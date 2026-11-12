package controller

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertTopUpOrder(t *testing.T, userId int, money float64, status string, createTime int64) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.TopUp{
		UserId:        userId,
		Money:         money,
		TradeNo:       fmt.Sprintf("order-%s-%d-%d", status, userId, createTime),
		Status:        status,
		PaymentMethod: "epay",
		CreateTime:    createTime,
	}).Error)
}

func TestGetTopUpOrdersStats(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	setupNowPaymentsWebhookDB(t)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/topup/orders_stats", GetTopUpOrdersStats)

	require.NoError(t, model.DB.Create(&model.User{Id: 1, Username: "alice", AffCode: "aaa"}).Error)
	require.NoError(t, model.DB.Create(&model.User{Id: 2, Username: "bob", AffCode: "bbb"}).Error)

	insertTopUpOrder(t, 1, 10, "pending", 1000)
	insertTopUpOrder(t, 2, 20, "pending", 2000)
	insertTopUpOrder(t, 1, 30, "success", 3000)
	insertTopUpOrder(t, 2, 40, "success", 4000)
	insertTopUpOrder(t, 1, 50, "failed", 5000)
	insertTopUpOrder(t, 2, 60, "expired", 6000)
	insertTopUpOrder(t, 1, 70, "pending", 7000) // most recent pending order

	req := httptest.NewRequest(http.MethodGet, "/api/topup/orders_stats", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var body struct {
		Success bool `json:"success"`
		Data    []struct {
			Key    string  `json:"key"`
			Count  int64   `json:"count"`
			Amount float64 `json:"amount"`
			Recent []struct {
				Username string  `json:"username"`
				Money    float64 `json:"money"`
				TradeNo  string  `json:"trade_no"`
			} `json:"recent"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.True(t, body.Success)
	require.Len(t, body.Data, 3)

	type groupStats struct {
		count    int64
		amount   float64
		tradeNos []string
		users    []string
	}
	byKey := make(map[string]groupStats)
	for _, group := range body.Data {
		stats := groupStats{count: group.Count, amount: group.Amount}
		for _, order := range group.Recent {
			stats.tradeNos = append(stats.tradeNos, order.TradeNo)
			stats.users = append(stats.users, order.Username)
		}
		byKey[group.Key] = stats
	}

	pending := byKey["pending"]
	assert.Equal(t, int64(3), pending.count)
	assert.InDelta(t, 100.0, pending.amount, 0.001)
	require.Len(t, pending.tradeNos, 3)
	// Most recent order first, with the joined username.
	assert.Equal(t, "order-pending-1-7000", pending.tradeNos[0])
	assert.Equal(t, "alice", pending.users[0])

	completed := byKey["completed"]
	assert.Equal(t, int64(2), completed.count)
	assert.InDelta(t, 70.0, completed.amount, 0.001)

	failed := byKey["failed"]
	// Both failed and expired orders are grouped into the failed bucket.
	assert.Equal(t, int64(2), failed.count)
	assert.InDelta(t, 110.0, failed.amount, 0.001)
}
