package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// ErrUserQuotaDebtOutstanding 表示用户仍有未结清的结算欠费。欠费来自实际用量
// 超过预扣、且钱包余额无法覆盖的差额。它是已经发生的上游消耗，必须在继续
// 消费前清偿，否则丢弃的差额等于免费额度。
var ErrUserQuotaDebtOutstanding = errors.New("user quota debt outstanding")

// userQuotaDebtRepayAttempts 限制偿还流程在并发修改下的重试次数。每次重试都
// 基于新读取的余额与欠费重新计算，因此重试是安全的。
const userQuotaDebtRepayAttempts = 3

type userQuotaDebtState struct {
	Quota     int64
	QuotaDebt int64
}

// GetUserQuotaDebt 返回用户当前未结清的欠费额度。
func GetUserQuotaDebt(userId int) (int64, error) {
	if DB == nil {
		return 0, nil
	}
	var state userQuotaDebtState
	if err := DB.Model(&User{}).Select("quota", "quota_debt").Where("id = ?", userId).Take(&state).Error; err != nil {
		return 0, err
	}
	return state.QuotaDebt, nil
}

// RecordUserQuotaDebt 以原子增量把无法覆盖的结算差额累加到用户欠费上。欠费上限
// 与钱包上限一致，避免账单字段溢出成负数。
func RecordUserQuotaDebt(userId int, amount int) (int64, error) {
	if DB == nil {
		// 没有持久化存储就无法登记欠费；这是未初始化/无库的运行环境，不能让
		// 结算路径因为缺少数据库而崩溃。
		common.SysError(common.LogText("cannot record quota debt without a database (userId=%d amount=%d)", userId, amount))
		return 0, nil
	}
	amount64 := int64(amount)
	if amount64 <= 0 {
		return GetUserQuotaDebt(userId)
	}
	limit := int64(common.MaxWalletQuota) - amount64
	if limit < 0 {
		return 0, ErrWalletQuotaLimitExceeded
	}

	result := DB.Model(&User{}).
		Where("id = ? AND quota_debt <= ?", userId, limit).
		Update("quota_debt", gorm.Expr("quota_debt + ?", amount64))
	if result.Error != nil {
		return 0, result.Error
	}
	if result.RowsAffected == 0 {
		var count int64
		if err := DB.Model(&User{}).Where("id = ?", userId).Count(&count).Error; err != nil {
			return 0, err
		}
		if count == 0 {
			return 0, gorm.ErrRecordNotFound
		}
		return 0, ErrWalletQuotaLimitExceeded
	}
	return GetUserQuotaDebt(userId)
}

// recordSettlementShortfall 把结算时钱包无法覆盖的差额持久化为欠费。返回记录
// 后的欠费总额；shortfall 不为正时不做任何写入。
func recordSettlementShortfall(userId int, requested int, deducted int) (int64, error) {
	shortfall := requested - deducted
	if shortfall <= 0 {
		return 0, nil
	}
	debt, err := RecordUserQuotaDebt(userId, shortfall)
	if err != nil {
		common.SysError(common.LogText("failed to record settlement shortfall as quota debt (userId=%d shortfall=%d): %s", userId, shortfall, err.Error()))
		return 0, err
	}
	common.SysError(common.LogText("wallet settlement shortfall recorded as quota debt (userId=%d requested=%d deducted=%d debt=%d)", userId, requested, deducted, debt))
	return debt, nil
}

// RepayUserQuotaDebt 用当前钱包余额结清欠费：每次最多抵扣 min(余额, 欠费)，
// 余额与欠费在一条条件更新中同时扣减，因此并发请求不会重复抵扣，也不会把
// 余额扣成负数。余额不足时剩余欠费保持原样，由调用方阻断请求。
// 返回值 remaining 为未结清的欠费，repaid 为本次抵扣的额度。
func RepayUserQuotaDebt(userId int) (remaining int64, repaid int64, err error) {
	if DB == nil {
		// 无数据库时没有已登记的欠费，请求照常放行。
		return 0, 0, nil
	}
	for range userQuotaDebtRepayAttempts {
		var state userQuotaDebtState
		readErr := DB.Model(&User{}).
			Select("quota", "quota_debt").
			Where("id = ?", userId).
			Take(&state).Error
		if readErr != nil {
			return 0, repaid, readErr
		}
		remaining = state.QuotaDebt
		if state.QuotaDebt <= 0 {
			return 0, repaid, nil
		}
		amount := min(state.Quota, state.QuotaDebt)
		if amount <= 0 {
			return remaining, repaid, nil
		}

		result := DB.Model(&User{}).
			Where("id = ? AND quota >= ? AND quota_debt >= ?", userId, amount, amount).
			Updates(map[string]any{
				"quota":      gorm.Expr("quota - ?", amount),
				"quota_debt": gorm.Expr("quota_debt - ?", amount),
			})
		if result.Error != nil {
			return remaining, repaid, result.Error
		}
		if result.RowsAffected == 0 {
			// 余额或欠费被并发修改：重新读取后按新值重算。
			continue
		}
		repaid += amount
		remaining = state.QuotaDebt - amount
	}

	if repaid > 0 {
		if invalidateErr := invalidateUserCache(userId); invalidateErr != nil {
			common.SysLog(common.LogText("failed to invalidate user cache after quota debt repayment: %s", invalidateErr.Error()))
		}
	}
	return remaining, repaid, nil
}
