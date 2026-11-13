package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// APIBodyLimit caps every non-GET API request body. Anonymous routes apply a
// stricter limit of their own, but authenticated JSON endpoints would otherwise
// decode an unbounded payload into memory. http.MaxBytesReader makes the read
// fail instead of allocating, without buffering the body up front.
func APIBodyLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body == nil || c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead {
			c.Next()
			return
		}
		if maxBytes > 0 {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		}
		c.Next()
	}
}
