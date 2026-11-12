package model

// ProfitBucket holds one reporting window of consume-log revenue and cost, in
// internal quota units. NetProfitQuota is revenue minus the provider's base
// cost and may be negative when a group is priced below upstream cost.
type ProfitBucket struct {
	RevenueQuota      int64 `json:"revenue_quota"`
	UpstreamCostQuota int64 `json:"upstream_cost_quota"`
	NetProfitQuota    int64 `json:"net_profit_quota"`
}

// ProfitStats holds net profit for the windows the admin dashboard reports.
type ProfitStats struct {
	Today   ProfitBucket `json:"today"`
	Month   ProfitBucket `json:"month"`
	AllTime ProfitBucket `json:"all_time"`
}

// GetProfitStats aggregates revenue (SUM(quota)) and provider cost
// (SUM(upstream_cost)) over consume logs for today, the current month and all
// time. One statement computes every window with conditional sums, so the log
// table is scanned once and the created_at index still bounds the range scan.
// The aggregate SQL (CASE WHEN / COALESCE) is portable across SQLite, MySQL,
// PostgreSQL and the ClickHouse log database.
func GetProfitStats(startOfDay int64, startOfMonth int64) (*ProfitStats, error) {
	var row struct {
		TodayRevenue int64
		TodayCost    int64
		MonthRevenue int64
		MonthCost    int64
		TotalRevenue int64
		TotalCost    int64
	}
	err := LOG_DB.Model(&Log{}).
		Where("type = ?", LogTypeConsume).
		Select(
			"COALESCE(SUM(CASE WHEN created_at >= ? THEN quota ELSE 0 END), 0) AS today_revenue, "+
				"COALESCE(SUM(CASE WHEN created_at >= ? THEN upstream_cost ELSE 0 END), 0) AS today_cost, "+
				"COALESCE(SUM(CASE WHEN created_at >= ? THEN quota ELSE 0 END), 0) AS month_revenue, "+
				"COALESCE(SUM(CASE WHEN created_at >= ? THEN upstream_cost ELSE 0 END), 0) AS month_cost, "+
				"COALESCE(SUM(quota), 0) AS total_revenue, "+
				"COALESCE(SUM(upstream_cost), 0) AS total_cost",
			startOfDay, startOfDay, startOfMonth, startOfMonth,
		).
		Scan(&row).Error
	if err != nil {
		return nil, err
	}

	bucket := func(revenue int64, cost int64) ProfitBucket {
		return ProfitBucket{
			RevenueQuota:      revenue,
			UpstreamCostQuota: cost,
			NetProfitQuota:    revenue - cost,
		}
	}
	return &ProfitStats{
		Today:   bucket(row.TodayRevenue, row.TodayCost),
		Month:   bucket(row.MonthRevenue, row.MonthCost),
		AllTime: bucket(row.TotalRevenue, row.TotalCost),
	}, nil
}
