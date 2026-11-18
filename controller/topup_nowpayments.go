package controller

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	encoding_json "encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/thanhpk/randstr"
)

const nowPaymentsApiBase = "https://api.nowpayments.io/v1"

var nowPaymentsAdaptor = &NowPaymentsAdaptor{}

// NowPaymentsAdaptor implements the NOWPayments crypto gateway top-up flow.
type NowPaymentsAdaptor struct{}
type NowPaymentsPayRequest struct {
	// Amount is the quantity of units to purchase.
	Amount int64 `json:"amount"`
	// PaymentMethod specifies the payment method (e.g., "nowpayments").
	PaymentMethod string `json:"payment_method"`
	// SuccessURL is the optional custom URL to redirect after successful payment.
	SuccessURL string `json:"success_url,omitempty"`
	// CancelURL is the optional custom URL to redirect when payment is canceled.
	CancelURL string `json:"cancel_url,omitempty"`
}

// nowPaymentsInvoice is the subset of the POST /v1/invoice response used here.
type nowPaymentsInvoice struct {
	Id         string `json:"id"`
	InvoiceUrl string `json:"invoice_url"`
}

// nowPaymentsMinAmount is the GET /v1/min-amount response.
type nowPaymentsMinAmount struct {
	MinAmount float64 `json:"min_amount"`
}

// nowPaymentsIpnPayload is the NOWPayments IPN callback body. PaymentId and
// InvoiceId use the tolerant identifier types below: the gateway's own
// GET /v1/payment/{id} response — which the IPN body mirrors — sends both as JSON
// numbers, so declaring them as int64 and string respectively rejected the real
// payload with "cannot unmarshal number into Go struct field … invoice_id of
// type string" after the signature had already been accepted.
type nowPaymentsIpnPayload struct {
	PaymentId       nowPaymentsID       `json:"payment_id"`
	PaymentStatus   string              `json:"payment_status"`
	PayAmount       decimal.Decimal     `json:"pay_amount"`
	ActuallyPaid    decimal.Decimal     `json:"actually_paid"`
	PayCurrency     string              `json:"pay_currency"`
	PriceAmount     decimal.Decimal     `json:"price_amount"`
	PriceCurrency   string              `json:"price_currency"`
	OrderId         string              `json:"order_id"`
	InvoiceId       nowPaymentsIDString `json:"invoice_id"`
	OutcomeAmount   decimal.Decimal     `json:"outcome_amount"`
	OutcomeCurrency string              `json:"outcome_currency"`
}

// nowPaymentsID is a numeric NOWPayments identifier (payment_id). The gateway
// sends it as a JSON number; a quoted number or an integral float is accepted
// too, so a representation change on their side cannot turn an otherwise valid
// callback into a 400 after the signature has been verified.
type nowPaymentsID int64

func (id *nowPaymentsID) UnmarshalJSON(raw []byte) error {
	text := strings.Trim(strings.TrimSpace(string(raw)), `"`)
	if text == "" || text == "null" {
		*id = 0
		return nil
	}
	if value, err := strconv.ParseInt(text, 10, 64); err == nil {
		*id = nowPaymentsID(value)
		return nil
	}
	// 5898863378.0 identifies the same payment as 5898863378; anything with a
	// fractional part is not an identifier and is refused.
	if value, err := strconv.ParseFloat(text, 64); err == nil && value == math.Trunc(value) && math.Abs(value) < 1<<53 {
		*id = nowPaymentsID(int64(value))
		return nil
	}
	return fmt.Errorf("invalid NOWPayments identifier %q", text)
}

func (id nowPaymentsID) Int64() int64 {
	return int64(id)
}

// nowPaymentsIDString is a NOWPayments identifier the gateway sends as a JSON
// number (invoice_id) but documents as a string. Unmarshalling it into a plain
// string fails on the numeric form, so both representations are accepted.
type nowPaymentsIDString string

func (id *nowPaymentsIDString) UnmarshalJSON(raw []byte) error {
	text := strings.TrimSpace(string(raw))
	if text == "" || text == "null" {
		*id = ""
		return nil
	}
	if len(text) > 1 && text[0] == '"' && text[len(text)-1] == '"' {
		var unquoted string
		if err := common.Unmarshal(raw, &unquoted); err != nil {
			return err
		}
		*id = nowPaymentsIDString(unquoted)
		return nil
	}
	// A bare JSON number: keep the literal as sent, digits intact.
	if _, err := strconv.ParseFloat(text, 64); err != nil {
		return fmt.Errorf("invalid NOWPayments identifier %q", text)
	}
	*id = nowPaymentsIDString(text)
	return nil
}

func (id nowPaymentsIDString) String() string {
	return string(id)
}

func getNowPaymentsCreditedQuota(amount int64, group string) decimal.Decimal {
	topUpGroupRatio := common.GetTopupGroupRatio(group)
	if topUpGroupRatio == 0 {
		topUpGroupRatio = 1
	}
	return decimal.NewFromInt(amount).
		Mul(decimal.NewFromFloat(topUpGroupRatio)).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit))
}

func getNowPaymentsPayMoney(amount float64, group string) float64 {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(amount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	payMoney := amount * setting.NowPaymentsUnitPrice * topupGroupRatio * discount
	return payMoney
}

func getNowPaymentsMinTopup() int64 {
	minTopup := setting.NowPaymentsMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}

// nowPaymentsMinFiatAmount queries NOWPayments for the minimum fiat amount
// accepted by the gateway for the given price, so invoices below the network
// minimum are rejected before an order is created.
func nowPaymentsMinFiatAmount(ctx context.Context, priceAmount float64) (float64, error) {
	url := fmt.Sprintf("%s/min-amount?fiat_currency=usd&fiat_eq_price=%s", nowPaymentsApiBase, strconv.FormatFloat(priceAmount, 'f', -1, 64))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("x-api-key", setting.NowPaymentsApiKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("NOWPayments min-amount API status %d", resp.StatusCode)
	}
	var result nowPaymentsMinAmount
	if err := common.DecodeJson(resp.Body, &result); err != nil {
		return 0, err
	}
	return result.MinAmount, nil
}

// createNowPaymentsInvoice calls POST /v1/invoice and returns the hosted
// payment page URL for the order.
func createNowPaymentsInvoice(ctx context.Context, tradeNo string, priceAmount float64, description string, ipnCallbackUrl string, successUrl string, cancelUrl string) (*nowPaymentsInvoice, error) {
	bodyBuilder := map[string]any{
		"price_amount":      priceAmount,
		"price_currency":    "usd",
		"order_id":          tradeNo,
		"order_description": description,
		"ipn_callback_url":  ipnCallbackUrl,
	}
	if successUrl != "" {
		bodyBuilder["success_url"] = successUrl
	}
	if cancelUrl != "" {
		bodyBuilder["cancel_url"] = cancelUrl
	}
	body, err := common.Marshal(bodyBuilder)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, nowPaymentsApiBase+"/invoice", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("x-api-key", setting.NowPaymentsApiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("NOWPayments invoice API status %d", resp.StatusCode)
	}
	var invoice nowPaymentsInvoice
	if err := common.DecodeJson(resp.Body, &invoice); err != nil {
		return nil, err
	}
	if invoice.InvoiceUrl == "" {
		return nil, errors.New("NOWPayments invoice API returned empty invoice_url")
	}
	return &invoice, nil
}

func (*NowPaymentsAdaptor) RequestAmount(c *gin.Context, req *NowPaymentsPayRequest) {
	if req.Amount < getNowPaymentsMinTopup() {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": getNowPaymentsMinTopup()}))
		return
	}
	if req.Amount > 10000 {
		paymentError(c, common.NewMessage("Top-up amount cannot exceed {{max}}", map[string]any{"max": 10000}))
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}
	if rejectInvalidCreditedQuota(c, id, getNowPaymentsCreditedQuota(req.Amount, group)) {
		return
	}
	payMoney := getNowPaymentsPayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func (*NowPaymentsAdaptor) RequestPay(c *gin.Context, req *NowPaymentsPayRequest) {
	if req.PaymentMethod != model.PaymentMethodNowPayments {
		paymentError(c, common.NewMessage("Unsupported payment channel"))
		return
	}
	if req.Amount < getNowPaymentsMinTopup() {
		common.ApiErrorStatus(c, http.StatusOK, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": getNowPaymentsMinTopup()}), gin.H{"data": 10})
		return
	}
	if req.Amount > 10000 {
		common.ApiErrorStatus(c, http.StatusOK, common.NewMessage("Top-up amount cannot exceed {{max}}", map[string]any{"max": 10000}), gin.H{"data": 10})
		return
	}

	if req.SuccessURL != "" && common.ValidateRedirectURL(req.SuccessURL) != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Payment success redirect URL is not in the trusted domain list"), gin.H{"data": ""})
		return
	}
	if req.CancelURL != "" && common.ValidateRedirectURL(req.CancelURL) != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Payment cancel redirect URL is not in the trusted domain list"), gin.H{"data": ""})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		paymentError(c, common.NewMessage("User does not exist"))
		return
	}
	chargedMoney := GetChargedAmount(float64(req.Amount), *user)
	if rejectInvalidCreditedQuota(c, id,
		decimal.NewFromFloat(chargedMoney).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
	) {
		return
	}

	payMoney := getNowPaymentsPayMoney(float64(req.Amount), user.Group)
	if payMoney <= 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	ctx := c.Request.Context()
	minAmount, err := nowPaymentsMinFiatAmount(ctx, payMoney)
	if err == nil && payMoney < minAmount {
		paymentError(c, common.NewMessage("Payment amount is below the NOWPayments minimum of {{min}} USD", map[string]any{"min": minAmount}))
		return
	}

	reference := fmt.Sprintf("new-api-np-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	tradeNo := "np_" + common.Sha1([]byte(reference))

	callBackAddress := service.GetCallbackAddress()
	ipnCallbackUrl := callBackAddress + "/api/webhooks/nowpayments"

	invoice, err := createNowPaymentsInvoice(ctx, tradeNo, payMoney, fmt.Sprintf("TUC%d", req.Amount), ipnCallbackUrl, req.SuccessURL, req.CancelURL)
	if err != nil {
		logger.LogError(ctx, common.LogText("NOWPayments failed to create invoice user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}

	topUp := &model.TopUp{
		UserId:          id,
		Amount:          req.Amount,
		Money:           chargedMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodNowPayments,
		PaymentProvider: model.PaymentProviderNowPayments,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	err = topUp.Insert()
	if err != nil {
		logger.LogError(ctx, common.LogText("NOWPayments failed to create top-up order user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}
	logger.LogInfo(ctx, common.LogText("NOWPayments top-up order created user_id=%d trade_no=%s amount=%d money=%.2f invoice_id=%s", id, tradeNo, req.Amount, chargedMoney, invoice.Id))
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": invoice.InvoiceUrl,
		},
	})
}

func RequestNowPaymentsAmount(c *gin.Context) {
	var req NowPaymentsPayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	nowPaymentsAdaptor.RequestAmount(c, &req)
}

func RequestNowPaymentsPay(c *gin.Context) {
	var req NowPaymentsPayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	nowPaymentsAdaptor.RequestPay(c, &req)
}

// nowPaymentsWebhookDebugEnv turns on the verbose request dump for the IPN
// endpoint. It is off by default: a full dump carries the customer's pay_address,
// payment hashes and every header the edge forwarded, which does not belong in a
// production log. NOWPAYMENTS_WEBHOOK_DEBUG=1 enables it while diagnosing.
const nowPaymentsWebhookDebugEnv = "NOWPAYMENTS_WEBHOOK_DEBUG"

// nowPaymentsSensitiveHeaders are never logged, even in debug mode: they carry
// credentials rather than transport metadata.
var nowPaymentsSensitiveHeaders = []string{"cookie", "authorization", "proxy-authorization", "set-cookie", "x-api-key", "cf-access-jwt-assertion"}

// nowPaymentsSignatureFromRequest reads the IPN signature header. Go's
// http.Header.Get already matches the name case-insensitively (the server
// canonicalises header names, so X-NOWPAYMENTS-SIG, x-nowpayments-sig and
// X-NowPayments-Sig all resolve), but a proxy or WAF in front of the app may
// rewrite the dashes as underscores, which canonicalisation does not cover. The
// fallback scan normalises case and -/_ before comparing so a rewritten header
// still verifies.
func nowPaymentsSignatureFromRequest(c *gin.Context) (signature string, headerName string) {
	if value := strings.TrimSpace(c.GetHeader(nowPaymentsIpnSignatureHeader)); value != "" {
		return value, nowPaymentsIpnSignatureHeader
	}
	wanted := strings.ReplaceAll(nowPaymentsIpnSignatureHeader, "-", "_")
	for name, values := range c.Request.Header {
		normalised := strings.ReplaceAll(strings.ToLower(name), "-", "_")
		if normalised != wanted {
			continue
		}
		for _, value := range values {
			if trimmed := strings.TrimSpace(value); trimmed != "" {
				return trimmed, name
			}
		}
	}
	return "", ""
}

// redactHeaderValue keeps a header's first characters so an operator can match it
// against a gateway dashboard without the value being usable as a credential.
func redactHeaderValue(value string) string {
	if len(value) <= 8 {
		return "[REDACTED]"
	}
	return value[:8] + "…"
}

// nowPaymentsWebhookHeaderDump renders the request headers for the diagnostic
// log, redacting credential-bearing ones.
func nowPaymentsWebhookHeaderDump(c *gin.Context) string {
	names := make([]string, 0, len(c.Request.Header))
	for name := range c.Request.Header {
		names = append(names, name)
	}
	sort.Strings(names)
	var builder strings.Builder
	for _, name := range names {
		value := strings.Join(c.Request.Header.Values(name), ", ")
		lowered := strings.ToLower(name)
		for _, sensitive := range nowPaymentsSensitiveHeaders {
			if lowered == sensitive {
				value = "[REDACTED]"
				break
			}
		}
		if builder.Len() > 0 {
			builder.WriteString("; ")
		}
		builder.WriteString(name)
		builder.WriteString("=")
		builder.WriteString(value)
	}
	return builder.String()
}

// logNowPaymentsWebhookRequest writes one line per IPN request: the transport
// facts that decide whether a callback can be verified at all, plus a fingerprint
// of the body so a rejected request can be diffed against a local re-sign. Richer
// detail (header dump, body) is written only when NOWPAYMENTS_WEBHOOK_DEBUG is set.
func logNowPaymentsWebhookRequest(ctx context.Context, c *gin.Context, payload []byte, signaturePresent bool) {
	sum := sha256.Sum256(payload)
	debug := common.GetEnvOrDefaultBool(nowPaymentsWebhookDebugEnv, false)
	logger.LogInfo(ctx, common.LogText(
		"NOWPayments webhook received method=%s path=%q client_ip=%s ua=%q content_type=%q content_length=%d body_len=%d body_sha256=%x sig_present=%t",
		c.Request.Method, c.Request.RequestURI, c.ClientIP(), c.Request.UserAgent(),
		c.GetHeader("Content-Type"), c.Request.ContentLength, len(payload), sum[:8], signaturePresent))
	if !debug {
		return
	}
	logger.LogInfo(ctx, common.LogText("NOWPayments webhook debug headers=%q body=%q", nowPaymentsWebhookHeaderDump(c), truncateForLog(string(payload), 4096)))
}

// truncateForLog bounds a diagnostic value so one oversized body cannot flood the
// log sink.
func truncateForLog(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	return value[:limit] + "…(truncated)"
}

// nowPaymentsWebhookExpectedSignature is used only on the failure path, to log
// what we computed next to what arrived. It returns "" when the body cannot be
// canonicalised.
func nowPaymentsWebhookExpectedSignature(payload []byte, secret string) string {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return ""
	}
	preimage, err := nowPaymentsSignaturePreimage(payload)
	if err != nil {
		return ""
	}
	return hex.EncodeToString(nowPaymentsHmacSha512(secret, preimage))
}

// nowPaymentsStoredIpnSecret reads the IPN secret straight from the options table.
// The in-memory copy is refreshed every minute by the option sync task, so a
// secret rotated in the database can be up to that stale; the webhook failure path
// re-reads it once before rejecting a callback.
func nowPaymentsStoredIpnSecret() (string, bool) {
	// A webhook must never panic because the main database is unavailable
	// (startup, an outage, or a unit test with no database): fall back to the
	// in-memory option instead.
	if model.DB == nil {
		return "", false
	}
	options, err := model.AllOption()
	if err != nil {
		return "", false
	}
	for _, option := range options {
		if option != nil && option.Key == "NowPaymentsIpnSecret" {
			return option.Value, true
		}
	}
	return "", true
}

// NowPaymentsWebhook handles the NOWPayments IPN callback. The signature in the
// x-nowpayments-sig header must be a valid HMAC-SHA512, keyed by the saved IPN
// secret, over the deep-key-sorted JSON encoding of the body; anything else is
// rejected before parsing is trusted. See VerifyNowPaymentsSignature for why the
// preimage is the re-encoded document and not the raw bytes or a value blob.
func NowPaymentsWebhook(c *gin.Context) {
	ctx := c.Request.Context()
	if !isNowPaymentsWebhookEnabled() {
		logger.LogWarn(ctx, common.LogText("NOWPayments webhook rejected reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	payload, err := readPaymentWebhookBody(c)
	if err != nil {
		status := http.StatusServiceUnavailable
		if err == errPaymentWebhookBodyTooLarge {
			status = http.StatusRequestEntityTooLarge
		}
		logger.LogError(ctx, common.LogText("NOWPayments webhook failed to read request body path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(status)
		return
	}

	signature, signatureHeader := nowPaymentsSignatureFromRequest(c)
	logNowPaymentsWebhookRequest(ctx, c, payload, signature != "")

	ipnSecret := setting.NowPaymentsIpnSecret
	verified := VerifyNowPaymentsSignature(payload, signature, ipnSecret)
	if !verified && signature != "" {
		// Only the failure path pays for a database read: the in-memory option is
		// refreshed once a minute, so a secret that was just rotated in the
		// database would otherwise reject a perfectly valid callback until the
		// next sync.
		if storedSecret, found := nowPaymentsStoredIpnSecret(); found && storedSecret != ipnSecret {
			if VerifyNowPaymentsSignature(payload, signature, storedSecret) {
				logger.LogWarn(ctx, common.LogText("NOWPayments webhook verified with the freshly loaded ipn secret; the in-memory option was stale path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
				ipnSecret = storedSecret
				verified = true
			} else {
				logger.LogWarn(ctx, common.LogText("NOWPayments webhook ipn secret differs between memory and database, and neither verifies path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
			}
		}
	}

	if !verified {
		expected := nowPaymentsWebhookExpectedSignature(payload, ipnSecret)
		debug := common.GetEnvOrDefaultBool(nowPaymentsWebhookDebugEnv, false)
		if signature == "" {
			// A missing signature is a transport problem, not a secret mismatch:
			// log which header carried it (if any) and what actually arrived.
			logger.LogWarn(ctx, common.LogText("NOWPayments webhook rejected reason=missing_signature path=%q client_ip=%s expected_header=%q headers=%q", c.Request.RequestURI, c.ClientIP(), nowPaymentsIpnSignatureHeader, nowPaymentsWebhookHeaderDump(c)))
		} else if debug {
			logger.LogWarn(ctx, common.LogText("NOWPayments webhook signature verification failed path=%q client_ip=%s header=%q received=%s expected=%s body=%q", c.Request.RequestURI, c.ClientIP(), signatureHeader, signature, expected, truncateForLog(string(payload), 4096)))
		} else {
			logger.LogWarn(ctx, common.LogText("NOWPayments webhook signature verification failed path=%q client_ip=%s header=%q received_prefix=%s received_len=%d expected_prefix=%s expected_len=%d", c.Request.RequestURI, c.ClientIP(), signatureHeader, redactHeaderValue(signature), len(signature), redactHeaderValue(expected), len(expected)))
		}
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var ipn nowPaymentsIpnPayload
	if err := common.Unmarshal(payload, &ipn); err != nil {
		// Previously this branch also covered ipn.OrderId == "" and called
		// err.Error() unconditionally: a well-formed body without order_id
		// dereferenced a nil error, and Gin's Recovery answered 200, so the
		// gateway considered the callback delivered and stopped retrying.
		logger.LogError(ctx, common.LogText("NOWPayments webhook failed to parse payload path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	// Payout (withdrawal) IPNs share this endpoint but describe no payment
	// order: they carry batch_withdrawal_id and a payout status instead. They
	// are acknowledged so the gateway clears them, and never touch a wallet.
	if ipn.PaymentId == 0 && ipn.PaymentStatus == "" {
		logger.LogInfo(ctx, common.LogText("NOWPayments webhook acknowledged non-payment ipn path=%q client_ip=%s order_id=%q", c.Request.RequestURI, c.ClientIP(), ipn.OrderId))
		c.Status(http.StatusOK)
		return
	}

	if ipn.OrderId == "" {
		logger.LogError(ctx, common.LogText("NOWPayments webhook rejected reason=missing_order_id payment_id=%d payment_status=%s client_ip=%s", ipn.PaymentId, ipn.PaymentStatus, c.ClientIP()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	// 结算必须能追溯到网关侧的支付流水号：缺少 payment_id 的 IPN 无法与订单
	// 对账，也无法在重放/撞单时定位来源，直接拒绝。
	if ipn.PaymentId <= 0 {
		logger.LogWarn(ctx, common.LogText("NOWPayments webhook rejected reason=missing_payment_id order_id=%s payment_status=%s client_ip=%s", ipn.OrderId, ipn.PaymentStatus, c.ClientIP()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	logger.LogInfo(ctx, common.LogText("NOWPayments webhook signature verified payment_id=%d order_id=%s payment_status=%s client_ip=%s path=%q", ipn.PaymentId, ipn.OrderId, ipn.PaymentStatus, c.ClientIP(), c.Request.RequestURI))

	switch ipn.PaymentStatus {
	case "finished":
		nowPaymentsFulfillOrder(ctx, ipn, decimal.NewFromInt(1), c.ClientIP())
	case "partially_paid":
		// 按实际支付的比例结算，比例全程用 decimal 计算：先转 float64 会把
		// 1/3 这类比例舍入后再乘额度，既会多给额度也会少给额度。缺少可用金额
		// 时比例保持 0，宁可不结算也不能凭空发放额度。
		ratio := decimal.Zero
		if ipn.PayAmount.IsPositive() {
			ratio = decimal.Min(ipn.ActuallyPaid.Div(ipn.PayAmount), decimal.NewFromInt(1))
			if !ratio.IsPositive() {
				ratio = decimal.Zero
			}
		}
		if !ratio.IsPositive() {
			logger.LogWarn(ctx, common.LogText("NOWPayments webhook rejected reason=no_payment_ratio payment_id=%d order_id=%s pay_amount=%s actually_paid=%s client_ip=%s", ipn.PaymentId, ipn.OrderId, ipn.PayAmount.String(), ipn.ActuallyPaid.String(), c.ClientIP()))
			c.Status(http.StatusOK)
			return
		}
		nowPaymentsFulfillOrder(ctx, ipn, ratio, c.ClientIP())
	case "expired", "failed", "refunded":
		nowPaymentsExpireOrder(ctx, ipn, c.ClientIP())
	default:
		logger.LogInfo(ctx, common.LogText("NOWPayments webhook ignored payment_status payment_id=%d order_id=%s payment_status=%s client_ip=%s", ipn.PaymentId, ipn.OrderId, ipn.PaymentStatus, c.ClientIP()))
	}

	c.Status(http.StatusOK)
}

// nowPaymentsFulfillOrder settles one IPN against its pending order. Every
// outcome logs the gateway payment_id next to the order id so a replayed or
// colliding callback can be traced back to the payment that caused it.
func nowPaymentsFulfillOrder(ctx context.Context, ipn nowPaymentsIpnPayload, completionRatio decimal.Decimal, callerIp string) {
	LockOrder(ipn.OrderId)
	defer UnlockOrder(ipn.OrderId)

	alreadyDone, err := model.RechargeNowPayments(ipn.OrderId, completionRatio, callerIp)
	if errors.Is(err, model.ErrTopUpNotFound) {
		logger.LogWarn(ctx, common.LogText("NOWPayments webhook order not found trade_no=%s payment_id=%d client_ip=%s", ipn.OrderId, ipn.PaymentId, callerIp))
		return
	}
	if errors.Is(err, model.ErrPaymentMethodMismatch) {
		logger.LogWarn(ctx, common.LogText("NOWPayments webhook order payment gateway mismatch trade_no=%s payment_id=%d client_ip=%s", ipn.OrderId, ipn.PaymentId, callerIp))
		return
	}
	if errors.Is(err, model.ErrTopUpStatusInvalid) {
		logger.LogInfo(ctx, common.LogText("NOWPayments webhook order not pending, ignored trade_no=%s payment_id=%d status_invalid client_ip=%s", ipn.OrderId, ipn.PaymentId, callerIp))
		return
	}
	if errors.Is(err, model.ErrInvalidTopUpQuota) {
		logger.LogWarn(ctx, common.LogText("NOWPayments webhook order has no creditable quota trade_no=%s payment_id=%d completion_ratio=%s client_ip=%s", ipn.OrderId, ipn.PaymentId, completionRatio.String(), callerIp))
		return
	}
	if err != nil {
		logger.LogError(ctx, common.LogText("NOWPayments top-up processing failed trade_no=%s payment_id=%d client_ip=%s error=%q", ipn.OrderId, ipn.PaymentId, callerIp, err.Error()))
		return
	}
	if alreadyDone {
		logger.LogInfo(ctx, common.LogText("NOWPayments top-up already completed, idempotent callback ignored trade_no=%s payment_id=%d client_ip=%s", ipn.OrderId, ipn.PaymentId, callerIp))
		return
	}
	logger.LogInfo(ctx, common.LogText("NOWPayments top-up succeeded trade_no=%s payment_id=%d payment_status=%s completion_ratio=%s client_ip=%s", ipn.OrderId, ipn.PaymentId, ipn.PaymentStatus, completionRatio.String(), callerIp))
}

// nowPaymentsExpireOrder transitions a pending order to expired when the
// gateway reports the payment lapsed, failed or was refunded, so the billing
// history and admin stats stop treating it as actionable.
func nowPaymentsExpireOrder(ctx context.Context, ipn nowPaymentsIpnPayload, callerIp string) {
	LockOrder(ipn.OrderId)
	defer UnlockOrder(ipn.OrderId)

	err := model.UpdatePendingTopUpStatus(ipn.OrderId, model.PaymentProviderNowPayments, common.TopUpStatusExpired)
	switch {
	case errors.Is(err, model.ErrTopUpNotFound):
		logger.LogWarn(ctx, common.LogText("NOWPayments webhook order not found trade_no=%s payment_id=%d client_ip=%s", ipn.OrderId, ipn.PaymentId, callerIp))
	case errors.Is(err, model.ErrTopUpStatusInvalid):
		logger.LogInfo(ctx, common.LogText("NOWPayments webhook order not pending, expiration ignored trade_no=%s payment_id=%d payment_status=%s client_ip=%s", ipn.OrderId, ipn.PaymentId, ipn.PaymentStatus, callerIp))
	case err != nil:
		logger.LogError(ctx, common.LogText("NOWPayments webhook failed to expire order trade_no=%s payment_id=%d payment_status=%s client_ip=%s error=%q", ipn.OrderId, ipn.PaymentId, ipn.PaymentStatus, callerIp, err.Error()))
	default:
		logger.LogInfo(ctx, common.LogText("NOWPayments top-up expired trade_no=%s payment_id=%d payment_status=%s client_ip=%s", ipn.OrderId, ipn.PaymentId, ipn.PaymentStatus, callerIp))
	}
}

// nowPaymentsIpnSignatureHeader carries the HMAC-SHA512 of the IPN body.
const nowPaymentsIpnSignatureHeader = "x-nowpayments-sig"

// VerifyNowPaymentsSignature reports whether signature is the HMAC-SHA512 of
// NOWPayments' signing preimage for payload, keyed by ipnSecret.
//
// NOWPayments signs JSON.stringify(sortObjectDeep(params)) — the compact JSON
// encoding of the body with every object's keys sorted — not a concatenation of
// the values (IPN docs, "Sorting and converting the received POST request by
// keys … JSON.stringify(params, Object.keys(params).sort())"; and
// nowpayments-sdk-nodejs/src/ipn.js createWebhookSignature). The signature is
// therefore computed over a re-encoded document rather than the raw bytes: the
// raw body may carry any key order, indentation or escaping, while the gateway's
// hash is taken over the normalised form. Two details make the encoding match
// JSON.stringify byte for byte:
//
//   - json.Number keeps every numeric literal as it was sent, so 1.0010351 does
//     not become 1.0010351000000001;
//   - SetEscapeHTML(false) stops Go escaping <, > and & as \u003c, \u003e, \u0026.
//
// A JSON null encodes as null (JSON.stringify's own token); Go's previous
// fmt.Sprintf("%v") fallback emitted "<nil>", which broke any payload carrying a
// null field.
func VerifyNowPaymentsSignature(payload []byte, signature string, ipnSecret string) bool {
	signature = strings.ToLower(strings.TrimSpace(signature))
	// The gateway trims the secret before signing (createWebhookSignature's
	// secret.trim()), so a secret pasted with a trailing newline still verifies.
	ipnSecret = strings.TrimSpace(ipnSecret)
	if signature == "" || ipnSecret == "" {
		return false
	}

	preimage, err := nowPaymentsSignaturePreimage(payload)
	if err != nil {
		return false
	}
	expected := hex.EncodeToString(nowPaymentsHmacSha512(ipnSecret, preimage))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// nowPaymentsSignaturePreimage rebuilds the exact JSON document NOWPayments
// signed. The whole body must be one JSON value: trailing data after the first
// value is rejected rather than ignored, because a body the gateway signed and a
// body we only partly verified must not differ.
func nowPaymentsSignaturePreimage(payload []byte) ([]byte, error) {
	decoder := encoding_json.NewDecoder(bytes.NewReader(payload))
	// Signature verification must hash the exact numeric literals sent by
	// NOWPayments, which requires decoder.UseNumber semantics the common codec
	// wrapper does not expose. This is a parse-only path, never used for
	// (re)marshalling business payloads.
	decoder.UseNumber()
	var body any
	if err := decoder.Decode(&body); err != nil {
		return nil, err
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return nil, errors.New("trailing data after the JSON body")
	}

	sorted, err := sortJSONKeysDeep(body)
	if err != nil {
		return nil, err
	}

	var buffer bytes.Buffer
	encoder := encoding_json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(sorted); err != nil {
		return nil, err
	}
	// Encoder.Encode terminates the value with a newline that JSON.stringify
	// does not emit.
	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n")), nil
}

// sortJSONKeysDeep mirrors the SDK's sortObjectDeep. Go already emits map keys in
// sorted order, but the normalisation is kept explicit so the preimage does not
// silently depend on that encoder detail.
func sortJSONKeysDeep(value any) (any, error) {
	switch typed := value.(type) {
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		sorted := make(map[string]any, len(typed))
		for _, key := range keys {
			child, err := sortJSONKeysDeep(typed[key])
			if err != nil {
				return nil, err
			}
			sorted[key] = child
		}
		return sorted, nil
	case []any:
		sorted := make([]any, len(typed))
		for i, item := range typed {
			child, err := sortJSONKeysDeep(item)
			if err != nil {
				return nil, err
			}
			sorted[i] = child
		}
		return sorted, nil
	default:
		return value, nil
	}
}

func nowPaymentsHmacSha512(secret string, data []byte) []byte {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write(data)
	return mac.Sum(nil)
}
