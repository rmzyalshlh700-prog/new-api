package controller

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupNowPaymentsWebhookDB backs the endpoint tests with an in-memory sqlite
// database holding the tables the recharge path touches.
func setupNowPaymentsWebhookDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousRedis := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.Log{}))
	model.DB, model.LOG_DB = db, db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.RedisEnabled = previousRedis
	})
	return db
}

func insertNowPaymentsOrder(t *testing.T, db *gorm.DB, userId int, tradeNo string, money float64) {
	t.Helper()
	user := &model.User{
		Id:       userId,
		Username: "np_webhook_user_" + tradeNo,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, db.Create(user).Error)
	topUp := &model.TopUp{
		UserId:          userId,
		Amount:          2,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodNowPayments,
		PaymentProvider: model.PaymentProviderNowPayments,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, db.Create(topUp).Error)
}

func getNowPaymentsUserQuota(t *testing.T, db *gorm.DB, userId int) int {
	t.Helper()
	var user model.User
	require.NoError(t, db.Where("id = ?", userId).First(&user).Error)
	return user.Quota
}

// postNowPaymentsWebhook sends a signed or unsigned IPN request through the
// gin handler to assert endpoint-level behavior.
func postNowPaymentsWebhook(t *testing.T, body string, signature string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/webhooks/nowpayments", NowPaymentsWebhook)
	req := httptest.NewRequest(http.MethodPost, "/api/webhooks/nowpayments", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if signature != "" {
		req.Header.Set("x-nowpayments-sig", signature)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestNowPaymentsWebhookEndpoint(t *testing.T) {
	originalApiKey := setting.NowPaymentsApiKey
	originalIpnSecret := setting.NowPaymentsIpnSecret
	confirmPaymentComplianceForTest(t)
	t.Cleanup(func() {
		setting.NowPaymentsApiKey = originalApiKey
		setting.NowPaymentsIpnSecret = originalIpnSecret
	})
	setting.NowPaymentsApiKey = "test-api-key"
	setting.NowPaymentsIpnSecret = "test-ipn-secret"

	secret := setting.NowPaymentsIpnSecret
	sign := func(payload string) string {
		return computeExpectedNowPaymentsSig(t, secret, nowPaymentsSortedValuesString(mustParseJson(t, payload)))
	}

	t.Run("finished callback credits quota atomically", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 7, "np_order_finished", 20)
		payload := `{"payment_id":1,"payment_status":"finished","order_id":"np_order_finished","pay_amount":0.5,"actually_paid":0.5}`
		rec := postNowPaymentsWebhook(t, payload, sign(payload))
		require.Equal(t, http.StatusOK, rec.Code)

		topUp := model.GetTopUpByTradeNo("np_order_finished")
		require.NotNil(t, topUp)
		assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
		assert.Equal(t, 20*int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 7))
	})

	t.Run("duplicate finished callback is idempotent", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 8, "np_order_dup", 20)
		payload := `{"payment_id":2,"payment_status":"finished","order_id":"np_order_dup","pay_amount":0.5,"actually_paid":0.5}`
		for range 2 {
			rec := postNowPaymentsWebhook(t, payload, sign(payload))
			require.Equal(t, http.StatusOK, rec.Code)
		}
		assert.Equal(t, 20*int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 8))
	})

	t.Run("partially paid credits proportional quota", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 9, "np_order_partial", 20)
		payload := `{"payment_id":3,"payment_status":"partially_paid","order_id":"np_order_partial","pay_amount":0.5,"actually_paid":0.25}`
		rec := postNowPaymentsWebhook(t, payload, sign(payload))
		require.Equal(t, http.StatusOK, rec.Code)
		assert.Equal(t, 10*int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 9))
	})

	t.Run("invalid signature rejected with 401", func(t *testing.T) {
		payload := `{"payment_id":1,"payment_status":"finished","order_id":"np_x"}`
		rec := postNowPaymentsWebhook(t, payload, "deadbeef")
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("missing signature rejected with 401", func(t *testing.T) {
		payload := `{"payment_id":1,"payment_status":"finished","order_id":"np_x"}`
		rec := postNowPaymentsWebhook(t, payload, "")
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("malformed payload rejected", func(t *testing.T) {
		// Signature verification runs over the values of valid JSON only, so
		// an invalid body must fail verification before parsing is trusted.
		rec := postNowPaymentsWebhook(t, `{broken`, "deadbeef")
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("ignored statuses still return 200", func(t *testing.T) {
		payload := `{"payment_id":1,"payment_status":"waiting","order_id":"np_x"}`
		rec := postNowPaymentsWebhook(t, payload, sign(payload))
		require.Equal(t, http.StatusOK, rec.Code)
	})

	t.Run("webhook disabled returns 403", func(t *testing.T) {
		setting.NowPaymentsApiKey = ""
		payload := `{"payment_id":1,"payment_status":"finished","order_id":"np_x"}`
		rec := postNowPaymentsWebhook(t, payload, sign(payload))
		require.Equal(t, http.StatusForbidden, rec.Code)
	})
}

func mustParseJson(t *testing.T, payload string) map[string]any {
	t.Helper()
	var body map[string]any
	require.NoError(t, common.Unmarshal([]byte(payload), &body))
	return body
}

func TestNowPaymentsWebhookEnabled(t *testing.T) {
	originalApiKey := setting.NowPaymentsApiKey
	originalIpnSecret := setting.NowPaymentsIpnSecret
	confirmPaymentComplianceForTest(t)
	t.Cleanup(func() {
		setting.NowPaymentsApiKey = originalApiKey
		setting.NowPaymentsIpnSecret = originalIpnSecret
	})

	setting.NowPaymentsApiKey = "key"
	setting.NowPaymentsIpnSecret = "secret"
	assert.True(t, isNowPaymentsTopUpEnabled())
	assert.True(t, isNowPaymentsWebhookEnabled())

	setting.NowPaymentsIpnSecret = ""
	assert.False(t, isNowPaymentsTopUpEnabled())
}

// computeExpectedNowPaymentsSig builds the expected signature by hand,
// following the documented NOWPayments convention independently of the
// implementation under test: sort top-level keys alphabetically, concatenate
// their values in sorted order, HMAC-SHA512 with the IPN secret.
func computeExpectedNowPaymentsSig(t *testing.T, secret string, payload string) string {
	t.Helper()
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyNowPaymentsSignature(t *testing.T) {
	secret := "test-ipn-secret"
	// Values in unsorted key order in the payload; the signature is computed
	// over the values sorted alphabetically by key: actually_paid,
	// payment_id, payment_status.
	payload := []byte(`{"payment_id":123,"payment_status":"finished","actually_paid":10.5}`)

	validSig := computeExpectedNowPaymentsSig(t, secret, "10.5123finished")

	t.Run("valid signature accepted", func(t *testing.T) {
		assert.True(t, VerifyNowPaymentsSignature(payload, validSig, secret))
	})

	t.Run("whitespace around header accepted case-insensitively", func(t *testing.T) {
		assert.True(t, VerifyNowPaymentsSignature(payload, "  "+validSig+" ", secret))
	})

	t.Run("tampered payload rejected", func(t *testing.T) {
		tampered := []byte(`{"payment_id":124,"payment_status":"finished","actually_paid":10.5}`)
		assert.False(t, VerifyNowPaymentsSignature(tampered, validSig, secret))
	})

	t.Run("wrong secret rejected", func(t *testing.T) {
		assert.False(t, VerifyNowPaymentsSignature(payload, validSig, "other-secret"))
	})

	t.Run("missing or empty inputs rejected", func(t *testing.T) {
		assert.False(t, VerifyNowPaymentsSignature(payload, "", secret))
		assert.False(t, VerifyNowPaymentsSignature(payload, validSig, ""))
		assert.False(t, VerifyNowPaymentsSignature(payload, "", ""))
	})

	t.Run("invalid json rejected", func(t *testing.T) {
		assert.False(t, VerifyNowPaymentsSignature([]byte(`{not json`), validSig, secret))
	})

	t.Run("unsorted key order in payload does not change signature", func(t *testing.T) {
		resorted := []byte(`{"actually_paid":10.5,"payment_status":"finished","payment_id":123}`)
		expectedSig := computeExpectedNowPaymentsSig(t, secret, "10.5123finished")
		assert.True(t, VerifyNowPaymentsSignature(resorted, expectedSig, secret))
	})

	t.Run("nested object values sorted recursively", func(t *testing.T) {
		nested := []byte(`{"payment_id":1,"metadata":{"zeta":"z","alpha":"a"}}`)
		// Sorted: metadata(alpha,z) then payment_id → "az" + "1"
		expectedSig := computeExpectedNowPaymentsSig(t, secret, "az1")
		assert.True(t, VerifyNowPaymentsSignature(nested, expectedSig, secret))
	})

	t.Run("boolean and string values concatenated as-is", func(t *testing.T) {
		mixed := []byte(`{"payment_status":"finished","refund":false,"order_id":"np_abc"}`)
		expectedSig := computeExpectedNowPaymentsSig(t, secret, "np_abcfinishedfalse")
		assert.True(t, VerifyNowPaymentsSignature(mixed, expectedSig, secret))
	})

	t.Run("string concatenation is unseparated", func(t *testing.T) {
		// 12finished1 ≠ 1finished12: the concatenation order matters, values
		// are joined with no separators.
		payloadA := []byte(`{"payment_id":12,"payment_status":"finished","invoice_id":1}`)
		payloadB := []byte(`{"payment_id":1,"payment_status":"finished","invoice_id":12}`)
		// Sorted keys: invoice_id, payment_id, payment_status.
		sigA := computeExpectedNowPaymentsSig(t, secret, "112finished")
		sigB := computeExpectedNowPaymentsSig(t, secret, "121finished")
		require.NotEqual(t, sigA, sigB)
		assert.True(t, VerifyNowPaymentsSignature(payloadA, sigA, secret))
		assert.True(t, VerifyNowPaymentsSignature(payloadB, sigB, secret))
	})
}
