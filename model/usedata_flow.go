package model

import (
	"fmt"
	"slices"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type FlowQuotaData struct {
	UserID      int    `json:"user_id,omitempty" gorm:"column:user_id"`
	Username    string `json:"username,omitempty" gorm:"column:username"`
	NodeName    string `json:"node_name,omitempty" gorm:"column:node_name"`
	TokenID     int    `json:"token_id,omitempty" gorm:"column:token_id"`
	TokenName   string `json:"token_name,omitempty" gorm:"-"`
	UseGroup    string `json:"use_group" gorm:"column:use_group"`
	ChannelID   int    `json:"channel_id,omitempty" gorm:"column:channel_id"`
	ChannelName string `json:"channel_name,omitempty" gorm:"-"`
	ModelName   string `json:"model_name" gorm:"column:model_name"`
	TokenUsed   int    `json:"token_used" gorm:"column:token_used"`
	Count       int    `json:"count" gorm:"column:count"`
	Quota       int    `json:"quota" gorm:"column:quota"`
}

func GetFlowQuotaData(startTime int64, endTime int64, username string, userID int, role int) ([]*FlowQuotaData, error) {
	switch {
	case role >= common.RoleRootUser:
		return getRootFlowQuotaData(startTime, endTime, username)
	case role >= common.RoleAdminUser:
		return getAdminFlowQuotaData(startTime, endTime, username)
	default:
		return getSelfFlowQuotaData(startTime, endTime, userID)
	}
}

func flowQuotaBaseQuery(startTime int64, endTime int64) *gorm.DB {
	query := DB.Table("quota_data").
		Where("use_group <> ''").
		Where("created_at >= ? and created_at <= ?", startTime, endTime)
	return query
}

// mergePendingFlowQuotaData folds pending quota rows into flow rows using the
// same grouping the database query produced, then keeps the quota-descending
// order the flow tables expect.
func mergePendingFlowQuotaData(rows []*FlowQuotaData, pending []*QuotaData, toRow func(*QuotaData) *FlowQuotaData, keyOf func(*FlowQuotaData) string) []*FlowQuotaData {
	byKey := make(map[string]*FlowQuotaData, len(rows))
	for _, row := range rows {
		byKey[keyOf(row)] = row
	}
	for _, pendingRow := range pending {
		row := toRow(pendingRow)
		if existing, ok := byKey[keyOf(row)]; ok {
			existing.Count += row.Count
			existing.Quota += row.Quota
			existing.TokenUsed += row.TokenUsed
			continue
		}
		rows = append(rows, row)
		byKey[keyOf(row)] = row
	}
	slices.SortStableFunc(rows, func(a, b *FlowQuotaData) int {
		return b.Quota - a.Quota
	})
	return rows
}

// readFlowQuotaDataWithPending runs query and folds in pending cache rows,
// retrying when a flush overlaps the query so nothing is double-counted.
func readFlowQuotaDataWithPending(query func() ([]*FlowQuotaData, error), startTime int64, endTime int64, match func(*QuotaData) bool, toRow func(*QuotaData) *FlowQuotaData, keyOf func(*FlowQuotaData) string) ([]*FlowQuotaData, error) {
	for attempt := 0; ; attempt++ {
		generation := quotaDataGeneration()
		rows, err := query()
		if err != nil {
			return nil, err
		}
		pending, currentGeneration := pendingQuotaData(startTime, endTime, match)
		if currentGeneration == generation || attempt >= 2 {
			return mergePendingFlowQuotaData(rows, pending, toRow, keyOf), nil
		}
	}
}

func getSelfFlowQuotaData(startTime int64, endTime int64, userID int) ([]*FlowQuotaData, error) {
	rows, err := readFlowQuotaDataWithPending(func() ([]*FlowQuotaData, error) {
		rows := make([]*FlowQuotaData, 0)
		err := flowQuotaBaseQuery(startTime, endTime).
			Select("token_id, use_group, model_name, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used").
			Where("user_id = ?", userID).
			Group("token_id, use_group, model_name").
			Order("quota DESC").
			Find(&rows).Error
		return rows, err
	}, startTime, endTime, func(qd *QuotaData) bool {
		return qd.UserID == userID && qd.UseGroup != ""
	}, func(qd *QuotaData) *FlowQuotaData {
		return &FlowQuotaData{
			TokenID:   qd.TokenID,
			UseGroup:  qd.UseGroup,
			ModelName: qd.ModelName,
			TokenUsed: qd.TokenUsed,
			Count:     qd.Count,
			Quota:     qd.Quota,
		}
	}, func(row *FlowQuotaData) string {
		return fmt.Sprintf("%d\x00%s\x00%s", row.TokenID, row.UseGroup, row.ModelName)
	})
	if err != nil {
		return nil, err
	}
	return rows, fillFlowTokenNames(rows)
}

func getAdminFlowQuotaData(startTime int64, endTime int64, username string) ([]*FlowQuotaData, error) {
	rows, err := readFlowQuotaDataWithPending(func() ([]*FlowQuotaData, error) {
		rows := make([]*FlowQuotaData, 0)
		query := flowQuotaBaseQuery(startTime, endTime).
			Select("user_id, username, use_group, model_name, channel_id, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used")
		if username != "" {
			query = query.Where("username = ?", username)
		}
		err := query.
			Group("user_id, username, use_group, model_name, channel_id").
			Order("quota DESC").
			Find(&rows).Error
		return rows, err
	}, startTime, endTime, func(qd *QuotaData) bool {
		return qd.UseGroup != "" && (username == "" || qd.Username == username)
	}, func(qd *QuotaData) *FlowQuotaData {
		return &FlowQuotaData{
			UserID:    qd.UserID,
			Username:  qd.Username,
			UseGroup:  qd.UseGroup,
			ChannelID: qd.ChannelID,
			ModelName: qd.ModelName,
			TokenUsed: qd.TokenUsed,
			Count:     qd.Count,
			Quota:     qd.Quota,
		}
	}, func(row *FlowQuotaData) string {
		return fmt.Sprintf("%d\x00%s\x00%s\x00%s\x00%d", row.UserID, row.Username, row.UseGroup, row.ModelName, row.ChannelID)
	})
	if err != nil {
		return nil, err
	}
	return rows, fillFlowChannelNames(rows)
}

func getRootFlowQuotaData(startTime int64, endTime int64, username string) ([]*FlowQuotaData, error) {
	rows, err := readFlowQuotaDataWithPending(func() ([]*FlowQuotaData, error) {
		rows := make([]*FlowQuotaData, 0)
		query := flowQuotaBaseQuery(startTime, endTime).
			Select("user_id, username, node_name, token_id, use_group, model_name, channel_id, sum(count) as count, sum(quota) as quota, sum(token_used) as token_used")
		if username != "" {
			query = query.Where("username = ?", username)
		}
		err := query.
			Group("user_id, username, node_name, token_id, use_group, model_name, channel_id").
			Order("quota DESC").
			Find(&rows).Error
		return rows, err
	}, startTime, endTime, func(qd *QuotaData) bool {
		return qd.UseGroup != "" && (username == "" || qd.Username == username)
	}, func(qd *QuotaData) *FlowQuotaData {
		return &FlowQuotaData{
			UserID:    qd.UserID,
			Username:  qd.Username,
			NodeName:  qd.NodeName,
			TokenID:   qd.TokenID,
			UseGroup:  qd.UseGroup,
			ChannelID: qd.ChannelID,
			ModelName: qd.ModelName,
			TokenUsed: qd.TokenUsed,
			Count:     qd.Count,
			Quota:     qd.Quota,
		}
	}, func(row *FlowQuotaData) string {
		return fmt.Sprintf("%d\x00%s\x00%s\x00%d\x00%s\x00%s\x00%d", row.UserID, row.Username, row.NodeName, row.TokenID, row.UseGroup, row.ModelName, row.ChannelID)
	})
	if err != nil {
		return nil, err
	}
	if err := fillFlowTokenNames(rows); err != nil {
		return rows, err
	}
	return rows, fillFlowChannelNames(rows)
}

func fillFlowTokenNames(rows []*FlowQuotaData) error {
	tokenIDSet := make(map[int]struct{})
	tokenIDs := make([]int, 0)
	for _, row := range rows {
		if row.TokenID == 0 {
			continue
		}
		if _, ok := tokenIDSet[row.TokenID]; ok {
			continue
		}
		tokenIDSet[row.TokenID] = struct{}{}
		tokenIDs = append(tokenIDs, row.TokenID)
	}
	if len(tokenIDs) == 0 {
		return nil
	}

	var tokens []struct {
		Id   int    `gorm:"column:id"`
		Name string `gorm:"column:name"`
	}
	if err := DB.Model(&Token{}).Select("id, name").Where("id IN ?", tokenIDs).Find(&tokens).Error; err != nil {
		return err
	}
	tokenNameByID := make(map[int]string, len(tokens))
	for _, token := range tokens {
		tokenNameByID[token.Id] = token.Name
	}
	// Deleted tokens are intentionally not resolved here: leave TokenName empty
	// so the frontend can render a localized "deleted (id)" label instead.
	for _, row := range rows {
		if name := tokenNameByID[row.TokenID]; name != "" {
			row.TokenName = name
		}
	}
	return nil
}

func fillFlowChannelNames(rows []*FlowQuotaData) error {
	channelIDSet := make(map[int]struct{})
	channelIDs := make([]int, 0)
	for _, row := range rows {
		if row.ChannelID == 0 {
			continue
		}
		if _, ok := channelIDSet[row.ChannelID]; ok {
			continue
		}
		channelIDSet[row.ChannelID] = struct{}{}
		channelIDs = append(channelIDs, row.ChannelID)
	}
	if len(channelIDs) == 0 {
		return nil
	}

	channelNameByID := make(map[int]string, len(channelIDs))
	if common.MemoryCacheEnabled {
		for _, channelID := range channelIDs {
			if channel, err := CacheGetChannel(channelID); err == nil {
				channelNameByID[channelID] = channel.Name
			}
		}
	} else {
		var channels []struct {
			Id   int    `gorm:"column:id"`
			Name string `gorm:"column:name"`
		}
		if err := DB.Table("channels").Select("id, name").Where("id IN ?", channelIDs).Find(&channels).Error; err != nil {
			return err
		}
		for _, channel := range channels {
			channelNameByID[channel.Id] = channel.Name
		}
	}
	for _, row := range rows {
		if name := channelNameByID[row.ChannelID]; name != "" {
			row.ChannelName = name
			continue
		}
		if row.ChannelID > 0 {
			row.ChannelName = fmt.Sprintf("channel-%d", row.ChannelID)
		}
	}
	return nil
}
