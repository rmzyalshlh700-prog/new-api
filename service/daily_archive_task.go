package service

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const dailyArchiveBackfillDays = 7

var (
	dailyArchiveOnce    sync.Once
	dailyArchiveRunning atomic.Bool
)

// StartDailyArchiveTask archives the previous day's metrics at 00:00 local
// time every day. On startup it also backfills recent days that are missing,
// so a restart across midnight does not leave a gap. The scheduling loop runs
// in a pooled goroutine, so it never blocks startup or request handling.
func StartDailyArchiveTask() {
	dailyArchiveOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			runDailyArchive()
			for {
				now := time.Now()
				next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
				time.Sleep(time.Until(next))
				runDailyArchive()
				// Consume logs written just before midnight can commit after the
				// run above; refresh the closed day once the write burst drains so
				// the archived totals are final.
				time.Sleep(5 * time.Minute)
				if err := model.ArchiveDay(time.Now().AddDate(0, 0, -1)); err != nil {
					logger.LogWarn(context.Background(), common.LogText("daily archive refresh failed: %v", err))
				}
			}
		})
	})
}

func runDailyArchive() {
	if !dailyArchiveRunning.CompareAndSwap(false, true) {
		return
	}
	defer dailyArchiveRunning.Store(false)

	ctx := context.Background()
	today := time.Now()
	for i := dailyArchiveBackfillDays; i >= 1; i-- {
		day := today.AddDate(0, 0, -i)
		// One failing day must never stop the rest of the backfill: log it and
		// move on so a transient error cannot leave a permanent gap.
		if err := model.ArchiveDay(day); err != nil {
			logger.LogWarn(ctx, common.LogText("daily archive failed for %s: %v", day.Format(model.DailyArchiveDateLayout), err))
			continue
		}
	}
}
