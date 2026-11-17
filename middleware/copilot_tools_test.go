package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// runCopilotToolGuard executes the guard for a tool with the given permission
// set and reports whether the request reached the handler.
func runCopilotToolGuard(t *testing.T, tool string, enabled []string) (int, bool) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	previous := setting.CopilotOption(setting.CopilotEnabledToolsOptionKey)
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	common.OptionMap[setting.CopilotEnabledToolsOptionKey] = setting.CopilotEnabledToolsToJSON(enabled)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap[setting.CopilotEnabledToolsOptionKey] = previous
		common.OptionMapRWMutex.Unlock()
	})

	reached := false
	router := gin.New()
	router.POST("/tool", RequireCopilotTool(tool), func(c *gin.Context) {
		reached = true
		c.Status(http.StatusOK)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/tool", nil)
	router.ServeHTTP(recorder, request)
	return recorder.Code, reached
}

// A disabled tool must be refused by the server: hiding it from the model is a
// client-side hint, and a request replayed by hand would otherwise still work.
func TestRequireCopilotToolRefusesDisabledTool(t *testing.T) {
	code, reached := runCopilotToolGuard(t, setting.CopilotToolDeleteChannel, []string{
		setting.CopilotToolListChannels,
	})
	if reached {
		t.Fatalf("a disabled tool reached its handler")
	}
	if code != http.StatusForbidden {
		t.Fatalf("got status %d, want %d", code, http.StatusForbidden)
	}
}

func TestRequireCopilotToolAllowsEnabledTool(t *testing.T) {
	code, reached := runCopilotToolGuard(t, setting.CopilotToolDeleteChannel, []string{
		setting.CopilotToolDeleteChannel,
	})
	if !reached {
		t.Fatalf("an enabled tool was refused")
	}
	if code != http.StatusOK {
		t.Fatalf("got status %d, want %d", code, http.StatusOK)
	}
}

// A guard naming a tool the catalog does not know is a typo; failing closed
// keeps a mistyped endpoint from becoming an unguarded one.
func TestRequireCopilotToolFailsClosedOnUnknownTool(t *testing.T) {
	code, reached := runCopilotToolGuard(t, "notARealTool", setting.CopilotToolNames)
	if reached {
		t.Fatalf("an unknown tool reached its handler")
	}
	if code != http.StatusForbidden {
		t.Fatalf("got status %d, want %d", code, http.StatusForbidden)
	}
}
