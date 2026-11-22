package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// RequireCopilotTool guards one admin Copilot tool endpoint with the permission
// the operator granted in the Copilot settings.
//
// The console already hides a disabled tool from the model, but that is only a
// client-side hint: anyone able to reach the API could still call the tool by
// hand. Refusing here makes the switch in the settings page the real boundary,
// and keeps a narrowed permission set in force even if the console is out of
// date or a request is replayed.
func RequireCopilotTool(tool string) func(c *gin.Context) {
	return func(c *gin.Context) {
		// A guard for a tool the catalog does not know would be a typo that
		// silently leaves an endpoint reachable; fail closed instead.
		if _, ok := setting.CopilotToolByName(tool); !ok {
			abortWithWebMessage(c, http.StatusForbidden, "PERMISSION_DENIED", common.NewMessage("Permission Denied: this Copilot capability does not exist"))
			return
		}
		// CopilotToolEnabled folds in the master control switch: while it is
		// on every catalog tool is granted, and a single tool switched off
		// turns the master switch off in the settings API in the same save.
		if !setting.CopilotToolEnabled(tool) {
			// The wording is part of the contract: the assistant is told
			// "Permission Denied" when the operator switched a capability off,
			// so it can say so plainly instead of retrying another tool.
			abortWithWebMessage(c, http.StatusForbidden, "PERMISSION_DENIED", common.NewMessage("Permission Denied: this Copilot capability is switched off in the Copilot permissions"))
			return
		}
		c.Next()
	}
}
