package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestExpireStalePendingTopUps(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)
	t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })

	require.NoError(t, db.AutoMigrate(&TopUp{}))

	now := time.Now().Unix()
	fixtures := []TopUp{
		// NOWPayments order older than the 30-minute crypto TTL: must expire.
		{Id: 1, UserId: 1, Amount: 100, Money: 1, TradeNo: "NP-STALE", PaymentMethod: PaymentMethodNowPayments, PaymentProvider: PaymentProviderNowPayments, CreateTime: now - TopUpCryptoPendingTTLSeconds - 60, Status: common.TopUpStatusPending},
		// NOWPayments order within the TTL: must stay pending.
		{Id: 2, UserId: 1, Amount: 100, Money: 1, TradeNo: "NP-FRESH", PaymentMethod: PaymentMethodNowPayments, PaymentProvider: PaymentProviderNowPayments, CreateTime: now - 10*60, Status: common.TopUpStatusPending},
		// Other gateway older than the 60-minute TTL: must expire.
		{Id: 3, UserId: 2, Amount: 200, Money: 2, TradeNo: "EP-STALE", PaymentMethod: "alipay", PaymentProvider: PaymentProviderEpay, CreateTime: now - TopUpStandardPendingTTLSeconds - 60, Status: common.TopUpStatusPending},
		// Other gateway within the TTL: must stay pending.
		{Id: 4, UserId: 2, Amount: 200, Money: 2, TradeNo: "EP-FRESH", PaymentMethod: "alipay", PaymentProvider: PaymentProviderEpay, CreateTime: now - 10*60, Status: common.TopUpStatusPending},
		// Already terminal states: must never be touched.
		{Id: 5, UserId: 3, Amount: 300, Money: 3, TradeNo: "NP-DONE", PaymentMethod: PaymentMethodNowPayments, PaymentProvider: PaymentProviderNowPayments, CreateTime: now - TopUpCryptoPendingTTLSeconds - 3600, Status: common.TopUpStatusSuccess},
		{Id: 6, UserId: 3, Amount: 300, Money: 3, TradeNo: "EP-OLD-FAILED", PaymentMethod: "alipay", PaymentProvider: PaymentProviderEpay, CreateTime: now - TopUpStandardPendingTTLSeconds - 3600, Status: common.TopUpStatusFailed},
	}
	require.NoError(t, db.Create(&fixtures).Error)

	previousDB := DB
	DB = db
	t.Cleanup(func() { DB = previousDB })

	expired, err := ExpireStalePendingTopUps(now)
	require.NoError(t, err)
	assert.EqualValues(t, 2, expired)

	statuses := map[string]string{}
	var rows []TopUp
	require.NoError(t, db.Order("id").Find(&rows).Error)
	for _, row := range rows {
		statuses[row.TradeNo] = row.Status
	}

	assert.Equal(t, common.TopUpStatusExpired, statuses["NP-STALE"], "stale NOWPayments pending order must be expired")
	assert.Equal(t, common.TopUpStatusPending, statuses["NP-FRESH"], "fresh NOWPayments order must stay pending")
	assert.Equal(t, common.TopUpStatusExpired, statuses["EP-STALE"], "stale non-crypto pending order must be expired")
	assert.Equal(t, common.TopUpStatusPending, statuses["EP-FRESH"], "fresh non-crypto order must stay pending")
	assert.Equal(t, common.TopUpStatusSuccess, statuses["NP-DONE"], "completed order must never be modified")
	assert.Equal(t, common.TopUpStatusFailed, statuses["EP-OLD-FAILED"], "failed order must never be modified")

	// Re-running is idempotent: nothing new to expire.
	expiredAgain, err := ExpireStalePendingTopUps(now)
	require.NoError(t, err)
	assert.EqualValues(t, 0, expiredAgain)
}
