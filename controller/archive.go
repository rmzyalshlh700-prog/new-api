package controller

import (
	"encoding/csv"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const (
	archiveMaxRangeDays   = 366
	archiveExportRowLimit = 100000
)

// parseArchiveRange reads required start_date / end_date (YYYY-MM-DD) and
// returns the inclusive Unix second window. It writes the error response and
// returns false when the range is missing, malformed or too large.
func parseArchiveRange(c *gin.Context) (startDate string, endDate string, start int64, end int64, ok bool) {
	startDate = c.Query("start_date")
	endDate = c.Query("end_date")
	if startDate == "" || endDate == "" {
		common.ApiError(c, common.NewMessage("start_date and end_date are required"))
		return
	}
	from, err1 := time.ParseInLocation(model.DailyArchiveDateLayout, startDate, time.Local)
	to, err2 := time.ParseInLocation(model.DailyArchiveDateLayout, endDate, time.Local)
	if err1 != nil || err2 != nil {
		common.ApiError(c, common.NewMessage("Invalid date range"))
		return
	}
	if to.Before(from) || to.Sub(from) > archiveMaxRangeDays*24*time.Hour {
		common.ApiError(c, common.NewMessage("Invalid date range"))
		return
	}
	start, _ = model.DayBounds(from)
	_, end = model.DayBounds(to)
	ok = true
	return
}

// GetArchiveSummary returns the aggregated daily archives of a date range.
func GetArchiveSummary(c *gin.Context) {
	startDate, endDate, _, _, ok := parseArchiveRange(c)
	if !ok {
		return
	}
	archives, err := model.GetDailyArchives(startDate, endDate)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, archives)
}

// GetArchiveLogs returns a server-side paginated page of historical logs.
func GetArchiveLogs(c *gin.Context) {
	_, _, start, end, ok := parseArchiveRange(c)
	if !ok {
		return
	}
	pageInfo := common.GetPageQuery(c)
	logs, total, err := model.GetArchiveLogs(start, end, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

// GetArchivePayments returns a server-side paginated page of historical top-ups.
func GetArchivePayments(c *gin.Context) {
	_, _, start, end, ok := parseArchiveRange(c)
	if !ok {
		return
	}
	pageInfo := common.GetPageQuery(c)
	entries, total, err := model.QueryTopUpLedger(model.TopUpLedgerFilter{
		StartTime: start,
		EndTime:   end,
	}, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(entries)
	common.ApiSuccess(c, pageInfo)
}

// ExportArchiveDay downloads one day's logs and payments as JSON (default) or
// CSV (format=csv). Each side is capped at archiveExportRowLimit rows.
func ExportArchiveDay(c *gin.Context) {
	date := c.Query("date")
	day, err := time.ParseInLocation(model.DailyArchiveDateLayout, date, time.Local)
	if err != nil {
		common.ApiError(c, common.NewMessage("Invalid date"))
		return
	}
	start, end := model.DayBounds(day)
	logs, err := model.GetArchiveLogsForExport(start, end, archiveExportRowLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	topUps, err := model.GetArchiveTopUpsForExport(start, end, archiveExportRowLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if c.Query("format") != "csv" {
		c.Header("Content-Disposition", `attachment; filename="archive-`+date+`.json"`)
		c.JSON(200, gin.H{"date": date, "logs": logs, "payments": topUps})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="archive-`+date+`.csv"`)
	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"section", "id", "time", "user_id", "username", "type_or_status", "model_or_method", "quota_or_money", "upstream_cost", "prompt_tokens", "completion_tokens", "ref"})
	for _, l := range logs {
		_ = w.Write([]string{"log", strconv.Itoa(l.Id), strconv.FormatInt(l.CreatedAt, 10), strconv.Itoa(l.UserId), csvSafe(l.Username),
			strconv.Itoa(l.Type), csvSafe(l.ModelName), strconv.Itoa(l.Quota), strconv.FormatInt(l.UpstreamCost, 10),
			strconv.Itoa(l.PromptTokens), strconv.Itoa(l.CompletionTokens), csvSafe(l.RequestId)})
	}
	for _, t := range topUps {
		_ = w.Write([]string{"payment", strconv.Itoa(t.Id), strconv.FormatInt(t.CreateTime, 10), strconv.Itoa(t.UserId), "",
			csvSafe(t.Status), csvSafe(t.PaymentMethod), strconv.FormatFloat(t.Money, 'f', -1, 64), "", "", "", csvSafe(t.TradeNo)})
	}
	w.Flush()
}

// csvSafe neutralises spreadsheet formula injection in user-controlled text.
func csvSafe(value string) string {
	if value == "" {
		return value
	}
	switch value[0] {
	case '=', '+', '-', '@', '\t', '\r':
		return "'" + value
	}
	return value
}
