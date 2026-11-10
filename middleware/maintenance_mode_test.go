package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/maintenance_setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withMaintenanceSetting(t *testing.T, enabled bool, whitelist string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	current := maintenance_setting.Get()
	previousEnabled, previousWhitelist := current.MaintenanceEnabled, current.MaintenanceWhitelist
	require.NoError(t, config.UpdateConfigFromMap(current, map[string]string{
		"enabled":   strconv.FormatBool(enabled),
		"whitelist": whitelist,
	}))
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		current.MaintenanceEnabled = previousEnabled
		current.MaintenanceWhitelist = previousWhitelist
	})
}

func performMaintenanceRequest(t *testing.T, method, requestPath, accessToken string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	handled := false
	router := gin.New()
	router.Use(MaintenanceMode())
	router.Handle(method, requestPath, func(c *gin.Context) {
		handled = true
		c.JSON(http.StatusOK, gin.H{"success": true})
	})
	request := httptest.NewRequest(method, requestPath, nil)
	if accessToken != "" {
		request.Header.Set("Authorization", "Bearer "+accessToken)
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	if recorder.Code == http.StatusOK {
		assert.True(t, handled)
	} else {
		assert.False(t, handled)
	}
	return recorder
}

func TestMaintenanceModeDisabledPassesTraffic(t *testing.T) {
	withMaintenanceSetting(t, false, "")

	recorder := performMaintenanceRequest(t, http.MethodGet, "/dashboard", "")

	require.Equal(t, http.StatusOK, recorder.Code)
}

func TestMaintenanceModeAllowsDocumentRequests(t *testing.T) {
	withMaintenanceSetting(t, true, "")

	for _, requestPath := range []string{
		"/",
		"/dashboard",
		"/assets/index.js",
		"/maintenance",
	} {
		t.Run(requestPath, func(t *testing.T) {
			recorder := performMaintenanceRequest(t, http.MethodGet, requestPath, "")
			require.Equal(t, http.StatusOK, recorder.Code)
		})
	}
}

func TestMaintenanceModeBlocksAPIRequests(t *testing.T) {
	withMaintenanceSetting(t, true, "")

	for _, request := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/user/self"},
		{http.MethodPost, "/api/user/self"},
		{http.MethodPost, "/v1/chat/completions"},
		{http.MethodGet, "/dashboard/billing/usage"},
	} {
		t.Run(request.method+" "+request.path, func(t *testing.T) {
			recorder := performMaintenanceRequest(t, request.method, request.path, "")
			require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
			assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))

			var body map[string]any
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
			assert.Equal(t, false, body["success"])
			assert.Equal(t, true, body["maintenance_active"])
			assert.Equal(t, "System under maintenance", body["message"])
		})
	}
}

func TestMaintenanceModeExemptsLoginAdminAndAuthRoutes(t *testing.T) {
	withMaintenanceSetting(t, true, "")

	for _, requestPath := range []string{
		"/api/status",
		"/api/setup",
		"/api/user/login",
		"/api/user/auth/refresh",
		"/api/oauth/github",
	} {
		t.Run(requestPath, func(t *testing.T) {
			recorder := performMaintenanceRequest(t, http.MethodGet, requestPath, "")
			require.Equal(t, http.StatusOK, recorder.Code)
		})
	}
}

func TestMaintenanceModeSessionBypass(t *testing.T) {
	setupDashboardAuthMiddlewareTest(t)

	whitelisted := model.User{
		Username: "whitelisted-user", Email: "allowed@example.com",
		Password: "unused-password-hash", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
		AffCode: "maintenance-whitelisted",
	}
	require.NoError(t, model.DB.Create(&whitelisted).Error)
	blocked := model.User{
		Username: "blocked-user", Email: "blocked@example.com",
		Password: "unused-password-hash", Role: common.RoleCommonUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
		AffCode: "maintenance-blocked",
	}
	require.NoError(t, model.DB.Create(&blocked).Error)

	whitelistedBundle, err := service.CreateLoginSession(whitelisted.Id, "password", "127.0.0.1", "maintenance-test")
	require.NoError(t, err)
	blockedBundle, err := service.CreateLoginSession(blocked.Id, "password", "127.0.0.1", "maintenance-test")
	require.NoError(t, err)

	withMaintenanceSetting(t, true, "allowed@example.com")

	allowedRecorder := performMaintenanceRequest(t, http.MethodGet, "/api/user/self", whitelistedBundle.AccessToken)
	require.Equal(t, http.StatusOK, allowedRecorder.Code)

	blockedRecorder := performMaintenanceRequest(t, http.MethodGet, "/api/user/self", blockedBundle.AccessToken)
	require.Equal(t, http.StatusServiceUnavailable, blockedRecorder.Code)
	var body map[string]any
	require.NoError(t, json.Unmarshal(blockedRecorder.Body.Bytes(), &body))
	assert.Equal(t, true, body["maintenance_active"])
}

func TestMaintenanceModeAllowsAdministrators(t *testing.T) {
	setupDashboardAuthMiddlewareTest(t)

	admin := model.User{
		Username: "admin-user", Email: "admin@example.com",
		Password: "unused-password-hash", Role: common.RoleAdminUser,
		Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
		AffCode: "maintenance-admin",
	}
	require.NoError(t, model.DB.Create(&admin).Error)
	bundle, err := service.CreateLoginSession(admin.Id, "password", "127.0.0.1", "maintenance-test")
	require.NoError(t, err)

	withMaintenanceSetting(t, true, "")

	recorder := performMaintenanceRequest(t, http.MethodGet, "/api/option/", bundle.AccessToken)

	require.Equal(t, http.StatusOK, recorder.Code)
}
