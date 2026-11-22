package common

import (
	"database/sql/driver"
	"fmt"
)

// SecretString is a string that is encrypted at rest and transparently
// decrypted when read back from the database.
//
// The in-memory value is always plaintext, so call sites behave exactly as they
// did with a plain string. Encryption happens only on the way into SQL, which
// avoids mutating structs the way a GORM BeforeSave hook does (a mutated struct
// leaked ciphertext into the channel key cache and reached upstream as a Bearer
// token).
//
// Legacy plaintext rows scan back unchanged, and a deployment without
// CRYPTO_SECRET/SESSION_SECRET keeps writing plaintext, so enabling this type is
// backward compatible in both directions.
type SecretString string

// NewSecretString wraps a plaintext value.
func NewSecretString(value string) SecretString {
	return SecretString(value)
}

// String returns the plaintext. It exists so secrets can be passed to APIs that
// require a string without an explicit conversion at every call site.
func (s SecretString) String() string {
	return string(s)
}

// Value implements driver.Valuer: it encrypts the plaintext for storage.
func (s SecretString) Value() (driver.Value, error) {
	if s == "" {
		return "", nil
	}
	encrypted, err := EncryptSecret(string(s))
	if err != nil {
		return nil, err
	}
	return encrypted, nil
}

// Scan implements sql.Scanner: it decrypts a stored envelope into plaintext and
// passes legacy plaintext through unchanged.
func (s *SecretString) Scan(value any) error {
	switch typed := value.(type) {
	case nil:
		*s = ""
		return nil
	case string:
		*s = SecretString(SecretValueFromStorage(typed, "secret column"))
		return nil
	case []byte:
		*s = SecretString(SecretValueFromStorage(string(typed), "secret column"))
		return nil
	default:
		return fmt.Errorf("secret string: cannot scan %T", value)
	}
}
