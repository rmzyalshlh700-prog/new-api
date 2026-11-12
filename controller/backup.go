package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// SystemBackup is the downloadable snapshot of the platform's configuration and
// account state. Usage history, logs and other high-volume runtime tables are
// deliberately excluded so the export stays small, fast and free of request
// data; everything needed to rebuild the console's configuration is included.
type SystemBackup struct {
	ExportedAt      int64                `json:"exported_at"`
	ExportedAtLocal string               `json:"exported_at_local"`
	Version         string               `json:"version"`
	RedactedFields  []string             `json:"redacted_fields"`
	Counts          map[string]int       `json:"counts"`
	Users           []model.User         `json:"users"`
	Channels        []model.Channel      `json:"channels"`
	Tokens          []model.Token        `json:"tokens"`
	Abilities       []model.Ability      `json:"abilities"`
	Models          []model.Model        `json:"models"`
	Vendors         []model.Vendor       `json:"vendors"`
	PrefillGroups   []model.PrefillGroup `json:"prefill_groups"`
	TaskPlugins     []model.TaskPlugin   `json:"task_plugins"`
	Options         []model.Option       `json:"options"`
}

// ExportSystemBackup streams a complete configuration backup as a downloadable
// JSON document. Each table is read with a single ordered query so the payload
// is deterministic and the export never page-faults through unbounded scans.
// Password hashes are read but never exported, because the backup is meant to
// restore accounts, roles and balances, not credentials.
func ExportSystemBackup(c *gin.Context) {
	now := time.Now()
	backup := &SystemBackup{
		ExportedAt:      now.Unix(),
		ExportedAtLocal: now.Format(time.RFC3339),
		Version:         common.Version,
		RedactedFields:  []string{"users.password"},
	}

	reads := []struct {
		name string
		run  func() error
	}{
		{
			name: "users",
			run: func() error {
				return model.DB.Omit("password").Order("id").Find(&backup.Users).Error
			},
		},
		{
			name: "channels",
			run: func() error {
				return model.DB.Order("id").Find(&backup.Channels).Error
			},
		},
		{
			name: "tokens",
			run: func() error {
				return model.DB.Order("id").Find(&backup.Tokens).Error
			},
		},
		{
			name: "abilities",
			run: func() error {
				return model.DB.Order("channel_id, model").Find(&backup.Abilities).Error
			},
		},
		{
			name: "models",
			run: func() error {
				return model.DB.Order("id").Find(&backup.Models).Error
			},
		},
		{
			name: "vendors",
			run: func() error {
				return model.DB.Order("id").Find(&backup.Vendors).Error
			},
		},
		{
			name: "prefill_groups",
			run: func() error {
				return model.DB.Order("id").Find(&backup.PrefillGroups).Error
			},
		},
		{
			name: "task_plugins",
			run: func() error {
				return model.DB.Order("id").Find(&backup.TaskPlugins).Error
			},
		},
		{
			name: "options",
			run: func() error {
				return model.DB.Find(&backup.Options).Error
			},
		},
	}
	backup.Counts = make(map[string]int, len(reads))
	for _, read := range reads {
		if err := read.run(); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	backup.Counts["users"] = len(backup.Users)
	backup.Counts["channels"] = len(backup.Channels)
	backup.Counts["tokens"] = len(backup.Tokens)
	backup.Counts["abilities"] = len(backup.Abilities)
	backup.Counts["models"] = len(backup.Models)
	backup.Counts["vendors"] = len(backup.Vendors)
	backup.Counts["prefill_groups"] = len(backup.PrefillGroups)
	backup.Counts["task_plugins"] = len(backup.TaskPlugins)
	backup.Counts["options"] = len(backup.Options)

	payload, err := common.Marshal(backup)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf(
		`attachment; filename="system_backup_%s.json"`, now.Format("20060102_1504"),
	))
	c.Header("Cache-Control", "no-store")
	c.Data(http.StatusOK, "application/json; charset=utf-8", payload)
}
