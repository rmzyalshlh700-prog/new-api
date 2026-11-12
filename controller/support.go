package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

const (
	maxTicketSubjectLength = 120
	maxTicketContentLength = 4000
	defaultTicketPageSize  = 10
	maxTicketPageSize      = 100
	defaultAdminTicketPage = 20
)

func supportDisabled(c *gin.Context) bool {
	if !operation_setting.GetSupportSetting().Enabled {
		common.ApiErrorT(c, "Support system is not enabled")
		return true
	}
	return false
}

func parseTicketPage(c *gin.Context, defaultSize int) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", strconv.Itoa(defaultSize)))
	if pageSize < 1 {
		pageSize = defaultSize
	}
	if pageSize > maxTicketPageSize {
		pageSize = maxTicketPageSize
	}
	return page, pageSize
}

type createTicketRequest struct {
	Subject  string `json:"subject"`
	Priority string `json:"priority"`
	Content  string `json:"content"`
}

// CreateUserTicket creates a new support ticket with its first message.
func CreateUserTicket(c *gin.Context) {
	if supportDisabled(c) {
		return
	}
	userId := c.GetInt("id")
	var req createTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request body",
		})
		return
	}
	if len(req.Subject) == 0 || len(req.Subject) > maxTicketSubjectLength {
		common.ApiErrorT(c, "Ticket subject must be between 1 and 120 characters")
		return
	}
	if len(req.Content) == 0 || len(req.Content) > maxTicketContentLength {
		common.ApiErrorT(c, "Ticket message must be between 1 and 4000 characters")
		return
	}
	priority := req.Priority
	if priority != model.TicketPriorityLow && priority != model.TicketPriorityNormal && priority != model.TicketPriorityHigh {
		priority = model.TicketPriorityNormal
	}
	username, _ := model.GetUsernameById(userId, false)
	ticket, err := model.CreateTicket(userId, username, req.Subject, priority)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if _, err := model.CreateTicketMessage(ticket.Id, userId, false, req.Content, false); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

// GetUserTickets lists the signed-in user's tickets.
func GetUserTickets(c *gin.Context) {
	if supportDisabled(c) {
		return
	}
	userId := c.GetInt("id")
	page, pageSize := parseTicketPage(c, defaultTicketPageSize)
	tickets, total, err := model.GetUserTickets(userId, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items": tickets,
		"total": total,
	})
}

// GetUserTicketMessages returns one ticket with its messages, owner only.
func GetUserTicketMessages(c *gin.Context) {
	if supportDisabled(c) {
		return
	}
	userId := c.GetInt("id")
	ticketId, _ := strconv.Atoi(c.Param("id"))
	ticket, messages, err := model.GetTicketWithMessages(userId, false, ticketId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	_ = model.MarkTicketMessagesRead(ticketId, userId, false)
	common.ApiSuccess(c, gin.H{
		"ticket":   ticket,
		"messages": messages,
	})
}

// GetUserTicketUnreadCount returns the user's unread admin replies.
func GetUserTicketUnreadCount(c *gin.Context) {
	if supportDisabled(c) {
		return
	}
	count, err := model.CountUserUnread(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"unread": count})
}

// CreateUserTicketMessage appends a user reply to their ticket.
func CreateUserTicketMessage(c *gin.Context) {
	if supportDisabled(c) {
		return
	}
	userId := c.GetInt("id")
	ticketId, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request body",
		})
		return
	}
	if len(req.Content) == 0 || len(req.Content) > maxTicketContentLength {
		common.ApiErrorT(c, "Ticket message must be between 1 and 4000 characters")
		return
	}
	message, err := model.CreateTicketMessage(ticketId, userId, false, req.Content, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, message)
}

// AdminGetTickets lists all tickets with an optional status filter.
func AdminGetTickets(c *gin.Context) {
	page, pageSize := parseTicketPage(c, defaultAdminTicketPage)
	status := c.Query("status")
	tickets, total, err := model.GetAllTickets(status, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items": tickets,
		"total": total,
	})
}

// AdminGetTicketMessages returns any ticket with its messages.
func AdminGetTicketMessages(c *gin.Context) {
	ticketId, _ := strconv.Atoi(c.Param("id"))
	ticket, messages, err := model.GetTicketWithMessages(0, true, ticketId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	_ = model.MarkTicketMessagesRead(ticketId, 0, true)
	common.ApiSuccess(c, gin.H{
		"ticket":   ticket,
		"messages": messages,
	})
}

// AdminReplyTicket appends an admin reply and marks user messages read.
func AdminReplyTicket(c *gin.Context) {
	adminId := c.GetInt("id")
	ticketId, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request body",
		})
		return
	}
	if len(req.Content) == 0 || len(req.Content) > maxTicketContentLength {
		common.ApiErrorT(c, "Ticket message must be between 1 and 4000 characters")
		return
	}
	message, err := model.CreateTicketMessage(ticketId, adminId, true, req.Content, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, message)
}

// AdminUpdateTicketStatus changes a ticket's status.
func AdminUpdateTicketStatus(c *gin.Context) {
	ticketId, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request body",
		})
		return
	}
	if req.Status != model.TicketStatusOpen && req.Status != model.TicketStatusPending && req.Status != model.TicketStatusResolved {
		common.ApiErrorT(c, "Invalid ticket status")
		return
	}
	if err := model.UpdateTicketStatus(ticketId, req.Status); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminGetUnreadCount returns the global unread user-message counter.
func AdminGetUnreadCount(c *gin.Context) {
	count, err := model.CountAdminUnread()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"unread": count})
}
