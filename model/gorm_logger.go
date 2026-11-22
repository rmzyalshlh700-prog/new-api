package model

import (
	"io"
	"log"
	"os"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const (
	defaultSlowThresholdMs = 200
	maxSlowThresholdMs     = 60 * 60 * 1000
)

func newGormConfig(prepareStmt bool) *gorm.Config {
	return &gorm.Config{
		PrepareStmt: prepareStmt,
		Logger:      newGormLogger(os.Stdout),
	}
}

func newGormLogger(w io.Writer) logger.Interface {
	slowThresholdMs := common.GetEnvOrDefault("SQL_SLOW_THRESHOLD_MS", defaultSlowThresholdMs)
	if slowThresholdMs < 0 || slowThresholdMs > maxSlowThresholdMs {
		common.SysError(common.LogText("invalid SQL_SLOW_THRESHOLD_MS %d (allowed 0-%d, 0 disables slow query log), using default %d", slowThresholdMs, maxSlowThresholdMs, defaultSlowThresholdMs))
		slowThresholdMs = defaultSlowThresholdMs
	}
	// 在 Writer 层脱敏而非包装 logger.Interface:后者会让 gorm 的 FileWithLineNum
	// 把所有 SQL 日志的调用点归因到包装层自身,且需转发 ParamsFilter 类型断言。
	return logger.New(&sanitizedLogWriter{delegate: log.New(w, "\r\n", log.LstdFlags)}, logger.Config{
		SlowThreshold:             time.Duration(slowThresholdMs) * time.Millisecond,
		LogLevel:                  logger.Warn,
		IgnoreRecordNotFoundError: true,
		ParameterizedQueries:      !common.DebugEnabled,
		Colorful:                  true,
	})
}

// ParameterizedQueries 只过滤 SQL 字符串,驱动错误消息(如 MySQL 1062)同样会
// 内联数据值,在这里收敛为错误码;DEBUG=true 保留原文。
type sanitizedLogWriter struct {
	delegate *log.Logger
}

func (s *sanitizedLogWriter) Printf(format string, args ...any) {
	if !common.DebugEnabled {
		for i, arg := range args {
			if err, ok := arg.(error); ok {
				args[i] = sanitizeDBError(err)
			}
		}
	}
	s.delegate.Printf(format, args...)
}

// 只收敛数据库服务端生成的驱动错误(消息可能内联数据值);网络/上下文等
// 其它错误不含查询数据,原样保留以便排障。HTTP 错误边界共用同一实现,
// 保证驱动错误不会从日志或响应任一侧泄漏查询值。
func sanitizeDBError(err error) error {
	return common.SanitizeDatabaseError(err)
}
