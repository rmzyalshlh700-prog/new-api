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

// TestGetProfitStats verifies net profit is consume revenue minus upstream cost
// for today, the current month and all time, and that non-consume logs never
// count as revenue.
func TestGetProfitStats(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	setupNowPaymentsWebhookDB(t)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/admin/profit_stats", GetProfitStats)

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Unix()
	today := startOfDay + 60
	previousMonth := startOfMonth - 24*3600

	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 1, Type: model.LogTypeConsume, CreatedAt: today, Quota: 1000, UpstreamCost: 600}).Error)
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 2, Type: model.LogTypeConsume, CreatedAt: previousMonth, Quota: 300, UpstreamCost: 50}).Error)
	// A consuming log earlier this month that is not today. Skipped when the run
	// happens on the first day of a month, where it would also be "today".
	monthRevenue, monthCost := int64(1000), int64(600)
	if startOfMonth < startOfDay {
		require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 1, Type: model.LogTypeConsume, CreatedAt: startOfMonth, Quota: 500, UpstreamCost: 100}).Error)
		monthRevenue += 500
		monthCost += 100
	}
	// Top-up logs are not revenue.
	require.NoError(t, model.LOG_DB.Create(&model.Log{UserId: 2, Type: model.LogTypeTopup, CreatedAt: today, Quota: 9999}).Error)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/profit_stats", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	type profitBucket struct {
		Revenue int64 `json:"revenue_quota"`
		Cost    int64 `json:"upstream_cost_quota"`
		Profit  int64 `json:"net_profit_quota"`
	}
	var body struct {
		Success bool `json:"success"`
		Data    struct {
			Today   profitBucket `json:"today"`
			Month   profitBucket `json:"month"`
			AllTime profitBucket `json:"all_time"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.True(t, body.Success)

	assert.Equal(t, profitBucket{Revenue: 1000, Cost: 600, Profit: 400}, body.Data.Today)
	assert.Equal(t, profitBucket{Revenue: monthRevenue, Cost: monthCost, Profit: monthRevenue - monthCost}, body.Data.Month)
	assert.Equal(t, profitBucket{Revenue: monthRevenue + 300, Cost: monthCost + 50, Profit: monthRevenue + 250 - monthCost}, body.Data.AllTime)
}
