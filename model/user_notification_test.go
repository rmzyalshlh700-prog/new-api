package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedNotificationUser(t *testing.T, id int, username string, email string) *User {
	t.Helper()
	user := &User{
		Id:       id,
		Username: username,
		Password: "hashed-password",
		Email:    email,
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		Group:    "default",
		AffCode:  fmt.Sprintf("aff%d", id),
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func TestUserNotificationReachesOnlyItsRecipient(t *testing.T) {
	truncateTables(t)
	t.Cleanup(func() { DB.Exec("DELETE FROM user_notifications") })

	alice := seedNotificationUser(t, 2101, "alice", "alice@example.com")
	bob := seedNotificationUser(t, 2102, "bob", "bob@example.com")

	notification := &UserNotification{
		UserId:  alice.Id,
		Title:   "Plan renews tomorrow",
		Content: "Your subscription renews on the 1st.",
		Level:   UserNotificationLevelWarning,
		Source:  UserNotificationSourceAdmin,
	}
	require.NoError(t, CreateUserNotification(notification))

	aliceInbox, aliceTotal, aliceUnread, err := ListUserNotifications(alice.Id, 1, 20, false, "")
	require.NoError(t, err)
	assert.Equal(t, int64(1), aliceTotal)
	assert.Equal(t, int64(1), aliceUnread)
	require.Len(t, aliceInbox, 1)
	assert.Equal(t, "Plan renews tomorrow", aliceInbox[0].Title)
	assert.Equal(t, UserNotificationLevelWarning, aliceInbox[0].Level)
	assert.Zero(t, aliceInbox[0].ReadAt)

	bobInbox, bobTotal, bobUnread, err := ListUserNotifications(bob.Id, 1, 20, false, "")
	require.NoError(t, err)
	assert.Zero(t, bobTotal)
	assert.Zero(t, bobUnread)
	assert.Empty(t, bobInbox)
}

func TestUserNotificationReadStateIsPerUser(t *testing.T) {
	truncateTables(t)
	t.Cleanup(func() { DB.Exec("DELETE FROM user_notifications") })

	alice := seedNotificationUser(t, 2201, "alice", "alice@example.com")
	bob := seedNotificationUser(t, 2202, "bob", "bob@example.com")

	notification := &UserNotification{UserId: alice.Id, Title: "Hello Alice"}
	require.NoError(t, CreateUserNotification(notification))

	// Bob cannot mark somebody else's notification read, and cannot delete it.
	updated, err := MarkUserNotificationsRead(bob.Id, []int{notification.Id})
	require.NoError(t, err)
	assert.Zero(t, updated)
	assert.ErrorIs(t, DeleteUserNotificationForUser(bob.Id, notification.Id), ErrUserNotificationNotFound)

	unread, err := CountUnreadUserNotifications(alice.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(1), unread)

	updated, err = MarkUserNotificationsRead(alice.Id, []int{notification.Id})
	require.NoError(t, err)
	assert.Equal(t, int64(1), updated)

	unread, err = CountUnreadUserNotifications(alice.Id)
	require.NoError(t, err)
	assert.Zero(t, unread)
}

func TestGetUserByAccountMatchesIdUsernameAndEmail(t *testing.T) {
	truncateTables(t)
	t.Cleanup(func() { DB.Exec("DELETE FROM user_notifications") })

	user := seedNotificationUser(t, 2301, "carol", "Carol@Example.com")

	byId, err := GetUserByAccount("2301")
	require.NoError(t, err)
	assert.Equal(t, user.Id, byId.Id)

	byUsername, err := GetUserByAccount("carol")
	require.NoError(t, err)
	assert.Equal(t, user.Id, byUsername.Id)

	// Email addresses are matched case-insensitively.
	byEmail, err := GetUserByAccount("carol@example.com")
	require.NoError(t, err)
	assert.Equal(t, user.Id, byEmail.Id)

	_, err = GetUserByAccount("nobody@example.com")
	assert.Error(t, err)
}

func TestListSentUserNotificationsJoinsRecipient(t *testing.T) {
	truncateTables(t)
	t.Cleanup(func() { DB.Exec("DELETE FROM user_notifications") })

	alice := seedNotificationUser(t, 2401, "alice", "alice@example.com")

	require.NoError(t, CreateUserNotification(&UserNotification{
		UserId: alice.Id,
		Title:  "Welcome",
		Source: UserNotificationSourceAdmin,
	}))

	sent, total, err := ListSentUserNotifications("alice", 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, sent, 1)
	assert.Equal(t, "alice", sent[0].Username)
	assert.Equal(t, "alice@example.com", sent[0].Email)
	assert.False(t, sent[0].Read)
}
