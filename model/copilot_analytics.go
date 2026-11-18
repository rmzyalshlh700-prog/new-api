package model

import (
	"sort"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Sales and consumption analytics for the Admin Copilot.
//
// Everything here is read from the usage log, which is where the gateway
// records what it actually billed: one row per relayed request, carrying the
// quota charged, the provider's base cost, the tokens and the caller. Revenue
// and upstream cost are therefore measured, not estimated.
//
// The grouping is done in Go rather than with a SQL date function because the
// usage log may live in SQLite, MySQL or PostgreSQL, whose date arithmetic
// differs; a day bucket is one indexed range query per day.

// CopilotSalesBucket is one line of a sales report.
type CopilotSalesBucket struct {
	// Key is the day (2006-01-02), model name, username or channel id the
	// bucket was grouped by.
	Key               string `json:"key"`
	RevenueQuota      int64  `json:"revenue_quota"`
	UpstreamCostQuota int64  `json:"upstream_cost_quota"`
	ProfitQuota       int64  `json:"profit_quota"`
	Requests          int64  `json:"requests"`
	PromptTokens      int64  `json:"prompt_tokens"`
	CompletionTokens  int64  `json:"completion_tokens"`
}

// CopilotSalesReport is the answer to "analyse the sales and the consumption".
type CopilotSalesReport struct {
	StartTimestamp int64                `json:"start_timestamp"`
	EndTimestamp   int64                `json:"end_timestamp"`
	GroupBy        string               `json:"group_by"`
	Totals         CopilotSalesBucket   `json:"totals"`
	Buckets        []CopilotSalesBucket `json:"buckets"`
	// Truncated reports that the bucket list was cut at the requested limit,
	// so a reply never implies a short list is the whole picture.
	Truncated bool `json:"truncated"`
}

// CopilotSalesGroupByValues are the groupings a report can be asked for.
var CopilotSalesGroupByValues = map[string]struct{}{
	"day":     {},
	"model":   {},
	"user":    {},
	"channel": {},
	"group":   {},
}

type copilotSalesRow struct {
	Key              string
	RevenueQuota     int64
	UpstreamCost     int64
	Requests         int64
	PromptTokens     int64
	CompletionTokens int64
}

// GetCopilotSalesReport aggregates consumption between two timestamps.
//
// groupBy is one of day, model, user, channel or group; limit caps the bucket
// list (the totals always cover the whole window).
func GetCopilotSalesReport(startTimestamp int64, endTimestamp int64, groupBy string, limit int) (*CopilotSalesReport, error) {
	if startTimestamp <= 0 || endTimestamp <= startTimestamp {
		return nil, common.NewMessage("A valid time window is required")
	}
	if _, ok := CopilotSalesGroupByValues[groupBy]; !ok {
		return nil, common.NewMessage("group_by must be day, model, user, channel or group")
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	report := &CopilotSalesReport{
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		GroupBy:        groupBy,
		Buckets:        make([]CopilotSalesBucket, 0, 16),
	}

	// Totals for the whole window, in one query.
	var totals copilotSalesRow
	err := LOG_DB.Model(&Log{}).
		Where("type = ?", LogTypeConsume).
		Where("created_at >= ? AND created_at < ?", startTimestamp, endTimestamp).
		Select(
			"COALESCE(SUM(quota), 0) AS revenue_quota, " +
				"COALESCE(SUM(upstream_cost), 0) AS upstream_cost, " +
				"COUNT(*) AS requests, " +
				"COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens, " +
				"COALESCE(SUM(completion_tokens), 0) AS completion_tokens",
		).
		Scan(&totals).Error
	if err != nil {
		return nil, err
	}
	report.Totals = bucketFromRow("total", totals)

	raw := make([]copilotSalesRow, 0, 32)
	switch groupBy {
	case "day":
		// One indexed range per day, so the report never leans on a date
		// function the log database may not have.
		location := time.Local
		cursor := time.Unix(startTimestamp, 0).In(location)
		dayStart := time.Date(cursor.Year(), cursor.Month(), cursor.Day(), 0, 0, 0, 0, location).Unix()
		for dayStart < endTimestamp {
			dayEnd := dayStart + 86400
			// Clamp the first and last bucket to the requested window, so the
			// parts add up to the totals instead of reaching past them.
			from, to := dayStart, dayEnd
			if from < startTimestamp {
				from = startTimestamp
			}
			if to > endTimestamp {
				to = endTimestamp
			}
			var row copilotSalesRow
			err := LOG_DB.Model(&Log{}).
				Where("type = ?", LogTypeConsume).
				Where("created_at >= ? AND created_at < ?", from, to).
				Select(
					"COALESCE(SUM(quota), 0) AS revenue_quota, " +
						"COALESCE(SUM(upstream_cost), 0) AS upstream_cost, " +
						"COUNT(*) AS requests, " +
						"COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens, " +
						"COALESCE(SUM(completion_tokens), 0) AS completion_tokens",
				).
				Scan(&row).Error
			if err != nil {
				return nil, err
			}
			// A day with no traffic is still a day: it belongs in the series.
			row.Key = time.Unix(dayStart, 0).In(location).Format("2006-01-02")
			raw = append(raw, row)
			dayStart = dayEnd
		}
	case "model", "user", "channel", "group":
		column := map[string]string{
			"model":   "model_name",
			"user":    "username",
			"channel": "channel_id",
			"group":   "`group`",
		}[groupBy]
		if common.LogDatabaseType() == common.DatabaseTypePostgreSQL {
			column = map[string]string{
				"model":   "model_name",
				"user":    "username",
				"channel": "channel_id",
				"group":   `"group"`,
			}[groupBy]
		}
		rows, queryErr := queryCopilotSalesByColumn(column, startTimestamp, endTimestamp)
		if queryErr != nil {
			return nil, queryErr
		}
		raw = rows
	}

	sort.SliceStable(raw, func(i, j int) bool {
		return raw[i].RevenueQuota > raw[j].RevenueQuota
	})
	if len(raw) > limit {
		raw = raw[:limit]
		report.Truncated = true
	}
	for _, row := range raw {
		// A bucket with no traffic adds nothing to a ranked list, but a day
		// series keeps it so the operator sees the gap.
		if groupBy != "day" && row.Requests == 0 {
			continue
		}
		report.Buckets = append(report.Buckets, bucketFromRow(row.Key, row))
	}
	return report, nil
}

func bucketFromRow(key string, row copilotSalesRow) CopilotSalesBucket {
	return CopilotSalesBucket{
		Key:               key,
		RevenueQuota:      row.RevenueQuota,
		UpstreamCostQuota: row.UpstreamCost,
		ProfitQuota:       row.RevenueQuota - row.UpstreamCost,
		Requests:          row.Requests,
		PromptTokens:      row.PromptTokens,
		CompletionTokens:  row.CompletionTokens,
	}
}

// queryCopilotSalesByColumn runs the grouped aggregate over one column.
func queryCopilotSalesByColumn(column string, startTimestamp int64, endTimestamp int64) ([]copilotSalesRow, error) {
	rows := make([]copilotSalesRow, 0, 32)
	err := LOG_DB.Model(&Log{}).
		Where("type = ?", LogTypeConsume).
		Where("created_at >= ? AND created_at < ?", startTimestamp, endTimestamp).
		Select(column + " AS `key`, " +
			"COALESCE(SUM(quota), 0) AS revenue_quota, " +
			"COALESCE(SUM(upstream_cost), 0) AS upstream_cost, " +
			"COUNT(*) AS requests, " +
			"COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens, " +
			"COALESCE(SUM(completion_tokens), 0) AS completion_tokens").
		Group(column).
		Scan(&rows).Error
	return rows, err
}
