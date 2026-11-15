package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func storedChannelKey(t *testing.T, id int) string {
	t.Helper()
	var row struct{ Key string }
	require.NoError(t, DB.Session(&gorm.Session{SkipHooks: true}).Model(&Channel{}).Select("key").Where("id = ?", id).Take(&row).Error)
	return row.Key
}

func TestChannelKeyIsEncryptedAtRest(t *testing.T) {
	require.NoError(t, DB.AutoMigrate(&Channel{}))

	t.Run("a configured key stores an envelope and loads plaintext", func(t *testing.T) {
		t.Setenv("SESSION_SECRET", "")
		t.Setenv("CRYPTO_SECRET", "pilot-test-secret")
		channel := Channel{Name: "encrypted-key", Key: "sk-plain-123"}
		require.NoError(t, DB.Create(&channel).Error)

		assert.True(t, common.IsEncryptedSecret(storedChannelKey(t, channel.Id)), "the column must hold an enc:v1: envelope")

		var reloaded Channel
		require.NoError(t, DB.First(&reloaded, channel.Id).Error)
		assert.Equal(t, "sk-plain-123", reloaded.Key.String())
	})

	t.Run("legacy plaintext rows keep loading", func(t *testing.T) {
		t.Setenv("CRYPTO_SECRET", "pilot-test-secret")
		require.NoError(t, DB.Exec("INSERT INTO channels (name, key, status) VALUES (?, ?, ?)", "legacy-key", "sk-legacy-456", common.ChannelStatusEnabled).Error)
		var legacy Channel
		require.NoError(t, DB.Where("name = ?", "legacy-key").First(&legacy).Error)
		assert.Equal(t, "sk-legacy-456", legacy.Key.String())
	})

	t.Run("without a stable key the column stays plaintext", func(t *testing.T) {
		t.Setenv("CRYPTO_SECRET", "")
		t.Setenv("SESSION_SECRET", "")
		channel := Channel{Name: "plaintext-key", Key: "sk-plain-789"}
		require.NoError(t, DB.Create(&channel).Error)
		assert.Equal(t, "sk-plain-789", storedChannelKey(t, channel.Id))
	})
}
