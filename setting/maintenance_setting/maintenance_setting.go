package maintenance_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// MaintenanceSetting controls the global maintenance mode. It is persisted as
// the options table keys maintenance_setting.enabled, maintenance_setting.html
// and maintenance_setting.whitelist.
type MaintenanceSetting struct {
	// MaintenanceEnabled blocks the dashboard and API until maintenance ends.
	MaintenanceEnabled bool `json:"enabled"`
	// MaintenanceHTML is raw admin-authored HTML rendered on /maintenance.
	MaintenanceHTML string `json:"html"`
	// MaintenanceWhitelist holds comma-separated emails or usernames that keep
	// full access while maintenance mode is active.
	MaintenanceWhitelist string `json:"whitelist"`
}

var maintenanceSetting = MaintenanceSetting{}

func init() {
	config.GlobalConfig.Register("maintenance_setting", &maintenanceSetting)
}

// Get returns the live setting. Callers that read it while options may be
// updated concurrently must hold common.OptionMapRWMutex for reading.
func Get() *MaintenanceSetting {
	return &maintenanceSetting
}

// IsWhitelisted reports whether email or username appears in the configured
// whitelist. Matching is case-insensitive and ignores surrounding spaces.
func IsWhitelisted(email, username string) bool {
	email = strings.ToLower(strings.TrimSpace(email))
	username = strings.ToLower(strings.TrimSpace(username))
	for entry := range strings.FieldsFuncSeq(maintenanceSetting.MaintenanceWhitelist, func(r rune) bool {
		return r == ',' || r == ';' || r == '\n' || r == '\r'
	}) {
		entry = strings.ToLower(strings.TrimSpace(entry))
		if entry == "" {
			continue
		}
		if entry == email || entry == username {
			return true
		}
	}
	return false
}
