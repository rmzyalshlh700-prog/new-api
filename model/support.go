package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
)

const (
	TicketStatusOpen     = "open"
	TicketStatusPending  = "pending"
	TicketStatusResolved = "resolved"

	TicketPriorityLow    = "low"
	TicketPriorityNormal = "normal"
	TicketPriorityHigh   = "high"
)

type Ticket struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	UserId    int    `json:"user_id" gorm:"index"`
	Username  string `json:"username" gorm:"index;default:''"`
	Subject   string `json:"subject" gorm:"type:varchar(255)"`
	Status    string `json:"status" gorm:"type:varchar(20);index;default:'open'"`
	Priority  string `json:"priority" gorm:"type:varchar(20);default:'normal'"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint"`
}

type TicketMessage struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	TicketId  int    `json:"ticket_id" gorm:"index:idx_ticket_message_ticket_id_is_read,priority:1"`
	SenderId  int    `json:"sender_id"`
	IsAdmin   bool   `json:"is_admin"`
	Content   string `json:"content" gorm:"type:text"`
	IsRead    bool   `json:"is_read" gorm:"index:idx_ticket_message_ticket_id_is_read,priority:2"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

func ticketExists(id int) (*Ticket, error) {
	var ticket Ticket
	err := DB.Where("id = ?", id).First(&ticket).Error
	if err != nil {
		return nil, err
	}
	return &ticket, nil
}

func CreateTicket(userId int, username, subject, priority string) (*Ticket, error) {
	ticket := &Ticket{
		UserId:    userId,
		Username:  username,
		Subject:   subject,
		Status:    TicketStatusOpen,
		Priority:  priority,
		CreatedAt: common.GetTimestamp(),
		UpdatedAt: common.GetTimestamp(),
	}
	if err := DB.Create(ticket).Error; err != nil {
		return nil, err
	}
	return ticket, nil
}

func GetUserTickets(userId int, page int, pageSize int) ([]*Ticket, int64, error) {
	var tickets []*Ticket
	var total int64
	err := DB.Model(&Ticket{}).Where("user_id = ?", userId).Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = DB.Where("user_id = ?", userId).
		Omit("username").
		Order("updated_at desc").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&tickets).Error
	return tickets, total, err
}

func GetAllTickets(status string, page int, pageSize int) ([]*Ticket, int64, error) {
	var tickets []*Ticket
	var total int64
	query := DB.Model(&Ticket{})
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = query.Order("updated_at desc").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&tickets).Error
	return tickets, total, err
}

func GetTicketWithMessages(userId int, isAdmin bool, ticketId int) (*Ticket, []*TicketMessage, error) {
	ticket, err := ticketExists(ticketId)
	if err != nil {
		return nil, nil, err
	}
	if !isAdmin && ticket.UserId != userId {
		return nil, nil, errors.New("无权访问该工单")
	}
	var messages []*TicketMessage
	err = DB.Where("ticket_id = ?", ticketId).Order("created_at asc").Find(&messages).Error
	if err != nil {
		return nil, nil, err
	}
	ticket.Username = ""
	return ticket, messages, nil
}

func CreateTicketMessage(ticketId int, senderId int, isAdmin bool, content string, markUserMessagesRead bool) (*TicketMessage, error) {
	ticket, err := ticketExists(ticketId)
	if err != nil {
		return nil, err
	}
	if !isAdmin && ticket.UserId != senderId {
		return nil, errors.New("无权访问该工单")
	}
	message := &TicketMessage{
		TicketId:  ticketId,
		SenderId:  senderId,
		IsAdmin:   isAdmin,
		Content:   content,
		IsRead:    false,
		CreatedAt: common.GetTimestamp(),
	}
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	if err := tx.Create(message).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Model(&Ticket{}).Where("id = ?", ticketId).Updates(map[string]any{
		"updated_at": common.GetTimestamp(),
		"status":     TicketStatusPending,
	}).Error; err != nil {
		tx.Rollback()
		return nil, err
	}
	if markUserMessagesRead {
		if err := tx.Model(&TicketMessage{}).
			Where("ticket_id = ? AND is_admin = ? AND is_read = ?", ticketId, !isAdmin, false).
			Update("is_read", true).Error; err != nil {
			tx.Rollback()
			return nil, err
		}
	}
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}
	return message, nil
}

// CountAdminUnread counts unread user messages across all tickets.
func CountAdminUnread() (int64, error) {
	var count int64
	err := DB.Model(&TicketMessage{}).Where("is_admin = ? AND is_read = ?", false, false).Count(&count).Error
	return count, err
}

// CountUserUnread counts unread admin messages in a user's tickets.
func CountUserUnread(userId int) (int64, error) {
	var count int64
	err := DB.Model(&TicketMessage{}).
		Joins("JOIN tickets ON tickets.id = ticket_messages.ticket_id").
		Where("tickets.user_id = ? AND ticket_messages.is_admin = ? AND ticket_messages.is_read = ?", userId, true, false).
		Count(&count).Error
	return count, err
}

func MarkTicketMessagesRead(ticketId int, userId int, isAdmin bool) error {
	ticket, err := ticketExists(ticketId)
	if err != nil {
		return err
	}
	if !isAdmin && ticket.UserId != userId {
		return errors.New("无权访问该工单")
	}
	return DB.Model(&TicketMessage{}).
		Where("ticket_id = ? AND is_admin = ? AND is_read = ?", ticketId, !isAdmin, false).
		Update("is_read", true).Error
}

func UpdateTicketStatus(ticketId int, status string) error {
	return DB.Model(&Ticket{}).Where("id = ?", ticketId).Updates(map[string]any{
		"status":     status,
		"updated_at": common.GetTimestamp(),
	}).Error
}
