package controller

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// failedLoginAlertThreshold / failedLoginAlertWindow control the repeated
// failed-login alert. No sensitive data (passwords, tokens) is ever recorded;
// only the submitted username handle, IP and reason are logged.
const (
	failedLoginAlertThreshold = 5
	failedLoginAlertWindow    = 10 * time.Minute
)

type failedLoginKey struct {
	ip string
}

type failedLoginCounter struct {
	count     int
	windowEnd time.Time
	alerted   bool
}

var (
	failedLoginMu      sync.Mutex
	failedLoginTracker = make(map[failedLoginKey]*failedLoginCounter)
)

// noteFailedLogin records a failed login attempt in the audit log (category
// login, Success=false) and raises a syslog alert once per window when the
// same source IP keeps failing. userId is 0 when the username does not match
// an existing account; reason never contains credential material.
func noteFailedLogin(c *gin.Context, userId int, username string, reason string) {
	params := map[string]any{
		"method": loginMethodFromContext(c),
		"reason": reason,
	}
	extra := model.AuditOther{
		LoginMethod: loginMethodFromContext(c),
		UserAgent:   c.Request.UserAgent(),
	}
	model.RecordLoginFailureLog(c.ClientIP(), username, userId, params, extra, c)

	ip := c.ClientIP()
	now := time.Now()
	failedLoginMu.Lock()
	defer failedLoginMu.Unlock()
	pruneFailedLoginTrackerLocked()
	counter, ok := failedLoginTracker[failedLoginKey{ip: ip}]
	if !ok || now.After(counter.windowEnd) {
		failedLoginTracker[failedLoginKey{ip: ip}] = &failedLoginCounter{count: 1, windowEnd: now.Add(failedLoginAlertWindow)}
		return
	}
	counter.count++
	if counter.count == failedLoginAlertThreshold && !counter.alerted {
		counter.alerted = true
		common.SysLog(common.LogText("SECURITY ALERT: %d failed login attempts within %v from IP %s (last username tried: %q)", counter.count, failedLoginAlertWindow, ip, username))
	}
}

// pruneFailedLoginTracker drops expired counters so the in-memory tracker does
// not grow without bound. Called opportunistically from noteFailedLogin.
func pruneFailedLoginTrackerLocked() {
	now := time.Now()
	for key, counter := range failedLoginTracker {
		if now.After(counter.windowEnd) {
			delete(failedLoginTracker, key)
		}
	}
}
