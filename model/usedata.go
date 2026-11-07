package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// QuotaData 柱状图数据
type QuotaData struct {
	Id                  int    `json:"id"`
	UserID              int    `json:"user_id" gorm:"index"`
	Username            string `json:"username" gorm:"index:idx_qdt_model_user_name,priority:2;size:64;default:''"`
	ModelName           string `json:"model_name" gorm:"index:idx_qdt_model_user_name,priority:1;size:64;default:''"`
	CreatedAt           int64  `json:"created_at" gorm:"bigint;index:idx_qdt_created_at,priority:2"`
	UseGroup            string `json:"use_group" gorm:"index;size:64;default:''"`
	TokenID             int    `json:"token_id" gorm:"index;default:0"`
	ChannelID           int    `json:"channel_id" gorm:"index;default:0"`
	NodeName            string `json:"node_name" gorm:"index;size:64;default:''"`
	TokenUsed           int    `json:"token_used" gorm:"default:0"`
	Count               int    `json:"count" gorm:"default:0"`
	Quota               int    `json:"quota" gorm:"default:0"`
	CacheReadTokens     int64  `json:"cache_read_tokens" gorm:"default:0"`
	CacheCreationTokens int64  `json:"cache_creation_tokens" gorm:"default:0"`
}

type QuotaDataLogParams struct {
	UserID              int
	Username            string
	ModelName           string
	Quota               int
	CreatedAt           int64
	TokenUsed           int
	CacheReadTokens     int64
	CacheCreationTokens int64
	UseGroup            string
	TokenID             int
	ChannelID           int
	NodeName            string
}

func UpdateQuotaData() {
	for {
		if common.DataExportEnabled {
			common.SysLog(common.LogText("updating dashboard data..."))
			SaveQuotaDataCache()
		}
		time.Sleep(time.Duration(common.DataExportInterval) * time.Minute)
	}
}

var CacheQuotaData = make(map[string]*QuotaData)
var CacheQuotaDataLock = sync.Mutex{}

// quotaDataFlushGeneration counts how many times the pending cache has been
// written to the database. Read paths capture it before querying and compare it
// afterwards, so a flush that overlaps a dashboard query can be detected and
// retried instead of double-counting or dropping the affected rows.
var quotaDataFlushGeneration uint64

func logQuotaDataCache(quotaData *QuotaData) {
	key := fmt.Sprintf("%d\x00%s\x00%s\x00%d\x00%s\x00%d\x00%d\x00%s",
		quotaData.UserID,
		quotaData.Username,
		quotaData.ModelName,
		quotaData.CreatedAt,
		quotaData.UseGroup,
		quotaData.TokenID,
		quotaData.ChannelID,
		quotaData.NodeName,
	)
	count := quotaData.Count
	quota := quotaData.Quota
	tokenUsed := quotaData.TokenUsed
	cachedQuotaData, ok := CacheQuotaData[key]
	if ok {
		cachedQuotaData.Count += count
		cachedQuotaData.Quota += quota
		cachedQuotaData.TokenUsed += tokenUsed
		cachedQuotaData.CacheReadTokens += quotaData.CacheReadTokens
		cachedQuotaData.CacheCreationTokens += quotaData.CacheCreationTokens
		quotaData = cachedQuotaData
	}
	CacheQuotaData[key] = quotaData
}

func LogQuotaData(params QuotaDataLogParams) {
	// 只精确到小时
	createdAt := params.CreatedAt - (params.CreatedAt % 3600)
	quotaData := &QuotaData{
		UserID:              params.UserID,
		Username:            params.Username,
		ModelName:           params.ModelName,
		CreatedAt:           createdAt,
		UseGroup:            params.UseGroup,
		TokenID:             params.TokenID,
		ChannelID:           params.ChannelID,
		NodeName:            params.NodeName,
		Count:               1,
		Quota:               params.Quota,
		TokenUsed:           params.TokenUsed,
		CacheReadTokens:     max(0, params.CacheReadTokens),
		CacheCreationTokens: max(0, params.CacheCreationTokens),
	}

	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	logQuotaDataCache(quotaData)
}

func SaveQuotaDataCache() {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	size := len(CacheQuotaData)
	// 如果缓存中有数据，就保存到数据库中
	// 1. 先查询数据库中是否有数据
	// 2. 如果有数据，就更新数据
	// 3. 如果没有数据，就插入数据
	for _, quotaData := range CacheQuotaData {
		quotaDataDB := &QuotaData{}
		DB.Table("quota_data").
			Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
				quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
			First(quotaDataDB)
		if quotaDataDB.Id > 0 {
			//quotaDataDB.Count += quotaData.Count
			//quotaDataDB.Quota += quotaData.Quota
			//DB.Table("quota_data").Save(quotaDataDB)
			increaseQuotaData(quotaData)
		} else {
			DB.Table("quota_data").Create(quotaData)
		}
	}
	CacheQuotaData = make(map[string]*QuotaData)
	quotaDataFlushGeneration++
	common.SysLog(common.LogText("saved dashboard data, %d records", size))
}

func increaseQuotaData(quotaData *QuotaData) {
	err := DB.Table("quota_data").
		Where("user_id = ? and username = ? and model_name = ? and created_at = ? and use_group = ? and token_id = ? and channel_id = ? and node_name = ?",
			quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt, quotaData.UseGroup, quotaData.TokenID, quotaData.ChannelID, quotaData.NodeName).
		Updates(map[string]any{
			"count":                 gorm.Expr("count + ?", quotaData.Count),
			"quota":                 gorm.Expr("quota + ?", quotaData.Quota),
			"token_used":            gorm.Expr("token_used + ?", quotaData.TokenUsed),
			"cache_read_tokens":     gorm.Expr("cache_read_tokens + ?", quotaData.CacheReadTokens),
			"cache_creation_tokens": gorm.Expr("cache_creation_tokens + ?", quotaData.CacheCreationTokens),
		}).Error
	if err != nil {
		common.SysLog(common.LogText("increaseQuotaData error: %s", err))
	}
}

// pendingQuotaData copies the not-yet-flushed rows inside [startTime, endTime]
// that satisfy match, together with the flush generation they were read at.
func pendingQuotaData(startTime int64, endTime int64, match func(*QuotaData) bool) ([]*QuotaData, uint64) {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	pending := make([]*QuotaData, 0)
	for _, quotaData := range CacheQuotaData {
		if quotaData.CreatedAt < startTime || quotaData.CreatedAt > endTime {
			continue
		}
		if match != nil && !match(quotaData) {
			continue
		}
		snapshot := *quotaData
		pending = append(pending, &snapshot)
	}
	return pending, quotaDataFlushGeneration
}

func quotaDataGeneration() uint64 {
	CacheQuotaDataLock.Lock()
	defer CacheQuotaDataLock.Unlock()
	return quotaDataFlushGeneration
}

func quotaDataKeyByModelAndCreatedAt(quotaData *QuotaData) string {
	return fmt.Sprintf("%s\x00%d", quotaData.ModelName, quotaData.CreatedAt)
}

func quotaDataKeyByUserModelAndCreatedAt(quotaData *QuotaData) string {
	return fmt.Sprintf("%d\x00%s\x00%s\x00%d", quotaData.UserID, quotaData.Username, quotaData.ModelName, quotaData.CreatedAt)
}

func quotaDataKeyByUsernameAndCreatedAt(quotaData *QuotaData) string {
	return fmt.Sprintf("%s\x00%d", quotaData.Username, quotaData.CreatedAt)
}

// mergePendingQuotaData folds pending rows into rows using the same grouping the
// database query produced, so a dashboard reflects traffic not yet persisted.
func mergePendingQuotaData(rows []*QuotaData, pending []*QuotaData, keyOf func(*QuotaData) string) []*QuotaData {
	byKey := make(map[string]*QuotaData, len(rows))
	for _, row := range rows {
		byKey[keyOf(row)] = row
	}
	for _, pendingRow := range pending {
		if existing, ok := byKey[keyOf(pendingRow)]; ok {
			existing.Count += pendingRow.Count
			existing.Quota += pendingRow.Quota
			existing.TokenUsed += pendingRow.TokenUsed
			existing.CacheReadTokens += pendingRow.CacheReadTokens
			existing.CacheCreationTokens += pendingRow.CacheCreationTokens
			continue
		}
		row := *pendingRow
		rows = append(rows, &row)
		byKey[keyOf(&row)] = &row
	}
	return rows
}

// readQuotaDataWithPending runs query and folds in pending cache rows. It retries
// when a cache flush lands during the query, which keeps the merged result
// consistent with what will eventually be persisted.
func readQuotaDataWithPending(query func() ([]*QuotaData, error), startTime int64, endTime int64, match func(*QuotaData) bool, keyOf func(*QuotaData) string) ([]*QuotaData, error) {
	for attempt := 0; ; attempt++ {
		generation := quotaDataGeneration()
		rows, err := query()
		if err != nil {
			return nil, err
		}
		pending, currentGeneration := pendingQuotaData(startTime, endTime, match)
		if currentGeneration == generation || attempt >= 2 {
			return mergePendingQuotaData(rows, pending, keyOf), nil
		}
	}
}

func queryQuotaDataByUsername(username string, startTime int64, endTime int64) ([]*QuotaData, error) {
	var quotaDatas []*QuotaData
	err := DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("username = ? and created_at >= ? and created_at <= ?", username, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func queryQuotaDataByUserId(userId int, startTime int64, endTime int64) ([]*QuotaData, error) {
	var quotaDatas []*QuotaData
	err := DB.Table("quota_data").
		Select("user_id, username, model_name, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("user_id = ? and created_at >= ? and created_at <= ?", userId, startTime, endTime).
		Group("user_id, username, model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func queryQuotaDataGroupByUser(startTime int64, endTime int64) ([]*QuotaData, error) {
	var quotaDatas []*QuotaData
	err := DB.Table("quota_data").
		Select("username, created_at, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("username, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func queryAllQuotaDates(startTime int64, endTime int64) ([]*QuotaData, error) {
	var quotaDatas []*QuotaData
	err := DB.Table("quota_data").
		Select("model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used, sum(cache_read_tokens) as cache_read_tokens, sum(cache_creation_tokens) as cache_creation_tokens, created_at").
		Where("created_at >= ? and created_at <= ?", startTime, endTime).
		Group("model_name, created_at").
		Find(&quotaDatas).Error
	return quotaDatas, err
}

func GetQuotaDataByUsername(username string, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	return readQuotaDataWithPending(func() ([]*QuotaData, error) {
		return queryQuotaDataByUsername(username, startTime, endTime)
	}, startTime, endTime, func(qd *QuotaData) bool {
		return qd.Username == username
	}, quotaDataKeyByUserModelAndCreatedAt)
}

func GetQuotaDataByUserId(userId int, startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	return readQuotaDataWithPending(func() ([]*QuotaData, error) {
		return queryQuotaDataByUserId(userId, startTime, endTime)
	}, startTime, endTime, func(qd *QuotaData) bool {
		return qd.UserID == userId
	}, quotaDataKeyByUserModelAndCreatedAt)
}

func GetQuotaDataGroupByUser(startTime int64, endTime int64) (quotaData []*QuotaData, err error) {
	return readQuotaDataWithPending(func() ([]*QuotaData, error) {
		return queryQuotaDataGroupByUser(startTime, endTime)
	}, startTime, endTime, nil, quotaDataKeyByUsernameAndCreatedAt)
}

func GetAllQuotaDates(startTime int64, endTime int64, username string) (quotaData []*QuotaData, err error) {
	if username != "" {
		return GetQuotaDataByUsername(username, startTime, endTime)
	}
	return readQuotaDataWithPending(func() ([]*QuotaData, error) {
		return queryAllQuotaDates(startTime, endTime)
	}, startTime, endTime, nil, quotaDataKeyByModelAndCreatedAt)
}
