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
	CopilotStreamOptionKey        = "copilot_stream"
	CopilotEnabledToolsOptionKey  = "copilot_enabled_tools"
	// CopilotMasterControlOptionKey is the "master control" switch. While it is
	// on, every tool in the catalog is granted and the stored list is kept as
	// the operator left it, so switching the master off restores their choice.
	CopilotMasterControlOptionKey = "copilot_master_control"
	CopilotVisibilityOptionKey    = "copilot_visibility"
)

// Copilot visibility modes.
const (
	CopilotVisibilityAll           = "all"
	CopilotVisibilityDashboardOnly = "dashboard_only"
)

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

// CopilotStreamEnabled reports whether the chat request asks the configured
// provider to stream its completion. Unset or unparsable values mean off.
func CopilotStreamEnabled() bool {
	return CopilotOption(CopilotStreamOptionKey) == "true"
}

// CopilotStreamOptionValue renders the stored boolean for the settings API.
func CopilotStreamOptionValue(enabled bool) string {
	if enabled {
		return "true"
	}
	return "false"
}

// CopilotMasterControl reports whether the master control switch is on. While
// it is on, every tool is granted and the operator's stored list is ignored.
func CopilotMasterControl() bool {
	return CopilotOption(CopilotMasterControlOptionKey) == "true"
}

// CopilotMasterControlOptionValue renders the stored boolean for the settings
// API and the option validator.
func CopilotMasterControlOptionValue(enabled bool) string {
	if enabled {
		return "true"
	}
	return "false"
}

// CopilotStoredTools parses the operator's stored tool list. Missing or invalid
// values fall back to every known tool so an upgrade never silently disables
// tools.
func CopilotStoredTools() []string {
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

// CopilotEnabledTools returns the tools the server will actually accept: the
// whole catalog while the master control is on, otherwise the stored list.
func CopilotEnabledTools() []string {
	if CopilotMasterControl() {
		return append([]string(nil), CopilotToolNames...)
	}
	return CopilotStoredTools()
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

// CopilotToolEnabled reports whether one tool is granted right now. The master
// control and the stored list are both consulted here so the middleware, the
// chat runtime and the settings API cannot disagree.
func CopilotToolEnabled(name string) bool {
	if _, known := CopilotToolByName(name); !known {
		return false
	}
	if CopilotMasterControl() {
		return true
	}
	_, enabled := CopilotEnabledToolSet()[name]
	return enabled
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
	case CopilotStreamOptionKey:
		if value != "true" && value != "false" {
			return common.NewMessage("Copilot streaming must be true or false")
		}
	case CopilotVisibilityOptionKey:
		if value != CopilotVisibilityAll && value != CopilotVisibilityDashboardOnly {
			return common.NewMessage("Copilot visibility must be all or dashboard_only")
		}
	case CopilotMasterControlOptionKey:
		if value != "true" && value != "false" {
			return common.NewMessage("Copilot master control must be true or false")
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

// CopilotPermissionMap renders a tool list as the tool -> granted map the
// permissions API publishes. Every catalog tool appears, so a caller can read
// "off" from a missing name without knowing the catalog.
func CopilotPermissionMap(tools []string) map[string]bool {
	granted := make(map[string]bool, len(CopilotToolNames))
	for _, tool := range tools {
		granted[tool] = true
	}
	permissions := make(map[string]bool, len(CopilotToolNames))
	for _, tool := range CopilotToolNames {
		permissions[tool] = granted[tool]
	}
	return permissions
}

// CopilotToolsFromPermissionMap turns a tool -> granted map back into the stored
// list, in catalog order. A name the catalog does not know is refused rather
// than ignored: silently dropping it would let a client believe it granted a
// capability that does not exist.
func CopilotToolsFromPermissionMap(permissions map[string]bool) ([]string, error) {
	for name := range permissions {
		if _, known := CopilotToolByName(name); !known {
			return nil, common.NewMessage("unknown Copilot tool: " + name)
		}
	}
	enabled := make([]string, 0, len(CopilotToolNames))
	for _, tool := range CopilotToolNames {
		if permissions[tool] {
			enabled = append(enabled, tool)
		}
	}
	return enabled, nil
}
