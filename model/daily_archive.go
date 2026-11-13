package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm/clause"
)

// DailyArchive is the pre-aggregated metric row for one calendar day (server
// local time). Money-like fields stay in the units of their sources: revenue
// and cost are quota units, TopUpAmount is the paid money of successful
// top-ups.
type DailyArchive struct {
	Id            int     `json:"id"`
	Date          string  `json:"date" gorm:"type:varchar(10);uniqueIndex:idx_daily_archives_date"`
	TotalRevenue  int64   `json:"total_revenue" gorm:"default:0"`
	TotalCost     int64   `json:"total_cost" gorm:"default:0"`
	TotalTokens   int64   `json:"total_tokens" gorm:"default:0"`
	TotalRequests int64   `json:"total_requests" gorm:"default:0"`
	NewUsers      int64   `json:"new_users" gorm:"default:0"`
	TopUpAmount   float64 `json:"top_up_amount" gorm:"default:0"`
	UpdatedAt     int64   `json:"updated_at" gorm:"bigint"`
}

const DailyArchiveDateLayout = "2006-01-02"

// DayBounds returns the Unix second range [start, end] covered by a date.
func DayBounds(date time.Time) (int64, int64) {
	start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.Local)
	return start.Unix(), start.AddDate(0, 0, 1).Unix() - 1
}

// BuildDailyArchive aggregates one day of consume logs, new users and
// successful top-ups.
func BuildDailyArchive(date time.Time) (*DailyArchive, error) {
	start, end := DayBounds(date)
	var logRow struct {
		Revenue  int64
		Cost     int64
		Tokens   int64
		Requests int64
	}
	err := LOG_DB.Model(&Log{}).
		Where("type = ? AND created_at >= ? AND created_at <= ?", LogTypeConsume, start, end).
		Select("COALESCE(SUM(quota), 0) AS revenue, COALESCE(SUM(upstream_cost), 0) AS cost, " +
			"COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens, COUNT(*) AS requests").
		Scan(&logRow).Error
	if err != nil {
		return nil, err
	}
	var newUsers int64
	if err = DB.Model(&User{}).Where("created_at >= ? AND created_at <= ?", start, end).Count(&newUsers).Error; err != nil {
		return nil, err
	}
	var topUp struct{ Money float64 }
	err = DB.Model(&TopUp{}).
		Where("status = ? AND create_time >= ? AND create_time <= ?", common.TopUpStatusSuccess, start, end).
		Select("COALESCE(SUM(money), 0) AS money").
		Scan(&topUp).Error
	if err != nil {
		return nil, err
	}
	return &DailyArchive{
		Date:          date.In(time.Local).Format(DailyArchiveDateLayout),
		TotalRevenue:  logRow.Revenue,
		TotalCost:     logRow.Cost,
		TotalTokens:   logRow.Tokens,
		TotalRequests: logRow.Requests,
		NewUsers:      newUsers,
		TopUpAmount:   topUp.Money,
	}, nil
}

// SaveDailyArchive inserts or refreshes the row of its date in one statement.
// The upsert relies on the unique index on date, so concurrent archive runs
// (startup backfill, midnight job, a second replica) cannot collide on insert.
func SaveDailyArchive(archive *DailyArchive) error {
	archive.UpdatedAt = common.GetTimestamp()
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "date"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"total_revenue",
			"total_cost",
			"total_tokens",
			"total_requests",
			"new_users",
			"top_up_amount",
			"updated_at",
		}),
	}).Create(archive).Error
}

// ArchiveDay aggregates and stores one day.
func ArchiveDay(date time.Time) error {
	archive, err := BuildDailyArchive(date)
	if err != nil {
		return err
	}
	return SaveDailyArchive(archive)
}

// HasDailyArchive reports whether the date was already archived.
func HasDailyArchive(date time.Time) (bool, error) {
	var count int64
	err := DB.Model(&DailyArchive{}).Where("date = ?", date.In(time.Local).Format(DailyArchiveDateLayout)).Count(&count).Error
	return count > 0, err
}

// GetDailyArchives returns archive rows with from <= date <= to, newest first.
func GetDailyArchives(from string, to string) ([]DailyArchive, error) {
	archives := make([]DailyArchive, 0)
	err := DB.Where("date >= ? AND date <= ?", from, to).Order("date DESC").Find(&archives).Error
	return archives, err
}

// GetArchiveLogs returns one page of logs in [start, end], newest first.
func GetArchiveLogs(start int64, end int64, startIdx int, num int) ([]*Log, int64, error) {
	return GetAllLogs(LogFilter{StartTimestamp: start, EndTimestamp: end}, startIdx, num)
}

// GetArchiveLogsForExport returns up to limit logs in [start, end], oldest first.
func GetArchiveLogsForExport(start int64, end int64, limit int) ([]Log, error) {
	logs := make([]Log, 0)
	err := LOG_DB.Where("created_at >= ? AND created_at <= ?", start, end).
		Order("created_at asc, id asc").Limit(limit).Find(&logs).Error
	return logs, err
}

// GetArchiveTopUpsForExport returns up to limit top-ups in [start, end].
func GetArchiveTopUpsForExport(start int64, end int64, limit int) ([]TopUp, error) {
	topUps := make([]TopUp, 0)
	err := DB.Where("create_time >= ? AND create_time <= ?", start, end).
		Order("id asc").Limit(limit).Find(&topUps).Error
	return topUps, err
}
