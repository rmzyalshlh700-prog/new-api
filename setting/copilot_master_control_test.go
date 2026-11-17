package setting

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

// withCopilotOptions installs Copilot options for one test and restores the
// previous map afterwards.
func withCopilotOptions(t *testing.T, values map[string]string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	previous := make(map[string]string, len(values))
	restore := make(map[string]bool, len(values))
	for key := range values {
		previous[key], restore[key] = common.OptionMap[key]
		common.OptionMap[key] = values[key]
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		for key, value := range previous {
			if restore[key] {
				common.OptionMap[key] = value
				continue
			}
			delete(common.OptionMap, key)
		}
	})
}

// The master switch is the coarse grant: while it is on the stored list must not
// be able to narrow the tool set, otherwise the switch would lie about what the
// assistant can do.
func TestMasterControlGrantsEveryTool(t *testing.T) {
	withCopilotOptions(t, map[string]string{
		CopilotMasterControlOptionKey: CopilotMasterControlOptionValue(true),
		CopilotEnabledToolsOptionKey:  CopilotEnabledToolsToJSON([]string{CopilotToolListChannels}),
	})

	if !CopilotMasterControl() {
		t.Fatalf("master control reads off")
	}
	enabled := CopilotEnabledTools()
	if len(enabled) != len(CopilotToolNames) {
		t.Fatalf("got %d enabled tools, want %d", len(enabled), len(CopilotToolNames))
	}
	for _, tool := range CopilotToolNames {
		if !CopilotToolEnabled(tool) {
			t.Fatalf("tool %q is disabled while master control is on", tool)
		}
	}
}

// Switching the master off must restore the operator's own list, not revoke
// every tool: the list is what they chose before turning the master on.
func TestMasterControlOffHonoursStoredList(t *testing.T) {
	withCopilotOptions(t, map[string]string{
		CopilotMasterControlOptionKey: CopilotMasterControlOptionValue(false),
		CopilotEnabledToolsOptionKey:  CopilotEnabledToolsToJSON([]string{CopilotToolListChannels, CopilotToolSearchLogs}),
	})

	if CopilotMasterControl() {
		t.Fatalf("master control reads on")
	}
	if !CopilotToolEnabled(CopilotToolListChannels) || !CopilotToolEnabled(CopilotToolSearchLogs) {
		t.Fatalf("the stored tools were not granted")
	}
	if CopilotToolEnabled(CopilotToolDeleteChannel) {
		t.Fatalf("a tool outside the stored list was granted")
	}
}

// A tool the catalog does not know can never be enabled, whatever the stored
// list says, so a typo cannot widen the boundary.
func TestMasterControlNeverGrantsUnknownTools(t *testing.T) {
	withCopilotOptions(t, map[string]string{
		CopilotMasterControlOptionKey: CopilotMasterControlOptionValue(true),
	})
	if CopilotToolEnabled("notARealTool") {
		t.Fatalf("an unknown tool was granted")
	}
}

// The stored switch value is validated like every other Copilot option.
func TestMasterControlOptionValidation(t *testing.T) {
	if err := ValidateCopilotOption(CopilotMasterControlOptionKey, "true"); err != nil {
		t.Fatalf("true was refused: %v", err)
	}
	if err := ValidateCopilotOption(CopilotMasterControlOptionKey, "false"); err != nil {
		t.Fatalf("false was refused: %v", err)
	}
	if err := ValidateCopilotOption(CopilotMasterControlOptionKey, "yes"); err == nil {
		t.Fatalf("an invalid switch value was accepted")
	}
}

// The permission map is the shape the HTTP API publishes: every catalog tool
// appears, so a client never has to guess what "off" means.
func TestPermissionMapCoversEveryTool(t *testing.T) {
	permissions := CopilotPermissionMap([]string{CopilotToolListChannels})
	if len(permissions) != len(CopilotToolNames) {
		t.Fatalf("got %d entries, want %d", len(permissions), len(CopilotToolNames))
	}
	if !permissions[CopilotToolListChannels] {
		t.Fatalf("the granted tool reads off")
	}
	if permissions[CopilotToolDeleteChannel] {
		t.Fatalf("a tool outside the list reads on")
	}
}

// A map is turned back into the stored list in catalog order, and a name the
// catalog does not know is refused instead of being dropped silently.
func TestToolsFromPermissionMap(t *testing.T) {
	tools, err := CopilotToolsFromPermissionMap(map[string]bool{
		CopilotToolDeleteChannel: true,
		CopilotToolListChannels:  true,
		CopilotToolSearchLogs:    false,
	})
	if err != nil {
		t.Fatalf("a valid map was refused: %v", err)
	}
	want := []string{CopilotToolListChannels, CopilotToolDeleteChannel}
	if len(tools) != len(want) || tools[0] != want[0] || tools[1] != want[1] {
		t.Fatalf("got %v, want %v", tools, want)
	}

	if _, err := CopilotToolsFromPermissionMap(map[string]bool{"notARealTool": true}); err == nil {
		t.Fatalf("an unknown tool name was accepted")
	}
}
