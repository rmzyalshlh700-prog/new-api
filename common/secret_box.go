package common

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"strings"
	"sync"
)

// SecretBoxPrefix marks a value that was encrypted by this package. Anything
// without the prefix is treated as legacy plaintext and returned unchanged, so
// rows written before encryption was enabled keep working.
const SecretBoxPrefix = "enc:v1:"

// secretBoxSalt domain-separates the key-encryption key from any other use of
// CryptoSecret (session signing, auth-cache HMAC).
const secretBoxSalt = "new-api/secret-box/v1"

var (
	ErrSecretBoxNotConfigured = errors.New("secret box is not configured: set CRYPTO_SECRET or SESSION_SECRET")
	ErrSecretBoxMalformed     = errors.New("secret box value is malformed")
	ErrSecretBoxKeyMismatch   = errors.New("secret box value cannot be decrypted with the current CRYPTO_SECRET")

	secretBoxWarningOnce sync.Once
)

// SecretBoxConfigured reports whether a stable key is available.
//
// CryptoSecret falls back to a random per-process UUID when neither
// CRYPTO_SECRET nor SESSION_SECRET is set. Encrypting with that ephemeral value
// would make every stored secret unreadable after a restart, so encryption stays
// off and values remain plaintext until a stable key is configured.
func SecretBoxConfigured() bool {
	if os.Getenv("CRYPTO_SECRET") != "" || os.Getenv("SESSION_SECRET") != "" {
		return CryptoSecret != ""
	}
	return false
}

// IsEncryptedSecret reports whether value carries the secret-box envelope.
func IsEncryptedSecret(value string) bool {
	return strings.HasPrefix(value, SecretBoxPrefix)
}

// EncryptSecret wraps plaintext in an envelope: a fresh data key encrypts the
// value, and the data key is itself encrypted with the CRYPTO_SECRET-derived
// key-encryption key. Empty values, already-encrypted values and calls made
// while no stable key is configured are returned unchanged.
func EncryptSecret(plaintext string) (string, error) {
	if plaintext == "" || IsEncryptedSecret(plaintext) {
		return plaintext, nil
	}
	if !SecretBoxConfigured() {
		// No stable key: stay on the legacy plaintext representation instead of
		// failing writes or encrypting with a key that dies with the process.
		warnSecretBoxDisabled()
		return plaintext, nil
	}
	kek, err := secretBoxKEK()
	if err != nil {
		return "", err
	}
	dataKey := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, dataKey); err != nil {
		return "", err
	}
	wrappedKey, err := sealGCM(kek, dataKey)
	if err != nil {
		return "", err
	}
	payload, err := sealGCM(dataKey, []byte(plaintext))
	if err != nil {
		return "", err
	}
	return SecretBoxPrefix +
		base64.RawURLEncoding.EncodeToString(wrappedKey) + "." +
		base64.RawURLEncoding.EncodeToString(payload), nil
}

// DecryptSecret reverses EncryptSecret. Plaintext without the envelope prefix
// is returned unchanged so legacy rows keep working without a migration.
func DecryptSecret(stored string) (string, error) {
	if stored == "" || !IsEncryptedSecret(stored) {
		return stored, nil
	}
	kek, err := secretBoxKEK()
	if err != nil {
		return "", err
	}
	parts := strings.Split(strings.TrimPrefix(stored, SecretBoxPrefix), ".")
	if len(parts) != 2 {
		return "", ErrSecretBoxMalformed
	}
	wrappedKey, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return "", ErrSecretBoxMalformed
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", ErrSecretBoxMalformed
	}
	dataKey, err := openGCM(kek, wrappedKey)
	if err != nil {
		return "", ErrSecretBoxKeyMismatch
	}
	plaintext, err := openGCM(dataKey, payload)
	if err != nil {
		return "", ErrSecretBoxKeyMismatch
	}
	return string(plaintext), nil
}

// SecretValueForStorage encrypts value when it is sensitive and a stable key is
// configured. When the key is missing the value is stored as-is and a one-time
// warning is emitted, so an unconfigured deployment behaves exactly as before.
func SecretValueForStorage(value string) string {
	if value == "" || IsEncryptedSecret(value) {
		return value
	}
	if !SecretBoxConfigured() {
		warnSecretBoxDisabled()
		return value
	}
	encrypted, err := EncryptSecret(value)
	if err != nil {
		SysLog(LogText("failed to encrypt a stored secret, writing plaintext: %s", err.Error()))
		return value
	}
	return encrypted
}

// SecretValueFromStorage decrypts a stored value, leaving legacy plaintext and
// values that cannot be decrypted (for example after a key rotation) untouched
// so the caller sees a diagnostic instead of silently using wrong bytes.
func SecretValueFromStorage(value, label string) string {
	if !IsEncryptedSecret(value) {
		return value
	}
	if !SecretBoxConfigured() {
		warnSecretBoxDisabled()
		return value
	}
	decrypted, err := DecryptSecret(value)
	if err != nil {
		SysLog(LogText("failed to decrypt %s: %s", label, err.Error()))
		return value
	}
	return decrypted
}

func warnSecretBoxDisabled() {
	secretBoxWarningOnce.Do(func() {
		SysLog(LogText("secret encryption is disabled because neither CRYPTO_SECRET nor SESSION_SECRET is set; sensitive database fields stay plaintext"))
	})
}

func secretBoxKEK() ([]byte, error) {
	if !SecretBoxConfigured() {
		return nil, ErrSecretBoxNotConfigured
	}
	key, err := hkdf.Key(sha256.New, []byte(CryptoSecret), []byte(secretBoxSalt), "aes-256-gcm", 32)
	if err != nil {
		return nil, err
	}
	return key, nil
}

func sealGCM(key, plaintext []byte) ([]byte, error) {
	aead, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return aead.Seal(nonce, nonce, plaintext, nil), nil
}

func openGCM(key, sealed []byte) ([]byte, error) {
	aead, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	if len(sealed) < aead.NonceSize() {
		return nil, ErrSecretBoxMalformed
	}
	return aead.Open(nil, sealed[:aead.NonceSize()], sealed[aead.NonceSize():], nil)
}

func newGCM(key []byte) (cipher.AEAD, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
