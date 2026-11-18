package controller

import (
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// validateNotificationLink accepts an in-console path or an absolute http(s)
// URL and rejects everything else, so a sender cannot plant a javascript: or
// data: link that the recipient's console would render as a clickable target.
func validateNotificationLink(link string) error {
	link = strings.TrimSpace(link)
	if link == "" {
		return nil
	}
	if strings.HasPrefix(link, "/") && !strings.HasPrefix(link, "//") {
		return nil
	}
	parsed, err := url.Parse(link)
	if err != nil {
		return errors.New("notification link is not a valid URL")
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		if parsed.Host == "" {
			return errors.New("notification link is not a valid URL")
		}
		return nil
	case "":
		return errors.New("notification link must start with / or use http(s)")
	default:
		return fmt.Errorf("notification link scheme %q is not allowed", parsed.Scheme)
	}
}

// GetSelfNotifications serves one page of the signed-in user's own inbox.
func GetSelfNotifications(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	unreadOnly := c.Query("unread") == "true" || c.Query("unread") == "1"

	items, total, unread, err := model.ListUserNotifications(
		userId, pageInfo.Page, pageInfo.PageSize, unreadOnly, c.Query("keyword"),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if items == nil {
		items = []model.UserNotification{}
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"unread":    unread,
		"page":      pageInfo.Page,
		"page_size": pageInfo.PageSize,
	})
}

// MarkSelfNotificationsRead marks the given notifications read, or the whole
// inbox when asll is true. It answers with the remaining unread count so the
// bell badge updates without another round trip.
func MarkSelfNotificationsRead(c *gin.Context) {
	var req struct {
		Ids []int `json:"ids"`
		All bool  `json:"all"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	if !req.All && len(req.Ids) == 0 {
		common.ApiErrorMsg(c, "Choose at least one notification to mark as read")
		return
	}

	userId := c.GetInt("id")
	ids := req.Ids
	if req.All {
		ids = nil
	}
	updated, err := model.MarkUserNotificationsRead(userId, ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	unread, err := model.CountUnreadUserNotifications(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"updated": updated, "unread": unread})
}

// DismissSelfNotification removes one notification from the signed-in user's
// inbox.
func DismissSelfNotification(c *gin.Context) {
	var req struct {
		Id int `json:"id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Id <= 0 {
		common.ApiErrorMsg(c, "Invalid notification id")
		return
	}
	userId := c.GetInt("id")
	if err := model.DeleteUserNotificationForUser(userId, req.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	unread, err := model.CountUnreadUserNotifications(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"unread": unread})
}

// AdminResolveNotificationTarget previews who an account identifier resolves
// to before the administrator sends, so a typo is caught in the form rather
// than after the fact.
func AdminResolveNotificationTarget(c *gin.Context) {
	account := strings.TrimSpace(c.Query("account"))
	if account == "" {
		common.ApiErrorMsg(c, "Enter the recipient's user ID, username or email")
		return
	}
	user, err := model.GetUserByAccount(account)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "No user matches that ID, username or email")
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"id":           user.Id,
		"username":     user.Username,
		"display_name": user.DisplayName,
		"email":        user.Email,
		"status":       user.Status,
		"role":         user.Role,
		"group":        user.Group,
	})
}

// AdminSendNotification delivers one notification to exactly one user and
// optionally mirrors it through the channel that user configured (email,
// webhook, Bark or Gotify).
func AdminSendNotification(c *gin.Context) {
	var req struct {
		Account         string `json:"account"`
		Title           string `json:"title"`
		Content         string `json:"content"`
		Level           string `json:"level"`
		Category        string `json:"category"`
		Link            string `json:"link"`
		DeliverExternal bool   `json:"deliver_external"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	req.Account = strings.TrimSpace(req.Account)
	req.Title = strings.TrimSpace(req.Title)
	if req.Account == "" {
		common.ApiErrorMsg(c, "Enter the recipient's user ID, username or email")
		return
	}
	if req.Title == "" {
		common.ApiErrorMsg(c, "A notification title is required")
		return
	}
	if err := validateNotificationLink(req.Link); err != nil {
		common.ApiError(c, err)
		return
	}

	recipient, err := model.GetUserByAccount(req.Account)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "No user matches that ID, username or email")
			return
		}
		common.ApiError(c, err)
		return
	}
	if recipient.Status != common.UserStatusEnabled {
		common.ApiErrorMsg(c, "That account is disabled, so it could not read the notification")
		return
	}

	notification := &model.UserNotification{
		UserId:    recipient.Id,
		Title:     req.Title,
		Content:   req.Content,
		Level:     req.Level,
		Category:  req.Category,
		Link:      req.Link,
		Source:    model.UserNotificationSourceAdmin,
		CreatedBy: c.GetInt("id"),
	}
	if err := model.CreateUserNotification(notification); err != nil {
		common.ApiError(c, err)
		return
	}

	external := gin.H{"attempted": false, "delivered": false, "message": ""}
	if req.DeliverExternal {
		// Deliver through whatever the recipient configured for themselves. A
		// failure here never undoes the in-console notification that was just
		// stored; the administrator is told what happened.
		userSetting := recipient.GetSetting()
		notify := dto.NewNotify("user_notification", notification.Title, notification.Content, nil)
		if err := service.NotifyUser(recipient.Id, recipient.Email, userSetting, notify); err != nil {
			external = gin.H{"attempted": true, "delivered": false, "message": err.Error()}
		} else {
			external = gin.H{"attempted": true, "delivered": true, "message": ""}
		}
	}

	recordManageAudit(c, "notification.send", map[string]any{
		"username":        recipient.Username,
		"target_user_id":  recipient.Id,
		"notification_id": notification.Id,
		"title":           notification.Title,
		"level":           notification.Level,
		"external":        external["attempted"],
	})

	common.ApiSuccess(c, gin.H{
		"notification": notification,
		"recipient": gin.H{
			"id":           recipient.Id,
			"username":     recipient.Username,
			"display_name": recipient.DisplayName,
			"email":        recipient.Email,
		},
		"external": external,
	})
}

// AdminListSentNotifications lists the notifications administrators sent.
func AdminListSentNotifications(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.ListSentUserNotifications(c.Query("keyword"), pageInfo.Page, pageInfo.PageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      pageInfo.Page,
		"page_size": pageInfo.PageSize,
	})
}

// AdminRevokeNotification recalls a notification an administrator sent, so it
// disappears from the recipient's inbox.
func AdminRevokeNotification(c *gin.Context) {
	var req struct {
		Id int `json:"id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Id <= 0 {
		common.ApiErrorMsg(c, "Invalid notification id")
		return
	}
	if err := model.DeleteUserNotificationById(req.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "notification.revoke", map[string]any{"notification_id": req.Id})
	common.ApiSuccess(c, nil)
}
