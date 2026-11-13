package controller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// copilotSettingsResponse is the sanitized view of the Copilot configuration.
// The API key itself is never returned: admins only learn whether one is set.
type copilotSettingsResponse struct {
	BaseURL          string   `json:"base_url"`
	Model            string   `json:"model"`
	EnabledTools     []string `json:"enabled_tools"`
	Visibility       string   `json:"visibility"`
	APIKeyConfigured bool     `json:"api_key_configured"`
}

type updateCopilotSettingsRequest struct {
	BaseURL      string   `json:"base_url"`
	APIKey       string   `json:"api_key"`
	ClearAPIKey  bool     `json:"clear_api_key"`
	Model        string   `json:"model"`
	EnabledTools []string `json:"enabled_tools"`
	Visibility   string   `json:"visibility"`
}

// copilotAPIKeyForBaseURL resolves the API key to use for baseURL. The stored
// key is returned only when it was entered for exactly this URL. The second
// return value reports that a key is stored but belongs to another host (or has
// no recorded host at all), so callers can explain the failure instead of
// calling upstream unauthenticated.
func copilotAPIKeyForBaseURL(baseURL string) (apiKey string, unbound bool) {
	key := setting.CopilotOption(setting.CopilotAPIKeyOptionKey)
	if key == "" {
		return "", false
	}
	normalized := setting.NormalizeCopilotBaseURL(baseURL)
	if normalized == "" || setting.CopilotAPIKeyBaseURL() != normalized {
		return "", true
	}
	return key, false
}

func currentCopilotSettings() copilotSettingsResponse {
	return copilotSettingsResponse{
		BaseURL:          setting.CopilotOption(setting.CopilotBaseURLOptionKey),
		Model:            setting.CopilotOption(setting.CopilotModelOptionKey),
		EnabledTools:     setting.CopilotEnabledTools(),
		Visibility:       setting.CopilotVisibility(),
		APIKeyConfigured: setting.CopilotOption(setting.CopilotAPIKeyOptionKey) != "",
	}
}

// GetCopilotSettings returns the admin Copilot configuration.
func GetCopilotSettings(c *gin.Context) {
	common.ApiSuccess(c, currentCopilotSettings())
}

// copilotRuntimeSettings is the subset of the configuration the chat runtime
// needs. It is readable by every admin, not only those allowed into system
// settings: the operator's tool and visibility policy applies to all of them,
// and without it a restricted admin would be left with no tools at all. It
// deliberately carries no connection details.
type copilotRuntimeSettings struct {
	EnabledTools []string `json:"enabled_tools"`
	Visibility   string   `json:"visibility"`
}

// GetCopilotRuntimeSettings returns the tool permissions and visibility for
// the admin Copilot runtime.
func GetCopilotRuntimeSettings(c *gin.Context) {
	common.ApiSuccess(c, copilotRuntimeSettings{
		EnabledTools: setting.CopilotEnabledTools(),
		Visibility:   setting.CopilotVisibility(),
	})
}

// UpdateCopilotSettings persists the admin Copilot configuration atomically.
// An empty api_key leaves the stored key untouched; clear_api_key removes it.
func UpdateCopilotSettings(c *gin.Context) {
	var request updateCopilotSettingsRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	baseURL := setting.NormalizeCopilotBaseURL(request.BaseURL)
	if baseURL != "" && !setting.IsValidCopilotBaseURL(baseURL) {
		common.ApiErrorMsg(c, "Copilot base URL must be an absolute https URL (http is allowed only for localhost)")
		return
	}
	visibility := request.Visibility
	if visibility == "" {
		visibility = setting.CopilotVisibilityAll
	}
	if visibility != setting.CopilotVisibilityAll && visibility != setting.CopilotVisibilityDashboardOnly {
		common.ApiErrorMsg(c, "Copilot visibility must be all or dashboard_only")
		return
	}
	values := map[string]string{
		setting.CopilotBaseURLOptionKey:    baseURL,
		setting.CopilotModelOptionKey:      strings.TrimSpace(request.Model),
		setting.CopilotVisibilityOptionKey: visibility,
	}
	// An absent enabled_tools field means "leave the permissions alone"; only
	// an explicit array (including an empty one) rewrites the tool set.
	if request.EnabledTools != nil {
		tools := setting.NormalizeCopilotTools(request.EnabledTools)
		if len(tools) != len(dedupeStrings(request.EnabledTools)) {
			common.ApiErrorMsg(c, "Copilot tools contain unknown tool names")
			return
		}
		values[setting.CopilotEnabledToolsOptionKey] = setting.CopilotEnabledToolsToJSON(tools)
	}
	// The API key is bound to the base URL it was entered for. Saving a
	// different base URL while a key is stored would hand the operator's
	// credential to another host, so that transition needs a fresh key.
	previousBaseURL := setting.NormalizeCopilotBaseURL(setting.CopilotOption(setting.CopilotBaseURLOptionKey))
	storedKey := setting.CopilotOption(setting.CopilotAPIKeyOptionKey)
	newKey := strings.TrimSpace(request.APIKey)
	switch {
	case request.ClearAPIKey:
		values[setting.CopilotAPIKeyOptionKey] = ""
		values[setting.CopilotAPIKeyBaseURLOptionKey] = ""
	case newKey != "":
		values[setting.CopilotAPIKeyOptionKey] = newKey
		values[setting.CopilotAPIKeyBaseURLOptionKey] = baseURL
	case storedKey != "" && baseURL != previousBaseURL:
		common.ApiErrorMsg(c, "Changing the Copilot base URL requires entering a new API key, or clearing the saved key")
		return
	case storedKey != "" && baseURL != "" && setting.CopilotAPIKeyBaseURL() == "":
		// A key saved before host binding existed is bound to the base URL the
		// operator kept, so it can never follow a later change.
		values[setting.CopilotAPIKeyBaseURLOptionKey] = baseURL
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, currentCopilotSettings())
}

// dedupeStrings returns the unique trimmed values, preserving order.
func dedupeStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	unique := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		unique = append(unique, value)
	}
	return unique
}

type fetchCopilotModelsRequest struct {
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
}

// FetchCopilotModels proxies an OpenAI-compatible /v1/models listing so the
// browser never has to make a cross-origin request with the API key.
func FetchCopilotModels(c *gin.Context) {
	var request fetchCopilotModelsRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	configuredBaseURL := setting.NormalizeCopilotBaseURL(setting.CopilotOption(setting.CopilotBaseURLOptionKey))
	requestedBaseURL := setting.NormalizeCopilotBaseURL(request.BaseURL)
	baseURL := requestedBaseURL
	if baseURL == "" {
		baseURL = configuredBaseURL
	}
	if baseURL == "" {
		common.ApiErrorMsg(c, "Set a Copilot base URL before fetching models")
		return
	}
	if !setting.IsValidCopilotBaseURL(baseURL) {
		common.ApiErrorMsg(c, "Copilot base URL must be an absolute https URL (http is allowed only for localhost)")
		return
	}

	apiKey := strings.TrimSpace(request.APIKey)
	if apiKey == "" {
		// A caller-supplied host must bring its own credential: the stored key
		// belongs to the configured host and is never sent anywhere else.
		if requestedBaseURL != "" && requestedBaseURL != configuredBaseURL {
			common.ApiErrorMsg(c, "An API key is required when fetching models from a different base URL")
			return
		}
		storedKey, unbound := copilotAPIKeyForBaseURL(baseURL)
		if unbound {
			common.ApiErrorMsg(c, "The saved Copilot API key is bound to a different base URL. Re-enter the key in the Copilot settings")
			return
		}
		apiKey = storedKey
	}

	endpoint := setting.CopilotV1Endpoint(baseURL, "models")
	if err := service.ValidateSSRFProtectedFetchURL(endpoint); err != nil {
		common.ApiError(c, err)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		common.ApiErrorMsg(c, "Failed to build the models request")
		return
	}
	httpRequest.Header.Set("Accept", "application/json")
	if apiKey != "" {
		httpRequest.Header.Set("Authorization", "Bearer "+apiKey)
	}

	protectedClient := *service.GetSSRFProtectedHTTPClient()
	protectedClient.Timeout = 30 * time.Second
	response, err := protectedClient.Do(httpRequest)
	if err != nil {
		common.ApiErrorT(c, "Failed to fetch models: {{error}}", map[string]any{"error": err.Error()})
		return
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 4<<20))
	if err != nil {
		common.ApiErrorMsg(c, "Failed to read the models response")
		return
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message := strings.TrimSpace(string(body))
		if len(message) > 300 {
			message = message[:300] + "..."
		}
		if message == "" {
			message = response.Status
		}
		common.ApiErrorT(c, "Upstream rejected the models request ({{status}}): {{error}}", map[string]any{
			"status": response.StatusCode,
			"error":  message,
		})
		return
	}

	models, err := parseCopilotModelIDs(body)
	if err != nil {
		common.ApiErrorMsg(c, "The upstream response is not an OpenAI-compatible model list")
		return
	}
	common.ApiSuccess(c, models)
}

// parseCopilotModelIDs accepts either the OpenAI {"data":[{"id":...}]} shape or
// a bare array of ids and returns a sorted, de-duplicated list.
func parseCopilotModelIDs(body []byte) ([]string, error) {
	var payload struct {
		Data *[]struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	ids := make([]string, 0)
	// A present data array is authoritative even when empty: a compatible
	// provider with no models answers {"data":[]}, which is a valid empty list.
	if err := common.Unmarshal(bytes.TrimSpace(body), &payload); err == nil && payload.Data != nil {
		for _, item := range *payload.Data {
			ids = append(ids, item.ID)
		}
	} else {
		var plain []string
		if err := common.Unmarshal(bytes.TrimSpace(body), &plain); err != nil {
			return nil, fmt.Errorf("unexpected models payload")
		}
		ids = plain
	}
	seen := make(map[string]struct{}, len(ids))
	models := make([]string, 0, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		models = append(models, id)
	}
	sort.Strings(models)
	return models, nil
}
