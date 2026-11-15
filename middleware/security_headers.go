package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// SecurityHeaders sets baseline defensive response headers on every response,
// plus a deny-all Content-Security-Policy on API paths.
//
// The console previously relied on endpoint-specific headers only (nosniff and
// a sandbox CSP on proxied media); HTML and API responses served globally had
// no frame, sniffing, or referrer protection, and HSTS was left entirely to the
// reverse proxy. This middleware closes that gap without touching CORS, the
// OriginGuard, or relay streaming behavior.
//
// Strict-Transport-Security is emitted only when the request actually arrived
// over HTTPS — either a direct TLS connection or, when the immediate peer is a
// configured trusted proxy, X-Forwarded-Proto: https. A plain-HTTP development
// server therefore never pins clients to HTTPS, and a direct (untrusted) client
// cannot enable HSTS by spoofing the forwarded header.
// apiContentSecurityPolicy is sent on machine-readable API paths (/api, /v1).
//
// Those paths serve JSON, SSE and upstream media, never an HTML document, so
// the policy can deny everything: if a browser is ever navigated to a response
// there, it renders nothing and runs nothing. It also forbids framing, which
// closes the clickjacking window on endpoints that X-Frame-Options can only
// cover at SAMEORIGIN.
//
// The console's own HTML keeps the baseline headers only. A document policy has
// to allow the bundle, the operator-injected analytics snippet and the sandboxed
// plugin frames, so it depends on deployment choices (see SECURITY headers in
// the deployment notes) and is not guessed here.
const apiContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"

// isAPIPath reports whether the request targets the API rather than the web
// console. The prefixes match the ones the web router uses to route unknown
// paths to the API 404 handler.
func isAPIPath(path string) bool {
	return strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/v1")
}

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.Writer.Header()
		header.Set("X-Content-Type-Options", "nosniff")
		header.Set("X-Frame-Options", "SAMEORIGIN")
		header.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		header.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		if isAPIPath(c.Request.URL.Path) {
			header.Set("Content-Security-Policy", apiContentSecurityPolicy)
		}
		if requestOverHTTPS(c.Request) {
			header.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}

// requestOverHTTPS reports whether the browser-side connection used TLS,
// trusting X-Forwarded-Proto only from a trusted proxy peer.
func requestOverHTTPS(request *http.Request) bool {
	if request.TLS != nil {
		return true
	}
	if common.IsTrustedProxyIP(request.RemoteAddr) {
		return strings.EqualFold(firstForwardedValue(request.Header.Get("X-Forwarded-Proto")), "https")
	}
	return false
}
