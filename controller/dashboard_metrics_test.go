package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAdminDashboardMetrics(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	setupNowPaymentsWebhookDB(t)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/data/metrics", GetAdminDashboardMetrics)

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	today := startOfDay + 3600
	yesterday := startOfDay - 24*3600

	// Three registered users with balances (liabilities).
	require.NoError(t, model.DB.Create(&model.User{Id: 1, Username: "alice", AffCode: "aaa", Quota: 150}).Error)
	require.NoError(t, model.DB.Create(&model.User{Id: 2, Username: "bob", AffCode: "bbb", Quota: 250}).Error)
	require.NoError(t, model.DB.Create(&model.User{Id: 3, Username: "carol", AffCode: "ccc", Quota: 100}).Error)

	// Today: alice consumed, alice + bob logged in, one failed request.
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 1, Type: model.LogTypeConsume, CreatedAt: today}).Error)
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 1, Type: model.LogTypeLogin, CreatedAt: today}).Error)
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 2, Type: model.LogTypeLogin, CreatedAt: today}).Error)
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 1, Type: model.LogTypeError, CreatedAt: today}).Error)
	// Yesterday: must not count towards today's metrics.
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 3, Type: model.LogTypeConsume, CreatedAt: yesterday}).Error)
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 3, Type: model.LogTypeError, CreatedAt: yesterday}).Error)

	req := httptest.NewRequest(http.MethodGet, "/api/data/metrics", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var body struct {
		Success bool `json:"success"`
		Data    struct {
			RegisteredUsers       int64 `json:"registered_users"`
			TotalLiabilitiesQuota int64 `json:"total_liabilities_quota"`
			ActiveVisitorsToday   int64 `json:"active_visitors_today"`
			FailedRequestsToday   int64 `json:"failed_requests_today"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.True(t, body.Success)

	assert.Equal(t, int64(3), body.Data.RegisteredUsers)
	assert.Equal(t, int64(500), body.Data.TotalLiabilitiesQuota)
	// Distinct users with API requests or logins today: alice, bob.
	assert.Equal(t, int64(2), body.Data.ActiveVisitorsToday)
	// Only today's error logs count.
	assert.Equal(t, int64(1), body.Data.FailedRequestsToday)
}
