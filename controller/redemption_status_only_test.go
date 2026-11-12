package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUpdateRedemptionStatusOnlyRejectsInvalidStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })

	previousDB := model.DB
	previousRedis := common.RedisEnabled
	model.DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedis
	})

	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Redemption{}, &model.Option{}))
	// Keep the legacy admin access token authenticatable for this test.
	require.NoError(t, model.EnsureLegacyAccessTokenRetireAt(common.GetTimestamp()+24*60*60))

	code := model.Redemption{Name: "status-test", Key: "status-test-key", Quota: 100, Status: common.RedemptionCodeStatusEnabled}
	adminToken := "status-test-admin-token"
	require.NoError(t, db.Create(&code).Error)

	admin := model.User{Username: "status-test-admin", Password: "unused", Role: common.RoleAdminUser, Status: common.UserStatusEnabled, Group: "default", AccessToken: &adminToken}
	require.NoError(t, db.Create(&admin).Error)

	router := gin.New()
	router.PUT("/api/redemption/", middleware.AdminAuth(), UpdateRedemption)

	call := func(status int) *httptest.ResponseRecorder {
		payload, err := common.Marshal(map[string]any{"id": code.Id, "status": status})
		require.NoError(t, err)
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPut, "/api/redemption/?status_only=true", bytes.NewReader(payload))
		request.Header.Set("Authorization", "Bearer "+adminToken)
		router.ServeHTTP(response, request)
		return response
	}

	for _, status := range []int{0, 3, 4, 99, -1} {
		response := call(status)
		require.Equal(t, http.StatusOK, response.Code, "invalid status %d", status)
		var result struct {
			Success bool `json:"success"`
		}
		require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
		assert.False(t, result.Success, "status %d must be rejected", status)
	}

	var unchanged model.Redemption
	require.NoError(t, db.First(&unchanged, code.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, unchanged.Status, "invalid statuses must not be written")

	response := call(common.RedemptionCodeStatusDisabled)
	require.Equal(t, http.StatusOK, response.Code)
	var result struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	assert.True(t, result.Success)

	var updated model.Redemption
	require.NoError(t, db.First(&updated, code.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusDisabled, updated.Status)
}
