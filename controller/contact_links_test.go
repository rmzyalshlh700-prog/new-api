package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupContactLinksRouter(t *testing.T) *gin.Engine {
	confirmPaymentComplianceForTest(t)
	db := setupNowPaymentsWebhookDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = make(map[string]string)
	}
	common.OptionMap["ContactLinks"] = "[]"
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap["ContactLinks"] = "[]"
		common.OptionMapRWMutex.Unlock()
	})

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/admin/contact_links", GetContactLinksAdmin)
	router.POST("/api/admin/contact_links", AddContactLink)
	router.PUT("/api/admin/contact_links", UpdateContactLink)
	router.DELETE("/api/admin/contact_links/:id", DeleteContactLink)
	router.GET("/api/public/contact_links", GetPublicContactLinks)
	return router
}

func contactLinksRequest(t *testing.T, router *gin.Engine, method, path string, body any) map[string]any {
	var reader *bytes.Reader
	if body != nil {
		data, err := json.Marshal(body)
		require.NoError(t, err)
		reader = bytes.NewReader(data)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var res map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res))
	return res
}

func TestContactLinksCrud(t *testing.T) {
	router := setupContactLinksRouter(t)

	// Add two links.
	created := contactLinksRequest(t, router, http.MethodPost, "/api/admin/contact_links", map[string]any{
		"title": "Join Telegram", "url": "https://t.me/example",
		"icon": "send", "position": "sidebar_bottom", "is_active": true,
	})
	id1, ok := created["data"].(map[string]any)["id"].(string)
	require.True(t, ok)
	assert.NotEmpty(t, id1)

	contactLinksRequest(t, router, http.MethodPost, "/api/admin/contact_links", map[string]any{
		"title": "Status Page", "url": "https://status.example.com",
		"icon": "activity", "position": "header_top", "is_active": false,
	})

	// List shows both.
	list := contactLinksRequest(t, router, http.MethodGet, "/api/admin/contact_links", nil)
	items := list["data"].([]any)
	require.Len(t, items, 2)

	// Public endpoint returns only active ones.
	pub := contactLinksRequest(t, router, http.MethodGet, "/api/public/contact_links", nil)
	activeItems := pub["data"].([]any)
	require.Len(t, activeItems, 1)
	assert.Equal(t, "Join Telegram", activeItems[0].(map[string]any)["title"])

	// Update toggles title and active flag.
	active := true
	updated := contactLinksRequest(t, router, http.MethodPut, "/api/admin/contact_links", map[string]any{
		"id": id1, "title": "Telegram Channel", "is_active": &active,
	})
	_ = updated
	pub = contactLinksRequest(t, router, http.MethodGet, "/api/public/contact_links", nil)
	activeItems = pub["data"].([]any)
	require.Len(t, activeItems, 1)
	assert.Equal(t, "Telegram Channel", activeItems[0].(map[string]any)["title"])

	// Delete removes it.
	contactLinksRequest(t, router, http.MethodDelete, "/api/admin/contact_links/"+id1, nil)
	list = contactLinksRequest(t, router, http.MethodGet, "/api/admin/contact_links", nil)
	items = list["data"].([]any)
	require.Len(t, items, 1)

	// Persistence across the option round-trip: stored value is valid JSON
	// that survives a fresh read from the DB.
	common.OptionMapRWMutex.Lock()
	delete(common.OptionMap, "ContactLinks")
	common.OptionMapRWMutex.Unlock()
	options, err := model.AllOption()
	require.NoError(t, err)
	var stored string
	for _, opt := range options {
		if opt.Key == "ContactLinks" {
			stored = opt.Value
		}
	}
	var links []setting.ContactLink
	require.NoError(t, common.UnmarshalJsonStr(stored, &links))
	require.Len(t, links, 1)
	assert.Equal(t, "Status Page", links[0].Title)
}

func TestContactLinksValidation(t *testing.T) {
	router := setupContactLinksRouter(t)

	cases := []struct {
		name string
		body map[string]any
	}{
		{"missing title", map[string]any{"url": "https://t.me/x", "position": "sidebar_bottom"}},
		{"bad url", map[string]any{"title": "x", "url": "javascript:alert(1)", "position": "sidebar_bottom"}},
		{"bad position", map[string]any{"title": "x", "url": "https://t.me/x", "position": "nowhere"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/admin/contact_links", nil)
			data, err := json.Marshal(tc.body)
			require.NoError(t, err)
			req = httptest.NewRequest(http.MethodPost, "/api/admin/contact_links", bytes.NewReader(data))
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			var res map[string]any
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &res))
			assert.Equal(t, false, res["success"], rec.Body.String())

			// Nothing was persisted.
			list := contactLinksRequest(t, router, http.MethodGet, "/api/admin/contact_links", nil)
			assert.Empty(t, list["data"])
		})
	}

	// Update and Delete with an unknown id fail.
	updated := contactLinksRequest(t, router, http.MethodPut, "/api/admin/contact_links", map[string]any{"id": "missing"})
	assert.Equal(t, false, updated["success"])
	deleted := contactLinksRequest(t, router, http.MethodDelete, "/api/admin/contact_links/missing", nil)
	assert.Equal(t, false, deleted["success"])
}
