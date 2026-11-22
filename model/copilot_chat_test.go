package model

import (
	"fmt"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// newCopilotChatTestDB opens a private in-memory database and installs it as
// the package database for the test, restoring whatever was there before.
func newCopilotChatTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&CopilotChat{}, &CopilotMessage{}))
	previous := DB
	DB = db
	t.Cleanup(func() {
		DB = previous
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
	})
}

// TestCopilotChatCreateDerivesTitleFromOpeningTurn checks that a chat saved
// without a title is named after the question that opened it.
func TestCopilotChatCreateDerivesTitleFromOpeningTurn(t *testing.T) {
	newCopilotChatTestDB(t)
	chat, err := CreateCopilotChat(7, "", []CopilotChatTurn{
		{Role: "user", Content: "What is the balance of user 3?\nSecond line is ignored."},
	})
	require.NoError(t, err)
	assert.Equal(t, "What is the balance of user 3?", chat.Title)
	assert.Equal(t, 7, chat.UserId)

	messages, err := ListCopilotMessages(chat.Id)
	require.NoError(t, err)
	require.Len(t, messages, 1)
	assert.Equal(t, "user", messages[0].Role)
	assert.Equal(t, 7, messages[0].UserId)
}

// TestCopilotChatReplaceKeepsOneCopyOfEachTurn checks that resending the same
// transcript, which the console does after every finished round, cannot
// duplicate a turn.
func TestCopilotChatReplaceKeepsOneCopyOfEachTurn(t *testing.T) {
	newCopilotChatTestDB(t)
	chat, err := CreateCopilotChat(1, "Balances", nil)
	require.NoError(t, err)

	turns := []CopilotChatTurn{
		{Role: "user", Content: "Show the top users."},
		{Role: "assistant", Content: "- **alice**: $12"},
	}
	for range 3 {
		_, count, replaceErr := ReplaceCopilotChatMessages(1, chat.Id, "Balances", turns)
		require.NoError(t, replaceErr)
		assert.Equal(t, 2, count)
	}

	messages, err := ListCopilotMessages(chat.Id)
	require.NoError(t, err)
	assert.Len(t, messages, 2)
	assert.Equal(t, "assistant", messages[1].Role)
}

// TestCopilotChatIgnoresNonTextTurns checks that a tool turn never reaches the
// table: a result can hold another user's data.
func TestCopilotChatIgnoresNonTextTurns(t *testing.T) {
	newCopilotChatTestDB(t)
	chat, err := CreateCopilotChat(1, "Mixed", []CopilotChatTurn{
		{Role: "user", Content: "Delete channel 4"},
		{Role: "tool", Content: `{"secret":"sk-live"}`},
		{Role: "assistant", Content: "   "},
		{Role: "assistant", Content: "Confirming with you first."},
	})
	require.NoError(t, err)

	messages, err := ListCopilotMessages(chat.Id)
	require.NoError(t, err)
	require.Len(t, messages, 2)
	for _, message := range messages {
		assert.NotEqual(t, "tool", message.Role)
	}
}

// TestCopilotChatIsScopedToItsOwner checks that one administrator cannot read,
// change or delete another administrator's conversation, and that a foreign
// chat answers exactly like a missing one.
func TestCopilotChatIsScopedToItsOwner(t *testing.T) {
	newCopilotChatTestDB(t)
	chat, err := CreateCopilotChat(1, "Owner one", []CopilotChatTurn{
		{Role: "user", Content: "hello"},
	})
	require.NoError(t, err)

	_, err = GetCopilotChat(2, chat.Id)
	assert.ErrorIs(t, err, ErrCopilotChatNotFound)

	_, _, err = ReplaceCopilotChatMessages(2, chat.Id, "hijacked", []CopilotChatTurn{
		{Role: "user", Content: "replaced"},
	})
	assert.ErrorIs(t, err, ErrCopilotChatNotFound)

	assert.ErrorIs(t, DeleteCopilotChat(2, chat.Id), ErrCopilotChatNotFound)

	// The owner's copy is untouched and still theirs.
	owned, err := GetCopilotChat(1, chat.Id)
	require.NoError(t, err)
	assert.Equal(t, "Owner one", owned.Title)

	chats, err := ListCopilotChats(2)
	require.NoError(t, err)
	assert.Empty(t, chats)
}

// TestCopilotChatNormalizeCapsTranscript checks the size guards.
func TestCopilotChatNormalizeCapsTranscript(t *testing.T) {
	turns := make([]CopilotChatTurn, 0, CopilotChatMessageLimit+20)
	for index := range CopilotChatMessageLimit + 20 {
		turns = append(turns, CopilotChatTurn{Role: "user", Content: fmt.Sprintf("turn %d", index)})
	}
	normalized := normalizeCopilotChatTurns(turns)
	assert.Len(t, normalized, CopilotChatMessageLimit)
	// The most recent turns are the ones kept.
	assert.Equal(t, fmt.Sprintf("turn %d", CopilotChatMessageLimit+19), normalized[len(normalized)-1].Content)

	long := normalizeCopilotChatTurns([]CopilotChatTurn{{Role: "assistant", Content: string(make([]byte, CopilotChatContentLimit+100))}})
	require.Len(t, long, 1)
	assert.Len(t, long[0].Content, CopilotChatContentLimit)
}

// TestCopilotChatRedactsSecretsFromStoredTurns checks that a credential an
// operator pastes into the chat does not reach the stored transcript, and that
// an ordinary sentence is left exactly as it was written.
func TestCopilotChatRedactsSecretsFromStoredTurns(t *testing.T) {
	newCopilotChatTestDB(t)
	chat, err := CreateCopilotChat(1, "gateway", []CopilotChatTurn{
		{Role: "user", Content: "Add NOWPayments with key sk_live_9f8a7b6c5d4e3f21"},
		{Role: "user", Content: "my api key: 8f14e45fceea167a5a36dedd4bea2543"},
		{Role: "assistant", Content: "Added **NowPaymentsApiKey**. The channel has 4 models."},
	})
	require.NoError(t, err)

	messages, err := ListCopilotMessages(chat.Id)
	require.NoError(t, err)
	require.Len(t, messages, 3)
	assert.NotContains(t, messages[0].Content, "9f8a7b6c5d4e3f21")
	assert.Contains(t, messages[0].Content, "[REDACTED]")
	assert.NotContains(t, messages[1].Content, "8f14e45fceea167a5a36dedd4bea2543")
	assert.Equal(t, "Added **NowPaymentsApiKey**. The channel has 4 models.", messages[2].Content)
}
