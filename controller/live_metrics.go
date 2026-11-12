package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
)

// StreamLiveMetrics streams one OS-metrics snapshot per second over SSE.
// The route is protected by AdminAuth, so only admins can subscribe. The
// connection ends when the client disconnects (request context cancelled).
func StreamLiveMetrics(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-store")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Writer.WriteHeader(http.StatusOK)
	if _, err := c.Writer.Write([]byte("retry: 5000\n\n")); err != nil {
		return
	}
	c.Writer.Flush()

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		return
	}

	writeSnapshot := func(snapshot service.LiveMetricsSnapshot) error {
		payload, err := common.Marshal(snapshot)
		if err != nil {
			return err
		}
		if _, err := c.Writer.Write([]byte("event: metrics\ndata: " + string(payload) + "\n\n")); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	service.StreamLiveMetrics(c.Request.Context(), writeSnapshot)
}
