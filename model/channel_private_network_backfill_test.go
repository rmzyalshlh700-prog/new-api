package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func backfillTestChannel(t *testing.T, baseURL, setting string) *Channel {
	t.Helper()
	channel := &Channel{
		Type:    1,
		Key:     common.SecretString("sk-backfill"),
		Status:  common.ChannelStatusEnabled,
		Name:    "backfill",
		Models:  "gpt-4o",
		Group:   "default",
		BaseURL: &baseURL,
	}
	if setting != "" {
		channel.Setting = &setting
	}
	require.NoError(t, DB.Create(channel).Error)
	t.Cleanup(func() { DB.Unscoped().Delete(&Channel{}, channel.Id) })
	return channel
}

func reloadedBackfillChannel(t *testing.T, id int) *Channel {
	t.Helper()
	var stored Channel
	require.NoError(t, DB.First(&stored, id).Error)
	return &stored
}

func storedBackfillSetting(t *testing.T, id int) map[string]any {
	t.Helper()
	stored := reloadedBackfillChannel(t, id)
	settings := map[string]any{}
	if stored.Setting != nil && *stored.Setting != "" {
		require.NoError(t, common.UnmarshalJsonStr(*stored.Setting, &settings))
	}
	return settings
}

func TestBackfillGrantsInternalChannelsOnly(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Channel{}, &Option{}))
	require.NoError(t, DB.Where(&Option{Key: channelPrivateNetworkBackfillKey}).Delete(&Option{}).Error)
	t.Cleanup(func() { DB.Where(&Option{Key: channelPrivateNetworkBackfillKey}).Delete(&Option{}) })

	internal := backfillTestChannel(t, "http://127.0.0.1:11434", `{"task_plugin_key":"keep-me"}`)
	private := backfillTestChannel(t, "http://10.1.2.3:8000/v1", "")
	noScheme := backfillTestChannel(t, "192.168.1.9:8080", "")
	ipv6 := backfillTestChannel(t, "http://[::1]:9000", "")
	public := backfillTestChannel(t, "https://api.openai.com", "")
	hostname := backfillTestChannel(t, "http://ollama.internal:11434", "")
	already := backfillTestChannel(t, "http://10.9.9.9:80", `{"allow_private_network":true}`)

	require.NoError(t, backfillChannelPrivateNetworkPermission(DB))

	for _, channel := range []*Channel{internal, private, noScheme, ipv6} {
		settings := storedBackfillSetting(t, channel.Id)
		assert.Equal(t, true, settings["allow_private_network"], "channel %d must be granted", channel.Id)
	}
	// A grant must not drop a setting key this build does not write.
	assert.Equal(t, "keep-me", storedBackfillSetting(t, internal.Id)["task_plugin_key"])

	for _, channel := range []*Channel{public, hostname} {
		assert.NotContains(t, storedBackfillSetting(t, channel.Id), "allow_private_network",
			"channel %d must be left alone", channel.Id)
	}
	// A channel without any stored setting keeps none: the public one is the
	// control, and an already authorized channel keeps its JSON.
	assert.Nil(t, reloadedBackfillChannel(t, public.Id).Setting)
	assert.Equal(t, true, storedBackfillSetting(t, already.Id)["allow_private_network"])
}

func TestBackfillRunsOnceAndIsIdempotent(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Channel{}, &Option{}))
	require.NoError(t, DB.Where(&Option{Key: channelPrivateNetworkBackfillKey}).Delete(&Option{}).Error)
	t.Cleanup(func() { DB.Where(&Option{Key: channelPrivateNetworkBackfillKey}).Delete(&Option{}) })

	channel := backfillTestChannel(t, "http://172.16.0.9:2375", "")
	require.NoError(t, backfillChannelPrivateNetworkPermission(DB))

	var marker Option
	require.NoError(t, DB.Where(&Option{Key: channelPrivateNetworkBackfillKey}).First(&marker).Error)
	first := reloadedBackfillChannel(t, channel.Id).Setting
	require.NotNil(t, first)

	// A channel created afterwards must not be rewritten by a repeat run: the
	// marker is what makes this a one-time migration rather than a policy that
	// hides a missing grant on every start.
	late := backfillTestChannel(t, "http://10.5.5.5:80", "")
	require.NoError(t, backfillChannelPrivateNetworkPermission(DB))

	assert.Equal(t, *first, *reloadedBackfillChannel(t, channel.Id).Setting)
	assert.Nil(t, reloadedBackfillChannel(t, late.Id).Setting)
}
