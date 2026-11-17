package model

import (
	"errors"
	"net"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// channelPrivateNetworkBackfillKey records that the one-time grant of the
// internal network permission to channels that already point at an internal
// upstream has run, so a restart does not scan the channel table again.
const channelPrivateNetworkBackfillKey = "ChannelPrivateNetworkBackfillV1"

// backfillChannelPrivateNetworkPermission grants the internal network
// permission to the channels that already point at an internal upstream.
//
// The outbound dialer used to log a warning for an internal literal address and
// connect anyway, so a channel created before the dial-time guard could reach an
// internal service while its stored allow_private_network stayed false. The
// guard now refuses such an address, and those channels would return
// "blocked internal network address" as soon as this release starts. The
// permission is exactly what a root account is granted today when it points a
// channel at an internal upstream (enforceChannelUpstreamPolicy), so the
// backfill restores the state the upgrade would otherwise silently revoke
// rather than widening anything: the destination was already reachable.
//
// Only a literal internal IP address is granted. Resolving a hostname here
// would block startup on DNS once per channel, and a name that resolves to an
// internal address keeps its stored settings untouched; those channels are
// reported so an operator can decide.
func backfillChannelPrivateNetworkPermission(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	var done Option
	err := db.Where(&Option{Key: channelPrivateNetworkBackfillKey}).First(&done).Error
	switch {
	case err == nil:
		return nil
	case !errors.Is(err, gorm.ErrRecordNotFound):
		return err
	}

	var channels []Channel
	if err := db.Select("id", "type", "base_url", "setting").Find(&channels).Error; err != nil {
		return err
	}

	granted := 0
	for _, channel := range channels {
		if !urlHasLiteralPrivateIP(channel.GetBaseURL()) {
			continue
		}
		// The stored settings are read as a map so a grant never drops a key
		// this build does not know about.
		settings := map[string]any{}
		if channel.Setting != nil && strings.TrimSpace(*channel.Setting) != "" {
			if err := common.UnmarshalJsonStr(*channel.Setting, &settings); err != nil {
				common.SysError(common.LogText("skip internal network backfill for channel %d: unreadable setting: %s", channel.Id, err.Error()))
				continue
			}
		}
		if allowed, _ := settings["allow_private_network"].(bool); allowed {
			continue
		}
		settings["allow_private_network"] = true
		encoded, err := common.Marshal(settings)
		if err != nil {
			common.SysError(common.LogText("skip internal network backfill for channel %d: marshal setting: %s", channel.Id, err.Error()))
			continue
		}
		// Only the setting column of this row is written, and only while it
		// still holds the value that was read, so a channel edited meanwhile is
		// left alone.
		query := db.Model(&Channel{}).Where("id = ?", channel.Id)
		if channel.Setting == nil {
			query = query.Where("setting IS NULL OR setting = ''")
		} else {
			query = query.Where("setting = ?", *channel.Setting)
		}
		result := query.Update("setting", string(encoded))
		if result.Error != nil {
			common.SysError(common.LogText("internal network backfill failed for channel %d: %s", channel.Id, result.Error.Error()))
			continue
		}
		if result.RowsAffected > 0 {
			granted++
		}
	}

	if err := db.Clauses(clause.OnConflict{DoNothing: true}).
		Create(&Option{Key: channelPrivateNetworkBackfillKey, Value: "done"}).Error; err != nil {
		return err
	}
	if granted > 0 {
		common.SysLog(common.LogText("granted the internal network permission to %d channel(s) that already pointed at an internal upstream", granted))
	}
	return nil
}

// urlHasLiteralPrivateIP reports whether the URL host is an internal IP address
// written as a literal. A hostname returns false: it is never resolved here.
func urlHasLiteralPrivateIP(rawURL string) bool {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return false
	}
	host := ""
	if parsed, err := url.Parse(rawURL); err == nil {
		host = parsed.Hostname()
	}
	if host == "" {
		// A base URL stored without a scheme, such as "10.1.2.3:8080".
		if h, _, err := net.SplitHostPort(rawURL); err == nil {
			host = h
		} else {
			host = rawURL
		}
	}
	ip := net.ParseIP(strings.Trim(host, "[]"))
	if ip == nil {
		// IsPrivateNetworkIP reports true for a nil address, so an unparsable
		// host has to be rejected before it is asked about.
		return false
	}
	return common.IsPrivateNetworkIP(ip)
}
