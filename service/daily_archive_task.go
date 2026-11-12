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

// StartDailyArchiveTask archives the previous day's metrics shortly after each
// local midnight. On startup it also backfills recent days that are missing,
// so a restart across midnight does not leave a gap.
func StartDailyArchiveTask() {
	dailyArchiveOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			runDailyArchive()
			for {
				now := time.Now()
				next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 5, 0, 0, now.Location())
				time.Sleep(time.Until(next))
				runDailyArchive()
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
		// The previous day is always recomputed to catch late-written logs.
		if i > 1 {
			archived, err := model.HasDailyArchive(day)
			if err != nil {
				logger.LogWarn(ctx, common.LogText("daily archive check failed: %v", err))
				return
			}
			if archived {
				continue
			}
		}
		if err := model.ArchiveDay(day); err != nil {
			logger.LogWarn(ctx, common.LogText("daily archive failed: %v", err))
			return
		}
	}
}
