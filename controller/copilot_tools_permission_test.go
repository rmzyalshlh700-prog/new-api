package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

// withEnabledCopilotTools installs a permission set for one test and restores
// the previous option afterwards.
func withEnabledCopilotTools(t *testing.T, tools []string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	previous, had := common.OptionMap[setting.CopilotEnabledToolsOptionKey]
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	common.OptionMap[setting.CopilotEnabledToolsOptionKey] = setting.CopilotEnabledToolsToJSON(tools)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		if had {
			common.OptionMap[setting.CopilotEnabledToolsOptionKey] = previous
			return
		}
		delete(common.OptionMap, setting.CopilotEnabledToolsOptionKey)
	})
}

// With nothing granted the run carries no tools at all, so the model cannot ask
// for one and the assistant has to say the capability is switched off.
func TestCopilotAguiRequestCarriesNoToolsWhenNothingIsGranted(t *testing.T) {
	withEnabledCopilotTools(t, []string{})

	input := &copilotAguiInput{
		ThreadID: "thread-1",
		Messages: []copilotAguiMessage{{Role: "user", Content: []byte(`"hi"`)}},
		Tools: []copilotAguiTool{
			{Name: setting.CopilotToolListChannels, Description: "list", Parameters: []byte(`{"type":"object"}`)},
			{Name: setting.CopilotToolCreateChannel, Description: "create", Parameters: []byte(`{"type":"object"}`)},
		},
	}
	request, err := buildCopilotAguiChatRequest(input, 1)
	if err != nil {
		t.Fatalf("building the request failed: %v", err)
	}
	if len(request.Tools) != 0 {
		t.Fatalf("got %d tools, want none", len(request.Tools))
	}
}

// The GraphQL path that CopilotTask uses applies the same filter.
func TestCopilotGraphQLRequestDropsDisabledTools(t *testing.T) {
	withEnabledCopilotTools(t, []string{setting.CopilotToolGetSystemHealth})

	// Decoding the payload is the honest way to build the anonymous struct the
	// GraphQL variables use, and it also checks the JSON shape the console sends.
	const payload = `{
		"threadId": "thread-1",
		"runId": "run-1",
		"messages": [],
		"frontend": {
			"actions": [
				{"name": "getSystemHealth", "description": "health", "jsonSchema": "{\"type\":\"object\",\"properties\":{}}"},
				{"name": "deleteChannel", "description": "delete", "jsonSchema": "{\"type\":\"object\",\"properties\":{}}"}
			]
		}
	}`
	var data copilotChatRequestVariablesData
	if err := common.Unmarshal([]byte(payload), &data); err != nil {
		t.Fatalf("decoding the payload failed: %v", err)
	}
	request, err := buildCopilotChatRequest(&data, copilotToolExchange{
		byClientID: map[string]string{},
		requested:  map[string]struct{}{},
	})
	if err != nil {
		t.Fatalf("building the request failed: %v", err)
	}
	if len(request.Tools) != 1 || request.Tools[0].Function.Name != setting.CopilotToolGetSystemHealth {
		t.Fatalf("unexpected tool list: %+v", request.Tools)
	}
}
