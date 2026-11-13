/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
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

// archiveExportPayload is the JSON export structure: one day summary plus
// the human-readable invoice and API-key tables behind it.
type archiveExportPayload struct {
	Date     string                     `json:"date"`
	Summary  *model.DailyArchive        `json:"summary"`
	Invoices []model.TopUp              `json:"invoices"`
	NewKeys  []model.ArchiveNewKeyEntry `json:"new_keys"`
}

// ExportArchiveDay downloads one day's financial report as JSON: the daily
// summary, its payment invoices (trade_no + payment method for gateway
// cross-referencing) and the API keys created that day. The raw log/CSV dump
// was removed; this structured payload is what the console renders as a
// multi-sheet workbook.
func ExportArchiveDay(c *gin.Context) {
	date := c.Query("date")
	day, err := time.ParseInLocation(model.DailyArchiveDateLayout, date, time.Local)
	if err != nil {
		common.ApiError(c, common.NewMessage("Invalid date"))
		return
	}
	start, end := model.DayBounds(day)
	summary, err := model.GetDailyArchiveByDate(date)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	invoices, err := model.GetArchiveTopUpsForExport(start, end, archiveExportRowLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	newKeys, err := model.GetArchiveNewKeysForExport(start, end, archiveExportRowLimit)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.Header("Content-Disposition", `attachment; filename="archive-`+date+`.json"`)
	c.JSON(200, archiveExportPayload{
		Date:     date,
		Summary:  summary,
		Invoices: invoices,
		NewKeys:  newKeys,
	})
}
