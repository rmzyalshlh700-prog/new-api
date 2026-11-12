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

const topUpExpirationInterval = 2 * time.Minute

var (
	topUpExpirationOnce    sync.Once
	topUpExpirationRunning atomic.Bool
)

// StartTopUpExpirationTask periodically expires stale pending top-up orders so
// abandoned checkouts never stay actionable or count as pending in stats.
// TTLs are gateway-aligned: NOWPayments (crypto) 30 minutes, other gateways
// 60 minutes.
func StartTopUpExpirationTask() {
	topUpExpirationOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			runTopUpExpiration()
			ticker := time.NewTicker(topUpExpirationInterval)
			defer ticker.Stop()
			for range ticker.C {
				runTopUpExpiration()
			}
		})
	})
}

func runTopUpExpiration() {
	if !topUpExpirationRunning.CompareAndSwap(false, true) {
		return
	}
	defer topUpExpirationRunning.Store(false)

	ctx := context.Background()
	count, err := model.ExpireStalePendingTopUps(time.Now().Unix())
	if err != nil {
		logger.LogWarn(ctx, common.LogText("top-up expiration task failed: %v", err))
		return
	}
	if count > 0 {
		logger.LogInfo(ctx, common.LogText("top-up expiration task expired %d stale pending orders", count))
	}
}
