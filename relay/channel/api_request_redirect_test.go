package channel

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 上游返回响应头后拖住响应体时，非流式请求必须被整请求超时截断，不能无限期
// 占用处理协程与它持有的缓冲区。
func TestDoRequestCutsStalledNonStreamBody(t *testing.T) {
	service.InitHttpClient()
	gin.SetMode(gin.TestMode)
	previousNonStream, previousRelay := common.RelayNonStreamTimeout, common.RelayTimeout
	common.RelayNonStreamTimeout, common.RelayTimeout = 1, 0
	t.Cleanup(func() { common.RelayNonStreamTimeout, common.RelayTimeout = previousNonStream, previousRelay })

	stalled := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, `{"partial":`)
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}
		<-r.Context().Done()
	}))
	defer stalled.Close()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/relay", nil)
	req, err := http.NewRequest(http.MethodPost, stalled.URL, bytes.NewReader([]byte(`{"model":"test"}`)))
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	start := time.Now()
	resp, err := doRequest(ctx, req, info)
	if err == nil {
		defer resp.Body.Close()
		_, err = io.ReadAll(resp.Body)
	}
	require.Error(t, err, "a stalled non-stream body must be cut by the request timeout")
	assert.Less(t, time.Since(start), 30*time.Second)
}

func TestDoRequestReturnsUpstreamRedirectWithoutFollowing(t *testing.T) {
	service.InitHttpClient()
	gin.SetMode(gin.TestMode)
	sharedClient := service.GetHttpClient()
	require.NotNil(t, sharedClient)
	require.NotNil(t, sharedClient.CheckRedirect)
	originalRedirectPolicy := reflect.ValueOf(sharedClient.CheckRedirect).Pointer()

	var targetRequests atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		targetRequests.Add(1)
		w.WriteHeader(http.StatusTeapot)
	}))
	defer target.Close()

	const responseBody = "redirect response"
	tests := []int{
		http.StatusMovedPermanently,
		http.StatusFound,
		http.StatusSeeOther,
		http.StatusTemporaryRedirect,
		http.StatusPermanentRedirect,
	}

	for _, statusCode := range tests {
		t.Run(http.StatusText(statusCode), func(t *testing.T) {
			targetRequests.Store(0)
			var sourceRequests atomic.Int32
			type sourceResult struct {
				body []byte
				err  error
			}
			sourceResultCh := make(chan sourceResult, 1)
			source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				sourceRequests.Add(1)
				body, err := io.ReadAll(r.Body)
				sourceResultCh <- sourceResult{body: body, err: err}
				w.Header().Set("Location", target.URL+"/redirect-target")
				w.WriteHeader(statusCode)
				_, _ = io.WriteString(w, responseBody)
			}))
			defer source.Close()

			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/relay", nil)

			req, err := http.NewRequest(http.MethodPost, source.URL, bytes.NewReader([]byte("request body")))
			require.NoError(t, err)
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

			resp, err := doRequest(ctx, req, info)
			require.NoError(t, err)
			defer resp.Body.Close()
			body, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			gotSource := <-sourceResultCh
			require.NoError(t, gotSource.err)

			assert.Equal(t, statusCode, resp.StatusCode)
			assert.Equal(t, target.URL+"/redirect-target", resp.Header.Get("Location"))
			assert.Equal(t, responseBody, string(body))
			assert.Equal(t, []byte("request body"), gotSource.body)
			assert.EqualValues(t, 1, sourceRequests.Load())
			assert.Zero(t, targetRequests.Load())
		})
	}

	assert.Equal(t, originalRedirectPolicy, reflect.ValueOf(sharedClient.CheckRedirect).Pointer(), "the cached client must not be mutated")
}
