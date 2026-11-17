package controller

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/console_setting"

	"github.com/gin-gonic/gin"
)

// Platform administration tools of the Admin Copilot.
//
// These tools reach settings and tables the channel and user tools do not, so
// each one re-checks authority before it acts: the Copilot permission switch is
// only one of the two gates (RequireCopilotTool is the other), and a write that
// changes the platform for every user stays reserved for the root account, as
// it is in the console. Values that are secrets are written, never read: the
// payment tools accept a new credential and answer with the key names they
// stored, never with the stored value.

// copilotRequireRoot refuses a platform-wide change unless the caller is the
// root administrator, exactly as the settings page does.
func copilotRequireRoot(c *gin.Context, capability string) bool {
	if c.GetInt("role") == common.RoleRootUser {
		return true
	}
	common.ApiErrorMsg(c, capability+" is reserved for the root administrator")
	return false
}

// copilotUpdateOption writes one option through the admin handler, so the
// validation, cache refresh and audit record of the settings page apply.
func copilotUpdateOption(c *gin.Context, key string, value string) error {
	_, err := copilotCallAdminHandler(c, UpdateOption, http.MethodPut, "/api/option/", gin.H{
		"key":   key,
		"value": value,
	}, nil)
	return err
}

// copilotOptionString reads one option without exposing the map itself.
func copilotOptionString(key string) string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	if common.OptionMap == nil {
		return ""
	}
	return common.Interface2String(common.OptionMap[key])
}

// copilotHasPrefix reports whether key carries one of the allowed prefixes.
func copilotHasPrefix(key string, prefixes []string) bool {
	for _, prefix := range prefixes {
		if strings.HasPrefix(key, prefix) {
			return true
		}
	}
	return false
}

// Monitoring settings the Copilot may read and change. Both are numeric or
// boolean settings about metrics collection; neither holds a credential.
var copilotMonitoringOptionPrefixes = []string{
	"perf_metrics_setting.",
	"performance_setting.",
}

// ToggleCopilotMaintenanceMode serves the toggleMaintenanceMode tool.
func ToggleCopilotMaintenanceMode(c *gin.Context) {
	if !copilotRequireRoot(c, "Maintenance mode") {
		return
	}
	var request struct {
		Enabled *bool `json:"enabled"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || request.Enabled == nil {
		common.ApiErrorMsg(c, "enabled must be true or false")
		return
	}
	value := "false"
	if *request.Enabled {
		value = "true"
	}
	if err := copilotUpdateOption(c, "maintenance_setting.enabled", value); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"enabled": *request.Enabled})
}

// GetCopilotMonitoringSettings serves the readMonitoring tool.
func GetCopilotMonitoringSettings(c *gin.Context) {
	settings := make(map[string]string)
	common.OptionMapRWMutex.RLock()
	for key, raw := range common.OptionMap {
		if !copilotHasPrefix(key, copilotMonitoringOptionPrefixes) {
			continue
		}
		settings[key] = common.Interface2String(raw)
	}
	common.OptionMapRWMutex.RUnlock()
	common.ApiSuccess(c, gin.H{"settings": settings})
}

// ConfigureCopilotMonitoring serves the configureMonitoring tool: it accepts
// only keys under the monitoring prefixes, and the option validator checks the
// value itself.
func ConfigureCopilotMonitoring(c *gin.Context) {
	if !copilotRequireRoot(c, "Monitoring configuration") {
		return
	}
	var request struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	key := strings.TrimSpace(request.Key)
	if !copilotHasPrefix(key, copilotMonitoringOptionPrefixes) {
		common.ApiErrorMsg(c, "key must be a monitoring setting")
		return
	}
	value := strings.TrimSpace(request.Value)
	if err := copilotUpdateOption(c, key, value); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"key": key, "value": value})
}

// CreateCopilotUser serves the createUser tool. Creating an administrator
// additionally requires the secure-verification proof the console asks for,
// which a tool call cannot supply, so such a call is refused rather than
// silently downgraded.
func CreateCopilotUser(c *gin.Context) {
	var request struct {
		Username    string `json:"username"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
		Role        int    `json:"role"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	username := strings.TrimSpace(request.Username)
	if username == "" || request.Password == "" {
		common.ApiErrorMsg(c, "A username and a password are required")
		return
	}
	role := request.Role
	if role == 0 {
		role = common.RoleCommonUser
	}
	data, err := copilotCallAdminHandler(c, CreateUser, http.MethodPost, "/api/user/", gin.H{
		"username":     username,
		"password":     request.Password,
		"display_name": strings.TrimSpace(request.DisplayName),
		"role":         role,
	}, nil)
	copilotRespondData(c, data, err)
}

// DeductCopilotUserQuota serves the deductUserQuota tool. A deduction is
// destructive by nature, so it is its own capability with its own switch, and
// the amount is always positive: the direction is the tool, not the sign.
func DeductCopilotUserQuota(c *gin.Context) {
	var request struct {
		ID    int `json:"id"`
		Quota int `json:"quota"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	if request.ID <= 0 {
		common.ApiErrorMsg(c, "A user id is required")
		return
	}
	if request.Quota <= 0 {
		common.ApiErrorMsg(c, "A positive quota amount is required")
		return
	}
	data, err := copilotCallAdminHandler(c, ManageUser, http.MethodPost, "/api/user/manage", gin.H{
		"id":     request.ID,
		"action": "add_quota",
		"mode":   "subtract",
		"value":  request.Quota,
	}, nil)
	copilotRespondData(c, data, err)
}

// ReadCopilotPayments serves the readPayments tool through the admin handler,
// so paging and the reply shape match the payments page.
func ReadCopilotPayments(c *gin.Context) {
	pageSize := copilotPageSize(c)
	page := copilotQueryInt(c, "page", 1, 1, 1000)
	target := fmt.Sprintf("/api/user/topup?page=%d&page_size=%d", page, pageSize)
	if keyword := strings.TrimSpace(c.Query("keyword")); keyword != "" {
		target += "&keyword=" + keyword
	}
	data, err := copilotCallAdminHandler(c, GetAllTopUps, http.MethodGet, target, nil, nil)
	copilotRespondData(c, data, err)
}

// copilotPaymentOptionKeys lists the payment settings the Copilot may write.
// Credentials are write-only: the reply names the keys and never echoes them.
var copilotPaymentOptionKeys = map[string]struct{}{
	"PayAddress":                  {},
	"CustomCallbackAddress":       {},
	"Price":                       {},
	"USDExchangeRate":             {},
	"MinTopUp":                    {},
	"TopupGroupRatio":             {},
	"EpayId":                      {},
	"EpayKey":                     {},
	"StripeApiSecret":             {},
	"StripeWebhookSecret":         {},
	"StripePriceId":               {},
	"StripeUnitPrice":             {},
	"StripeMinTopUp":              {},
	"StripePromotionCodesEnabled": {},
	"CreemApiKey":                 {},
	"CreemProducts":               {},
	"CreemTestMode":               {},
	"CreemWebhookSecret":          {},
	"NowPaymentsApiKey":           {},
	"NowPaymentsIpnSecret":        {},
	"NowPaymentsUnitPrice":        {},
	"NowPaymentsMinTopUp":         {},
	"WaffoEnabled":                {},
	"WaffoMerchantId":             {},
	"WaffoCurrency":               {},
	"WaffoUnitPrice":              {},
	"WaffoMinTopUp":               {},
}

// UpdateCopilotPaymentGateway serves the updatePaymentGateway tool.
func UpdateCopilotPaymentGateway(c *gin.Context) {
	if !copilotRequireRoot(c, "Payment gateway settings") {
		return
	}
	var request struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	key := strings.TrimSpace(request.Key)
	if _, ok := copilotPaymentOptionKeys[key]; !ok {
		common.ApiErrorMsg(c, "key is not a payment gateway setting")
		return
	}
	if err := copilotUpdateOption(c, key, strings.TrimSpace(request.Value)); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"updated": []string{key}})
}

// copilotMergeJSONOption merges numeric entries into a JSON object option and
// returns the encoded result plus the changed names.
func copilotMergeJSONOption(optionKey string, patch map[string]float64) (string, []string, error) {
	if len(patch) == 0 {
		return "", nil, common.NewMessage("No entries to change")
	}
	current := make(map[string]float64)
	if raw := strings.TrimSpace(copilotOptionString(optionKey)); raw != "" {
		// A malformed stored value must not be silently replaced: the operator
		// would lose pricing rules this tool cannot show them.
		if err := common.Unmarshal([]byte(raw), &current); err != nil {
			return "", nil, common.NewMessage(optionKey + " is not a JSON object of numbers")
		}
	}
	changed := make([]string, 0, len(patch))
	for name, value := range patch {
		name = strings.TrimSpace(name)
		if name == "" {
			return "", nil, common.NewMessage("A model or group name is required")
		}
		current[name] = value
		changed = append(changed, name)
	}
	sort.Strings(changed)
	encoded, err := common.Marshal(current)
	if err != nil {
		return "", nil, err
	}
	return string(encoded), changed, nil
}

// UpdateCopilotGroupRatio serves the updateGroupRatio tool.
func UpdateCopilotGroupRatio(c *gin.Context) {
	if !copilotRequireRoot(c, "Group ratios") {
		return
	}
	var request struct {
		Ratios map[string]float64 `json:"ratios"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	encoded, changed, err := copilotMergeJSONOption("GroupRatio", request.Ratios)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := copilotUpdateOption(c, "GroupRatio", encoded); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"groups": changed})
}

// copilotPricingOptionKeys maps a request field to the option it edits.
var copilotPricingOptionKeys = []struct {
	Field     string
	OptionKey string
}{
	{"model_ratios", "ModelRatio"},
	{"completion_ratios", "CompletionRatio"},
	{"model_prices", "ModelPrice"},
}

// UpdateCopilotModelPricing serves the updateModelPricing tool.
func UpdateCopilotModelPricing(c *gin.Context) {
	if !copilotRequireRoot(c, "Model pricing") {
		return
	}
	var request struct {
		ModelRatios      map[string]float64 `json:"model_ratios"`
		CompletionRatios map[string]float64 `json:"completion_ratios"`
		ModelPrices      map[string]float64 `json:"model_prices"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	patches := map[string]map[string]float64{
		"model_ratios":      request.ModelRatios,
		"completion_ratios": request.CompletionRatios,
		"model_prices":      request.ModelPrices,
	}
	updated := make(map[string][]string)
	for _, entry := range copilotPricingOptionKeys {
		patch := patches[entry.Field]
		if len(patch) == 0 {
			continue
		}
		encoded, changed, err := copilotMergeJSONOption(entry.OptionKey, patch)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if err := copilotUpdateOption(c, entry.OptionKey, encoded); err != nil {
			common.ApiError(c, err)
			return
		}
		updated[entry.OptionKey] = changed
	}
	if len(updated) == 0 {
		common.ApiErrorMsg(c, "Provide model_ratios, completion_ratios or model_prices")
		return
	}
	common.ApiSuccess(c, gin.H{"updated": updated})
}

// SetCopilotChannelKey serves the setChannelKey tool. The key is written
// through the channel update handler and never read back.
func SetCopilotChannelKey(c *gin.Context) {
	if ok := copilotRequireChannelPermission(c, authz.ChannelSensitiveWrite); !ok {
		return
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "A channel id is required")
		return
	}
	var request struct {
		Key string `json:"key"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	key := strings.TrimSpace(request.Key)
	if key == "" {
		common.ApiErrorMsg(c, "A channel key is required")
		return
	}
	data, handlerErr := copilotCallAdminHandler(c, UpdateChannel, http.MethodPut, "/api/channel/", gin.H{
		"id":  id,
		"key": key,
	}, nil)
	if handlerErr != nil {
		copilotRespondData(c, data, handlerErr)
		return
	}
	common.ApiSuccess(c, gin.H{"id": id, "key_updated": true})
}

// copilotLogFilterFromQuery builds the log filter every log tool shares.
func copilotLogFilterFromQuery(c *gin.Context) (model.LogFilter, error) {
	var filter model.LogFilter
	filter.Username = strings.TrimSpace(c.Query("username"))
	filter.ModelName = strings.TrimSpace(c.Query("model"))
	filter.TokenName = strings.TrimSpace(c.Query("token_name"))
	filter.Group = strings.TrimSpace(c.Query("group"))
	filter.RequestId = strings.TrimSpace(c.Query("request_id"))
	if raw := strings.TrimSpace(c.Query("type")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			return filter, common.NewMessage("type must be a number")
		}
		filter.Type = value
	}
	if raw := strings.TrimSpace(c.Query("channel_id")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			return filter, common.NewMessage("channel_id must be a number")
		}
		filter.Channel = value
	}
	if raw := strings.TrimSpace(c.Query("start_timestamp")); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return filter, common.NewMessage("start_timestamp must be a unix timestamp")
		}
		filter.StartTimestamp = value
	}
	if raw := strings.TrimSpace(c.Query("end_timestamp")); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return filter, common.NewMessage("end_timestamp must be a unix timestamp")
		}
		filter.EndTimestamp = value
	}
	return filter, nil
}

// ExportCopilotLogs serves the exportLogs tool: the same rows the usage log
// page shows, as CSV the operator can paste into a report.
func ExportCopilotLogs(c *gin.Context) {
	filter, err := copilotLogFilterFromQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	limit := copilotQueryInt(c, "limit", 200, 1, 1000)
	logs, total, err := model.GetAllLogs(filter, 0, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var builder strings.Builder
	writer := csv.NewWriter(&builder)
	header := []string{"id", "created_at", "username", "model", "token", "channel_id", "channel", "group", "quota", "prompt_tokens", "completion_tokens", "use_time", "request_id"}
	if err := writer.Write(header); err != nil {
		common.ApiError(c, err)
		return
	}
	for _, record := range logs {
		row := []string{
			strconv.Itoa(record.Id),
			time.Unix(record.CreatedAt, 0).UTC().Format(time.RFC3339),
			record.Username,
			record.ModelName,
			record.TokenName,
			strconv.Itoa(record.ChannelId),
			record.ChannelName,
			record.Group,
			strconv.Itoa(record.Quota),
			strconv.Itoa(record.PromptTokens),
			strconv.Itoa(record.CompletionTokens),
			strconv.Itoa(record.UseTime),
			record.RequestId,
		}
		if err := writer.Write(row); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"format":    "csv",
		"csv":       builder.String(),
		"rows":      len(logs),
		"total":     total,
		"truncated": int64(len(logs)) < total,
	})
}

// ListCopilotAnnouncements serves the listAnnouncements tool.
func ListCopilotAnnouncements(c *gin.Context) {
	list := console_setting.GetAnnouncements()
	common.ApiSuccess(c, gin.H{"items": list, "total": len(list)})
}

// PublishCopilotAnnouncement serves the publishAnnouncement tool: it appends one
// announcement to the console announcement list and saves it through the option
// handler, which validates the whole list before it is stored.
func PublishCopilotAnnouncement(c *gin.Context) {
	var request struct {
		Content     string `json:"content"`
		Type        string `json:"type"`
		PublishDate string `json:"publish_date"`
		Extra       string `json:"extra"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	content := strings.TrimSpace(request.Content)
	if content == "" {
		common.ApiErrorMsg(c, "A content string is required")
		return
	}
	publishDate := strings.TrimSpace(request.PublishDate)
	if publishDate == "" {
		publishDate = time.Now().UTC().Format(time.RFC3339)
	}
	if _, err := time.Parse(time.RFC3339, publishDate); err != nil {
		common.ApiErrorMsg(c, "publish_date must be an RFC3339 timestamp")
		return
	}
	entry := map[string]any{"content": content, "publishDate": publishDate}
	if kind := strings.TrimSpace(request.Type); kind != "" {
		entry["type"] = kind
	}
	if extra := strings.TrimSpace(request.Extra); extra != "" {
		entry["extra"] = extra
	}
	list := append(console_setting.GetAnnouncements(), entry)
	encoded, err := common.Marshal(list)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := copilotUpdateOption(c, "console_setting.announcements", string(encoded)); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"announcement": entry, "total": len(list)})
}

// DeleteCopilotUser serves the deleteUser tool.
//
// Deleting an account is the one user operation the console guards with a fresh
// security proof (service.VerificationScopeAdminUserDelete), and a tool call
// cannot produce one: the proof is entered by a person in the browser. The tool
// therefore goes through the very same admin handler, which refuses the call
// with that explanation, and never deletes on a weaker check. The operator
// finishes the deletion from the users page, where the proof is asked for.
func DeleteCopilotUser(c *gin.Context) {
	var request struct {
		ID int `json:"id"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	if request.ID <= 0 {
		common.ApiErrorMsg(c, "A user id is required")
		return
	}
	data, err := copilotCallAdminHandler(c, ManageUser, http.MethodPost, "/api/user/manage", gin.H{
		"id":     request.ID,
		"action": "delete",
	}, nil)
	copilotRespondData(c, data, err)
}
