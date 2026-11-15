package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// sensitiveOptionKeys are the option rows that hold a credential rather than
// configuration. Their values are encrypted at rest and decrypted when loaded.
var sensitiveOptionKeys = map[string]struct{}{
	"copilot_api_key":     {},
	"ResendApiKey":        {},
	"GitHubClientSecret":  {},
	"LinuxDOClientSecret": {},
	"OIDCClientSecret":    {},
	"WeChatClientSecret":  {},
	"TelegramBotToken":    {},
	"SMTPPassword":        {},
}

// IsSensitiveOptionKey reports whether an option row stores a credential.
func IsSensitiveOptionKey(key string) bool {
	_, ok := sensitiveOptionKeys[key]
	return ok
}

// BeforeSave encrypts a channel key before it reaches the database. Values that
// are already encrypted and legacy plaintext handling are idempotent.
func (channel *Channel) BeforeSave(_ *gorm.DB) error {
	encrypted, err := common.EncryptSecret(channel.Key)
	if err != nil {
		return err
	}
	channel.Key = encrypted
	return nil
}

// AfterFind decrypts a stored channel key in memory. Relay code therefore keeps
// receiving plaintext keys without changing any call site.
func (channel *Channel) AfterFind(_ *gorm.DB) error {
	channel.Key = common.SecretValueFromStorage(channel.Key, "channel key")
	return nil
}

func (provider *CustomOAuthProvider) BeforeSave(_ *gorm.DB) error {
	encrypted, err := common.EncryptSecret(provider.ClientSecret)
	if err != nil {
		return err
	}
	provider.ClientSecret = encrypted
	return nil
}

func (provider *CustomOAuthProvider) AfterFind(_ *gorm.DB) error {
	provider.ClientSecret = common.SecretValueFromStorage(provider.ClientSecret, "oauth client secret")
	return nil
}

func (option *Option) BeforeSave(_ *gorm.DB) error {
	if !IsSensitiveOptionKey(option.Key) {
		return nil
	}
	option.Value = common.SecretValueForStorage(option.Value)
	return nil
}

func (option *Option) AfterFind(_ *gorm.DB) error {
	if !IsSensitiveOptionKey(option.Key) {
		return nil
	}
	option.Value = common.SecretValueFromStorage(option.Value, "option "+option.Key)
	return nil
}

// EncryptPlaintextSecrets encrypts credentials that predate encryption. It is
// idempotent: rows already carrying the envelope are skipped, and it does
// nothing while no stable key is configured.
func EncryptPlaintextSecrets() {
	if !common.SecretBoxConfigured() {
		common.SysLog(common.LogText("skipping secret encryption migration: CRYPTO_SECRET and SESSION_SECRET are unset"))
		return
	}
	var channels int
	var channelRows []struct {
		Id  int
		Key string
	}
	if err := DB.Session(&gorm.Session{SkipHooks: true}).Table("channels").Select("id, key").Scan(&channelRows).Error; err != nil {
		common.SysError(common.LogText("failed to read channel keys for encryption: %s", err.Error()))
	} else {
		for _, row := range channelRows {
			if row.Key == "" || common.IsEncryptedSecret(row.Key) {
				continue
			}
			encrypted, err := common.EncryptSecret(row.Key)
			if err != nil {
				common.SysError(common.LogText("failed to encrypt channel %d key: %s", row.Id, err.Error()))
				continue
			}
			if err := DB.Session(&gorm.Session{SkipHooks: true}).Table("channels").Where("id = ?", row.Id).Update("key", encrypted).Error; err != nil {
				common.SysError(common.LogText("failed to store encrypted channel %d key: %s", row.Id, err.Error()))
				continue
			}
			channels++
		}
	}

	var oauthProviders int
	var oauthRows []struct {
		Id           int
		ClientSecret string
	}
	if err := DB.Session(&gorm.Session{SkipHooks: true}).Table("custom_o_auth_providers").Select("id, client_secret").Scan(&oauthRows).Error; err != nil {
		common.SysError(common.LogText("failed to read oauth client secrets for encryption: %s", err.Error()))
	} else {
		for _, row := range oauthRows {
			if row.ClientSecret == "" || common.IsEncryptedSecret(row.ClientSecret) {
				continue
			}
			encrypted, err := common.EncryptSecret(row.ClientSecret)
			if err != nil {
				common.SysError(common.LogText("failed to encrypt oauth provider %d secret: %s", row.Id, err.Error()))
				continue
			}
			if err := DB.Session(&gorm.Session{SkipHooks: true}).Table("custom_o_auth_providers").Where("id = ?", row.Id).Update("client_secret", encrypted).Error; err != nil {
				common.SysError(common.LogText("failed to store encrypted oauth provider %d secret: %s", row.Id, err.Error()))
				continue
			}
			oauthProviders++
		}
	}

	var options int
	var optionRows []struct {
		Key   string
		Value string
	}
	if err := DB.Session(&gorm.Session{SkipHooks: true}).Table("options").Select("key, value").Scan(&optionRows).Error; err != nil {
		common.SysError(common.LogText("failed to read options for encryption: %s", err.Error()))
	} else {
		for _, row := range optionRows {
			if !IsSensitiveOptionKey(row.Key) || row.Value == "" || common.IsEncryptedSecret(row.Value) {
				continue
			}
			encrypted, err := common.EncryptSecret(row.Value)
			if err != nil {
				common.SysError(common.LogText("failed to encrypt option %s: %s", row.Key, err.Error()))
				continue
			}
			if err := DB.Session(&gorm.Session{SkipHooks: true}).Table("options").Where("key = ?", row.Key).Update("value", encrypted).Error; err != nil {
				common.SysError(common.LogText("failed to store encrypted option %s: %s", row.Key, err.Error()))
				continue
			}
			options++
		}
	}

	if channels+oauthProviders+options > 0 {
		common.SysLog(common.LogText("encrypted secrets at rest: %d channel keys, %d oauth client secrets, %d options", channels, oauthProviders, options))
	}
}

// DecryptStoredSecret is exposed for call sites that read a secret through raw
// SQL and therefore bypass the GORM hooks.
func DecryptStoredSecret(value, label string) string {
	return common.SecretValueFromStorage(strings.TrimSpace(value), label)
}
