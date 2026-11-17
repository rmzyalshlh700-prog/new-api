package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// Admin Copilot tools that act on the platform.
//
// Reading tools query the model layer directly and return a projection that
// carries no credentials. Writing tools reuse the admin handler the console
// calls, so validation, permission checks, cache invalidation and the manage
// audit trail behave exactly as they do for a click in the panel. Every
// endpoint is guarded by RequireCopilotTool, so a disabled tool is refused by
// the server and not only hidden from the model.

// copilotAdminEnvelope is the answer shape the admin handlers use.
type copilotAdminEnvelope struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

// copilotCallAdminHandler runs an existing admin handler in process, as the
// signed-in operator, and hands back its data payload.
//
// Reimplementation is the alternative, and it drifts: a second copy of channel
// validation or ability sync would eventually disagree with the real one. The
// inner context carries the operator's own keys, so the permission checks
// inside those handlers still apply to whoever asked the Copilot.
func copilotCallAdminHandler(c *gin.Context, handler gin.HandlerFunc, method string, target string, body any, params gin.Params) (json.RawMessage, error) {
	var reader io.Reader = strings.NewReader("")
	if body != nil {
		encoded, err := common.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = strings.NewReader(string(encoded))
	}
	recorder := httptest.NewRecorder()
	inner, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(method, target, reader)
	request.Header.Set("Content-Type", "application/json")
	if c.Request != nil {
		request = request.WithContext(c.Request.Context())
	}
	inner.Request = request
	inner.Params = params
	for key, value := range c.Keys {
		inner.Set(key, value)
	}

	handler(inner)

	var envelope copilotAdminEnvelope
	if err := common.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		return nil, fmt.Errorf("the admin handler answered with an unexpected body")
	}
	if !envelope.Success {
		message := strings.TrimSpace(envelope.Message)
		if message == "" {
			message = "the admin handler refused the request"
		}
		return envelope.Data, errors.New(message)
	}
	return envelope.Data, nil
}

// copilotRespondData answers a tool call with a handler's raw data payload.
func copilotRespondData(c *gin.Context, data json.RawMessage, err error) {
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if len(data) == 0 {
		data = json.RawMessage("null")
	}
	common.ApiSuccess(c, data)
}

// copilotQueryInt reads an optional integer query parameter, clamped to a range
// so a model cannot ask for an unbounded page.
func copilotQueryInt(c *gin.Context, name string, fallback int, min int, max int) int {
	raw := strings.TrimSpace(c.Query(name))
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// copilotPageSize bounds how much one tool call may return.
func copilotPageSize(c *gin.Context) int {
	return copilotQueryInt(c, "page_size", 20, 1, 100)
}

// copilotPageStart converts a page number into a row offset.
func copilotPageStart(c *gin.Context, pageSize int) int {
	page := copilotQueryInt(c, "page", 1, 1, 1000)
	return (page - 1) * pageSize
}

// copilotSplitModels turns a channel's comma separated model list into names.
func copilotSplitModels(raw string) []string {
	models := make([]string, 0)
	for _, item := range strings.Split(raw, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			models = append(models, item)
		}
	}
	return models
}

// copilotChannelSummary is the safe projection of a channel: it never carries
// the upstream key, a multi-key list or a credential summary.
type copilotChannelSummary struct {
	ID           int      `json:"id"`
	Name         string   `json:"name"`
	Type         int      `json:"type"`
	Status       int      `json:"status"`
	Group        string   `json:"group"`
	Models       []string `json:"models"`
	Priority     int64    `json:"priority"`
	Weight       uint     `json:"weight"`
	BaseURL      string   `json:"base_url"`
	Tag          string   `json:"tag"`
	Remark       string   `json:"remark"`
	ModelMapping string   `json:"model_mapping,omitempty"`
	UsedQuota    int64    `json:"used_quota"`
	Balance      float64  `json:"balance"`
	ResponseTime int      `json:"response_time"`
	TestTime     int64    `json:"test_time"`
	CreatedTime  int64    `json:"created_time"`
}

func copilotChannelSummaryFrom(channel *model.Channel) copilotChannelSummary {
	summary := copilotChannelSummary{
		ID:           channel.Id,
		Name:         channel.Name,
		Type:         channel.Type,
		Status:       channel.Status,
		Group:        channel.Group,
		Models:       copilotSplitModels(channel.Models),
		BaseURL:      channel.GetBaseURL(),
		UsedQuota:    channel.UsedQuota,
		Balance:      channel.Balance,
		ResponseTime: channel.ResponseTime,
		TestTime:     channel.TestTime,
		CreatedTime:  channel.CreatedTime,
	}
	if channel.Priority != nil {
		summary.Priority = *channel.Priority
	}
	if channel.Weight != nil {
		summary.Weight = *channel.Weight
	}
	if channel.Tag != nil {
		summary.Tag = *channel.Tag
	}
	if channel.Remark != nil {
		summary.Remark = *channel.Remark
	}
	if channel.ModelMapping != nil {
		summary.ModelMapping = *channel.ModelMapping
	}
	return summary
}

// copilotChannelStatusFilter maps a readable status to the stored value. An
// empty filter keeps every status.
func copilotChannelStatusFilter(raw string) (int, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "all":
		return 0, true
	case "enabled", "active", "1":
		return common.ChannelStatusEnabled, true
	case "disabled", "2":
		return common.ChannelStatusManuallyDisabled, true
	case "auto_disabled", "auto-disabled", "3":
		return common.ChannelStatusAutoDisabled, true
	default:
		return 0, false
	}
}

// GetCopilotChannelList serves the listChannels tool.
func GetCopilotChannelList(c *gin.Context) {
	statusFilter, ok := copilotChannelStatusFilter(c.Query("status"))
	if !ok {
		common.ApiErrorMsg(c, "status must be enabled, disabled or auto_disabled")
		return
	}
	channels, err := model.SearchChannels(
		strings.TrimSpace(c.Query("keyword")),
		strings.TrimSpace(c.Query("group")),
		strings.TrimSpace(c.Query("model")),
		true,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	matched := make([]copilotChannelSummary, 0, len(channels))
	for _, channel := range channels {
		if statusFilter != 0 && channel.Status != statusFilter {
			continue
		}
		matched = append(matched, copilotChannelSummaryFrom(channel))
	}
	pageSize := copilotPageSize(c)
	start := copilotPageStart(c, pageSize)
	if start > len(matched) {
		start = len(matched)
	}
	end := start + pageSize
	if end > len(matched) {
		end = len(matched)
	}
	common.ApiSuccess(c, gin.H{
		"items": matched[start:end],
		"total": len(matched),
	})
}

// GetCopilotChannel serves the getChannel tool for one channel.
func GetCopilotChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "A channel id is required")
		return
	}
	channel, err := model.GetChannelById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, copilotChannelSummaryFrom(channel))
}

// copilotChannelBody prepares the channel object a createChannel tool call
// submits: the operator's own fields, with a model array accepted as a list.
func copilotChannelBody(c *gin.Context) (map[string]any, error) {
	var payload map[string]any
	if err := common.DecodeJson(c.Request.Body, &payload); err != nil {
		return nil, common.NewMessage("Invalid request body")
	}
	if len(payload) == 0 {
		return nil, common.NewMessage("A channel body is required")
	}
	if models, ok := payload["models"].([]any); ok {
		names := make([]string, 0, len(models))
		for _, item := range models {
			if name, ok := item.(string); ok && strings.TrimSpace(name) != "" {
				names = append(names, strings.TrimSpace(name))
			}
		}
		payload["models"] = strings.Join(names, ",")
	}
	return payload, nil
}

// CreateCopilotChannel serves the createChannel tool through the admin handler.
func CreateCopilotChannel(c *gin.Context) {
	payload, err := copilotChannelBody(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if name, _ := payload["name"].(string); strings.TrimSpace(name) == "" {
		common.ApiErrorMsg(c, "A channel name is required")
		return
	}
	if _, ok := payload["type"]; !ok {
		common.ApiErrorMsg(c, "A channel type is required")
		return
	}
	data, handlerErr := copilotCallAdminHandler(c, AddChannel, http.MethodPost, "/api/channel/", gin.H{
		"mode":    "single",
		"channel": payload,
	}, nil)
	copilotRespondData(c, data, handlerErr)
}

// UpdateCopilotChannel serves the updateChannel tool. The admin handler already
// treats the body as a patch, so only the fields the operator asked to change
// are sent.
func UpdateCopilotChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "A channel id is required")
		return
	}
	payload, err := copilotChannelBody(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// Status has its own tool, and the update handler refuses the field.
	delete(payload, "status")
	payload["id"] = id
	data, handlerErr := copilotCallAdminHandler(c, UpdateChannel, http.MethodPut, "/api/channel/", payload, nil)
	copilotRespondData(c, data, handlerErr)
}

// DeleteCopilotChannel serves the deleteChannel tool.
func DeleteCopilotChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "A channel id is required")
		return
	}
	data, handlerErr := copilotCallAdminHandler(c, DeleteChannel, http.MethodDelete, "/api/channel/"+strconv.Itoa(id), nil, gin.Params{
		{Key: "id", Value: strconv.Itoa(id)},
	})
	copilotRespondData(c, data, handlerErr)
}

// SetCopilotChannelStatus serves the setChannelStatus tool.
func SetCopilotChannelStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "A channel id is required")
		return
	}
	var request struct {
		Status int `json:"status"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	data, handlerErr := copilotCallAdminHandler(c, UpdateChannelStatus, http.MethodPost, "/api/channel/"+strconv.Itoa(id)+"/status", gin.H{
		"status": request.Status,
	}, gin.Params{{Key: "id", Value: strconv.Itoa(id)}})
	copilotRespondData(c, data, handlerErr)
}

// TestCopilotChannel serves the testChannel tool. The query carries the model,
// endpoint type and streaming flag the admin test page sends.
func TestCopilotChannel(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "A channel id is required")
		return
	}
	target := "/api/channel/test/" + strconv.Itoa(id)
	if c.Request != nil && c.Request.URL.RawQuery != "" {
		target += "?" + c.Request.URL.RawQuery
	}
	data, handlerErr := copilotCallAdminHandler(c, TestChannel, http.MethodGet, target, nil, gin.Params{
		{Key: "id", Value: strconv.Itoa(id)},
	})
	copilotRespondData(c, data, handlerErr)
}

// copilotModelEntry is one model of the catalogue the listModels tool returns.
type copilotModelEntry struct {
	Name            string   `json:"name"`
	ChannelCount    int      `json:"channel_count"`
	EnabledChannels int      `json:"enabled_channels"`
	Groups          []string `json:"groups"`
}

// GetCopilotModelList serves the listModels tool: every model any channel
// serves, with how many channels carry it and whether it is currently enabled.
func GetCopilotModelList(c *gin.Context) {
	channels, err := model.SearchChannels("", "", "", true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	keyword := strings.ToLower(strings.TrimSpace(c.Query("keyword")))
	type aggregate struct {
		channels int
		enabled  int
		groups   map[string]struct{}
	}
	models := make(map[string]*aggregate)
	for _, channel := range channels {
		for _, name := range copilotSplitModels(channel.Models) {
			entry, ok := models[name]
			if !ok {
				entry = &aggregate{groups: make(map[string]struct{})}
				models[name] = entry
			}
			entry.channels++
			if channel.Status == common.ChannelStatusEnabled {
				entry.enabled++
			}
			if channel.Group != "" {
				entry.groups[channel.Group] = struct{}{}
			}
		}
	}
	names := make([]string, 0, len(models))
	for name := range models {
		if keyword != "" && !strings.Contains(strings.ToLower(name), keyword) {
			continue
		}
		names = append(names, name)
	}
	sort.Strings(names)
	pageSize := copilotPageSize(c)
	start := copilotPageStart(c, pageSize)
	if start > len(names) {
		start = len(names)
	}
	end := start + pageSize
	if end > len(names) {
		end = len(names)
	}
	items := make([]copilotModelEntry, 0, end-start)
	for _, name := range names[start:end] {
		entry := models[name]
		groups := make([]string, 0, len(entry.groups))
		for group := range entry.groups {
			groups = append(groups, group)
		}
		sort.Strings(groups)
		items = append(items, copilotModelEntry{
			Name:            name,
			ChannelCount:    entry.channels,
			EnabledChannels: entry.enabled,
			Groups:          groups,
		})
	}
	common.ApiSuccess(c, gin.H{
		"items": items,
		"total": len(names),
	})
}

// SetCopilotChannelModels serves the setChannelModels tool: it replaces, adds to
// or removes from the model list a channel offers, then saves it through the
// admin update handler so abilities and caches follow.
func SetCopilotChannelModels(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "A channel id is required")
		return
	}
	var request struct {
		Models []string `json:"models"`
		Add    []string `json:"add"`
		Remove []string `json:"remove"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	channel, err := model.GetChannelById(id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	next := copilotSplitModels(channel.Models)
	if request.Models != nil {
		next = copilotSplitModels(strings.Join(request.Models, ","))
	}
	removed := make(map[string]struct{}, len(request.Remove))
	for _, name := range request.Remove {
		removed[strings.TrimSpace(name)] = struct{}{}
	}
	kept := make([]string, 0, len(next)+len(request.Add))
	seen := make(map[string]struct{}, len(next)+len(request.Add))
	for _, name := range next {
		if _, drop := removed[name]; drop {
			continue
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		kept = append(kept, name)
	}
	for _, name := range request.Add {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		kept = append(kept, name)
	}
	if len(kept) == 0 {
		common.ApiErrorMsg(c, "A channel needs at least one model")
		return
	}
	data, handlerErr := copilotCallAdminHandler(c, UpdateChannel, http.MethodPut, "/api/channel/", gin.H{
		"id":     id,
		"models": strings.Join(kept, ","),
	}, nil)
	if handlerErr != nil {
		copilotRespondData(c, data, handlerErr)
		return
	}
	common.ApiSuccess(c, gin.H{
		"id":     id,
		"models": kept,
	})
}

// copilotLogEntry is the safe projection of a usage log record.
type copilotLogEntry struct {
	ID               int    `json:"id"`
	CreatedAt        int64  `json:"created_at"`
	Type             int    `json:"type"`
	Username         string `json:"username"`
	ModelName        string `json:"model_name"`
	TokenName        string `json:"token_name"`
	ChannelID        int    `json:"channel_id"`
	ChannelName      string `json:"channel_name"`
	Group            string `json:"group"`
	Quota            int    `json:"quota"`
	PromptTokens     int    `json:"prompt_tokens"`
	CompletionTokens int    `json:"completion_tokens"`
	UseTime          int    `json:"use_time"`
	RequestID        string `json:"request_id,omitempty"`
	Content          string `json:"content,omitempty"`
}

// GetCopilotLogs serves the searchLogs tool over the usage log database.
func GetCopilotLogs(c *gin.Context) {
	var filter model.LogFilter
	filter.Username = strings.TrimSpace(c.Query("username"))
	filter.ModelName = strings.TrimSpace(c.Query("model"))
	filter.TokenName = strings.TrimSpace(c.Query("token_name"))
	filter.Group = strings.TrimSpace(c.Query("group"))
	filter.RequestId = strings.TrimSpace(c.Query("request_id"))
	if raw := strings.TrimSpace(c.Query("type")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			common.ApiErrorMsg(c, "type must be a number")
			return
		}
		filter.Type = value
	}
	if raw := strings.TrimSpace(c.Query("channel_id")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			common.ApiErrorMsg(c, "channel_id must be a number")
			return
		}
		filter.Channel = value
	}
	if raw := strings.TrimSpace(c.Query("start_timestamp")); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			common.ApiErrorMsg(c, "start_timestamp must be a unix timestamp")
			return
		}
		filter.StartTimestamp = value
	}
	if raw := strings.TrimSpace(c.Query("end_timestamp")); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			common.ApiErrorMsg(c, "end_timestamp must be a unix timestamp")
			return
		}
		filter.EndTimestamp = value
	}
	pageSize := copilotPageSize(c)
	start := copilotPageStart(c, pageSize)
	logs, total, err := model.GetAllLogs(filter, start, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]copilotLogEntry, 0, len(logs))
	for _, log := range logs {
		items = append(items, copilotLogEntry{
			ID:               log.Id,
			CreatedAt:        log.CreatedAt,
			Type:             log.Type,
			Username:         log.Username,
			ModelName:        log.ModelName,
			TokenName:        log.TokenName,
			ChannelID:        log.ChannelId,
			ChannelName:      log.ChannelName,
			Group:            log.Group,
			Quota:            log.Quota,
			PromptTokens:     log.PromptTokens,
			CompletionTokens: log.CompletionTokens,
			UseTime:          log.UseTime,
			RequestID:        log.RequestId,
			Content:          log.Content,
		})
	}
	common.ApiSuccess(c, gin.H{
		"items": items,
		"total": total,
	})
}

// copilotRedemptionEntry is the safe projection of a redemption code.
type copilotRedemptionEntry struct {
	ID           int    `json:"id"`
	Key          string `json:"key"`
	Name         string `json:"name"`
	Status       int    `json:"status"`
	Quota        int    `json:"quota"`
	CreatedTime  int64  `json:"created_time"`
	RedeemedTime int64  `json:"redeemed_time"`
	ExpiredTime  int64  `json:"expired_time"`
	UsedUserID   int    `json:"used_user_id"`
}

// GetCopilotRedemptions serves the listRedemptions tool.
func GetCopilotRedemptions(c *gin.Context) {
	pageSize := copilotPageSize(c)
	start := copilotPageStart(c, pageSize)
	keyword := strings.TrimSpace(c.Query("keyword"))
	status := strings.TrimSpace(c.Query("status"))
	var (
		redemptions []*model.Redemption
		total       int64
		err         error
	)
	if keyword == "" {
		redemptions, total, err = model.GetAllRedemptions(start, pageSize)
	} else {
		redemptions, total, err = model.SearchRedemptions(keyword, status, start, pageSize)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]copilotRedemptionEntry, 0, len(redemptions))
	for _, redemption := range redemptions {
		items = append(items, copilotRedemptionEntry{
			ID:           redemption.Id,
			Key:          redemption.Key,
			Name:         redemption.Name,
			Status:       redemption.Status,
			Quota:        redemption.Quota,
			CreatedTime:  redemption.CreatedTime,
			RedeemedTime: redemption.RedeemedTime,
			ExpiredTime:  redemption.ExpiredTime,
			UsedUserID:   redemption.UsedUserId,
		})
	}
	common.ApiSuccess(c, gin.H{
		"items": items,
		"total": total,
	})
}

// CreateCopilotRedemption serves the createRedemption tool through the admin
// handler, so the compliance check and the audit entry stay in one place.
func CreateCopilotRedemption(c *gin.Context) {
	var request map[string]any
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	data, handlerErr := copilotCallAdminHandler(c, AddRedemption, http.MethodPost, "/api/redemption/", request, nil)
	if handlerErr != nil {
		copilotRespondData(c, data, handlerErr)
		return
	}
	var keys []string
	_ = common.Unmarshal(data, &keys)
	common.ApiSuccess(c, gin.H{
		"keys":  keys,
		"count": len(keys),
	})
}

// GetCopilotUserList serves the listUsers tool, a paged read with the same safe
// projection the user lookup tool returns.
func GetCopilotUserList(c *gin.Context) {
	pageSize := copilotPageSize(c)
	page := copilotQueryInt(c, "page", 1, 1, 1000)
	start := (page - 1) * pageSize
	keyword := strings.TrimSpace(c.Query("keyword"))
	var (
		users []*model.User
		total int64
		err   error
	)
	if keyword != "" {
		users, total, err = model.SearchUsers(keyword, strings.TrimSpace(c.Query("group")), nil, nil, start, pageSize)
	} else {
		users, total, err = model.GetAllUsers(&common.PageInfo{Page: page, PageSize: pageSize})
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]CopilotUserResult, 0, len(users))
	for _, user := range users {
		items = append(items, copilotUserFrom(user))
	}
	common.ApiSuccess(c, gin.H{
		"items": items,
		"total": total,
	})
}

// AdjustCopilotUserQuota serves the adjustUserQuota tool. A positive quota adds
// to a user's balance and a negative one takes away; the admin handler records
// who changed whose balance.
func AdjustCopilotUserQuota(c *gin.Context) {
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
	if request.Quota == 0 {
		common.ApiErrorMsg(c, "A non-zero quota change is required")
		return
	}
	data, err := copilotCallAdminHandler(c, ManageUser, http.MethodPost, "/api/user/manage", gin.H{
		"id":     request.ID,
		"action": "add_quota",
		"value":  request.Quota,
	}, nil)
	copilotRespondData(c, data, err)
}

// SetCopilotUserStatus serves the setUserStatus tool.
func SetCopilotUserStatus(c *gin.Context) {
	var request struct {
		ID     int    `json:"id"`
		Status string `json:"status"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	if request.ID <= 0 {
		common.ApiErrorMsg(c, "A user id is required")
		return
	}
	action := strings.ToLower(strings.TrimSpace(request.Status))
	if action != "enable" && action != "disable" {
		common.ApiErrorMsg(c, "status must be enable or disable")
		return
	}
	data, err := copilotCallAdminHandler(c, ManageUser, http.MethodPost, "/api/user/manage", gin.H{
		"id":     request.ID,
		"action": action,
	}, nil)
	copilotRespondData(c, data, err)
}
