package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// SecurityHeaders sets baseline defensive response headers on every response.
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
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.Writer.Header()
		header.Set("X-Content-Type-Options", "nosniff")
		header.Set("X-Frame-Options", "SAMEORIGIN")
		header.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		header.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
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
