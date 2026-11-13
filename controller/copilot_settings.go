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
		common.ApiErrorMsg(c, "Copilot base URL must be an absolute http(s) URL")
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
	tools := setting.NormalizeCopilotTools(request.EnabledTools)
	if len(tools) != len(dedupeStrings(request.EnabledTools)) {
		common.ApiErrorMsg(c, "Copilot tools contain unknown tool names")
		return
	}

	values := map[string]string{
		setting.CopilotBaseURLOptionKey:      baseURL,
		setting.CopilotModelOptionKey:        strings.TrimSpace(request.Model),
		setting.CopilotEnabledToolsOptionKey: setting.CopilotEnabledToolsToJSON(tools),
		setting.CopilotVisibilityOptionKey:   visibility,
	}
	if request.ClearAPIKey {
		values[setting.CopilotAPIKeyOptionKey] = ""
	} else if key := strings.TrimSpace(request.APIKey); key != "" {
		values[setting.CopilotAPIKeyOptionKey] = key
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
	baseURL := setting.NormalizeCopilotBaseURL(request.BaseURL)
	if baseURL == "" {
		baseURL = setting.CopilotOption(setting.CopilotBaseURLOptionKey)
	}
	if baseURL == "" {
		common.ApiErrorMsg(c, "Set a Copilot base URL before fetching models")
		return
	}
	if !setting.IsValidCopilotBaseURL(baseURL) {
		common.ApiErrorMsg(c, "Copilot base URL must be an absolute http(s) URL")
		return
	}
	apiKey := strings.TrimSpace(request.APIKey)
	if apiKey == "" {
		apiKey = setting.CopilotOption(setting.CopilotAPIKeyOptionKey)
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
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	ids := make([]string, 0)
	if err := common.Unmarshal(bytes.TrimSpace(body), &payload); err == nil && len(payload.Data) > 0 {
		for _, item := range payload.Data {
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
