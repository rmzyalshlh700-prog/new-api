package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/maintenance_setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func withMaintenanceProbeSetting(t *testing.T, enabled bool, whitelist string) {
	t.Helper()
	common.OptionMapRWMutex.Lock()
	current := maintenance_setting.Get()
	previousEnabled, previousWhitelist := current.MaintenanceEnabled, current.MaintenanceWhitelist
	current.MaintenanceEnabled = enabled
	current.MaintenanceWhitelist = whitelist
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		defer common.OptionMapRWMutex.Unlock()
		current.MaintenanceEnabled = previousEnabled
		current.MaintenanceWhitelist = previousWhitelist
	})
}

func setupMaintenanceProbeTestDB(t *testing.T) {
	t.Helper()
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousDatabaseType := common.MainDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	previousSessionSecret := common.SessionSecret

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/maintenance-probe.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserSession{}))
	model.DB, model.LOG_DB = db, db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.SessionSecret = "maintenance-probe-test-secret"

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.RedisEnabled = previousRedisEnabled
		common.SessionSecret = previousSessionSecret
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
}

func performMaintenanceProbeRequest(t *testing.T, accessToken string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/status/maintenance", nil)
	if accessToken != "" {
		context.Request.Header.Set("Authorization", "Bearer "+accessToken)
	}
	GetMaintenanceStatus(context)
	return recorder
}

type maintenanceProbePayload struct {
	Success bool `json:"success"`
	Data    struct {
		Enabled bool `json:"enabled"`
		Bypass  bool `json:"bypass"`
	} `json:"data"`
}

func decodeMaintenanceProbe(t *testing.T, recorder *httptest.ResponseRecorder) maintenanceProbePayload {
	t.Helper()
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))
	var payload maintenanceProbePayload
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.True(t, payload.Success)
	return payload
}

func TestGetMaintenanceStatusReportsGlobalState(t *testing.T) {
	withMaintenanceProbeSetting(t, false, "")

	payload := decodeMaintenanceProbe(t, performMaintenanceProbeRequest(t, ""))

	assert.False(t, payload.Data.Enabled)
	assert.False(t, payload.Data.Bypass)
}

func TestGetMaintenanceStatusReportsSessionBypass(t *testing.T) {
	setupMaintenanceProbeTestDB(t)

	createUser := func(username, email string, role int) *model.User {
		user := &model.User{
			Username: username, Email: email,
			Password: "unused-password-hash", Role: role,
			Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
			AffCode: "maintenance-probe-" + username,
		}
		require.NoError(t, model.DB.Create(user).Error)
		return user
	}
	normal := createUser("normal-user", "normal@example.com", common.RoleCommonUser)
	whitelisted := createUser("whitelisted-user", "allowed@example.com", common.RoleCommonUser)
	admin := createUser("admin-user", "admin@example.com", common.RoleAdminUser)

	createSession := func(userID int) string {
		bundle, err := service.CreateLoginSession(userID, "password", "127.0.0.1", "maintenance-probe-test")
		require.NoError(t, err)
		return bundle.AccessToken
	}
	normalToken := createSession(normal.Id)
	whitelistedToken := createSession(whitelisted.Id)
	adminToken := createSession(admin.Id)

	withMaintenanceProbeSetting(t, true, "allowed@example.com")

	for _, testCase := range []struct {
		name        string
		accessToken string
		wantBypass  bool
	}{
		{name: "anonymous", accessToken: "", wantBypass: false},
		{name: "normal user", accessToken: normalToken, wantBypass: false},
		{name: "whitelisted user", accessToken: whitelistedToken, wantBypass: true},
		{name: "administrator", accessToken: adminToken, wantBypass: true},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			payload := decodeMaintenanceProbe(t, performMaintenanceProbeRequest(t, testCase.accessToken))

			assert.True(t, payload.Data.Enabled)
			assert.Equal(t, testCase.wantBypass, payload.Data.Bypass)
		})
	}
}
