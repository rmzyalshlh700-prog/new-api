package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useSecretBoxKey(t *testing.T, secret string) {
	t.Helper()
	t.Setenv("CRYPTO_SECRET", secret)
	previous := CryptoSecret
	CryptoSecret = secret
	t.Cleanup(func() { CryptoSecret = previous })
}

func TestSecretBoxRoundTripUsesEnvelopeEncryption(t *testing.T) {
	useSecretBoxKey(t, "unit-test-crypto-secret")
	require.True(t, SecretBoxConfigured())

	encrypted, err := EncryptSecret("sk-plaintext-channel-key")
	require.NoError(t, err)
	assert.True(t, IsEncryptedSecret(encrypted))
	assert.NotContains(t, encrypted, "sk-plaintext")

	decrypted, err := DecryptSecret(encrypted)
	require.NoError(t, err)
	assert.Equal(t, "sk-plaintext-channel-key", decrypted)

	// A fresh data key per value means equal plaintext never yields equal
	// ciphertext, so the stored form leaks nothing about shared credentials.
	again, err := EncryptSecret("sk-plaintext-channel-key")
	require.NoError(t, err)
	assert.NotEqual(t, encrypted, again)
}

func TestSecretBoxLeavesLegacyPlaintextAndEmptyValuesAlone(t *testing.T) {
	useSecretBoxKey(t, "unit-test-crypto-secret")

	assert.Equal(t, "", SecretValueForStorage(""))
	assert.Equal(t, "legacy-plaintext", SecretValueFromStorage("legacy-plaintext", "test value"))
	encrypted := mustEncrypt(t, "already-encrypted")
	assert.Equal(t, encrypted, mustEncrypt(t, encrypted), "encrypting twice must not wrap the envelope again")
}

func mustEncrypt(t *testing.T, value string) string {
	t.Helper()
	encrypted, err := EncryptSecret(value)
	require.NoError(t, err)
	return encrypted
}

func TestSecretBoxRejectsCiphertextFromAnotherKey(t *testing.T) {
	useSecretBoxKey(t, "first-key")
	encrypted, err := EncryptSecret("sk-rotate-me")
	require.NoError(t, err)

	t.Setenv("CRYPTO_SECRET", "second-key")
	CryptoSecret = "second-key"

	_, err = DecryptSecret(encrypted)
	assert.ErrorIs(t, err, ErrSecretBoxKeyMismatch)
	// The raw value survives so an operator can re-enter it instead of the
	// gateway silently relaying a corrupted key upstream.
	assert.Equal(t, encrypted, SecretValueFromStorage(encrypted, "channel key"))
}

func TestSecretBoxStaysOffWithoutStableEnvironmentKey(t *testing.T) {
	t.Setenv("CRYPTO_SECRET", "")
	t.Setenv("SESSION_SECRET", "")
	previous := CryptoSecret
	CryptoSecret = "ephemeral-process-uuid"
	t.Cleanup(func() { CryptoSecret = previous })

	assert.False(t, SecretBoxConfigured())
	assert.Equal(t, "sk-stay-plaintext", SecretValueForStorage("sk-stay-plaintext"))
}
