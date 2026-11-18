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

// nowPaymentsSDKSecret signs the fixtures below.
const nowPaymentsSDKSecret = "test-ipn-secret"

// nowPaymentsSDKFixturePayload is a real IPN body: the shape NOWPayments sent
// for payment 5898863378, including a JSON null (payin_extra_id) and a decimal
// pay_amount.
const nowPaymentsSDKFixturePayload = `{"payment_id":5898863378,"payment_status":"finished","pay_address":"0xDc1b5AeE1908d46F18a85F80d7f422D4941A21fa","price_amount":1,"price_currency":"usd","pay_amount":1.0010351,"actually_paid":1.002,"pay_currency":"usdtbsc","order_id":"np_7a414039d01623bf1947d416a05cb40858c8137c","order_description":"TUC1","purchase_id":4982370482,"payin_extra_id":null}`

// nowPaymentsSDKFixtureSignature was produced by the official SDK, not by this
// package. It is the anchor that keeps the verifier honest: the implementation
// must match an implementation it did not write.
//
//	import { createWebhookSignature } from 'nowpayments-sdk-nodejs';
//	createWebhookSignature(JSON.parse(payload), 'test-ipn-secret')
const nowPaymentsSDKFixtureSignature = "9de2ef176bcb4f853fdc9f8c560d8cbfaf809ad7e83c6fb4a74ff31a3c2fde409f2f6e01513325718ea86128cabb54a209f14737ca0b978061cd09d1eb61705e"

// signCanonicalPayload signs a body that is already the canonical preimage: the
// endpoint fixtures are written with keys in alphabetical order, no whitespace
// and no escaped characters, so JSON.stringify of the sorted object equals the
// raw bytes and the expected signature is produced without the code under test.
func signCanonicalPayload(t *testing.T, secret string, canonicalPayload string) string {
	t.Helper()
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write([]byte(canonicalPayload))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyNowPaymentsSignature(t *testing.T) {
	secret := nowPaymentsSDKSecret

	t.Run("matches the official SDK signature", func(t *testing.T) {
		assert.True(t, VerifyNowPaymentsSignature([]byte(nowPaymentsSDKFixturePayload), nowPaymentsSDKFixtureSignature, secret))
	})

	t.Run("rejects the legacy value-concatenation signature", func(t *testing.T) {
		// The pre-fix scheme hashed the concatenated values of the sorted keys.
		// It must never be accepted again.
		legacySig := signCanonicalPayload(t, secret, "1TUC1np_7a414039d01623bf1947d416a05cb40858c8137c1.0010351usd1usdtbsc5898863378finished")
		assert.False(t, VerifyNowPaymentsSignature([]byte(nowPaymentsSDKFixturePayload), legacySig, secret))
	})

	t.Run("null values hash as the JSON null token", func(t *testing.T) {
		payload := `{"payin_extra_id":null}`
		assert.True(t, VerifyNowPaymentsSignature([]byte(payload), signCanonicalPayload(t, secret, `{"payin_extra_id":null}`), secret))
		// Neither the Go <nil> rendering nor an empty string is the preimage.
		assert.False(t, VerifyNowPaymentsSignature([]byte(payload), signCanonicalPayload(t, secret, `{"payin_extra_id":<nil>}`), secret))
		assert.False(t, VerifyNowPaymentsSignature([]byte(payload), signCanonicalPayload(t, secret, `{"payin_extra_id":""}`), secret))
	})

	t.Run("nested objects and arrays are sorted deeply", func(t *testing.T) {
		payload := `{"zeta":1,"meta":{"b":2,"a":[{"d":4,"c":3}]}}`
		// Keys sorted at every level; array order preserved, element keys sorted.
		canonical := `{"meta":{"a":[{"c":3,"d":4}],"b":2},"zeta":1}`
		assert.True(t, VerifyNowPaymentsSignature([]byte(payload), signCanonicalPayload(t, secret, canonical), secret))
	})

	t.Run("array element order is significant", func(t *testing.T) {
		payload := `{"items":[1,2]}`
		assert.True(t, VerifyNowPaymentsSignature([]byte(payload), signCanonicalPayload(t, secret, `{"items":[1,2]}`), secret))
		assert.False(t, VerifyNowPaymentsSignature([]byte(payload), signCanonicalPayload(t, secret, `{"items":[2,1]}`), secret))
	})

	t.Run("numeric literals are not reformatted", func(t *testing.T) {
		payload := `{"pay_amount":1.0010351}`
		assert.True(t, VerifyNowPaymentsSignature([]byte(payload), signCanonicalPayload(t, secret, `{"pay_amount":1.0010351}`), secret))
	})

	t.Run("payload key order does not matter", func(t *testing.T) {
		resorted := `{"payin_extra_id":null,"purchase_id":4982370482,"order_description":"TUC1","order_id":"np_7a414039d01623bf1947d416a05cb40858c8137c","pay_currency":"usdtbsc","actually_paid":1.002,"pay_amount":1.0010351,"price_currency":"usd","price_amount":1,"pay_address":"0xDc1b5AeE1908d46F18a85F80d7f422D4941A21fa","payment_status":"finished","payment_id":5898863378}`
		assert.True(t, VerifyNowPaymentsSignature([]byte(resorted), nowPaymentsSDKFixtureSignature, secret))
	})

	t.Run("html characters are not escaped", func(t *testing.T) {
		payload := `{"order_description":"a<b>c&d"}`
		assert.True(t, VerifyNowPaymentsSignature([]byte(payload), signCanonicalPayload(t, secret, `{"order_description":"a<b>c&d"}`), secret))
	})

	t.Run("signature header is case-insensitive and trimmed", func(t *testing.T) {
		assert.True(t, VerifyNowPaymentsSignature([]byte(nowPaymentsSDKFixturePayload), "  "+strings.ToUpper(nowPaymentsSDKFixtureSignature)+" ", secret))
	})

	t.Run("secret is trimmed like the SDK", func(t *testing.T) {
		assert.True(t, VerifyNowPaymentsSignature([]byte(nowPaymentsSDKFixturePayload), nowPaymentsSDKFixtureSignature, "  "+secret+"\n"))
	})

	t.Run("tampered payload rejected", func(t *testing.T) {
		tampered := strings.Replace(nowPaymentsSDKFixturePayload, `"actually_paid":1.002`, `"actually_paid":1000`, 1)
		assert.False(t, VerifyNowPaymentsSignature([]byte(tampered), nowPaymentsSDKFixtureSignature, secret))
	})

	t.Run("wrong secret rejected", func(t *testing.T) {
		assert.False(t, VerifyNowPaymentsSignature([]byte(nowPaymentsSDKFixturePayload), nowPaymentsSDKFixtureSignature, "other-secret"))
	})

	t.Run("missing or empty inputs rejected", func(t *testing.T) {
		assert.False(t, VerifyNowPaymentsSignature([]byte(nowPaymentsSDKFixturePayload), "", secret))
		assert.False(t, VerifyNowPaymentsSignature([]byte(nowPaymentsSDKFixturePayload), nowPaymentsSDKFixtureSignature, ""))
		assert.False(t, VerifyNowPaymentsSignature([]byte(nowPaymentsSDKFixturePayload), "", ""))
	})

	t.Run("invalid json rejected", func(t *testing.T) {
		assert.False(t, VerifyNowPaymentsSignature([]byte(`{not json`), nowPaymentsSDKFixtureSignature, secret))
		assert.False(t, VerifyNowPaymentsSignature([]byte(``), nowPaymentsSDKFixtureSignature, secret))
	})

	t.Run("trailing data after the body rejected", func(t *testing.T) {
		body := `{"payment_id":1}{"payment_id":2}`
		assert.False(t, VerifyNowPaymentsSignature([]byte(body), signCanonicalPayload(t, secret, `{"payment_id":1}`), secret))
	})
}

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

func insertNowPaymentsOrderWithStatus(t *testing.T, db *gorm.DB, userId int, tradeNo string, money float64, status string) {
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
		Status:          status,
	}
	require.NoError(t, db.Create(topUp).Error)
}

func insertNowPaymentsOrder(t *testing.T, db *gorm.DB, userId int, tradeNo string, money float64) {
	t.Helper()
	insertNowPaymentsOrderWithStatus(t, db, userId, tradeNo, money, common.TopUpStatusPending)
}

func getNowPaymentsUserQuota(t *testing.T, db *gorm.DB, userId int) int {
	t.Helper()
	var user model.User
	require.NoError(t, db.Where("id = ?", userId).First(&user).Error)
	return user.Quota
}

// postNowPaymentsWebhook sends a signed or unsigned IPN request through the gin
// handler to assert endpoint-level behavior.
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
	setting.NowPaymentsIpnSecret = nowPaymentsSDKSecret
	secret := setting.NowPaymentsIpnSecret
	sign := func(payload string) string { return signCanonicalPayload(t, secret, payload) }

	t.Run("canonical fixtures stay canonical", func(t *testing.T) {
		// The endpoint fixtures are signed over their raw bytes, which is only
		// valid while each one is already the sorted, compact form.
		for _, payload := range []string{
			`{"actually_paid":0.5,"order_id":"np_order_finished","pay_amount":0.5,"payment_id":1,"payment_status":"finished"}`,
			`{"actually_paid":0.25,"order_id":"np_order_partial","pay_amount":0.5,"payment_id":3,"payment_status":"partially_paid"}`,
			`{"actually_paid":1,"order_id":"np_order_expired","pay_amount":1,"payment_id":8,"payment_status":"finished"}`,
			`{"actually_paid":1.002,"order_id":"np_order_null","pay_amount":1.0010351,"payin_extra_id":null,"payment_id":10,"payment_status":"finished"}`,
		} {
			canonical, err := nowPaymentsSignaturePreimage([]byte(payload))
			require.NoError(t, err)
			require.Equal(t, payload, string(canonical), "fixture is not in canonical form: %s", payload)
		}
	})

	t.Run("finished callback credits quota atomically", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 7, "np_order_finished", 20)
		payload := `{"actually_paid":0.5,"order_id":"np_order_finished","pay_amount":0.5,"payment_id":1,"payment_status":"finished"}`
		rec := postNowPaymentsWebhook(t, payload, sign(payload))
		require.Equal(t, http.StatusOK, rec.Code)

		topUp := model.GetTopUpByTradeNo("np_order_finished")
		require.NotNil(t, topUp)
		assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
		assert.Equal(t, 20*int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 7))
	})

	t.Run("real SDK payload credits the order", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 20, "np_7a414039d01623bf1947d416a05cb40858c8137c", 1)
		rec := postNowPaymentsWebhook(t, nowPaymentsSDKFixturePayload, nowPaymentsSDKFixtureSignature)
		require.Equal(t, http.StatusOK, rec.Code)

		topUp := model.GetTopUpByTradeNo("np_7a414039d01623bf1947d416a05cb40858c8137c")
		require.NotNil(t, topUp)
		assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
		assert.Equal(t, int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 20))
	})

	t.Run("payload with a null field settles normally", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 21, "np_order_null", 1)
		payload := `{"actually_paid":1.002,"order_id":"np_order_null","pay_amount":1.0010351,"payin_extra_id":null,"payment_id":10,"payment_status":"finished"}`
		rec := postNowPaymentsWebhook(t, payload, sign(payload))
		require.Equal(t, http.StatusOK, rec.Code)
		assert.Equal(t, int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 21))
	})

	t.Run("duplicate finished callback is idempotent", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 8, "np_order_dup", 20)
		payload := `{"actually_paid":0.5,"order_id":"np_order_dup","pay_amount":0.5,"payment_id":2,"payment_status":"finished"}`
		for range 2 {
			require.Equal(t, http.StatusOK, postNowPaymentsWebhook(t, payload, sign(payload)).Code)
		}
		assert.Equal(t, 20*int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 8))
	})

	t.Run("partially paid credits proportional quota", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 9, "np_order_partial", 20)
		payload := `{"actually_paid":0.25,"order_id":"np_order_partial","pay_amount":0.5,"payment_id":3,"payment_status":"partially_paid"}`
		require.Equal(t, http.StatusOK, postNowPaymentsWebhook(t, payload, sign(payload)).Code)
		assert.Equal(t, 10*int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 9))
	})

	t.Run("partially paid keeps the exact decimal ratio", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 10, "np_order_partial_thirds", 30)
		payload := `{"actually_paid":1,"order_id":"np_order_partial_thirds","pay_amount":3,"payment_id":4,"payment_status":"partially_paid"}`
		require.Equal(t, http.StatusOK, postNowPaymentsWebhook(t, payload, sign(payload)).Code)

		// 30 * QuotaPerUnit * 1/3 must settle to the full third: the ratio is
		// carried as a decimal instead of being flattened to a float64.
		assert.Equal(t, 10*int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 10))
	})

	t.Run("underpayment is credited proportionally without crashing", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 22, "np_order_underpaid", 1)
		payload := `{"actually_paid":0.999,"order_id":"np_order_underpaid","pay_amount":1,"payment_id":11,"payment_status":"partially_paid"}`
		require.Equal(t, http.StatusOK, postNowPaymentsWebhook(t, payload, sign(payload)).Code)

		quota := getNowPaymentsUserQuota(t, db, 22)
		assert.Greater(t, quota, 0, "a 0.999/1 underpayment must still credit something")
		assert.Less(t, quota, int(common.QuotaPerUnit), "an underpayment must not credit the full order")
	})

	t.Run("partially paid without a usable amount credits nothing", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 11, "np_order_partial_zero", 20)
		payload := `{"actually_paid":0,"order_id":"np_order_partial_zero","pay_amount":0.5,"payment_id":5,"payment_status":"partially_paid"}`
		require.Equal(t, http.StatusOK, postNowPaymentsWebhook(t, payload, sign(payload)).Code)
		assert.Equal(t, 0, getNowPaymentsUserQuota(t, db, 11))
		topUp := model.GetTopUpByTradeNo("np_order_partial_zero")
		require.NotNil(t, topUp)
		assert.Equal(t, common.TopUpStatusPending, topUp.Status)
	})

	t.Run("expired order is resurrected by a finished callback", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrderWithStatus(t, db, 23, "np_order_expired", 5, common.TopUpStatusExpired)
		payload := `{"actually_paid":1,"order_id":"np_order_expired","pay_amount":1,"payment_id":8,"payment_status":"finished"}`
		require.Equal(t, http.StatusOK, postNowPaymentsWebhook(t, payload, sign(payload)).Code)

		topUp := model.GetTopUpByTradeNo("np_order_expired")
		require.NotNil(t, topUp)
		assert.Equal(t, common.TopUpStatusSuccess, topUp.Status, "a paid order must not stay expired")
		assert.Equal(t, 5*int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 23))
	})

	t.Run("refund after settlement credits nothing further", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 24, "np_order_refunded", 5)
		finished := `{"actually_paid":1,"order_id":"np_order_refunded","pay_amount":1,"payment_id":12,"payment_status":"finished"}`
		require.Equal(t, http.StatusOK, postNowPaymentsWebhook(t, finished, sign(finished)).Code)
		refund := `{"actually_paid":1,"order_id":"np_order_refunded","pay_amount":1,"payment_id":12,"payment_status":"refunded"}`
		require.Equal(t, http.StatusOK, postNowPaymentsWebhook(t, refund, sign(refund)).Code)
		assert.Equal(t, 5*int(common.QuotaPerUnit), getNowPaymentsUserQuota(t, db, 24))
	})

	t.Run("payout ipn is acknowledged without wallet logic", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 25, "np_order_payout", 5)
		payload := `{"batch_withdrawal_id":"batch_1","payout_status":"finished","status":"finished"}`
		rec := postNowPaymentsWebhook(t, payload, sign(payload))
		require.Equal(t, http.StatusOK, rec.Code, "unknown ipn kinds must be cleared from the gateway queue")
		assert.Equal(t, 0, getNowPaymentsUserQuota(t, db, 25))
		topUp := model.GetTopUpByTradeNo("np_order_payout")
		require.NotNil(t, topUp)
		assert.Equal(t, common.TopUpStatusPending, topUp.Status)
	})

	t.Run("payment callback without order_id is rejected, not a panic", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 26, "np_order_no_order_id", 5)
		payload := `{"actually_paid":0.5,"pay_amount":0.5,"payment_id":6,"payment_status":"finished"}`
		rec := postNowPaymentsWebhook(t, payload, sign(payload))
		require.Equal(t, http.StatusBadRequest, rec.Code, "a callback we cannot reconcile must be surfaced, not swallowed")
		assert.Equal(t, 0, getNowPaymentsUserQuota(t, db, 26))
		assert.Equal(t, common.TopUpStatusPending, model.GetTopUpByTradeNo("np_order_no_order_id").Status)
	})

	t.Run("callback without payment_id rejected with 400", func(t *testing.T) {
		db := setupNowPaymentsWebhookDB(t)
		insertNowPaymentsOrder(t, db, 12, "np_order_no_payment_id", 20)
		payload := `{"actually_paid":0.5,"order_id":"np_order_no_payment_id","pay_amount":0.5,"payment_status":"finished"}`
		rec := postNowPaymentsWebhook(t, payload, sign(payload))
		require.Equal(t, http.StatusBadRequest, rec.Code)

		topUp := model.GetTopUpByTradeNo("np_order_no_payment_id")
		require.NotNil(t, topUp)
		assert.Equal(t, common.TopUpStatusPending, topUp.Status, "an untraceable callback must not settle the order")
		assert.Equal(t, 0, getNowPaymentsUserQuota(t, db, 12))
	})

	t.Run("invalid signature rejected with 401", func(t *testing.T) {
		payload := `{"order_id":"np_x","payment_id":1,"payment_status":"finished"}`
		require.Equal(t, http.StatusUnauthorized, postNowPaymentsWebhook(t, payload, "deadbeef").Code)
	})

	t.Run("missing signature rejected with 401", func(t *testing.T) {
		payload := `{"order_id":"np_x","payment_id":1,"payment_status":"finished"}`
		require.Equal(t, http.StatusUnauthorized, postNowPaymentsWebhook(t, payload, "").Code)
	})

	t.Run("malformed payload rejected", func(t *testing.T) {
		require.Equal(t, http.StatusUnauthorized, postNowPaymentsWebhook(t, `{broken`, "deadbeef").Code)
	})

	t.Run("ignored statuses still return 200", func(t *testing.T) {
		payload := `{"order_id":"np_x","payment_id":1,"payment_status":"waiting"}`
		require.Equal(t, http.StatusOK, postNowPaymentsWebhook(t, payload, sign(payload)).Code)
	})

	t.Run("webhook disabled returns 403", func(t *testing.T) {
		setting.NowPaymentsApiKey = ""
		payload := `{"order_id":"np_x","payment_id":1,"payment_status":"finished"}`
		require.Equal(t, http.StatusForbidden, postNowPaymentsWebhook(t, payload, sign(payload)).Code)
	})
}

func TestNowPaymentsWebhookEnabled(t *testing.T) {
	originalApiKey := setting.NowPaymentsApiKey
	originalIpnSecret := setting.NowPaymentsIpnSecret
	confirmPaymentComplianceForTest(t)
	t.Cleanup(func() {
		setting.NowPaymentsApiKey = originalApiKey
		setting.NowPaymentsIpnSecret = originalIpnSecret
	})

	setting.NowPaymentsApiKey = "test-api-key"
	setting.NowPaymentsIpnSecret = "test-ipn-secret"
	assert.True(t, isNowPaymentsTopUpEnabled())
	assert.True(t, isNowPaymentsWebhookEnabled())

	setting.NowPaymentsIpnSecret = ""
	assert.False(t, isNowPaymentsTopUpEnabled())
}
