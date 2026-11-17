package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// copilotPermissionsBody is the answer shape the handlers use.
type copilotPermissionsBody struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// copilotPermissionsRequest runs the permissions handler with a JSON body and
// returns the recorded answer.
func copilotPermissionsRequest(t *testing.T, handler gin.HandlerFunc, body string) (*httptest.ResponseRecorder, copilotPermissionsBody) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPut, "/api/admin/copilot/permissions", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	handler(c)
	var decoded copilotPermissionsBody
	_ = json.Unmarshal(recorder.Body.Bytes(), &decoded)
	return recorder, decoded
}

// A tool name the catalog does not know must be refused before anything is
// written, otherwise a client could believe it granted a capability.
func TestUpdateCopilotPermissionsRefusesUnknownTool(t *testing.T) {
	_, body := copilotPermissionsRequest(t, UpdateCopilotPermissions, `{"permissions":{"notARealTool":true}}`)
	if body.Success {
		t.Fatalf("an unknown tool name was accepted")
	}
	if !strings.Contains(body.Message, "unknown Copilot tool") {
		t.Fatalf("the refusal does not name the unknown tool: %q", body.Message)
	}
}

// An empty body says nothing about the matrix, so it is refused rather than
// applied as a silent "revoke everything".
func TestUpdateCopilotPermissionsRequiresAnIntent(t *testing.T) {
	_, body := copilotPermissionsRequest(t, UpdateCopilotPermissions, `{}`)
	if body.Success {
		t.Fatalf("an empty request was accepted")
	}
}

// The GET answer must describe every catalog tool, so a client can render a
// switch for a capability it has never seen.
func TestGetCopilotPermissionsCoversTheCatalog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/admin/copilot/permissions", nil)
	GetCopilotPermissions(c)

	if recorder.Code != http.StatusOK {
		t.Fatalf("got status %d, want %d", recorder.Code, http.StatusOK)
	}
	body := recorder.Body.String()
	for _, tool := range setting.CopilotToolNames {
		if !strings.Contains(body, `"`+tool+`"`) {
			t.Fatalf("the answer does not mention tool %q", tool)
		}
	}
	if !strings.Contains(body, `"master_control"`) {
		t.Fatalf("the answer does not carry the master switch state")
	}
	if !strings.Contains(body, `"catalog"`) {
		t.Fatalf("the answer does not carry the catalog")
	}
}
