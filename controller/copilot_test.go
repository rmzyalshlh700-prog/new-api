package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// TestAdminCopilotChatInfoAdvertisesDefaultAgent guards the CopilotKit runtime
// handshake contract: without an `agents.default` entry the client registers no
// remote agent and silently drops every message sent from the popup.
func TestAdminCopilotChatInfoAdvertisesDefaultAgent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/admin/copilot/chat/info", nil)

	AdminCopilotChatInfo(c)

	require.Equal(t, http.StatusOK, w.Code)

	var payload struct {
		Agents map[string]struct {
			Description string `json:"description"`
		} `json:"agents"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &payload))
	require.Contains(t, payload.Agents, "default")
	require.NotEmpty(t, payload.Agents["default"].Description)
}
