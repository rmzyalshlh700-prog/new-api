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

// Wallet refund sweep.
//
// Refunds are claimed synchronously by the request that abandons a reservation
// and credited afterwards. The claim is durable, so this task is the part that
// guarantees eventual repayment: it settles every claim a crash, a restart or a
// transient database error left pending. Settlement itself is idempotent and
// row-locked, so running the sweep on a node that also settles refunds inline
// cannot double-credit.
const (
	walletRefundSweepInterval  = 1 * time.Minute
	walletRefundSweepBatchSize = 100
)

var (
	walletRefundSweepOnce    sync.Once
	walletRefundSweepRunning atomic.Bool
)

func StartWalletRefundSweepTask() {
	walletRefundSweepOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), common.LogText("wallet refund sweep started: tick=%s", walletRefundSweepInterval))
			ticker := time.NewTicker(walletRefundSweepInterval)
			defer ticker.Stop()

			runWalletRefundSweepOnce()
			for range ticker.C {
				runWalletRefundSweepOnce()
			}
		})
	})
}

func runWalletRefundSweepOnce() {
	if !walletRefundSweepRunning.CompareAndSwap(false, true) {
		return
	}
	defer walletRefundSweepRunning.Store(false)

	credited, err := model.SweepPendingWalletRefunds(walletRefundSweepBatchSize)
	if err != nil {
		logger.LogWarn(context.Background(), common.LogText("wallet refund sweep left uncredited refunds: %s", err.Error()))
	}
	if credited > 0 {
		logger.LogInfo(context.Background(), common.LogText("wallet refund sweep credited %d pending refund(s)", credited))
	}
}
