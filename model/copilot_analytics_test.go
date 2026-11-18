package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func withCopilotSalesDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Log{}))
	previous := LOG_DB
	LOG_DB = db
	t.Cleanup(func() {
		LOG_DB = previous
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
}

// TestCopilotSalesReportTotalsAndBuckets checks the figures a sales answer rests
// on: revenue and upstream cost summed from the log, profit as their difference,
// and only consumed requests counted.
func TestCopilotSalesReportTotalsAndBuckets(t *testing.T) {
	withCopilotSalesDB(t)
	start := int64(1700000000)
	rows := []Log{
		{CreatedAt: start + 100, Type: LogTypeConsume, ModelName: "gpt-4o", Username: "alice", Quota: 1000, UpstreamCost: 700, PromptTokens: 10, CompletionTokens: 5},
		{CreatedAt: start + 200, Type: LogTypeConsume, ModelName: "gpt-4o", Username: "bob", Quota: 500, UpstreamCost: 300, PromptTokens: 4, CompletionTokens: 2},
		{CreatedAt: start + 300, Type: LogTypeConsume, ModelName: "claude", Username: "alice", Quota: 2000, UpstreamCost: 1500},
		// A top-up is not consumption and must not enter the report.
		{CreatedAt: start + 400, Type: LogTypeTopup, Username: "alice", Quota: 999999},
	}
	for index := range rows {
		require.NoError(t, LOG_DB.Create(&rows[index]).Error)
	}

	report, err := GetCopilotSalesReport(start, start+86400, "model", 10)
	require.NoError(t, err)
	assert.Equal(t, int64(3500), report.Totals.RevenueQuota)
	assert.Equal(t, int64(2500), report.Totals.UpstreamCostQuota)
	assert.Equal(t, int64(1000), report.Totals.ProfitQuota)
	assert.Equal(t, int64(3), report.Totals.Requests)
	assert.Equal(t, int64(14), report.Totals.PromptTokens)

	require.Len(t, report.Buckets, 2)
	// Ranked by revenue, so the biggest earner is first.
	assert.Equal(t, "claude", report.Buckets[0].Key)
	assert.Equal(t, int64(2000), report.Buckets[0].RevenueQuota)
	assert.Equal(t, "gpt-4o", report.Buckets[1].Key)
	assert.Equal(t, int64(1500), report.Buckets[1].RevenueQuota)
	// gpt-4o: 1500 charged, 1000 upstream cost.
	assert.Equal(t, int64(500), report.Buckets[1].ProfitQuota)
}

// TestCopilotSalesReportDaySeriesKeepsEmptyDays checks that a day series shows
// the gaps instead of silently closing them.
func TestCopilotSalesReportDaySeriesKeepsEmptyDays(t *testing.T) {
	withCopilotSalesDB(t)
	start := int64(1700000000)
	require.NoError(t, LOG_DB.Create(&Log{CreatedAt: start, Type: LogTypeConsume, ModelName: "m", Quota: 100}).Error)

	// A window that starts mid-day covers part of that day, then two whole
	// days, then part of the last one.
	report, err := GetCopilotSalesReport(start, start+3*86400, "day", 10)
	require.NoError(t, err)
	assert.Len(t, report.Buckets, 4)
	assert.Equal(t, int64(100), report.Totals.RevenueQuota)
}

// TestCopilotSalesReportRefusesBadInput checks the guards.
func TestCopilotSalesReportRefusesBadInput(t *testing.T) {
	withCopilotSalesDB(t)
	_, err := GetCopilotSalesReport(0, 100, "day", 10)
	assert.Error(t, err)
	_, err = GetCopilotSalesReport(200, 100, "day", 10)
	assert.Error(t, err)
	_, err = GetCopilotSalesReport(100, 200, "nonsense", 10)
	assert.Error(t, err)
}
