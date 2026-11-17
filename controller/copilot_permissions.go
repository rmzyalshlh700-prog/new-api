package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// The Copilot permission matrix API.
//
// This is the single place a client reads and writes what the assistant may do.
// It is a thin, explicit view over the option the tool middleware already
// enforces (copilot_master_control plus copilot_enabled_tools), so a permission
// switched off here is refused by RequireCopilotTool on the next call, not only
// hidden from the model.
//
// The GET answer always carries every catalog tool, so a caller can render a
// switch for a capability it has never seen, and the master switch state is
// reported as the server holds it: on only while every tool is granted.

// copilotPermissionsResponse is the shape both GET and PUT answer with.
type copilotPermissionsResponse struct {
	// MasterControl is the explicit switch. It is reported on only while every
	// catalog tool is granted, so a single tool switched off reads as off.
	MasterControl bool `json:"master_control"`
	// Permissions maps every catalog tool to whether it is granted right now.
	Permissions map[string]bool `json:"permissions"`
	// Catalog is the authoritative tool list with group and risk, so the client
	// does not have to carry a second copy of the schema.
	Catalog []setting.CopilotTool `json:"catalog"`
	// Groups lists the catalog groups in display order.
	Groups []string `json:"groups"`
}

type updateCopilotPermissionsRequest struct {
	// MasterControl grants or revokes every tool at once. Omitted leaves the
	// stored list alone.
	MasterControl *bool `json:"master_control"`
	// Permissions grants or revokes named tools. It is applied only when the
	// request does not switch the master control on, and any tool it switches
	// off turns the master control off, which is the rule the console renders.
	Permissions map[string]bool `json:"permissions"`
}

// currentCopilotPermissions builds the answer from the live settings.
func currentCopilotPermissions() copilotPermissionsResponse {
	enabled := setting.CopilotEnabledTools()
	return copilotPermissionsResponse{
		MasterControl: setting.CopilotMasterControl() ||
			len(enabled) == len(setting.CopilotToolNames),
		Permissions: setting.CopilotPermissionMap(enabled),
		Catalog:     setting.CopilotToolCatalog,
		Groups:      setting.CopilotToolGroups,
	}
}

// GetCopilotPermissions serves GET /api/admin/copilot/permissions.
func GetCopilotPermissions(c *gin.Context) {
	common.ApiSuccess(c, currentCopilotPermissions())
}

// UpdateCopilotPermissions serves PUT /api/admin/copilot/permissions.
//
// The whole matrix is written in one save: a client that flips the master switch
// and a client that flips one tool both send the intent, and the server decides
// what the stored list becomes. Every value is validated against the catalog
// before anything is persisted, so a refused request changes nothing.
func UpdateCopilotPermissions(c *gin.Context) {
	var request updateCopilotPermissionsRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	if request.MasterControl == nil && request.Permissions == nil {
		common.ApiErrorMsg(c, "Provide master_control, permissions, or both")
		return
	}

	values := map[string]string{}
	switch {
	case request.MasterControl != nil && *request.MasterControl:
		// The coarse grant: every tool, and the stored list kept whole so a
		// later "off" restores the operator's own choice.
		values[setting.CopilotMasterControlOptionKey] = setting.CopilotMasterControlOptionValue(true)
		values[setting.CopilotEnabledToolsOptionKey] = setting.DefaultCopilotEnabledToolsJSON()
	case request.Permissions != nil:
		enabled, err := setting.CopilotToolsFromPermissionMap(request.Permissions)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		values[setting.CopilotEnabledToolsOptionKey] = setting.CopilotEnabledToolsToJSON(enabled)
		values[setting.CopilotMasterControlOptionKey] = setting.CopilotMasterControlOptionValue(false)
	case request.MasterControl != nil:
		// Explicitly switching the master off keeps the stored list as it is.
		values[setting.CopilotMasterControlOptionKey] = setting.CopilotMasterControlOptionValue(false)
	}

	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "copilot.permissions_update", map[string]any{
		"master_control": setting.CopilotMasterControl(),
		"enabled_count":  len(setting.CopilotEnabledTools()),
		"enabled_tools":  setting.CopilotEnabledTools(),
	})
	common.ApiSuccess(c, currentCopilotPermissions())
}
