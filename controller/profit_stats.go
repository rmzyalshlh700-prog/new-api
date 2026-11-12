package controller

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetProfitStats serves the admin dashboard net profit: consume-log revenue
// minus the provider's base cost for today, the current month and all time.
// Windows are computed from the server's local midnight so they match the
// dashboard's other "today" metrics.
func GetProfitStats(c *gin.Context) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Unix()

	stats, err := model.GetProfitStats(startOfDay, startOfMonth)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stats)
}
