package setting

// Admin Copilot tool catalog.
//
// A tool is the unit of permission: the operator switches each one on or off
// in the Copilot settings, and the server refuses a call to a tool that is off,
// so the switches are a real boundary rather than only a hint to the model.
//
// The catalog is the single source of truth: the settings API publishes it, the
// option validator normalises against it, the middleware guards every endpoint
// by name, and the console renders its permission matrix from it.

// Tool names. They are constants so the router, the controller and the option
// validation cannot drift apart on a spelling.
const (
	CopilotToolGetFinancialSummary = "getFinancialSummary"
	CopilotToolLookupUser          = "lookupUser"
	CopilotToolListUsers           = "listUsers"
	CopilotToolCreateUser          = "createUser"
	CopilotToolDeleteUser          = "deleteUser"
	CopilotToolAdjustUserQuota     = "adjustUserQuota"
	CopilotToolDeductUserQuota     = "deductUserQuota"
	CopilotToolSetUserStatus       = "setUserStatus"

	CopilotToolListChannels     = "listChannels"
	CopilotToolGetChannel       = "getChannel"
	CopilotToolCreateChannel    = "createChannel"
	CopilotToolUpdateChannel    = "updateChannel"
	CopilotToolSetChannelKey    = "setChannelKey"
	CopilotToolSetChannelStatus = "setChannelStatus"
	CopilotToolTestChannel      = "testChannel"
	CopilotToolDeleteChannel    = "deleteChannel"

	CopilotToolListModels       = "listModels"
	CopilotToolSetChannelModels = "setChannelModels"

	CopilotToolSearchLogs       = "searchLogs"
	CopilotToolExportLogs       = "exportLogs"
	CopilotToolListRedemptions  = "listRedemptions"
	CopilotToolCreateRedemption = "createRedemption"

	CopilotToolReadPayments         = "readPayments"
	CopilotToolUpdatePaymentGateway = "updatePaymentGateway"
	CopilotToolUpdateGroupRatio     = "updateGroupRatio"
	CopilotToolUpdateModelPricing   = "updateModelPricing"

	CopilotToolReadMonitoring      = "readMonitoring"
	CopilotToolConfigureMonitoring = "configureMonitoring"
	CopilotToolToggleMaintenance   = "toggleMaintenanceMode"
	CopilotToolGetSystemHealth     = "getSystemHealth"

	CopilotToolListAnnouncements   = "listAnnouncements"
	CopilotToolPublishAnnouncement = "publishAnnouncement"
)

// Tool groups. Each group names the admin area a tool acts on, so the operator
// can grant a whole area (channels, users, billing) or a single capability.
const (
	CopilotGroupSystem        = "system"
	CopilotGroupUsers         = "users"
	CopilotGroupCommercial    = "commercial"
	CopilotGroupChannels      = "channels"
	CopilotGroupModels        = "models"
	CopilotGroupData          = "data"
	CopilotGroupNotifications = "notifications"
)

// Risk levels. "read" only inspects data, "write" changes platform state and is
// reversible by hand, "destructive" removes data or balance that cannot be
// recovered from the console.
const (
	CopilotRiskRead        = "read"
	CopilotRiskWrite       = "write"
	CopilotRiskDestructive = "destructive"
)

// CopilotTool describes one capability the Copilot can be granted.
type CopilotTool struct {
	Name  string `json:"name"`
	Group string `json:"group"`
	Risk  string `json:"risk"`
}

// CopilotToolCatalog lists every capability, in the order the console shows
// them. A tool that is not listed here cannot be enabled, called or validated.
var CopilotToolCatalog = []CopilotTool{
	// System and operations.
	{CopilotToolGetSystemHealth, CopilotGroupSystem, CopilotRiskRead},
	{CopilotToolReadMonitoring, CopilotGroupSystem, CopilotRiskRead},
	{CopilotToolConfigureMonitoring, CopilotGroupSystem, CopilotRiskWrite},
	{CopilotToolToggleMaintenance, CopilotGroupSystem, CopilotRiskWrite},

	// Users and authentication.
	{CopilotToolLookupUser, CopilotGroupUsers, CopilotRiskRead},
	{CopilotToolListUsers, CopilotGroupUsers, CopilotRiskRead},
	{CopilotToolCreateUser, CopilotGroupUsers, CopilotRiskWrite},
	{CopilotToolDeleteUser, CopilotGroupUsers, CopilotRiskDestructive},
	{CopilotToolAdjustUserQuota, CopilotGroupUsers, CopilotRiskWrite},
	{CopilotToolDeductUserQuota, CopilotGroupUsers, CopilotRiskDestructive},
	{CopilotToolSetUserStatus, CopilotGroupUsers, CopilotRiskWrite},

	// Commercial: revenue, payments, groups and pricing.
	{CopilotToolGetFinancialSummary, CopilotGroupCommercial, CopilotRiskRead},
	{CopilotToolReadPayments, CopilotGroupCommercial, CopilotRiskRead},
	{CopilotToolUpdatePaymentGateway, CopilotGroupCommercial, CopilotRiskWrite},
	{CopilotToolUpdateGroupRatio, CopilotGroupCommercial, CopilotRiskWrite},
	{CopilotToolUpdateModelPricing, CopilotGroupCommercial, CopilotRiskWrite},

	// Channels and upstream providers.
	{CopilotToolListChannels, CopilotGroupChannels, CopilotRiskRead},
	{CopilotToolGetChannel, CopilotGroupChannels, CopilotRiskRead},
	{CopilotToolCreateChannel, CopilotGroupChannels, CopilotRiskWrite},
	{CopilotToolUpdateChannel, CopilotGroupChannels, CopilotRiskWrite},
	{CopilotToolSetChannelKey, CopilotGroupChannels, CopilotRiskWrite},
	{CopilotToolSetChannelStatus, CopilotGroupChannels, CopilotRiskWrite},
	{CopilotToolTestChannel, CopilotGroupChannels, CopilotRiskWrite},
	{CopilotToolDeleteChannel, CopilotGroupChannels, CopilotRiskDestructive},

	// Model catalogue and channel model lists.
	{CopilotToolListModels, CopilotGroupModels, CopilotRiskRead},
	{CopilotToolSetChannelModels, CopilotGroupModels, CopilotRiskWrite},

	// Data, logs and redemption codes.
	{CopilotToolSearchLogs, CopilotGroupData, CopilotRiskRead},
	{CopilotToolExportLogs, CopilotGroupData, CopilotRiskRead},
	{CopilotToolListRedemptions, CopilotGroupData, CopilotRiskRead},
	{CopilotToolCreateRedemption, CopilotGroupData, CopilotRiskWrite},

	// Notifications.
	{CopilotToolListAnnouncements, CopilotGroupNotifications, CopilotRiskRead},
	{CopilotToolPublishAnnouncement, CopilotGroupNotifications, CopilotRiskWrite},
}

// CopilotToolGroups lists every group in the order the console renders them.
var CopilotToolGroups = []string{
	CopilotGroupSystem,
	CopilotGroupUsers,
	CopilotGroupCommercial,
	CopilotGroupChannels,
	CopilotGroupModels,
	CopilotGroupData,
	CopilotGroupNotifications,
}

// CopilotToolNames lists every tool in catalog order. It replaces the literal
// list the option layer used to carry, so adding a tool cannot leave the
// normaliser behind.
var CopilotToolNames = copilotToolNamesFromCatalog()

func copilotToolNamesFromCatalog() []string {
	names := make([]string, 0, len(CopilotToolCatalog))
	for _, tool := range CopilotToolCatalog {
		names = append(names, tool.Name)
	}
	return names
}

// CopilotToolByName returns the catalog entry for a tool name.
func CopilotToolByName(name string) (CopilotTool, bool) {
	for _, tool := range CopilotToolCatalog {
		if tool.Name == name {
			return tool, true
		}
	}
	return CopilotTool{}, false
}

// CopilotToolsInGroup returns the names of the tools that belong to one group.
func CopilotToolsInGroup(group string) []string {
	names := make([]string, 0, len(CopilotToolCatalog))
	for _, tool := range CopilotToolCatalog {
		if tool.Group == group {
			names = append(names, tool.Name)
		}
	}
	return names
}
