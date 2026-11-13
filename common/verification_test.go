package common

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Password reset tokens must be redeemable exactly once, even under concurrent
// requests with the same link (OWASP ASVS V3.3 recovery code single use).
func TestConsumeVerificationCodeWithKey_SingleUse(t *testing.T) {
	key := "single-use@example.com"
	code := GenerateVerificationCode(32)
	RegisterVerificationCodeWithKey(key, code, PasswordResetPurpose)

	require.True(t, VerifyCodeWithKey(key, code, PasswordResetPurpose))
	require.True(t, ConsumeVerificationCodeWithKey(key, code, PasswordResetPurpose))

	// Replay after successful consumption must fail.
	assert.False(t, VerifyCodeWithKey(key, code, PasswordResetPurpose), "code must be deleted after consumption")
	assert.False(t, ConsumeVerificationCodeWithKey(key, code, PasswordResetPurpose), "second consumption must fail")
}

func TestConsumeVerificationCodeWithKey_WrongCodeNotConsumed(t *testing.T) {
	key := "wrong-code@example.com"
	code := GenerateVerificationCode(32)
	RegisterVerificationCodeWithKey(key, code, PasswordResetPurpose)

	assert.False(t, ConsumeVerificationCodeWithKey(key, "bad-token", PasswordResetPurpose))
	// A failed attempt must not consume the real code.
	assert.True(t, VerifyCodeWithKey(key, code, PasswordResetPurpose))
}

func TestConsumeVerificationCodeWithKey_ConcurrentRedeemOnce(t *testing.T) {
	key := "concurrent@example.com"
	code := GenerateVerificationCode(32)
	RegisterVerificationCodeWithKey(key, code, PasswordResetPurpose)

	const racers = 16
	results := make([]bool, racers)
	var wg sync.WaitGroup
	for i := range racers {
		wg.Go(func() {
			results[i] = ConsumeVerificationCodeWithKey(key, code, PasswordResetPurpose)
		})
	}
	wg.Wait()

	wins := 0
	for _, ok := range results {
		if ok {
			wins++
		}
	}
	assert.Equal(t, 1, wins, "exactly one concurrent redemption must succeed, got %d", wins)
	assert.False(t, VerifyCodeWithKey(key, code, PasswordResetPurpose))
}

func TestConsumeVerificationCodeWithKey_Expired(t *testing.T) {
	key := "expired@example.com"
	code := GenerateVerificationCode(32)
	RegisterVerificationCodeWithKey(key, code, PasswordResetPurpose)

	original := VerificationValidMinutes
	VerificationValidMinutes = 0
	t.Cleanup(func() { VerificationValidMinutes = original })

	assert.False(t, ConsumeVerificationCodeWithKey(key, code, PasswordResetPurpose), "expired code must fail")
}
