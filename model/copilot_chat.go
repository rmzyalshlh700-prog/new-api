package model

import (
	"errors"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
)

// Persistent storage for the Admin Copilot's conversations.
//
// The browser used to keep the transcript in localStorage, which meant history
// was lost with the site data and never followed an administrator to another
// machine. These two tables make the transcript a server-side artefact owned by
// the administrator who wrote it, while the chat endpoint itself stays
// stateless: the console still sends the turn list with every run, and it now
// also stores the finished turns here.
//
// Only text turns are stored. Tool arguments and tool results are deliberately
// left out: they can carry another user's data (a looked-up account, a channel
// key preview) and are not needed to replay a conversation.

const (
	// CopilotChatTitleLimit bounds a derived title, which is the first line of
	// the opening question.
	CopilotChatTitleLimit = 120
	// CopilotChatMessageLimit bounds one stored transcript. A chat that grows
	// past it keeps the most recent turns, so storage cannot grow without end
	// because of one long session.
	CopilotChatMessageLimit = 200
	// CopilotChatContentLimit bounds a single stored turn.
	CopilotChatContentLimit = 32 << 10
	// CopilotChatListLimit bounds the history list offered in the console.
	CopilotChatListLimit = 100
)

// CopilotChat is one conversation between an administrator and the assistant.
type CopilotChat struct {
	Id        int    `json:"id"`
	UserId    int    `json:"user_id" gorm:"index:idx_copilot_chat_user,priority:1"`
	Title     string `json:"title" gorm:"type:varchar(120)"`
	CreatedAt int64  `json:"created_at" gorm:"type:bigint"`
	UpdatedAt int64  `json:"updated_at" gorm:"type:bigint;index:idx_copilot_chat_user,priority:2"`
}

func (CopilotChat) TableName() string {
	return "copilot_chats"
}

// CopilotMessage is one text turn of a conversation. UserId is stored beside
// ChatId so every read and write can be scoped to the owner in a single query
// instead of trusting the chat id alone.
type CopilotMessage struct {
	Id        int    `json:"id"`
	ChatId    int    `json:"chat_id" gorm:"index:idx_copilot_message_chat,priority:1"`
	UserId    int    `json:"user_id" gorm:"index"`
	Role      string `json:"role" gorm:"type:varchar(16)"`
	Content   string `json:"content" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"type:bigint;index:idx_copilot_message_chat,priority:2"`
}

func (CopilotMessage) TableName() string {
	return "copilot_messages"
}

// ErrCopilotChatNotFound reports a chat id that does not exist for this owner.
// It is reported as "not found" rather than "forbidden" on purpose: another
// administrator's chat must be indistinguishable from a chat that never was.
var ErrCopilotChatNotFound = errors.New("copilot chat not found")

// CopilotChatTurn is one turn a client asks to store.
type CopilotChatTurn struct {
	Role    string
	Content string
}

// copilotChatTitle derives a title from the opening question.
func copilotChatTitle(raw string) string {
	title := strings.TrimSpace(strings.SplitN(strings.TrimSpace(raw), "\n", 2)[0])
	if title == "" {
		return "New chat"
	}
	runes := []rune(title)
	if len(runes) > CopilotChatTitleLimit {
		title = string(runes[:CopilotChatTitleLimit])
	}
	return title
}

// normalizeCopilotChatTurns keeps only the turns worth storing: a known role
// and some text. Later turns win when a transcript exceeds the cap.
func normalizeCopilotChatTurns(turns []CopilotChatTurn) []CopilotMessage {
	cleaned := make([]CopilotMessage, 0, len(turns))
	for _, turn := range turns {
		role := strings.TrimSpace(turn.Role)
		if role != "user" && role != "assistant" {
			continue
		}
		content := strings.TrimSpace(turn.Content)
		if content == "" {
			continue
		}
		content = redactCopilotSecrets(content)
		if len(content) > CopilotChatContentLimit {
			content = content[:CopilotChatContentLimit]
		}
		cleaned = append(cleaned, CopilotMessage{Role: role, Content: content})
	}
	if len(cleaned) > CopilotChatMessageLimit {
		cleaned = cleaned[len(cleaned)-CopilotChatMessageLimit:]
	}
	return cleaned
}

// ListCopilotChats returns the administrator's conversations, newest first.
func ListCopilotChats(userId int) ([]CopilotChat, error) {
	chats := make([]CopilotChat, 0, 16)
	err := DB.Where("user_id = ?", userId).
		Order("updated_at DESC, id DESC").
		Limit(CopilotChatListLimit).
		Find(&chats).Error
	if err != nil {
		return nil, err
	}
	return chats, nil
}

// GetCopilotChat reads one conversation owned by the administrator.
func GetCopilotChat(userId int, chatId int) (*CopilotChat, error) {
	if chatId <= 0 {
		return nil, ErrCopilotChatNotFound
	}
	var chat CopilotChat
	err := DB.Where("id = ? AND user_id = ?", chatId, userId).First(&chat).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrCopilotChatNotFound
	}
	if err != nil {
		return nil, err
	}
	return &chat, nil
}

// ListCopilotMessages returns a conversation's turns in the order they were said.
func ListCopilotMessages(chatId int) ([]CopilotMessage, error) {
	messages := make([]CopilotMessage, 0, 16)
	err := DB.Where("chat_id = ?", chatId).
		Order("created_at ASC, id ASC").
		Find(&messages).Error
	if err != nil {
		return nil, err
	}
	return messages, nil
}

// CreateCopilotChat opens a conversation. An empty transcript is allowed: the
// console creates it as soon as the operator sends the first question.
func CreateCopilotChat(userId int, title string, turns []CopilotChatTurn) (*CopilotChat, error) {
	now := time.Now().Unix()
	messages := normalizeCopilotChatTurns(turns)
	derived := copilotChatTitle(title)
	if derived == "New chat" && len(messages) > 0 {
		// A client that sends the opening turn without a title gets the title
		// derived from it.
		derived = copilotChatTitle(messages[0].Content)
	}
	chat := CopilotChat{
		UserId:    userId,
		Title:     derived,
		CreatedAt: now,
		UpdatedAt: now,
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&chat).Error; err != nil {
			return err
		}
		for index := range messages {
			messages[index].ChatId = chat.Id
			messages[index].UserId = userId
			messages[index].CreatedAt = now
		}
		if len(messages) == 0 {
			return nil
		}
		return tx.Create(&messages).Error
	})
	if err != nil {
		return nil, err
	}
	return &chat, nil
}

// ReplaceCopilotChatMessages stores a conversation's transcript.
//
// The console owns the transcript and resends it after every finished turn, so
// this is a replace rather than an append: a retried or duplicated request
// cannot leave the same turn in the table twice.
func ReplaceCopilotChatMessages(userId int, chatId int, title string, turns []CopilotChatTurn) (*CopilotChat, int, error) {
	chat, err := GetCopilotChat(userId, chatId)
	if err != nil {
		return nil, 0, err
	}
	messages := normalizeCopilotChatTurns(turns)
	now := time.Now().Unix()
	updates := map[string]any{"updated_at": now}
	requestedTitle := copilotChatTitle(title)
	switch {
	case strings.TrimSpace(title) != "" && requestedTitle != chat.Title:
		updates["title"] = requestedTitle
	case chat.Title == "New chat" && len(messages) > 0:
		updates["title"] = copilotChatTitle(messages[0].Content)
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("chat_id = ? AND user_id = ?", chatId, userId).
			Delete(&CopilotMessage{}).Error; err != nil {
			return err
		}
		for index := range messages {
			messages[index].ChatId = chatId
			messages[index].UserId = userId
			messages[index].CreatedAt = now
		}
		if len(messages) > 0 {
			if err := tx.Create(&messages).Error; err != nil {
				return err
			}
		}
		return tx.Model(&CopilotChat{}).
			Where("id = ? AND user_id = ?", chatId, userId).
			Updates(updates).Error
	})
	if err != nil {
		return nil, 0, err
	}
	updated, err := GetCopilotChat(userId, chatId)
	if err != nil {
		return nil, 0, err
	}
	return updated, len(messages), nil
}

// DeleteCopilotChat removes a conversation and its turns.
func DeleteCopilotChat(userId int, chatId int) error {
	if _, err := GetCopilotChat(userId, chatId); err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("chat_id = ? AND user_id = ?", chatId, userId).
			Delete(&CopilotMessage{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ? AND user_id = ?", chatId, userId).
			Delete(&CopilotChat{}).Error
	})
}

// copilotSecretPatterns match the credentials an operator pastes into the chat
// when they ask the assistant to configure a provider.
//
// The chat endpoint sends the transcript to the model provider, and this table
// keeps it, so a key written in a sentence would otherwise be copied into a
// stored conversation and shipped upstream a second time. The model still needs
// the value to make the call — it arrives in the run that carries the request —
// but the stored transcript keeps only the masked form.
var copilotSecretPatterns = []*regexp.Regexp{
	// Provider-prefixed keys: sk-…, sk_live_…, rk-…, AIza…, ghp_…, xoxb-…
	regexp.MustCompile(`\b(?:sk|rk)[-_][A-Za-z0-9_-]{8,}`),
	regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{20,}`),
	regexp.MustCompile(`\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{16,}`),
	regexp.MustCompile(`\bxox[baprs]-[A-Za-z0-9-]{10,}`),
	// A labelled value: "key: …", "secret=…", "token …", "password …".
	regexp.MustCompile(`(?i)\b(api[ _-]?key|secret|token|password|passwd)\b\s*[:=]\s*\S{8,}`),
}

// redactCopilotSecrets masks anything that looks like a credential.
func redactCopilotSecrets(content string) string {
	for _, pattern := range copilotSecretPatterns {
		content = pattern.ReplaceAllStringFunc(content, func(match string) string {
			// Keep the label so the sentence still reads, mask the value.
			if index := strings.IndexAny(match, ":="); index > 0 {
				return match[:index+1] + " [REDACTED]"
			}
			return "[REDACTED]"
		})
	}
	return content
}
