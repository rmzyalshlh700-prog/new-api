package controller

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupBackupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Channel{},
		&model.Token{},
		&model.Ability{},
		&model.Model{},
		&model.Vendor{},
		&model.PrefillGroup{},
		&model.TaskPlugin{},
		&model.Option{},
	))
	model.DB = db
	t.Cleanup(func() { model.DB = previousDB })
	return db
}

// TestExportSystemBackup verifies the download is a JSON attachment containing
// the account, channel and configuration state without credential material.
func TestExportSystemBackup(t *testing.T) {
	db := setupBackupTestDB(t)

	require.NoError(t, db.Create(&model.User{
		Id:       1,
		Username: "alice",
		Password: "password-hash",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Quota:    1234,
		Group:    "default",
		AffCode:  "aff-alice",
	}).Error)
	require.NoError(t, db.Create(&model.Channel{
		Id:     1,
		Name:   "openai-primary",
		Key:    "sk-test",
		Group:  "default",
		Models: "gpt-4o",
	}).Error)
	require.NoError(t, db.Create(&model.Option{Key: "ModelRatio", Value: `{"gpt-4o": 1.25}`}).Error)
	require.NoError(t, db.Create(&model.Option{Key: "GroupRatio", Value: `{"default": 1}`}).Error)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/admin/backup/export", ExportSystemBackup)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin/backup/export", nil)
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Regexp(t,
		regexp.MustCompile(`^attachment; filename="system_backup_\d{8}_\d{4}\.json"$`),
		recorder.Header().Get("Content-Disposition"),
	)
	assert.Equal(t, "no-store", recorder.Header().Get("Cache-Control"))

	var payload struct {
		Version string         `json:"version"`
		Counts  map[string]int `json:"counts"`
		Users   []struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Quota    int    `json:"quota"`
			Role     int    `json:"role"`
		} `json:"users"`
		Channels []struct {
			Name string `json:"name"`
		} `json:"channels"`
		Options []struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		} `json:"options"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))

	require.Len(t, payload.Users, 1)
	assert.Equal(t, "alice", payload.Users[0].Username)
	assert.Empty(t, payload.Users[0].Password, "password hashes must never be exported")
	assert.Equal(t, 1234, payload.Users[0].Quota)
	assert.Equal(t, common.RoleCommonUser, payload.Users[0].Role)

	require.Len(t, payload.Channels, 1)
	assert.Equal(t, "openai-primary", payload.Channels[0].Name)

	// Group ratios and model pricing live in the options table.
	require.Len(t, payload.Options, 2)
	optionKeys := map[string]string{}
	for _, option := range payload.Options {
		optionKeys[option.Key] = option.Value
	}
	assert.Contains(t, optionKeys["ModelRatio"], "gpt-4o")
	assert.Contains(t, optionKeys["GroupRatio"], "default")

	assert.Equal(t, 1, payload.Counts["users"])
	assert.Equal(t, 1, payload.Counts["channels"])
	assert.Equal(t, 2, payload.Counts["options"])
}
