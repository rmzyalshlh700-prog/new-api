package controller

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"
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

// nowPaymentsIpnPayload is the NOWPayments IPN callback body.
type nowPaymentsIpnPayload struct {
	PaymentId       int64           `json:"payment_id"`
	PaymentStatus   string          `json:"payment_status"`
	PayAmount       decimal.Decimal `json:"pay_amount"`
	ActuallyPaid    decimal.Decimal `json:"actually_paid"`
	PayCurrency     string          `json:"pay_currency"`
	PriceAmount     decimal.Decimal `json:"price_amount"`
	PriceCurrency   string          `json:"price_currency"`
	OrderId         string          `json:"order_id"`
	InvoiceId       string          `json:"invoice_id"`
	OutcomeAmount   decimal.Decimal `json:"outcome_amount"`
	OutcomeCurrency string          `json:"outcome_currency"`
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

// NowPaymentsWebhook handles the NOWPayments IPN callback. The signature in
// the x-nowpayments-sig header must be a valid HMAC-SHA512 over the sorted
// values of the JSON body keyed by the saved IPN secret; anything else is
// rejected before parsing is trusted.
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

	signature := c.GetHeader("x-nowpayments-sig")
	logger.LogInfo(ctx, common.LogText("NOWPayments webhook received request path=%q client_ip=%s content_length=%d signature_present=%t", c.Request.RequestURI, c.ClientIP(), len(payload), signature != ""))

	if !VerifyNowPaymentsSignature(payload, signature, setting.NowPaymentsIpnSecret) {
		logger.LogWarn(ctx, common.LogText("NOWPayments webhook signature verification failed path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusUnauthorized)
		return
	}

	var ipn nowPaymentsIpnPayload
	if err := common.Unmarshal(payload, &ipn); err != nil || ipn.OrderId == "" {
		logger.LogError(ctx, common.LogText("NOWPayments webhook failed to parse payload path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
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

// VerifyNowPaymentsSignature implements the NOWPayments IPN signature scheme:
// sort the top-level JSON keys alphabetically, concatenate their values in
// sorted order (nested objects are sorted recursively), then compare
// HMAC-SHA512(ipn_secret, concatenated) with the x-nowpayments-sig header.
func VerifyNowPaymentsSignature(payload []byte, signature string, ipnSecret string) bool {
	if strings.TrimSpace(ipnSecret) == "" || strings.TrimSpace(signature) == "" {
		return false
	}

	// signature verification must hash the exact numeric literals sent by
	// NOWPayments, which requires decoder.UseNumber semantics the common codec
	// wrapper does not expose. This is a parse-only path, never used for
	// (re)marshalling business payloads.
	decoder := encoding_json.NewDecoder(bytes.NewReader(payload))
	decoder.UseNumber()
	var body map[string]any
	if err := decoder.Decode(&body); err != nil || body == nil {
		return false
	}

	expected := hex.EncodeToString(nowPaymentsHmacSha512(ipnSecret, nowPaymentsSortedValuesString(body)))
	return hmac.Equal([]byte(expected), []byte(strings.ToLower(strings.TrimSpace(signature))))
}

func nowPaymentsHmacSha512(secret string, data string) []byte {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write([]byte(data))
	return mac.Sum(nil)
}

// nowPaymentsSortedValuesString concatenates the values of a JSON object in
// alphabetically sorted key order. Nested objects are sorted recursively and
// concatenated without separators, matching the official Node SDK behavior.
func nowPaymentsSortedValuesString(value any) string {
	switch v := value.(type) {
	case map[string]any:
		keys := make([]string, 0, len(v))
		for key := range v {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		var builder strings.Builder
		for _, key := range keys {
			builder.WriteString(nowPaymentsSortedValuesString(v[key]))
		}
		return builder.String()
	case []any:
		var builder strings.Builder
		for _, item := range v {
			builder.WriteString(nowPaymentsSortedValuesString(item))
		}
		return builder.String()
	case string:
		return v
	case encoding_json.Number:
		return v.String()
	case bool:
		if v {
			return "true"
		}
		return "false"
	default:
		return fmt.Sprintf("%v", v)
	}
}
