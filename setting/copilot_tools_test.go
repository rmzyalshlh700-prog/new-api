package setting

import (
	"slices"
	"testing"
)

// The catalogue is the single source of truth for what the Copilot may do, so a
// duplicate or an ungrouped entry would silently change the permission set.
func TestCopilotToolCatalogIsWellFormed(t *testing.T) {
	seen := make(map[string]struct{}, len(CopilotToolCatalog))
	groups := []string{
		CopilotGroupFinancials, CopilotGroupUsers, CopilotGroupChannels,
		CopilotGroupModels, CopilotGroupLogs, CopilotGroupRedemptions,
		CopilotGroupSystem,
	}
	risks := []string{CopilotRiskRead, CopilotRiskWrite, CopilotRiskDestructive}
	for _, tool := range CopilotToolCatalog {
		if tool.Name == "" {
			t.Fatalf("catalog holds a tool without a name")
		}
		if _, ok := seen[tool.Name]; ok {
			t.Fatalf("tool %q is listed twice", tool.Name)
		}
		seen[tool.Name] = struct{}{}
		if !slices.Contains(groups, tool.Group) {
			t.Fatalf("tool %q has unknown group %q", tool.Name, tool.Group)
		}
		if !slices.Contains(risks, tool.Risk) {
			t.Fatalf("tool %q has unknown risk %q", tool.Name, tool.Risk)
		}
	}
	if len(CopilotToolNames) != len(CopilotToolCatalog) {
		t.Fatalf("CopilotToolNames is out of step with the catalog")
	}
}

func TestCopilotToolNamesFollowCatalogOrder(t *testing.T) {
	for i, tool := range CopilotToolCatalog {
		if CopilotToolNames[i] != tool.Name {
			t.Fatalf("index %d: got %q, want %q", i, CopilotToolNames[i], tool.Name)
		}
	}
}

// Every group the console renders must be reachable, otherwise its switch would
// toggle nothing.
func TestEveryCopilotGroupHasTools(t *testing.T) {
	for _, group := range []string{
		CopilotGroupFinancials, CopilotGroupUsers, CopilotGroupChannels,
		CopilotGroupModels, CopilotGroupLogs, CopilotGroupRedemptions,
		CopilotGroupSystem,
	} {
		if len(CopilotToolsInGroup(group)) == 0 {
			t.Fatalf("group %q has no tools", group)
		}
	}
}

// Narrowing the permission set must keep the known tools in canonical order and
// drop anything the catalog does not know, including duplicates.
func TestNormalizeCopilotToolsKeepsCatalogOrder(t *testing.T) {
	tools := NormalizeCopilotTools([]string{
		CopilotToolDeleteChannel,
		"notARealTool",
		CopilotToolListChannels,
		CopilotToolDeleteChannel,
	})
	want := []string{CopilotToolListChannels, CopilotToolDeleteChannel}
	if !slices.Equal(tools, want) {
		t.Fatalf("got %v, want %v", tools, want)
	}
}

// The default set hands every capability to a fresh installation; an operator
// narrows it from there.
func TestDefaultCopilotToolsEnableEverything(t *testing.T) {
	var decoded []string
	if err := unmarshalToolList(DefaultCopilotEnabledToolsJSON(), &decoded); err != nil {
		t.Fatalf("default tool list is not valid JSON: %v", err)
	}
	if !slices.Equal(decoded, CopilotToolNames) {
		t.Fatalf("default tool list does not match the catalog")
	}
}
