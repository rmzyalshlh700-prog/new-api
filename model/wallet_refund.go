package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Wallet refund lifecycle states.
//
// A refund is claimed before it is credited: the pending record is written
// synchronously by the request that abandons its reservation, and the credit
// itself is applied afterwards and may be retried. This is the refund outbox:
// money that must move is durable before anything asynchronous runs.
const (
	WalletRefundStatusPending   = "pending"
	WalletRefundStatusCompleted = "completed"
)

// WalletRefundRecord is the persistent idempotency record for a wallet
// pre-consume refund. RequestId stores the refund attempt key and is unique. It
// is claimed before any credit is attempted and completed inside the same
// transaction that credits the wallet, so a retried execution of one refund, a
// concurrent refund path, or a background sweep after a crash credits that
// reservation at most once. The key carries the relay request id plus a
// per-attempt nonce, because a retried task pre-consumes a new reservation under
// the same relay request id and each reservation must be refundable.
type WalletRefundRecord struct {
	Id        int    `json:"id"`
	RequestId string `json:"request_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId    int    `json:"user_id" gorm:"index"`
	Amount    int    `json:"amount" gorm:"not null;default:0"`
	Status    string `json:"status" gorm:"type:varchar(32);index"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint;index"`
}

func (r *WalletRefundRecord) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	r.CreatedAt = now
	r.UpdatedAt = now
	return nil
}

func (r *WalletRefundRecord) BeforeUpdate(tx *gorm.DB) error {
	r.UpdatedAt = common.GetTimestamp()
	return nil
}

func validateWalletRefund(refundKey string, userId int, amount int) error {
	if userId <= 0 {
		return errors.New("invalid userId")
	}
	if strings.TrimSpace(refundKey) == "" {
		return errors.New("refundKey is empty")
	}
	if amount <= 0 {
		return errors.New("amount must be > 0")
	}
	return common.ValidateWalletQuota(amount)
}

// ClaimWalletRefund durably records that amount must be returned to userId
// under refundKey, without moving any money yet. It is idempotent: a key that
// was claimed before (pending or completed) is left untouched, so a retry after
// a crash keeps the original owner and amount instead of minting a second
// payable.
func ClaimWalletRefund(refundKey string, userId int, amount int) error {
	if err := validateWalletRefund(refundKey, userId, amount); err != nil {
		return err
	}
	record := &WalletRefundRecord{
		RequestId: refundKey,
		UserId:    userId,
		Amount:    amount,
		Status:    WalletRefundStatusPending,
	}
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(record).Error
}

// SettleWalletRefund credits a claimed refund exactly once and reports whether
// this call is the one that moved the money. The row is locked for the whole
// transaction, so concurrent settlements of one key serialize: the first
// credits and marks the record completed, the rest observe completed and do
// nothing. The credit and the status change commit together, so a failure can
// never leave a paid record pending (which a later sweep would pay again).
func SettleWalletRefund(refundKey string) (bool, error) {
	if strings.TrimSpace(refundKey) == "" {
		return false, errors.New("refundKey is empty")
	}
	credited := false
	var settled WalletRefundRecord
	err := DB.Transaction(func(tx *gorm.DB) error {
		var record WalletRefundRecord
		if err := lockForUpdate(tx).Where("request_id = ?", refundKey).First(&record).Error; err != nil {
			return err
		}
		if record.Status == WalletRefundStatusCompleted {
			return nil
		}
		if err := increaseUserQuotaTx(tx, record.UserId, record.Amount); err != nil {
			return err
		}
		record.Status = WalletRefundStatusCompleted
		if err := tx.Save(&record).Error; err != nil {
			return err
		}
		settled = record
		credited = true
		return nil
	})
	if err != nil || !credited {
		return credited, err
	}
	syncCreditUserQuotaCache(settled.UserId, settled.Amount, common.LogText("wallet refund"))
	return true, nil
}

// RefundWalletPreConsume credits a pre-consumed wallet amount exactly once for
// refundKey. It claims and settles in one call, which is what a caller that
// already holds the money-movement decision wants; callers that must survive a
// crash between the decision and the credit use ClaimWalletRefund and
// SettleWalletRefund separately.
func RefundWalletPreConsume(refundKey string, userId int, amount int) error {
	if err := ClaimWalletRefund(refundKey, userId, amount); err != nil {
		return err
	}
	_, err := SettleWalletRefund(refundKey)
	return err
}

// PendingWalletRefunds returns claimed but uncredited refund keys, oldest
// first. A record whose credit exhausted its attempts stays here, so the sweep
// retries it until the wallet accepts the amount.
func PendingWalletRefunds(limit int) ([]WalletRefundRecord, error) {
	if limit <= 0 {
		limit = 100
	}
	var records []WalletRefundRecord
	err := DB.Where("status = ?", WalletRefundStatusPending).
		Order("id asc").Limit(limit).Find(&records).Error
	return records, err
}

// SweepPendingWalletRefunds settles every claim it can, and returns how many
// credits it applied. One failing refund does not stop the sweep; the error is
// the last one seen so the caller can log it while the rest of the batch is
// still processed.
func SweepPendingWalletRefunds(limit int) (int, error) {
	records, err := PendingWalletRefunds(limit)
	if err != nil {
		return 0, err
	}
	credited := 0
	var lastErr error
	for _, record := range records {
		moved, settleErr := SettleWalletRefund(record.RequestId)
		if settleErr != nil {
			lastErr = settleErr
			continue
		}
		if moved {
			credited++
		}
	}
	return credited, lastErr
}
