package relay

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
)

// 预扣的输出预算只适用于真正会生成输出的请求；embedding/moderation 复用聊天
// DTO 但没有输出 token，若也为它们预留输出成本会误伤低余额的合法请求。
func TestReservesOutputTokensOnlyForGenerationFormats(t *testing.T) {
	cases := []struct {
		name      string
		request   dto.Request
		relayMode int
		want      bool
	}{
		{"chat completions", &dto.GeneralOpenAIRequest{}, relayconstant.RelayModeChatCompletions, true},
		{"responses", &dto.OpenAIResponsesRequest{}, relayconstant.RelayModeResponses, true},
		{"claude messages", &dto.ClaudeRequest{}, relayconstant.RelayModeChatCompletions, true},
		{"gemini generate", &dto.GeminiChatRequest{}, relayconstant.RelayModeChatCompletions, true},
		{"openai embeddings", &dto.GeneralOpenAIRequest{}, relayconstant.RelayModeEmbeddings, false},
		{"openai moderations", &dto.GeneralOpenAIRequest{}, relayconstant.RelayModeModerations, false},
		{"image request", &dto.ImageRequest{}, relayconstant.RelayModeImagesGenerations, false},
		{"no request", nil, relayconstant.RelayModeChatCompletions, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{Request: tc.request, RelayMode: tc.relayMode}
			assert.Equal(t, tc.want, reservesOutputTokens(info))
		})
	}
	assert.False(t, reservesOutputTokens(nil))
}
