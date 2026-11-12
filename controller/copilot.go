package controller

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// Admin Copilot: the React console registers frontend tools through CopilotKit
// and this package backs them with REST data endpoints plus a chat proxy that
// relays CopilotKit's GraphQL chat mutation through the internal channel
// system, answering in the GraphQL shape the runtime client expects.

// copilotChatRequest is the body of the generateCopilotResponse mutation sent
// by @copilotkit/runtime-client-gql (urql GraphQL-over-HTTP POST).
type copilotChatRequest struct {
	OperationName string                      `json:"operationName"`
	Query         string                      `json:"query"`
	Variables     copilotChatRequestVariables `json:"variables"`
}

type copilotChatRequestVariables struct {
	Data copilotChatRequestVariablesData `json:"data"`
}

type copilotChatRequestVariablesData struct {
	ThreadID string `json:"threadId"`
	RunID    string `json:"runId"`
	Messages []struct {
		ID          string `json:"id"`
		CreatedAt   string `json:"createdAt"`
		TextMessage *struct {
			Content string `json:"content"`
			Role    string `json:"role"`
		} `json:"textMessage"`
		ActionExecutionMessage *struct {
			Name      string `json:"name"`
			Arguments string `json:"arguments"`
		} `json:"actionExecutionMessage"`
		ResultMessage *struct {
			Result            string `json:"result"`
			ActionExecutionID string `json:"actionExecutionId"`
			ActionName        string `json:"actionName"`
		} `json:"resultMessage"`
	} `json:"messages"`
	Context []struct {
		Description string `json:"description"`
		Value       string `json:"value"`
	} `json:"context"`
	ForwardedParameters *struct {
		Model       string   `json:"model"`
		MaxTokens   *float64 `json:"maxTokens"`
		Temperature *float64 `json:"temperature"`
	} `json:"forwardedParameters"`
	Frontend struct {
		URL     string `json:"url"`
		Actions []struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			JSONSchema  string `json:"jsonSchema"`
		} `json:"actions"`
	} `json:"frontend"`
}

// copilotMessage is one entry of the messages list in the GraphQL response.
type copilotMessage struct {
	Typename          string               `json:"__typename"`
	ID                string               `json:"id"`
	CreatedAt         string               `json:"createdAt"`
	Role              string               `json:"role,omitempty"`
	Content           []string             `json:"content,omitempty"`
	Name              string               `json:"name,omitempty"`
	Arguments         []string             `json:"arguments,omitempty"`
	Result            string               `json:"result,omitempty"`
	ActionExecutionID string               `json:"actionExecutionId,omitempty"`
	ActionName        string               `json:"actionName,omitempty"`
	ParentMessageID   string               `json:"parentMessageId,omitempty"`
	Status            copilotMessageStatus `json:"status"`
}

type copilotMessageStatus struct {
	Typename string `json:"__typename"`
	Code     string `json:"code"`
}

// GetCopilotFinancials serves the admin Copilot tool data for revenue and
// profit stats. The data mirrors GET /api/admin/profit_stats.
func GetCopilotFinancials(c *gin.Context) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Unix()

	stats, err := model.GetProfitStats(startOfDay, startOfMonth)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stats)
}

// CopilotUserResult is the safe projection of a user record exposed to the
// Copilot tool: no credentials, tokens or invitation codes.
type CopilotUserResult struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	DisplayName  string `json:"display_name"`
	Email        string `json:"email"`
	Role         int    `json:"role"`
	Status       int    `json:"status"`
	Group        string `json:"group"`
	Quota        int    `json:"quota"`
	UsedQuota    int    `json:"used_quota"`
	RequestCount int    `json:"request_count"`
}

func copilotUserFrom(u *model.User) CopilotUserResult {
	return CopilotUserResult{
		ID:           u.Id,
		Username:     u.Username,
		DisplayName:  u.DisplayName,
		Email:        u.Email,
		Role:         u.Role,
		Status:       u.Status,
		Group:        u.Group,
		Quota:        u.Quota,
		UsedQuota:    u.UsedQuota,
		RequestCount: u.RequestCount,
	}
}

// GetCopilotUsers serves the admin Copilot tool data for user lookup, either
// by numeric id (?id=) or by email/username keyword (?keyword=).
func GetCopilotUsers(c *gin.Context) {
	if idStr := c.Query("id"); idStr != "" {
		id, err := strconv.Atoi(idStr)
		if err != nil || id <= 0 {
			common.ApiError(c, fmt.Errorf("invalid user id: %s", idStr))
			return
		}
		user, err := model.GetUserById(id, false)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, copilotUserFrom(user))
		return
	}

	keyword := strings.TrimSpace(c.Query("keyword"))
	if keyword == "" {
		common.ApiError(c, fmt.Errorf("id or keyword query parameter is required"))
		return
	}
	users, _, err := model.SearchUsers(keyword, "", nil, nil, 0, 10)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	results := make([]CopilotUserResult, 0, len(users))
	for _, u := range users {
		results = append(results, copilotUserFrom(u))
	}
	common.ApiSuccess(c, results)
}

// GetCopilotHealth serves the admin Copilot tool data for OS-level health:
// CPU, memory and network throughput from the shared live metrics sampler.
func GetCopilotHealth(c *gin.Context) {
	common.ApiSuccess(c, service.GetLiveMetrics())
}

// AdminCopilotChatInfo answers the CopilotKit v1.87+ runtime handshake. The
// client registers remote agents from `agents`, so a payload without a
// `default` agent makes CopilotKit drop every outgoing message ("Agent
// default not found") and breaks the chat message renderer. Keep the shape in
// sync with @copilotkit/core's performRuntimeConnection contract.
func AdminCopilotChatInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"version": "1.87.1",
		"agents": gin.H{
			"default": gin.H{
				"description": "Admin Copilot",
			},
		},
	})
}

// AdminCopilotChat is the CopilotKit runtimeUrl: a GraphQL-over-HTTP endpoint
// handling the generateCopilotResponse mutation. It translates the CopilotKit
// message list into an OpenAI chat completion with the frontend tools bound,
// relays it through the internal channel system, then converts the OpenAI
// response back into the CopilotResponse GraphQL shape. The urql client
// accepts a complete plain-JSON GraphQL response; the @stream/@defer directives
// in its query degrade gracefully to a single full result.
func AdminCopilotChat(c *gin.Context) {
	var payload copilotChatRequest
	if err := common.UnmarshalBodyReusable(c, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"errors": []gin.H{{"message": "invalid GraphQL request: " + err.Error()}}})
		return
	}
	if payload.OperationName != "" && payload.OperationName != "generateCopilotResponse" {
		c.JSON(http.StatusBadRequest, gin.H{"errors": []gin.H{{"message": "unsupported operation: " + payload.OperationName}}})
		return
	}
	data := payload.Variables.Data

	openaiResp, apiErr := copilotRelayChat(c, &data)
	if apiErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"data": gin.H{
				"generateCopilotResponse": gin.H{
					"threadId": data.ThreadID,
					"runId":    data.RunID,
					"status": gin.H{
						"__typename": "FailedResponseStatus",
						"code":       "Failed",
						"reason":     "UNKNOWN_ERROR",
						"details":    apiErr.Error(),
					},
					"messages": []copilotMessage{},
				},
			},
		})
		return
	}

	messages := copilotMessagesFromOpenAI(openaiResp, data.RunID)
	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"generateCopilotResponse": gin.H{
				"threadId": data.ThreadID,
				"runId":    data.RunID,
				"status": gin.H{
					"__typename": "SuccessResponseStatus",
					"code":       "Success",
				},
				"messages": messages,
			},
		},
	})
}

// copilotSystemPrompt describes the copilot's role; frontend context and page
// url are appended from the request.
const copilotSystemPrompt = "You are the Admin Copilot of an AI gateway console. " +
	"Answer concisely and professionally, and use the available tools when the " +
	"question needs live platform data instead of guessing."

// copilotRelayChat synthesizes an OpenAI chat completion from the CopilotKit
// payload and executes it through the internal relay pipeline on a synthetic
// gin context, mirroring how channel tests invoke Relay non-interactively.
func copilotRelayChat(c *gin.Context, data *copilotChatRequestVariablesData) (*dto.OpenAITextResponse, *types.NewAPIError) {
	request := buildCopilotChatRequest(data)

	// When an administrator configured a dedicated upstream, the Copilot talks
	// to it directly with its own credentials instead of the internal channels.
	if baseURL := setting.CopilotOption(setting.CopilotBaseURLOptionKey); baseURL != "" {
		return copilotDirectChat(c, request, baseURL, setting.CopilotOption(setting.CopilotAPIKeyOptionKey))
	}

	// Serialize the synthesized request and re-read it through the ordinary
	// relay entry point so validation, token counting and conversion all run.
	body, err := common.Marshal(request)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeJsonMarshalFailed)
	}

	relayCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	relayCtx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(string(body)))
	relayCtx.Request.Header.Set("Content-Type", "application/json")

	userID := c.GetInt("id")
	userCache, uerr := model.GetUserCache(userID)
	if uerr != nil {
		return nil, types.NewError(uerr, types.ErrorCodeQueryDataError)
	}
	userCache.WriteContext(relayCtx)
	relayCtx.Set("id", userID)
	group, _ := model.GetUserGroup(userID, false)
	relayCtx.Set("group", group)
	tempToken := &model.Token{
		UserId: userID,
		Name:   "admin-copilot",
		Group:  group,
	}
	_ = middleware.SetupContextForToken(relayCtx, tempToken)

	var relayErr *types.NewAPIError
	defer func() {
		if relayErr != nil {
			logger.LogError(c, common.LogText("copilot relay error: %s", common.LocalLogPreview(relayErr.Error())))
		}
	}()

	validated, verr := helper.GetAndValidateRequest(relayCtx, types.RelayFormatOpenAI)
	if verr != nil {
		return nil, types.NewError(verr, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	request = validated.(*dto.GeneralOpenAIRequest)
	relayInfo, gerr := relaycommon.GenRelayInfo(relayCtx, types.RelayFormatOpenAI, request, nil)
	if gerr != nil {
		return nil, types.NewError(gerr, types.ErrorCodeGenRelayInfoFailed)
	}
	relayInfo.IsChannelTest = true

	_, channelErr := getChannel(relayCtx, relayInfo, &service.RetryParam{
		Ctx:         relayCtx,
		TokenGroup:  relayInfo.TokenGroup,
		ModelName:   relayInfo.OriginModelName,
		RequestPath: "/v1/chat/completions",
		Retry:       common.GetPointer(0),
	})
	if channelErr != nil {
		return nil, channelErr
	}
	if berr := service.PrepareTieredBillingForSelectedGroup(relayCtx, relayInfo); berr != nil {
		return nil, berr
	}
	relayInfo.InitChannelMeta(relayCtx)

	if relayErr = relay.TextHelper(relayCtx, relayInfo); relayErr != nil {
		return nil, relayErr
	}

	return copilotParseRelayResponse(relayCtx)
}

// copilotParseRelayResponse extracts the completed OpenAI response that
// TextHelper wrote into the synthetic context's recorder.
func copilotParseRelayResponse(relayCtx *gin.Context) (*dto.OpenAITextResponse, *types.NewAPIError) {
	resp := relayCtx.Request.Response
	if resp == nil || resp.Body == nil {
		return nil, types.NewError(fmt.Errorf("copilot relay produced no response body"), types.ErrorCodeBadResponse)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeReadResponseBodyFailed)
	}
	var openaiResp dto.OpenAITextResponse
	if err := common.Unmarshal(body, &openaiResp); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if len(openaiResp.Choices) == 0 {
		return nil, types.NewError(fmt.Errorf("copilot relay response contained no choices"), types.ErrorCodeBadResponse)
	}
	return &openaiResp, nil
}

// copilotDirectChat sends the synthesized completion to the administrator's
// configured OpenAI-compatible upstream, authenticated with its own key. It is
// used instead of the internal relay whenever copilot_base_url is set.
func copilotDirectChat(c *gin.Context, request *dto.GeneralOpenAIRequest, baseURL string, apiKey string) (*dto.OpenAITextResponse, *types.NewAPIError) {
	body, err := common.Marshal(request)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeJsonMarshalFailed)
	}
	endpoint := setting.CopilotV1Endpoint(baseURL, "chat/completions")
	if err := service.ValidateSSRFProtectedFetchURL(endpoint); err != nil {
		return nil, types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	httpRequest, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}
	httpRequest.Header.Set("Content-Type", "application/json")
	httpRequest.Header.Set("Accept", "application/json")
	if apiKey != "" {
		httpRequest.Header.Set("Authorization", "Bearer "+apiKey)
	}

	protectedClient := *service.GetSSRFProtectedHTTPClient()
	protectedClient.Timeout = 120 * time.Second
	response, err := protectedClient.Do(httpRequest)
	if err != nil {
		return nil, types.NewError(fmt.Errorf("copilot upstream request failed: %w", err), types.ErrorCodeDoRequestFailed)
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 8<<20))
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeReadResponseBodyFailed)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		message := strings.TrimSpace(string(responseBody))
		if len(message) > 300 {
			message = message[:300] + "..."
		}
		if message == "" {
			message = response.Status
		}
		return nil, types.NewError(fmt.Errorf("copilot upstream rejected the request (%d): %s", response.StatusCode, message), types.ErrorCodeBadResponse)
	}

	var openaiResp dto.OpenAITextResponse
	if err := common.Unmarshal(responseBody, &openaiResp); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if len(openaiResp.Choices) == 0 {
		return nil, types.NewError(fmt.Errorf("copilot upstream response contained no choices"), types.ErrorCodeBadResponse)
	}
	if openaiResp.Id == "" {
		openaiResp.Id = fmt.Sprintf("chatcmpl-copilot-%d", time.Now().UnixNano())
	}
	return &openaiResp, nil
}

// buildCopilotChatRequest converts the CopilotKit conversation, context and
// frontend tools into an OpenAI chat completion request.
func buildCopilotChatRequest(data *copilotChatRequestVariablesData) *dto.GeneralOpenAIRequest {
	var sb strings.Builder
	sb.WriteString(copilotSystemPrompt)
	if data.Frontend.URL != "" {
		sb.WriteString("\nCurrent admin page: ")
		sb.WriteString(data.Frontend.URL)
	}
	for _, ctxItem := range data.Context {
		sb.WriteString("\nContext - ")
		sb.WriteString(ctxItem.Description)
		sb.WriteString(": ")
		sb.WriteString(ctxItem.Value)
	}

	messages := []dto.Message{
		{Role: "system", Content: sb.String()},
	}

	for _, m := range data.Messages {
		switch {
		case m.TextMessage != nil:
			role := m.TextMessage.Role
			if role == "" {
				role = "user"
			}
			messages = append(messages, dto.Message{Role: role, Content: m.TextMessage.Content})
		case m.ActionExecutionMessage != nil:
			// The model previously requested a frontend tool call.
			toolCallID := fmt.Sprintf("call_%s", m.ID)
			messages = append(messages, dto.Message{
				Role:    "assistant",
				Content: "",
				ToolCalls: mustJSON([]map[string]any{{
					"id":   toolCallID,
					"type": "function",
					"function": map[string]any{
						"name":      m.ActionExecutionMessage.Name,
						"arguments": m.ActionExecutionMessage.Arguments,
					},
				}}),
			})
		case m.ResultMessage != nil:
			// The frontend executed the tool and sent the result back.
			messages = append(messages, dto.Message{
				Role:       "tool",
				Content:    m.ResultMessage.Result,
				ToolCallId: fmt.Sprintf("call_%s", m.ResultMessage.ActionExecutionID),
			})
		}
	}

	req := &dto.GeneralOpenAIRequest{
		Model:    copilotModelName(),
		Messages: messages,
		Stream:   common.GetPointer(false),
	}

	// Only actions enabled in the Copilot settings may reach the model: a tool
	// the administrator disabled is never advertised to the LLM.
	enabledTools := setting.CopilotEnabledToolSet()
	if len(data.Frontend.Actions) > 0 {
		tools := make([]dto.ToolCallRequest, 0, len(data.Frontend.Actions))
		for _, action := range data.Frontend.Actions {
			if _, enabled := enabledTools[action.Name]; !enabled {
				continue
			}
			tools = append(tools, dto.ToolCallRequest{
				Type: "function",
				Function: dto.FunctionRequest{
					Name:        action.Name,
					Description: action.Description,
					Parameters:  []byte(action.JSONSchema),
				},
			})
		}
		if len(tools) > 0 {
			req.Tools = tools
		}
	}

	if fp := data.ForwardedParameters; fp != nil {
		// An explicit model in the Copilot settings wins over the browser's
		// forwarded parameter.
		if fp.Model != "" && setting.CopilotOption(setting.CopilotModelOptionKey) == "" {
			req.Model = fp.Model
		}
		if fp.MaxTokens != nil {
			req.MaxTokens = common.GetPointer(uint(*fp.MaxTokens))
		}
		if fp.Temperature != nil {
			req.Temperature = fp.Temperature
		}
	}
	return req
}

// copilotModelName returns the model the Admin Copilot should use. The model
// saved in the Copilot settings wins; operators otherwise override it with the
// COPILOT_MODEL environment variable, and the default is a widely available
// chat model.
func copilotModelName() string {
	if m := setting.CopilotOption(setting.CopilotModelOptionKey); m != "" {
		return m
	}
	if m := strings.TrimSpace(os.Getenv("COPILOT_MODEL")); m != "" {
		return m
	}
	return "gpt-4o-mini"
}

// copilotMessagesFromOpenAI converts an OpenAI chat completion into the
// CopilotKit GraphQL message union. A text answer becomes a TextMessageOutput;
// a tool call becomes an ActionExecutionMessageOutput whose id is the tool
// result correlation id ("call_<messageId>") the frontend sends back.
func copilotMessagesFromOpenAI(resp *dto.OpenAITextResponse, parentMessageID string) []copilotMessage {
	created := time.Now().UTC().Format(time.RFC3339)
	choice := resp.Choices[0]
	out := make([]copilotMessage, 0, 1)

	if len(choice.ParseToolCalls()) > 0 {
		for _, toolCall := range choice.ParseToolCalls() {
			out = append(out, copilotMessage{
				Typename:        "ActionExecutionMessageOutput",
				ID:              strings.TrimPrefix(toolCall.ID, "call_"),
				CreatedAt:       created,
				Name:            toolCall.Function.Name,
				Arguments:       []string{toolCall.Function.Arguments},
				ParentMessageID: parentMessageID,
				Status:          copilotMessageStatus{Typename: "SuccessMessageStatus", Code: "Success"},
			})
		}
		return out
	}

	out = append(out, copilotMessage{
		Typename:        "TextMessageOutput",
		ID:              resp.Id,
		CreatedAt:       created,
		Role:            "assistant",
		Content:         []string{copilotContentString(choice.Content)},
		ParentMessageID: parentMessageID,
		Status:          copilotMessageStatus{Typename: "SuccessMessageStatus", Code: "Success"},
	})
	return out
}

// copilotContentString flattens the OpenAI message content, which may be a
// plain string or a content-part array, into plain text.
func copilotContentString(content any) string {
	switch v := content.(type) {
	case string:
		return v
	case []any:
		parts := make([]string, 0, len(v))
		for _, item := range v {
			if m, ok := item.(map[string]any); ok {
				if t, ok := m["text"].(string); ok {
					parts = append(parts, t)
				}
			}
		}
		return strings.Join(parts, "")
	default:
		if content == nil {
			return ""
		}
		if b, err := common.Marshal(content); err == nil {
			return string(b)
		}
		return ""
	}
}

// mustJSON marshals v, falling back to a JSON null on failure. It only feeds
// dto.Message.ToolCalls with values this file constructs itself.
func mustJSON(v any) json.RawMessage {
	b, err := common.Marshal(v)
	if err != nil {
		return []byte("null")
	}
	return b
}
