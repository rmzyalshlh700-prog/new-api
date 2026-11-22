package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPublicPageEnabledDefaultsToVisible(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})

	assert.True(t, publicPageEnabled("public_pages.docs_enabled"))

	common.OptionMapRWMutex.Lock()
	common.OptionMap["public_pages.docs_enabled"] = "false"
	common.OptionMap["public_pages.blog_enabled"] = "true"
	common.OptionMapRWMutex.Unlock()

	assert.False(t, publicPageEnabled("public_pages.docs_enabled"))
	assert.True(t, publicPageEnabled("public_pages.blog_enabled"))
}

func TestGetPublicBlogPostsServesOnlyPublishedPostsNewestFirst(t *testing.T) {
	gin.SetMode(gin.TestMode)

	common.OptionMapRWMutex.Lock()
	previous := common.OptionMap
	common.OptionMap = map[string]string{
		"public_pages.blog_posts": `[
			{"id":"a","slug":"older","date":"2026-01-02","published":true,"title":{"en":"Older"},"summary":{},"body":{}},
			{"id":"b","slug":"draft","date":"2026-05-01","published":false,"title":{"en":"Draft"},"summary":{},"body":{}},
			{"id":"c","slug":"newer","date":"2026-04-03","published":true,"title":{"en":"Newer"},"summary":{},"body":{}}
		]`,
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previous
		common.OptionMapRWMutex.Unlock()
	})

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/blog", nil)

	GetPublicBlogPosts(context)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"slug":"newer"`)
	assert.Contains(t, recorder.Body.String(), `"slug":"older"`)
	assert.NotContains(t, recorder.Body.String(), `"slug":"draft"`)
	assert.Less(
		t,
		strings.Index(recorder.Body.String(), `"slug":"newer"`),
		strings.Index(recorder.Body.String(), `"slug":"older"`),
	)
}
