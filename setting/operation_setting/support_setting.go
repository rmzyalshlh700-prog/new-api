package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// SupportSetting controls the user-facing support ticketing system.
type SupportSetting struct {
	// Enabled shows the support center to users and accepts new tickets.
	Enabled bool `json:"enabled"`
}

var supportSetting = SupportSetting{
	Enabled: true,
}

func init() {
	config.GlobalConfig.Register("support_setting", &supportSetting)
}

// GetSupportSetting returns the current support configuration.
func GetSupportSetting() *SupportSetting {
	return &supportSetting
}
