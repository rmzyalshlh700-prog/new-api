package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// performanceIndex describes an index that the dashboard and list queries rely
// on but that AutoMigrate does not create from the model tags. The columns are
// written with the physical column names used by the supported databases.
type performanceIndex struct {
	table   string
	name    string
	columns string
}

// mainDatabaseIndexes covers the tables scanned by control-panel overview and
// list endpoints. `logs` lives in the main database only when no separate log
// database is configured, so the same set is applied to both handles.
var mainDatabaseIndexes = []performanceIndex{
	{table: "logs", name: "idx_logs_created_at_type_user_id", columns: "created_at, type, user_id"},
	{table: "logs", name: "idx_logs_created_at", columns: "created_at"},
	{table: "users", name: "idx_users_quota", columns: "quota"},
	{table: "users", name: "idx_users_created_at", columns: "created_at"},
	{table: "tokens", name: "idx_tokens_status_created_time", columns: "status, created_time"},
	{table: "redemptions", name: "idx_redemptions_status_created_time", columns: "status, created_time"},
}

// logDatabaseIndexes is applied to the log database. ClickHouse manages its own
// primary index through the table engine and rejects CREATE INDEX, so the
// caller skips this migration for ClickHouse.
var logDatabaseIndexes = []performanceIndex{
	{table: "logs", name: "idx_logs_created_at", columns: "created_at"},
	{table: "logs", name: "idx_logs_created_at_type_user_id", columns: "created_at, type, user_id"},
}

// ensurePerformanceIndexes creates the indexes a database is missing.
//
// concurrently builds each one with CREATE INDEX CONCURRENTLY, which PostgreSQL
// needs so a build does not hold a write lock on the table for its whole
// duration: these run at startup and `logs` is the largest table the gateway
// owns. That form cannot run inside a transaction, so this function must stay
// outside one — it is called from the migration path, never from a transaction.
// MySQL and SQLite have no such form and keep the plain statement.
func ensurePerformanceIndexes(db *gorm.DB, label string, indexes []performanceIndex, concurrently bool) {
	if db == nil {
		return
	}
	for _, index := range indexes {
		if !db.Migrator().HasTable(index.table) {
			continue
		}
		if db.Migrator().HasIndex(index.table, index.name) {
			// A CONCURRENTLY build that was interrupted leaves the index in
			// place but invalid: PostgreSQL will not use it, will not build it
			// again, and HasIndex still reports it, so it would cost writes
			// forever without serving a query. Say so instead of starting up
			// silently with it.
			if concurrently && indexIsInvalid(db, index.name) {
				common.SysError(common.LogText("%s performance index %s exists but is invalid, left by an interrupted build; drop it to let the next start rebuild it: DROP INDEX CONCURRENTLY %s", label, index.name, index.name))
			}
			continue
		}
		create := "CREATE INDEX "
		if concurrently {
			create = "CREATE INDEX CONCURRENTLY "
		}
		statement := create + index.name + " ON " + index.table + " (" + index.columns + ")"
		if err := db.Exec(statement).Error; err != nil {
			// Several instances can migrate at the same time; losing that race
			// is not an error because the index then exists.
			if isExistingIndexError(err) {
				continue
			}
			// A failed index must not stop startup: the instance keeps serving,
			// and the next restart retries.
			common.SysError(common.LogText("%s performance index %s could not be created: %s", label, index.name, err.Error()))
		}
	}
}

// indexIsInvalid reports whether PostgreSQL marked an index invalid. Any other
// database, and a read that fails, answer false so the caller keeps its
// behaviour.
func indexIsInvalid(db *gorm.DB, name string) bool {
	var invalid bool
	row := db.Raw("SELECT NOT i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ?", name).Row()
	if err := row.Scan(&invalid); err != nil {
		return false
	}
	return invalid
}

func isExistingIndexError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "already exists") ||
		strings.Contains(message, "duplicate key name") ||
		strings.Contains(message, "duplicate index")
}
