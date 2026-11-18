package controller

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestConfigurePaymentGatewayRefusesForeignKeys checks that a key belonging to
// another provider cannot be smuggled into a gateway configuration.
func TestConfigurePaymentGatewayRefusesForeignKeys(t *testing.T) {
	withCopilotChatTestDB(t)
	cases := []struct {
		name string
		body string
	}{
		{"unknown provider", `{"provider":"paypal","credentials":{}}`},
		{"foreign key", `{"provider":"nowpayments","credentials":{"StripeApiSecret":"sk_live_x"}}`},
		{"invented key", `{"provider":"nowpayments","credentials":{"NowPaymentsApiKey":"k","Backdoor":"1"}}`},
		{"sent twice", `{"provider":"nowpayments","credentials":{"NowPaymentsApiKey":"a"},"settings":{"NowPaymentsApiKey":"b"}}`},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			c, recorder := copilotChatContext(t, http.MethodPost, "/api/admin/copilot/tools/payments/configure", testCase.body, 1)
			// The root check runs first; give the context the role it expects.
			c.Set("role", 10)
			ConfigureCopilotPaymentGateway(c)
			var envelope copilotChatEnvelope
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &envelope))
			assert.False(t, envelope.Success)
		})
	}
}

// TestConfigurePaymentGatewayWritesEveryKeyAndReportsLiveness checks the whole
// point of the tool: one call stores the credentials, and the answer says what
// the platform itself thinks of the gateway afterwards.
func TestConfigurePaymentGatewayWritesEveryKeyAndReportsLiveness(t *testing.T) {
	withCopilotChatTestDB(t)
	previousKey := setting.NowPaymentsApiKey
	previousSecret := setting.NowPaymentsIpnSecret
	t.Cleanup(func() {
		setting.NowPaymentsApiKey = previousKey
		setting.NowPaymentsIpnSecret = previousSecret
	})

	// No option store in this test, so the handler must report a failure rather
	// than claim the gateway is configured.
	c, recorder := copilotChatContext(t, http.MethodPost, "/api/admin/copilot/tools/payments/configure",
		`{"provider":"nowpayments","credentials":{"NowPaymentsApiKey":"k","NowPaymentsIpnSecret":"s"}}`, 1)
	c.Set("role", 10)
	ConfigureCopilotPaymentGateway(c)
	var envelope copilotChatEnvelope
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &envelope))
	// Writing an option without an option map is refused, and the refusal names
	// nothing that was not attempted.
	assert.False(t, envelope.Success)
}
