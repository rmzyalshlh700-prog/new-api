package controller

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// The Copilot chat-history API.
//
// A conversation belongs to the administrator who wrote it and to nobody else:
// every handler filters by the session's user id, and a chat that belongs to
// someone else answers exactly like one that does not exist.
//
// The console keeps the live transcript in the browser (CopilotKit owns it
// during a run) and posts the finished turn list here after each exchange, so
// reloading the page or opening the console on another machine restores the
// same conversations.

// copilotChatTurnsFromBody validates the transcript a client sends.
func copilotChatTurnsFromBody(turns []copilotChatTurnBody) ([]model.CopilotChatTurn, bool) {
	if len(turns) > model.CopilotChatMessageLimit*2 {
		return nil, false
	}
	converted := make([]model.CopilotChatTurn, 0, len(turns))
	for _, turn := range turns {
		converted = append(converted, model.CopilotChatTurn{Role: turn.Role, Content: turn.Content})
	}
	return converted, true
}

type copilotChatTurnBody struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// copilotChatIdFromPath reads and validates the :id path parameter.
func copilotChatIdFromPath(c *gin.Context) (int, bool) {
	chatId, err := strconv.Atoi(c.Param("id"))
	if err != nil || chatId <= 0 {
		common.ApiErrorMsg(c, "A valid chat id is required")
		return 0, false
	}
	return chatId, true
}

// copilotChatError answers a model error, translating "not found" into the
// same answer whichever administrator asks about whom.
func copilotChatError(c *gin.Context, err error) {
	if errors.Is(err, model.ErrCopilotChatNotFound) {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "chat not found",
		})
		return
	}
	common.ApiError(c, err)
}

// ListCopilotChats lists the administrator's saved conversations, newest first.
func ListCopilotChats(c *gin.Context) {
	chats, err := model.ListCopilotChats(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, chats)
}

// GetCopilotChat returns one conversation with its turns.
func GetCopilotChat(c *gin.Context) {
	chatId, ok := copilotChatIdFromPath(c)
	if !ok {
		return
	}
	chat, err := model.GetCopilotChat(c.GetInt("id"), chatId)
	if err != nil {
		copilotChatError(c, err)
		return
	}
	messages, err := model.ListCopilotMessages(chat.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"chat": chat, "messages": messages})
}

// CreateCopilotChat opens a conversation, with or without its first turns.
func CreateCopilotChat(c *gin.Context) {
	var request struct {
		Title    string                `json:"title"`
		Messages []copilotChatTurnBody `json:"messages"`
	}
	if c.Request.Body != nil {
		if err := common.DecodeJson(c.Request.Body, &request); err != nil && !errors.Is(err, io.EOF) {
			common.ApiErrorMsg(c, "Invalid request body")
			return
		}
	}
	turns, ok := copilotChatTurnsFromBody(request.Messages)
	if !ok {
		common.ApiErrorMsg(c, "Too many messages in one chat")
		return
	}
	chat, err := model.CreateCopilotChat(c.GetInt("id"), strings.TrimSpace(request.Title), turns)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, chat)
}

// ReplaceCopilotChatMessages stores the transcript the console holds.
func ReplaceCopilotChatMessages(c *gin.Context) {
	chatId, ok := copilotChatIdFromPath(c)
	if !ok {
		return
	}
	var request struct {
		Title    string                `json:"title"`
		Messages []copilotChatTurnBody `json:"messages"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	turns, ok := copilotChatTurnsFromBody(request.Messages)
	if !ok {
		common.ApiErrorMsg(c, "Too many messages in one chat")
		return
	}
	chat, count, err := model.ReplaceCopilotChatMessages(c.GetInt("id"), chatId, request.Title, turns)
	if err != nil {
		copilotChatError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"chat": chat, "count": count})
}

// DeleteCopilotChat removes one conversation.
func DeleteCopilotChat(c *gin.Context) {
	chatId, ok := copilotChatIdFromPath(c)
	if !ok {
		return
	}
	if err := model.DeleteCopilotChat(c.GetInt("id"), chatId); err != nil {
		copilotChatError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": chatId})
}
