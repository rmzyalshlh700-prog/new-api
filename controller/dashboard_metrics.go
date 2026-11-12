package controller

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetAdminDashboardMetrics serves the admin dashboard platform metrics:
// total registered users, total user liabilities (sum of balances),
// today's active visitors and today's failed API requests.
func GetAdminDashboardMetrics(c *gin.Context) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()

	metrics, err := model.GetDashboardMetrics(startOfDay)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, metrics)
}
