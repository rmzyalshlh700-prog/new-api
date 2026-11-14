package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// The interactive Admin Copilot chat is an AG-UI agent: @copilotkit/react-core
// posts a RunAgentInput to this endpoint and reads a server-sent event stream.
// The GraphQL mutation handled in copilot.go is only used by CopilotTask, which
// awaits a single response. Both shapes are accepted here; the AG-UI branch is
// the one the chat panel uses.

// copilotAguiInput is the subset of the AG-UI RunAgentInput this proxy reads.
type copilotAguiInput struct {
	ThreadID string               `json:"threadId"`
	RunID    string               `json:"runId"`
	Messages []copilotAguiMessage `json:"messages"`
	Tools    []copilotAguiTool    `json:"tools"`
	Context  []struct {
		Description string `json:"description"`
		Value       any    `json:"value"`
	} `json:"context"`
	ForwardedProps map[string]any `json:"forwardedProps"`
}

type copilotAguiMessage struct {
	ID         string                `json:"id"`
	Role       string                `json:"role"`
	Content    jsonRaw               `json:"content"`
	ToolCalls  []copilotAguiToolCall `json:"toolCalls"`
	ToolCallID string                `json:"toolCallId"`
}

type copilotAguiToolCall struct {
	ID       string              `json:"id"`
	Type     string              `json:"type"`
	Function copilotAguiFunction `json:"function"`
}

type copilotAguiFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type copilotAguiTool struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Parameters  jsonRaw `json:"parameters"`
}

// jsonRaw keeps an unknown JSON value so string and structured content can be
// decoded lazily, without a second decoding pass over the body.
type jsonRaw = []byte

// isCopilotAguiRequest reports whether the body is an AG-UI run rather than the
// GraphQL mutation. The GraphQL envelope always carries a "variables" object.
func isCopilotAguiRequest(keys map[string]any) bool {
	_, hasVariables := keys["variables"]
	return !hasVariables
}

// copilotAguiText extracts plain text from a message content field, which may
// be a string or a list of content parts.
func copilotAguiText(raw jsonRaw) string {
	if len(bytes.TrimSpace(raw)) == 0 || string(bytes.TrimSpace(raw)) == "null" {
		return ""
	}
	var text string
	if err := common.Unmarshal(raw, &text); err == nil {
		return text
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := common.Unmarshal(raw, &parts); err != nil {
		return ""
	}
	chunks := make([]string, 0, len(parts))
	for _, part := range parts {
		if part.Type == "text" && part.Text != "" {
			chunks = append(chunks, part.Text)
		}
	}
	return strings.Join(chunks, "")
}

// copilotAguiContextBlock renders the browser's readable context as inert data,
// matching the GraphQL path so page context cannot become instructions.
func copilotAguiContextBlock(input *copilotAguiInput) string {
	items := make([]copilotContextItem, 0, len(input.Context))
	for _, item := range input.Context {
		value := ""
		switch typed := item.Value.(type) {
		case string:
			value = typed
		case nil:
			value = ""
		default:
			if encoded, err := common.Marshal(typed); err == nil {
				value = string(encoded)
			}
		}
		if strings.TrimSpace(value) == "" && strings.TrimSpace(item.Description) == "" {
			continue
		}
		items = append(items, copilotContextItem{Description: item.Description, Value: value})
	}
	url := ""
	if candidate, ok := input.ForwardedProps["url"].(string); ok {
		url = candidate
	}
	return copilotPageContextBlock(url, items)
}

// buildCopilotAguiChatRequest converts an AG-UI run into an OpenAI chat
// completion, applying the same server-owned system prompt, tool allow-list and
// token ceiling as the GraphQL path.
func buildCopilotAguiChatRequest(input *copilotAguiInput, userID int) (*dto.GeneralOpenAIRequest, error) {
	messages := []dto.Message{{Role: "system", Content: copilotSystemPrompt}}
	if contextBlock := copilotAguiContextBlock(input); contextBlock != "" {
		messages = append(messages, dto.Message{Role: "user", Content: contextBlock})
	}

	// Tool calls are echoed back by the browser, so only identifiers this server
	// signed for the requesting admin and thread are accepted, exactly like the
	// GraphQL path. A result must also answer a call in this same payload.
	upstreamByClientID := make(map[string]string, len(input.Messages))
	requested := make(map[string]struct{}, len(input.Messages))
	for _, message := range input.Messages {
		if message.Role != "assistant" {
			continue
		}
		for _, call := range message.ToolCalls {
			upstreamID, err := verifyCopilotToolCallID(userID, input.ThreadID, call.ID)
			if err != nil {
				return nil, err
			}
			upstreamByClientID[call.ID] = upstreamID
			requested[upstreamID] = struct{}{}
		}
	}
	for _, message := range input.Messages {
		if message.Role != "tool" {
			continue
		}
		upstreamID, err := verifyCopilotToolCallID(userID, input.ThreadID, message.ToolCallID)
		if err != nil {
			return nil, err
		}
		if _, ok := requested[upstreamID]; !ok {
			return nil, errCopilotUnrequestedToolResult
		}
	}

	for _, message := range input.Messages {
		switch message.Role {
		case "user", "assistant", "system", "developer":
			role := message.Role
			if role == "system" || role == "developer" {
				// The system prompt is server-owned; client system text rides in a
				// user turn so it can never acquire system authority.
				role = "user"
			}
			content := copilotAguiText(message.Content)
			if content == "" && len(message.ToolCalls) == 0 {
				continue
			}
			entry := dto.Message{Role: role, Content: content}
			if role == "assistant" && len(message.ToolCalls) > 0 {
				calls := make([]map[string]any, 0, len(message.ToolCalls))
				for _, call := range message.ToolCalls {
					upstreamID, verified := upstreamByClientID[call.ID]
					if !verified {
						return nil, errCopilotUnverifiedToolCall
					}
					calls = append(calls, map[string]any{
						"id":   copilotToolCallCorrelationID(upstreamID),
						"type": "function",
						"function": map[string]any{
							"name":      call.Function.Name,
							"arguments": call.Function.Arguments,
						},
					})
				}
				entry.ToolCalls = mustJSON(calls)
			}
			messages = append(messages, entry)
		case "tool":
			if message.ToolCallID == "" {
				continue
			}
			upstreamID, verified := upstreamByClientID[message.ToolCallID]
			if !verified {
				return nil, errCopilotUnverifiedToolCall
			}
			messages = append(messages, dto.Message{
				Role:       "tool",
				Content:    copilotAguiText(message.Content),
				ToolCallId: copilotToolCallCorrelationID(upstreamID),
			})
		}
	}

	request := &dto.GeneralOpenAIRequest{
		Model:     copilotModelName(),
		Messages:  messages,
		Stream:    common.GetPointer(false),
		MaxTokens: common.GetPointer(uint(copilotMaxTokensLimit)),
	}

	enabledTools := setting.CopilotEnabledToolSet()
	tools := make([]dto.ToolCallRequest, 0, len(input.Tools))
	for _, tool := range input.Tools {
		if _, enabled := enabledTools[tool.Name]; !enabled {
			continue
		}
		parameters := bytes.TrimSpace(tool.Parameters)
		if len(parameters) == 0 {
			parameters = []byte(`{"type":"object","properties":{}}`)
		}
		tools = append(tools, dto.ToolCallRequest{
			Type: "function",
			Function: dto.FunctionRequest{
				Name:        tool.Name,
				Description: tool.Description,
				Parameters:  parameters,
			},
		})
	}
	if len(tools) > 0 {
		request.Tools = tools
	}
	return request, nil
}

// copilotAguiStream writes AG-UI protocol events. Flushing after every event is
// what makes each provider delta visible in the console as it arrives.
type copilotAguiStream struct {
	c       *gin.Context
	flusher http.Flusher
}

func newCopilotAguiStream(c *gin.Context) *copilotAguiStream {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Writer.WriteHeader(http.StatusOK)
	flusher, _ := c.Writer.(http.Flusher)
	return &copilotAguiStream{c: c, flusher: flusher}
}

func (stream *copilotAguiStream) event(payload gin.H) {
	encoded, err := common.Marshal(payload)
	if err != nil {
		return
	}
	if _, err := fmt.Fprintf(stream.c.Writer, "data: %s\n\n", encoded); err != nil {
		return
	}
	if stream.flusher != nil {
		stream.flusher.Flush()
	}
}

// AdminCopilotChatAgui answers an AG-UI run as a server-sent event stream. When
// streaming is enabled the provider's deltas are forwarded as they arrive;
// otherwise the completed reply is emitted as a single text chunk.
func AdminCopilotChatAgui(c *gin.Context, input *copilotAguiInput) {
	request, buildErr := buildCopilotAguiChatRequest(input, c.GetInt("id"))
	if buildErr != nil {
		c.JSON(http.StatusBadRequest, gin.H{"errors": []gin.H{{"message": buildErr.Error()}}})
		return
	}
	if input.ThreadID == "" {
		input.ThreadID = "thread-" + common.GetUUID()
	}
	if input.RunID == "" {
		input.RunID = "run-" + common.GetUUID()
	}

	stream := newCopilotAguiStream(c)
	stream.event(gin.H{"type": "RUN_STARTED", "threadId": input.ThreadID, "runId": input.RunID})

	messageID := "msg-" + common.GetUUID()
	stream.event(gin.H{
		"type":      "TEXT_MESSAGE_START",
		"messageId": messageID,
		"role":      "assistant",
	})

	var streamed strings.Builder
	onDelta := func(delta string) {
		if delta == "" {
			return
		}
		streamed.WriteString(delta)
		stream.event(gin.H{
			"type":      "TEXT_MESSAGE_CONTENT",
			"messageId": messageID,
			"delta":     delta,
		})
	}

	response, apiErr := copilotCompletion(c, request, onDelta)
	if apiErr != nil {
		stream.event(gin.H{"type": "RUN_ERROR", "message": apiErr.Error()})
		return
	}

	if response != nil && len(response.Choices) > 0 {
		message := response.Choices[0].Message
		if streamed.Len() == 0 {
			if content := messageContentString(message.Content); content != "" {
				stream.event(gin.H{
					"type":      "TEXT_MESSAGE_CONTENT",
					"messageId": messageID,
					"delta":     content,
				})
			}
		}
		stream.event(gin.H{"type": "TEXT_MESSAGE_END", "messageId": messageID})
		if toolCalls, err := decodeCopilotToolCalls(message.ToolCalls); err == nil {
			for _, call := range toolCalls {
				toolCallID := call.ID
				if toolCallID == "" {
					toolCallID = "tool-" + common.GetUUID()
				}
				// The console must send this identifier back with the result;
				// signing it binds the result to this admin and thread.
				toolCallID = signCopilotToolCallID(c.GetInt("id"), input.ThreadID, toolCallID)
				stream.event(gin.H{
					"type":            "TOOL_CALL_START",
					"toolCallId":      toolCallID,
					"toolCallName":    call.Function.Name,
					"parentMessageId": messageID,
				})
				if call.Function.Arguments != "" {
					stream.event(gin.H{
						"type":       "TOOL_CALL_ARGS",
						"toolCallId": toolCallID,
						"delta":      call.Function.Arguments,
					})
				}
				stream.event(gin.H{"type": "TOOL_CALL_END", "toolCallId": toolCallID})
			}
		}
	} else {
		stream.event(gin.H{"type": "TEXT_MESSAGE_END", "messageId": messageID})
	}

	stream.event(gin.H{"type": "RUN_FINISHED", "threadId": input.ThreadID, "runId": input.RunID})
}

// messageContentString flattens an OpenAI message content value, which may be a
// plain string or a slice of parts.
func messageContentString(content any) string {
	switch typed := content.(type) {
	case string:
		return typed
	case nil:
		return ""
	default:
		encoded, err := common.Marshal(typed)
		if err != nil {
			return ""
		}
		return copilotAguiText(encoded)
	}
}

// decodeCopilotToolCalls reads the tool calls carried on a completed message.
func decodeCopilotToolCalls(raw jsonRaw) ([]dto.ToolCallResponse, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, nil
	}
	var calls []dto.ToolCallResponse
	if err := common.Unmarshal(raw, &calls); err != nil {
		return nil, err
	}
	return calls, nil
}

// readCopilotChatBody reads the request body once so the handler can choose
// between the GraphQL and AG-UI envelopes.
func readCopilotChatBody(c *gin.Context) ([]byte, error) {
	return io.ReadAll(io.LimitReader(c.Request.Body, 8<<20))
}
