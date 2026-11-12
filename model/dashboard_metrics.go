package model

// DashboardMetrics holds platform-wide metrics for the admin dashboard.
// Quota values are in internal quota units; the frontend converts them to
// the configured currency display.
type DashboardMetrics struct {
	RegisteredUsers       int64 `json:"registered_users"`
	TotalLiabilitiesQuota int64 `json:"total_liabilities_quota"`
	ActiveVisitorsToday   int64 `json:"active_visitors_today"`
	FailedRequestsToday   int64 `json:"failed_requests_today"`
}

// GetDashboardMetrics aggregates the admin dashboard metrics with a single
// indexed query per table:
//   - users: one scan for COUNT(*) + SUM(quota) (total financial liability).
//   - logs: one range scan over idx_created_at_type counting distinct active
//     users (API requests + logins) and failed requests since startOfDay.
//     The aggregate SQL (CASE WHEN / COUNT DISTINCT / COALESCE) is portable
//     across SQLite, MySQL, PostgreSQL and the ClickHouse log database.
func GetDashboardMetrics(startOfDay int64) (*DashboardMetrics, error) {
	metrics := &DashboardMetrics{}

	err := DB.Model(&User{}).
		Select("COUNT(*) as registered_users, COALESCE(SUM(quota), 0) as total_liabilities_quota").
		Scan(metrics).Error
	if err != nil {
		return nil, err
	}

	var logStats struct {
		ActiveVisitors int64 `gorm:"column:active_visitors"`
		FailedRequests int64 `gorm:"column:failed_requests"`
	}
	err = LOG_DB.Model(&Log{}).
		Select(
			"COUNT(DISTINCT CASE WHEN type IN (?, ?) THEN user_id END) as active_visitors, "+
				"COALESCE(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END), 0) as failed_requests",
			LogTypeConsume, LogTypeLogin, LogTypeError,
		).
		Where("created_at >= ?", startOfDay).
		Scan(&logStats).Error
	if err != nil {
		return nil, err
	}
	metrics.ActiveVisitorsToday = logStats.ActiveVisitors
	metrics.FailedRequestsToday = logStats.FailedRequests

	return metrics, nil
}
