package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// withCopilotChatTestDB installs a private in-memory database for the chat
// history handlers. They read and write through model.DB, so the test replaces
// it for its own duration only.
func withCopilotChatTestDB(t *testing.T) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.CopilotChat{}, &model.CopilotMessage{}))
	previous := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = previous
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
}

func copilotChatContext(t *testing.T, method string, target string, body string, userId int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(method, target, strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", userId)
	return c, recorder
}

type copilotChatEnvelope struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func decodeCopilotChatEnvelope(t *testing.T, recorder *httptest.ResponseRecorder) copilotChatEnvelope {
	t.Helper()
	var envelope copilotChatEnvelope
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &envelope))
	return envelope
}

// TestCopilotChatHistoryRoundTrip covers the console's own sequence: open a
// chat with the first question, list it, read it back, then replace the
// transcript after the answer arrives.
func TestCopilotChatHistoryRoundTrip(t *testing.T) {
	withCopilotChatTestDB(t)

	createCtx, createRecorder := copilotChatContext(t, http.MethodPost, "/api/admin/copilot/chats",
		`{"title":"","messages":[{"role":"user","content":"حلل لي النظام كامل"}]}`, 1)
	CreateCopilotChat(createCtx)
	require.Equal(t, http.StatusOK, createRecorder.Code)
	created := decodeCopilotChatEnvelope(t, createRecorder)
	require.True(t, created.Success)
	var chat model.CopilotChat
	require.NoError(t, json.Unmarshal(created.Data, &chat))
	assert.NotZero(t, chat.Id)
	assert.Equal(t, "حلل لي النظام كامل", chat.Title)

	listCtx, listRecorder := copilotChatContext(t, http.MethodGet, "/api/admin/copilot/chats", "", 1)
	ListCopilotChats(listCtx)
	listEnvelope := decodeCopilotChatEnvelope(t, listRecorder)
	require.True(t, listEnvelope.Success)
	var chats []model.CopilotChat
	require.NoError(t, json.Unmarshal(listEnvelope.Data, &chats))
	require.Len(t, chats, 1)

	replaceCtx, replaceRecorder := copilotChatContext(t, http.MethodPut,
		"/api/admin/copilot/chats/1/messages",
		`{"messages":[{"role":"user","content":"حلل لي النظام كامل"},{"role":"assistant","content":"- **CPU**: 12%"}]}`, 1)
	replaceCtx.Params = gin.Params{{Key: "id", Value: "1"}}
	ReplaceCopilotChatMessages(replaceCtx)
	require.Equal(t, http.StatusOK, replaceRecorder.Code)

	readCtx, readRecorder := copilotChatContext(t, http.MethodGet, "/api/admin/copilot/chats/1", "", 1)
	readCtx.Params = gin.Params{{Key: "id", Value: "1"}}
	GetCopilotChat(readCtx)
	require.Equal(t, http.StatusOK, readRecorder.Code)
	var stored struct {
		Chat     model.CopilotChat      `json:"chat"`
		Messages []model.CopilotMessage `json:"messages"`
	}
	require.NoError(t, json.Unmarshal(decodeCopilotChatEnvelope(t, readRecorder).Data, &stored))
	require.Len(t, stored.Messages, 2)
	assert.Equal(t, "assistant", stored.Messages[1].Role)
}

// TestCopilotChatHistoryHidesAnotherAdminsChat checks that a chat belonging to
// someone else answers exactly like one that does not exist.
func TestCopilotChatHistoryHidesAnotherAdminsChat(t *testing.T) {
	withCopilotChatTestDB(t)

	_, err := model.CreateCopilotChat(1, "private", nil)
	require.NoError(t, err)

	id := "1"
	readCtx, readRecorder := copilotChatContext(t, http.MethodGet, "/api/admin/copilot/chats/1", "", 2)
	readCtx.Params = gin.Params{{Key: "id", Value: id}}
	GetCopilotChat(readCtx)
	assert.Equal(t, http.StatusNotFound, readRecorder.Code)

	deleteCtx, deleteRecorder := copilotChatContext(t, http.MethodDelete, "/api/admin/copilot/chats/1", "", 2)
	deleteCtx.Params = gin.Params{{Key: "id", Value: id}}
	DeleteCopilotChat(deleteCtx)
	assert.Equal(t, http.StatusNotFound, deleteRecorder.Code)

	listCtx, listRecorder := copilotChatContext(t, http.MethodGet, "/api/admin/copilot/chats", "", 2)
	ListCopilotChats(listCtx)
	var chats []model.CopilotChat
	require.NoError(t, json.Unmarshal(decodeCopilotChatEnvelope(t, listRecorder).Data, &chats))
	assert.Empty(t, chats)
}

// TestPurgeCopilotLogsRequiresAWindow checks the guard that keeps a purge from
// emptying the record of what the gateway billed: a request without both ends
// of the window is refused before any row is touched.
func TestPurgeCopilotLogsRequiresAWindow(t *testing.T) {
	withCopilotChatTestDB(t)
	cases := []struct {
		name string
		body string
	}{
		{"no window", `{}`},
		{"start only", `{"start_timestamp":1700000000}`},
		{"backwards", `{"start_timestamp":1700000200,"end_timestamp":1700000100}`},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			c, recorder := copilotChatContext(t, http.MethodPost, "/api/admin/copilot/tools/logs/purge", testCase.body, 1)
			PurgeCopilotLogs(c)
			// This API reports a refusal in the envelope with a 200, so the
			// envelope is what the console acts on.
			assert.False(t, decodeCopilotChatEnvelope(t, recorder).Success)
		})
	}
}

// TestDeleteLogsInWindowLeavesAuditLogsAlone checks that the purge touches the
// usage log table and nothing else.
func TestDeleteLogsInWindowLeavesAuditLogsAlone(t *testing.T) {
	withCopilotChatTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Log{}, &model.AuditLog{}))

	inside := model.Log{CreatedAt: 1700000100, ModelName: "gpt-4o", Username: "alice"}
	outside := model.Log{CreatedAt: 1700000900, ModelName: "gpt-4o", Username: "alice"}
	require.NoError(t, model.DB.Create(&inside).Error)
	require.NoError(t, model.DB.Create(&outside).Error)
	audit := model.AuditLog{EventId: "e1", CreatedAt: 1700000100, Action: "user.delete"}
	require.NoError(t, model.DB.Create(&audit).Error)

	deleted, err := model.DeleteLogsInWindow(1700000000, 1700000200, "", "")
	require.NoError(t, err)
	assert.Equal(t, int64(1), deleted)

	var remainingLogs int64
	require.NoError(t, model.DB.Model(&model.Log{}).Count(&remainingLogs).Error)
	assert.Equal(t, int64(1), remainingLogs, "only the row inside the window is removed")

	var remainingAudits int64
	require.NoError(t, model.DB.Model(&model.AuditLog{}).Count(&remainingAudits).Error)
	assert.Equal(t, int64(1), remainingAudits, "audit logs are never touched")
}
