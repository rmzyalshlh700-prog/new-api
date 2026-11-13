package middleware

import (
	"crypto/tls"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func securityHeadersRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(SecurityHeaders())
	router.GET("/status", func(c *gin.Context) {
		c.Status(200)
	})
	return router
}

func setTrustedProxyTestIPs(t *testing.T, router *gin.Engine, cidr string) {
	t.Helper()
	require.NoError(t, common.ConfigureTrustedProxies(router, []string{cidr}))
	t.Cleanup(func() {
		require.NoError(t, common.ConfigureTrustedProxies(router, nil))
	})
}

func baseSecurityHeaderAssertions(t *testing.T, recorder *httptest.ResponseRecorder) {
	t.Helper()
	assert.Equal(t, "nosniff", recorder.Header().Get("X-Content-Type-Options"))
	assert.Equal(t, "SAMEORIGIN", recorder.Header().Get("X-Frame-Options"))
	assert.Equal(t, "strict-origin-when-cross-origin", recorder.Header().Get("Referrer-Policy"))
	assert.Equal(t, "camera=(), microphone=(), geolocation=()", recorder.Header().Get("Permissions-Policy"))
}

func TestSecurityHeadersSetsBaselineOnPlainHTTP(t *testing.T) {
	router := securityHeadersRouter(t)

	request := httptest.NewRequest("GET", "/status", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	baseSecurityHeaderAssertions(t, recorder)
	assert.Empty(t, recorder.Header().Get("Strict-Transport-Security"))
}

func TestSecurityHeadersRejectSpoofedForwardedProto(t *testing.T) {
	router := securityHeadersRouter(t)

	// httptest's default RemoteAddr (192.0.2.1:1234) is not a trusted proxy, so
	// a directly connected client cannot enable HSTS via X-Forwarded-Proto.
	request := httptest.NewRequest("GET", "/status", nil)
	request.Header.Set("X-Forwarded-Proto", "https")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	baseSecurityHeaderAssertions(t, recorder)
	assert.Empty(t, recorder.Header().Get("Strict-Transport-Security"))
}

func TestSecurityHeadersEmitsHSTSBehindTrustedHTTPSProxy(t *testing.T) {
	router := securityHeadersRouter(t)
	setTrustedProxyTestIPs(t, router, "127.0.0.0/8")

	request := httptest.NewRequest("GET", "/status", nil)
	request.RemoteAddr = "127.0.0.1:54321"
	request.Header.Set("X-Forwarded-Proto", "https")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	baseSecurityHeaderAssertions(t, recorder)
	assert.Equal(t, "max-age=31536000; includeSubDomains", recorder.Header().Get("Strict-Transport-Security"))
}

func TestSecurityHeadersNoHSTSBehindTrustedProxyStillHTTP(t *testing.T) {
	router := securityHeadersRouter(t)
	setTrustedProxyTestIPs(t, router, "127.0.0.0/8")

	request := httptest.NewRequest("GET", "/status", nil)
	request.RemoteAddr = "127.0.0.1:54321"
	request.Header.Set("X-Forwarded-Proto", "http")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	baseSecurityHeaderAssertions(t, recorder)
	assert.Empty(t, recorder.Header().Get("Strict-Transport-Security"))
}

func TestSecurityHeadersEmitsHSTSOnDirectTLS(t *testing.T) {
	router := securityHeadersRouter(t)

	request := httptest.NewRequest("GET", "/status", nil)
	request.TLS = &tls.ConnectionState{}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	baseSecurityHeaderAssertions(t, recorder)
	assert.Equal(t, "max-age=31536000; includeSubDomains", recorder.Header().Get("Strict-Transport-Security"))
}
