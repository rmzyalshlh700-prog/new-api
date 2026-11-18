package controller

import (
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// Complete payment-gateway setup as one operation.
//
// Writing one option key per tool call made "add NOWPayments with these keys" a
// five-turn conversation that could stop halfway, leaving a gateway with an API
// key and no webhook secret — saved, but not working, and reported as if it
// were. This tool takes the whole provider configuration at once, checks what
// the platform's own enablement predicate requires, writes every key, then
// re-reads the predicate, so the answer says whether the gateway is *live*
// rather than whether some keys were stored.
//
// Two gates stay, because a tool must not remove them: the caller has to be a
// root administrator, and the platform's payment compliance acknowledgement has
// to be confirmed by a person. A gateway whose credentials are complete but
// whose acknowledgement is missing is saved and reported as inactive with that
// reason named — signing it on the operator's behalf would be forging their
// consent to the provider's terms.

// copilotGatewaySpec is what one provider needs to be enabled.
type copilotGatewaySpec struct {
	Provider    string
	DisplayName string
	Required    []string
	Optional    []string
	WebhookPath string
	// SwitchKey is the option that turns the provider on, when it has one.
	SwitchKey string
}

// copilotGatewaySpecs is the provider catalogue the tool works from.
var copilotGatewaySpecs = []copilotGatewaySpec{
	{
		Provider:    "nowpayments",
		DisplayName: "NOWPayments",
		Required:    []string{"NowPaymentsApiKey", "NowPaymentsIpnSecret"},
		Optional:    []string{"NowPaymentsUnitPrice", "NowPaymentsMinTopUp", "CustomCallbackAddress"},
		WebhookPath: "/api/webhooks/nowpayments",
	},
	{
		Provider:    "stripe",
		DisplayName: "Stripe",
		Required:    []string{"StripeApiSecret", "StripeWebhookSecret", "StripePriceId"},
		Optional:    []string{"StripeUnitPrice", "StripeMinTopUp", "StripePromotionCodesEnabled", "CustomCallbackAddress"},
		WebhookPath: "/api/stripe/webhook",
	},
	{
		Provider:    "creem",
		DisplayName: "Creem",
		Required:    []string{"CreemApiKey", "CreemProducts"},
		Optional:    []string{"CreemWebhookSecret", "CreemTestMode", "CustomCallbackAddress"},
		WebhookPath: "/api/creem/webhook",
	},
	{
		Provider:    "epay",
		DisplayName: "Epay",
		Required:    []string{"PayAddress", "EpayId", "EpayKey"},
		Optional:    []string{"Price", "MinTopUp", "USDExchangeRate", "CustomCallbackAddress"},
		WebhookPath: "/api/user/epay/notify",
	},
	{
		Provider:    "waffo",
		DisplayName: "Waffo",
		Required:    []string{"WaffoMerchantId"},
		Optional:    []string{"WaffoCurrency", "WaffoUnitPrice", "WaffoMinTopUp", "CustomCallbackAddress"},
		SwitchKey:   "WaffoEnabled",
		WebhookPath: "/api/waffo/webhook",
	},
}

// copilotGatewayByName finds a provider specification.
func copilotGatewayByName(name string) (copilotGatewaySpec, bool) {
	name = strings.ToLower(strings.TrimSpace(name))
	for _, spec := range copilotGatewaySpecs {
		if spec.Provider == name {
			return spec, true
		}
	}
	return copilotGatewaySpec{}, false
}

// copilotGatewayLive reports whether the platform's own predicate says the
// provider is taking payments right now.
func copilotGatewayLive(provider string) bool {
	switch provider {
	case "nowpayments":
		return isNowPaymentsTopUpEnabled()
	case "stripe":
		return isStripeTopUpEnabled()
	case "creem":
		return isCreemTopUpEnabled()
	case "waffo":
		return isWaffoTopUpEnabled()
	case "epay":
		return copilotOptionString("PayAddress") != "" &&
			copilotOptionString("EpayId") != "" &&
			copilotOptionString("EpayKey") != ""
	}
	return false
}

// isCredentialKey reports whether an option key holds a secret.
func isCredentialKey(key string) bool {
	switch key {
	case "NowPaymentsApiKey", "NowPaymentsIpnSecret",
		"StripeApiSecret", "StripeWebhookSecret",
		"CreemApiKey", "CreemWebhookSecret",
		"EpayKey":
		return true
	}
	return false
}

// GetCopilotPaymentGateways lists the providers this tool can configure, what
// each one needs, and which are live — so the model can answer "what is missing
// for Stripe?" without guessing.
func GetCopilotPaymentGateways(c *gin.Context) {
	type gatewayStatus struct {
		Provider    string   `json:"provider"`
		DisplayName string   `json:"display_name"`
		Required    []string `json:"required"`
		Optional    []string `json:"optional"`
		Configured  []string `json:"configured"`
		Missing     []string `json:"missing"`
		Enabled     bool     `json:"enabled"`
		WebhookPath string   `json:"webhook_path"`
	}
	rows := make([]gatewayStatus, 0, len(copilotGatewaySpecs))
	for _, spec := range copilotGatewaySpecs {
		configured := make([]string, 0, len(spec.Required))
		missing := make([]string, 0, len(spec.Required))
		for _, key := range spec.Required {
			if strings.TrimSpace(copilotOptionString(key)) != "" {
				configured = append(configured, key)
			} else {
				missing = append(missing, key)
			}
		}
		rows = append(rows, gatewayStatus{
			Provider:    spec.Provider,
			DisplayName: spec.DisplayName,
			Required:    spec.Required,
			Optional:    spec.Optional,
			Configured:  configured,
			Missing:     missing,
			Enabled:     copilotGatewayLive(spec.Provider),
			WebhookPath: spec.WebhookPath,
		})
	}
	common.ApiSuccess(c, gin.H{
		"gateways":             rows,
		"compliance_confirmed": operation_setting.IsPaymentComplianceConfirmed(),
	})
}

// ConfigureCopilotPaymentGateway serves the configurePaymentGateway tool.
func ConfigureCopilotPaymentGateway(c *gin.Context) {
	if !copilotRequireRoot(c, "Payment gateway settings") {
		return
	}
	var request struct {
		Provider    string            `json:"provider"`
		Credentials map[string]string `json:"credentials"`
		Settings    map[string]string `json:"settings"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	spec, ok := copilotGatewayByName(request.Provider)
	if !ok {
		names := make([]string, 0, len(copilotGatewaySpecs))
		for _, candidate := range copilotGatewaySpecs {
			names = append(names, candidate.Provider)
		}
		sort.Strings(names)
		common.ApiErrorMsg(c, "unknown provider; use one of: "+strings.Join(names, ", "))
		return
	}

	expected := make(map[string]struct{}, len(spec.Required)+len(spec.Optional))
	for _, key := range spec.Required {
		expected[key] = struct{}{}
	}
	for _, key := range spec.Optional {
		expected[key] = struct{}{}
	}

	values := make(map[string]string, len(request.Credentials)+len(request.Settings))
	for key, value := range request.Credentials {
		values[key] = value
	}
	for key, value := range request.Settings {
		if _, duplicate := values[key]; duplicate {
			common.ApiErrorMsg(c, "key "+key+" was sent twice; send it once")
			return
		}
		values[key] = value
	}
	for key := range values {
		if _, isExpected := expected[key]; !isExpected {
			common.ApiErrorMsg(c, "key "+key+" is not a setting of "+spec.DisplayName)
			return
		}
		// The provider's list and the Copilot's write allowlist must agree
		// before anything is written, so the two cannot drift apart.
		if _, writable := copilotPaymentOptionKeys[key]; !writable {
			common.ApiErrorMsg(c, "key "+key+" is not writable through the Copilot")
			return
		}
	}

	// Write in a stable order, so a partial failure names what came before it.
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	written := make([]string, 0, len(keys))
	for _, key := range keys {
		if err := copilotUpdateOption(c, key, strings.TrimSpace(values[key])); err != nil {
			common.ApiErrorMsg(c, "wrote "+strings.Join(written, ", ")+" then failed on "+key+": "+err.Error())
			return
		}
		written = append(written, key)
	}

	// Re-read the truth: which required keys are set now, and does the platform
	// consider the gateway live?
	missing := make([]string, 0, len(spec.Required))
	for _, key := range spec.Required {
		if strings.TrimSpace(copilotOptionString(key)) == "" {
			missing = append(missing, key)
		}
	}
	compliance := operation_setting.IsPaymentComplianceConfirmed()
	live := copilotGatewayLive(spec.Provider)

	payload := gin.H{
		"provider":             spec.Provider,
		"display_name":         spec.DisplayName,
		"written":              written,
		"required":             spec.Required,
		"missing":              missing,
		"enabled":              live,
		"compliance_confirmed": compliance,
		"webhook_path":         spec.WebhookPath,
	}
	switch {
	case live:
		payload["message"] = spec.DisplayName + " is live and taking payments."
	case len(missing) > 0:
		payload["message"] = spec.DisplayName + " is saved but missing " + strings.Join(missing, ", ") + "."
	case !compliance:
		payload["message"] = spec.DisplayName + " is fully configured but inactive: the payment compliance acknowledgement must be confirmed by a person in the console, and this tool does not sign it."
	default:
		payload["message"] = spec.DisplayName + " is fully configured but not reported as live."
	}
	common.ApiSuccess(c, payload)
}

// GetCopilotSalesReport serves the getSalesReport tool: revenue, upstream cost,
// profit, request count and tokens for a window, grouped by day, model, user,
// channel or group. Every figure comes from the usage log the gateway wrote, so
// it is measured rather than estimated.
func GetCopilotSalesReport(c *gin.Context) {
	parse := func(name string) int64 {
		value, err := strconv.ParseInt(strings.TrimSpace(c.Query(name)), 10, 64)
		if err != nil {
			return 0
		}
		return value
	}
	start := parse("start_timestamp")
	end := parse("end_timestamp")
	if start == 0 && end == 0 {
		// The common question needs no dates: the last seven days.
		end = time.Now().Unix()
		start = end - 7*86400
	} else if end == 0 {
		end = time.Now().Unix()
	}
	groupBy := strings.TrimSpace(c.DefaultQuery("group_by", "day"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	report, err := model.GetCopilotSalesReport(start, end, groupBy, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, report)
}
