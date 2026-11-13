package setting

import (
	"net"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// Admin Copilot option keys. These live in the shared option map so they are
// persisted in the options table and picked up on startup like every other
// platform setting.
const (
	CopilotBaseURLOptionKey = "copilot_base_url"
	CopilotAPIKeyOptionKey  = "copilot_api_key"
	// CopilotAPIKeyBaseURLOptionKey records the base URL the stored API key was
	// entered for. The key is only ever sent to that host, so repointing
	// copilot_base_url cannot redirect the operator's credential elsewhere.
	CopilotAPIKeyBaseURLOptionKey = "copilot_api_key_base_url"
	CopilotModelOptionKey         = "copilot_model"
	CopilotEnabledToolsOptionKey  = "copilot_enabled_tools"
	CopilotVisibilityOptionKey    = "copilot_visibility"
)

// Copilot visibility modes.
const (
	CopilotVisibilityAll           = "all"
	CopilotVisibilityDashboardOnly = "dashboard_only"
)

// CopilotToolNames lists the frontend tools the admin Copilot can call. A tool
// may only reach the model when it is enabled in the Copilot settings.
var CopilotToolNames = []string{
	"getFinancialSummary",
	"lookupUser",
	"getSystemHealth",
}

// DefaultCopilotEnabledToolsJSON is the default permission set: every tool is
// enabled until an administrator narrows it down.
func DefaultCopilotEnabledToolsJSON() string {
	return CopilotEnabledToolsToJSON(CopilotToolNames)
}

// CopilotEnabledToolsToJSON encodes a tool name list for the option map.
func CopilotEnabledToolsToJSON(tools []string) string {
	encoded, err := common.Marshal(tools)
	if err != nil {
		return "[]"
	}
	return string(encoded)
}

// CopilotOption returns a Copilot option value from the in-memory option map.
func CopilotOption(key string) string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if common.OptionMap == nil {
		return ""
	}
	return strings.TrimSpace(common.OptionMap[key])
}

// CopilotAPIKeyBaseURL returns the base URL the stored API key is bound to. An
// empty value means the key predates host binding and may not be reused.
func CopilotAPIKeyBaseURL() string {
	return NormalizeCopilotBaseURL(CopilotOption(CopilotAPIKeyBaseURLOptionKey))
}

// CopilotEnabledTools parses the enabled tool list. Missing or invalid values
// fall back to every known tool so an upgrade never silently disables tools.
func CopilotEnabledTools() []string {
	raw := CopilotOption(CopilotEnabledToolsOptionKey)
	if raw == "" {
		return append([]string(nil), CopilotToolNames...)
	}
	var tools []string
	if err := common.Unmarshal([]byte(raw), &tools); err != nil {
		return append([]string(nil), CopilotToolNames...)
	}
	return NormalizeCopilotTools(tools)
}

// CopilotEnabledToolSet returns the enabled tools as a lookup set.
func CopilotEnabledToolSet() map[string]struct{} {
	tools := CopilotEnabledTools()
	set := make(map[string]struct{}, len(tools))
	for _, tool := range tools {
		set[tool] = struct{}{}
	}
	return set
}

// CopilotVisibility returns the effective visibility mode.
func CopilotVisibility() string {
	value := CopilotOption(CopilotVisibilityOptionKey)
	if value == CopilotVisibilityDashboardOnly {
		return CopilotVisibilityDashboardOnly
	}
	return CopilotVisibilityAll
}

// NormalizeCopilotTools keeps known tools only, in canonical order, removing
// duplicates and whitespace.
func NormalizeCopilotTools(tools []string) []string {
	requested := make(map[string]struct{}, len(tools))
	for _, tool := range tools {
		requested[strings.TrimSpace(tool)] = struct{}{}
	}
	normalized := make([]string, 0, len(CopilotToolNames))
	for _, tool := range CopilotToolNames {
		if _, ok := requested[tool]; ok {
			normalized = append(normalized, tool)
		}
	}
	return normalized
}

// NormalizeCopilotBaseURL trims whitespace and a trailing slash so endpoint
// paths can be appended without producing double slashes.
func NormalizeCopilotBaseURL(raw string) string {
	return strings.TrimRight(strings.TrimSpace(raw), "/")
}

// CopilotV1Endpoint builds an OpenAI-compatible endpoint path from a base URL,
// tolerating bases that already end in /v1.
func CopilotV1Endpoint(baseURL string, path string) string {
	base := NormalizeCopilotBaseURL(baseURL)
	path = strings.TrimLeft(path, "/")
	if strings.HasSuffix(strings.ToLower(base), "/v1") {
		return base + "/" + path
	}
	return base + "/v1/" + path
}

// IsValidCopilotBaseURL accepts an absolute https URL with a host. Plain http
// is rejected outside loopback because the Copilot API key travels as a bearer
// token on every request to this endpoint.
func IsValidCopilotBaseURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Host == "" {
		return false
	}
	switch parsed.Scheme {
	case "https":
		return true
	case "http":
		return isLoopbackCopilotHost(parsed.Hostname())
	default:
		return false
	}
}

// isLoopbackCopilotHost reports whether host is a local development address.
// Only there is cleartext http acceptable.
func isLoopbackCopilotHost(host string) bool {
	host = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// ValidateCopilotOption validates a Copilot option value before it is
// persisted. Unknown keys are ignored so callers can share this with the
// generic option validator.
func ValidateCopilotOption(key string, value string) error {
	switch key {
	case CopilotBaseURLOptionKey:
		if strings.TrimSpace(value) != "" && !IsValidCopilotBaseURL(value) {
			return common.NewMessage("Copilot base URL must be an absolute https URL (http is allowed only for localhost)")
		}
	case CopilotVisibilityOptionKey:
		if value != CopilotVisibilityAll && value != CopilotVisibilityDashboardOnly {
			return common.NewMessage("Copilot visibility must be all or dashboard_only")
		}
	case CopilotEnabledToolsOptionKey:
		var tools []string
		if err := common.Unmarshal([]byte(value), &tools); err != nil {
			return common.NewMessage("Copilot enabled tools must be a JSON array of tool names")
		}
		if len(NormalizeCopilotTools(tools)) != len(tools) {
			return common.NewMessage("Copilot enabled tools contain unknown or duplicate tool names")
		}
	}
	return nil
}
