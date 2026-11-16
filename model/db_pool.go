package model

import (
	"database/sql"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/go-sql-driver/mysql"
)

// Connection-pool and network limits for the database handles.
//
// The defaults are sized for a database reached over the network rather than a
// local socket: a small idle pool keeps every process from parking a hundred
// connections on the server, and an idle connection is reaped long before its
// 30 minute lifetime so a socket opened across a network path that has since
// changed is not handed to a request.
const (
	defaultSQLMaxIdleConns = 10
	defaultSQLMaxOpenConns = 100
	defaultSQLMaxLifetime  = 1800
	defaultSQLMaxIdleTime  = 300

	defaultSQLConnectTimeout = 10
	defaultSQLReadTimeout    = 30
	defaultSQLWriteTimeout   = 30
)

// configureDBPool applies the pool limits to one handle. role only names the
// handle in the log line.
func configureDBPool(sqlDB *sql.DB, role string) {
	if sqlDB == nil {
		return
	}
	maxIdle := common.GetEnvOrDefault("SQL_MAX_IDLE_CONNS", defaultSQLMaxIdleConns)
	maxOpen := common.GetEnvOrDefault("SQL_MAX_OPEN_CONNS", defaultSQLMaxOpenConns)
	maxLifetime := common.GetEnvOrDefault("SQL_MAX_LIFETIME", defaultSQLMaxLifetime)
	maxIdleTime := common.GetEnvOrDefault("SQL_MAX_IDLE_TIME", defaultSQLMaxIdleTime)

	sqlDB.SetMaxIdleConns(maxIdle)
	sqlDB.SetMaxOpenConns(maxOpen)
	sqlDB.SetConnMaxLifetime(time.Second * time.Duration(maxLifetime))
	sqlDB.SetConnMaxIdleTime(time.Second * time.Duration(maxIdleTime))

	common.SysLog(common.LogText("%s database pool: maxIdle=%d maxOpen=%d lifetime=%ds idleTime=%ds", role, maxIdle, maxOpen, maxLifetime, maxIdleTime))
}

// withMySQLTimeouts bounds the network operations of the MySQL driver. Without
// them a dropped TCP session blocks the query until the operating system gives
// up, holding one of the pool's open connections for minutes. A value already
// present in the DSN always wins.
func withMySQLTimeouts(dsn string) string {
	config, err := mysql.ParseDSN(dsn)
	if err != nil {
		common.SysLog(common.LogText("cannot parse the MySQL DSN to apply network timeouts: %s", err.Error()))
		return dsn
	}
	if config.Timeout == 0 {
		config.Timeout = time.Second * time.Duration(common.GetEnvOrDefault("SQL_CONNECT_TIMEOUT", defaultSQLConnectTimeout))
	}
	if config.ReadTimeout == 0 {
		config.ReadTimeout = time.Second * time.Duration(common.GetEnvOrDefault("SQL_READ_TIMEOUT", defaultSQLReadTimeout))
	}
	if config.WriteTimeout == 0 {
		config.WriteTimeout = time.Second * time.Duration(common.GetEnvOrDefault("SQL_WRITE_TIMEOUT", defaultSQLWriteTimeout))
	}
	return config.FormatDSN()
}

// withPostgresConnectTimeout caps how long a dial to the server may take, so an
// unreachable or suspended server fails in seconds instead of blocking until
// the dial times out. Read and write deadlines are not DSN parameters for pgx;
// they belong to the request context or to the server's statement_timeout. A
// connect_timeout already in the DSN always wins.
func withPostgresConnectTimeout(dsn string) string {
	if strings.Contains(dsn, "connect_timeout") {
		return dsn
	}
	timeout := strconv.Itoa(common.GetEnvOrDefault("SQL_CONNECT_TIMEOUT", defaultSQLConnectTimeout))
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		if strings.Contains(dsn, "?") {
			return dsn + "&connect_timeout=" + timeout
		}
		return dsn + "?connect_timeout=" + timeout
	}
	return dsn + " connect_timeout=" + timeout
}
