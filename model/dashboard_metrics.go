package model

// DashboardMetrics holds platform-wide metrics for the admin dashboard.
// Quota values are in internal quota units; the frontend converts them to
// the configured currency display.
type DashboardMetrics struct {
	RegisteredUsers       int64 `json:"registered_users"`
	TotalLiabilitiesQuota int64 `json:"total_liabilities_quota"`
	ActiveVisitorsToday   int64 `json:"active_visitors_today"`
	FailedRequestsToday   int64 `json:"failed_requests_today"`
	// ProviderErrorsToday are the failed requests that reached a channel and
	// were refused or broke on the model provider's side.
	ProviderErrorsToday int64 `json:"provider_errors_today"`
	// RejectedRequestsToday are the failed requests that never reached a
	// provider: an unknown model, a bad key, exhausted quota, a malformed body.
	RejectedRequestsToday int64 `json:"rejected_requests_today"`
	APIKeysCreatedToday   int64 `json:"api_keys_created_today"`
	APIKeysTotal          int64 `json:"api_keys_total"`
}

// GetDashboardMetrics aggregates the admin dashboard metrics with a single
// indexed query per table:
//   - users: one scan for COUNT(*) + SUM(quota) (total financial liability).
//   - logs: one range scan over idx_created_at_type counting distinct active
//     users (API requests + logins) and failed requests since startOfDay.
//     Failed requests are split by whether the request reached a channel:
//     `channel_id > 0` means the model provider refused it or broke, while
//     `channel_id = 0` means it was rejected before a provider was chosen.
//     The aggregate SQL (CASE WHEN / COUNT DISTINCT / COALESCE) is portable
//     across SQLite, MySQL, PostgreSQL and the ClickHouse log database.
//   - tokens: one scan counting the API keys created since startOfDay and the
//     total number of keys. Soft-deleted keys are excluded by GORM's
//     deleted_at filter, so the counts match the token list in the console.
func GetDashboardMetrics(startOfDay int64) (*DashboardMetrics, error) {
	metrics := &DashboardMetrics{}

	err := DB.Model(&User{}).
		Select("COUNT(*) as registered_users, COALESCE(SUM(quota), 0) as total_liabilities_quota").
		Scan(metrics).Error
	if err != nil {
		return nil, err
	}

	var tokenStats struct {
		CreatedToday int64 `gorm:"column:created_today"`
		TotalKeys    int64 `gorm:"column:total_keys"`
	}
	err = DB.Model(&Token{}).
		Select(
			"COALESCE(SUM(CASE WHEN created_time >= ? THEN 1 ELSE 0 END), 0) as created_today, "+
				"COUNT(*) as total_keys",
			startOfDay,
		).
		Scan(&tokenStats).Error
	if err != nil {
		return nil, err
	}
	metrics.APIKeysCreatedToday = tokenStats.CreatedToday
	metrics.APIKeysTotal = tokenStats.TotalKeys

	var logStats struct {
		ActiveVisitors   int64 `gorm:"column:active_visitors"`
		FailedRequests   int64 `gorm:"column:failed_requests"`
		ProviderErrors   int64 `gorm:"column:provider_errors"`
		RejectedRequests int64 `gorm:"column:rejected_requests"`
	}
	err = LOG_DB.Model(&Log{}).
		Select(
			"COUNT(DISTINCT CASE WHEN type IN (?, ?) THEN user_id END) as active_visitors, "+
				"COALESCE(SUM(CASE WHEN type = ? THEN 1 ELSE 0 END), 0) as failed_requests, "+
				"COALESCE(SUM(CASE WHEN type = ? AND channel_id > 0 THEN 1 ELSE 0 END), 0) as provider_errors, "+
				"COALESCE(SUM(CASE WHEN type = ? AND channel_id <= 0 THEN 1 ELSE 0 END), 0) as rejected_requests",
			LogTypeConsume, LogTypeLogin,
			LogTypeError,
			LogTypeError,
			LogTypeError,
		).
		Where("created_at >= ?", startOfDay).
		Scan(&logStats).Error
	if err != nil {
		return nil, err
	}
	metrics.ActiveVisitorsToday = logStats.ActiveVisitors
	metrics.FailedRequestsToday = logStats.FailedRequests
	metrics.ProviderErrorsToday = logStats.ProviderErrors
	metrics.RejectedRequestsToday = logStats.RejectedRequests

	return metrics, nil
}
