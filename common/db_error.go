package common

import (
	"errors"
	"fmt"

	"github.com/ClickHouse/clickhouse-go/v2/lib/proto"
	sqlitedriver "github.com/glebarez/go-sqlite"
	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
)

// SanitizeDatabaseError collapses an error produced by a database driver into
// its numeric code.
//
// Driver messages inline the values of the failing statement ("Duplicate entry
// 'user@example.com' for key ...") and sometimes the statement itself, so they
// must never reach a client response or a log line verbatim. Errors that do not
// come from a driver — network, context, business errors — carry no query data
// and are returned unchanged so operators keep the diagnostic detail.
//
// This is the single implementation used both by the SQL log writer and by the
// HTTP error boundary (ApiErrorStatus), so a database failure cannot leak
// through one of the two paths.
func SanitizeDatabaseError(err error) error {
	if err == nil {
		return nil
	}
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		return fmt.Errorf("mysql error %d", mysqlErr.Number)
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		// 08P01 is PgBouncer's FATAL for a duplicate Parse on the same
		// connection, and 42P05 is PostgreSQL's native
		// duplicate_prepared_statement; both mean prepared statements are
		// incompatible with a transaction-pooling proxy.
		if pgErr.Code == "08P01" || pgErr.Code == "42P05" {
			return fmt.Errorf("postgres error SQLSTATE %s: prepared statement conflict with a transaction-pooling proxy (PgBouncer/Neon/Supabase); other clients sharing this database must disable prepared statements, or upgrade PgBouncer to >=1.21 with max_prepared_statements enabled", pgErr.Code)
		}
		return fmt.Errorf("postgres error SQLSTATE %s", pgErr.Code)
	}
	var chErr *proto.Exception
	if errors.As(err, &chErr) {
		return fmt.Errorf("clickhouse error %d", chErr.Code)
	}
	var sqliteErr *sqlitedriver.Error
	if errors.As(err, &sqliteErr) {
		return fmt.Errorf("sqlite error %d", sqliteErr.Code())
	}
	return err
}
