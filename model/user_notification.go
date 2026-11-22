package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// A notification the web console shows to exactly one user inside its
// notification center. Unlike the platform-wide notice and announcement
// timeline (both stored as options and shared by everyone), every row here
// belongs to one recipient, carries its own read state, and can be recalled by
// the administrator who sent it.
const (
	UserNotificationLevelInfo    = "info"
	UserNotificationLevelSuccess = "success"
	UserNotificationLevelWarning = "warning"
	UserNotificationLevelError   = "error"

	UserNotificationSourceAdmin  = "admin"
	UserNotificationSourceSystem = "system"

	UserNotificationMaxTitleLength    = 120
	UserNotificationMaxContentLength  = 4000
	UserNotificationMaxLinkLength     = 512
	UserNotificationMaxCategoryLength = 32
)

var (
	ErrUserNotificationNotFound = errors.New("notification not found")
	ErrNotificationTitleEmpty   = errors.New("notification title cannot be empty")
)

type UserNotification struct {
	Id        int    `json:"id"`
	UserId    int    `json:"user_id" gorm:"not null;index:idx_user_notification_inbox,priority:1"`
	Title     string `json:"title" gorm:"type:varchar(120);not null"`
	Content   string `json:"content" gorm:"type:text"`
	Level     string `json:"level" gorm:"type:varchar(16);default:'info'"`
	Category  string `json:"category" gorm:"type:varchar(32);default:'system'"`
	Link      string `json:"link" gorm:"type:varchar(512)"`
	Source    string `json:"source" gorm:"type:varchar(16);default:'admin'"`
	CreatedBy int    `json:"created_by" gorm:"default:0;index"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime;index:idx_user_notification_inbox,priority:2"`
	ReadAt    int64  `json:"read_at" gorm:"default:0"`
}

// SentUserNotification is a stored notification joined with the recipient,
// which is what the administrator's sent list shows.
type SentUserNotification struct {
	UserNotification
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Read        bool   `json:"read"`
}

// Normalize trims and validates the fields a sender controls, so a malformed
// level or an oversized body never reaches the table.
func (n *UserNotification) Normalize() error {
	n.Title = strings.TrimSpace(n.Title)
	n.Content = strings.TrimSpace(n.Content)
	n.Category = strings.TrimSpace(n.Category)
	n.Link = strings.TrimSpace(n.Link)

	if n.Title == "" {
		return ErrNotificationTitleEmpty
	}
	titleRunes := []rune(n.Title)
	if len(titleRunes) > UserNotificationMaxTitleLength {
		n.Title = string(titleRunes[:UserNotificationMaxTitleLength])
	}
	if len(n.Content) > UserNotificationMaxContentLength {
		return fmt.Errorf("notification content exceeds %d characters", UserNotificationMaxContentLength)
	}
	if len(n.Link) > UserNotificationMaxLinkLength {
		return fmt.Errorf("notification link exceeds %d characters", UserNotificationMaxLinkLength)
	}
	switch n.Level {
	case UserNotificationLevelInfo, UserNotificationLevelSuccess,
		UserNotificationLevelWarning, UserNotificationLevelError:
	default:
		n.Level = UserNotificationLevelInfo
	}
	if n.Category == "" {
		n.Category = "system"
	}
	categoryRunes := []rune(n.Category)
	if len(categoryRunes) > UserNotificationMaxCategoryLength {
		n.Category = string(categoryRunes[:UserNotificationMaxCategoryLength])
	}
	if n.Source == "" {
		n.Source = UserNotificationSourceAdmin
	}
	if n.UserId <= 0 {
		return errors.New("notification recipient is missing")
	}
	return nil
}

func CreateUserNotification(notification *UserNotification) error {
	if notification == nil {
		return errors.New("notification is nil")
	}
	if err := notification.Normalize(); err != nil {
		return err
	}
	if notification.CreatedAt == 0 {
		notification.CreatedAt = common.GetTimestamp()
	}
	return DB.Create(notification).Error
}

// ListUserNotifications returns one page of a single user's inbox, newest
// first, together with the total count and the unread count behind the bell
// badge.
func ListUserNotifications(userId int, page int, pageSize int, unreadOnly bool, keyword string) ([]UserNotification, int64, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	base := func() *gorm.DB {
		query := DB.Model(&UserNotification{}).Where("user_id = ?", userId)
		if unreadOnly {
			query = query.Where("read_at = 0")
		}
		if trimmed := strings.TrimSpace(keyword); trimmed != "" {
			like := "%" + trimmed + "%"
			query = query.Where("title LIKE ? OR content LIKE ?", like, like)
		}
		return query
	}

	var total int64
	if err := base().Count(&total).Error; err != nil {
		return nil, 0, 0, err
	}
	var unread int64
	if err := DB.Model(&UserNotification{}).
		Where("user_id = ? AND read_at = 0", userId).
		Count(&unread).Error; err != nil {
		return nil, 0, 0, err
	}

	var notifications []UserNotification
	if err := base().
		Order("created_at DESC, id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&notifications).Error; err != nil {
		return nil, 0, 0, err
	}
	return notifications, total, unread, nil
}

func CountUnreadUserNotifications(userId int) (int64, error) {
	var unread int64
	err := DB.Model(&UserNotification{}).
		Where("user_id = ? AND read_at = 0", userId).
		Count(&unread).Error
	return unread, err
}

// MarkUserNotificationsRead marks the given notifications of a user as read.
// An empty id list marks the whole inbox, which is what "mark all as read"
// does.
func MarkUserNotificationsRead(userId int, ids []int) (int64, error) {
	query := DB.Model(&UserNotification{}).Where("user_id = ? AND read_at = 0", userId)
	if len(ids) > 0 {
		query = query.Where("id IN ?", ids)
	}
	result := query.Update("read_at", common.GetTimestamp())
	return result.RowsAffected, result.Error
}

// DeleteUserNotificationForUser removes one notification from a user's inbox,
// only when it belongs to them.
func DeleteUserNotificationForUser(userId int, id int) error {
	result := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&UserNotification{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrUserNotificationNotFound
	}
	return nil
}

// DeleteUserNotificationById recalls a notification an administrator sent,
// whoever the recipient is.
func DeleteUserNotificationById(id int) error {
	result := DB.Where("id = ?", id).Delete(&UserNotification{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrUserNotificationNotFound
	}
	return nil
}

// ListSentUserNotifications lists the notifications administrators sent, newest
// first, filtered by the recipient's username or email or by the notification
// text.
func ListSentUserNotifications(keyword string, page int, pageSize int) ([]SentUserNotification, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	base := func() *gorm.DB {
		query := DB.Model(&UserNotification{}).Where("source = ?", UserNotificationSourceAdmin)
		if trimmed := strings.TrimSpace(keyword); trimmed != "" {
			like := "%" + trimmed + "%"
			recipients := DB.Model(&User{}).Select("id").
				Where("username LIKE ? OR email LIKE ? OR display_name LIKE ?", like, like, like)
			query = query.Where(
				"title LIKE ? OR content LIKE ? OR user_id IN (?)",
				like, like, recipients,
			)
		}
		return query
	}

	var total int64
	if err := base().Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []UserNotification
	if err := base().
		Order("created_at DESC, id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	if len(rows) == 0 {
		return []SentUserNotification{}, total, nil
	}

	recipientIds := make([]int, 0, len(rows))
	seen := map[int]struct{}{}
	for _, row := range rows {
		if _, ok := seen[row.UserId]; ok {
			continue
		}
		seen[row.UserId] = struct{}{}
		recipientIds = append(recipientIds, row.UserId)
	}
	var users []User
	if err := DB.Select("id", "username", "display_name", "email").
		Where("id IN ?", recipientIds).
		Find(&users).Error; err != nil {
		return nil, 0, err
	}
	recipients := make(map[int]User, len(users))
	for _, user := range users {
		recipients[user.Id] = user
	}

	sent := make([]SentUserNotification, 0, len(rows))
	for _, row := range rows {
		item := SentUserNotification{UserNotification: row, Read: row.ReadAt > 0}
		if user, ok := recipients[row.UserId]; ok {
			item.Username = user.Username
			item.DisplayName = user.DisplayName
			item.Email = user.Email
		}
		sent = append(sent, item)
	}
	return sent, total, nil
}

// GetUserByAccount resolves the account an administrator typed: a numeric id,
// a username, or an email address. An exact username wins over an email match,
// and the email match is case-insensitive because addresses are.
func GetUserByAccount(account string) (*User, error) {
	account = strings.TrimSpace(account)
	if account == "" {
		return nil, errors.New("enter the recipient's user ID, username or email")
	}

	if id, err := strconv.Atoi(account); err == nil && id > 0 {
		var byId User
		err = DB.Where("id = ?", id).First(&byId).Error
		if err == nil {
			return &byId, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	var byUsername User
	err := DB.Where("username = ?", account).First(&byUsername).Error
	if err == nil {
		return &byUsername, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var byEmail User
	err = DB.Where("LOWER(email) = ?", strings.ToLower(account)).First(&byEmail).Error
	if err == nil {
		return &byEmail, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	return nil, gorm.ErrRecordNotFound
}
