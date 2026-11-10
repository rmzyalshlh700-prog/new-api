package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/maintenance_setting"

	"github.com/gin-gonic/gin"
)

const maintenanceRedirectPath = "/maintenance"

// Paths that stay reachable while maintenance mode is active. Administrative
// console routes and sign-in flows are exempt so operators can still disable
// the mode, and public page assets must load for /maintenance itself.
var maintenanceExemptPaths = []string{
	"/maintenance",
	"/login",
	"/sign-in",
	"/sign-up",
	"/oauth",
	"/admin",
	"/setup",
	"/assets",
	"/static",
	"/favicon.ico",
	"/robots.txt",
	"/manifest.webmanifest",
	"/site.webmanifest",
}

// Authentication and boot APIs never redirect, otherwise nobody could sign in
// or the console could not learn the current status while maintenance is on.
var maintenanceExemptAPIPaths = []string{
	"/api/status",
	"/api/setup",
	"/api/uptime/status",
	"/api/user/auth",
	"/api/user/login",
	"/api/user/login/encryption-key",
	"/api/user/passkey",
	"/api/user/register",
	"/api/user/reset",
	"/api/oauth",
	"/api/verification",
	"/api/reset_password",
}

func hasPathPrefix(requestPath, prefix string) bool {
	return requestPath == prefix || strings.HasPrefix(requestPath, prefix+"/")
}

func isMaintenanceExemptPath(requestPath string) bool {
	for _, prefix := range maintenanceExemptPaths {
		if hasPathPrefix(requestPath, prefix) {
			return true
		}
	}
	for _, prefix := range maintenanceExemptAPIPaths {
		if hasPathPrefix(requestPath, prefix) {
			return true
		}
	}
	return false
}

// maintenanceRequestUser resolves the live dashboard session behind the
// request. Anonymous requests and non-dashboard credentials return nil.
func maintenanceRequestUser(c *gin.Context) *model.UserBase {
	raw, ok := authorizationToken(c.GetHeader("Authorization"))
	if !ok {
		return nil
	}
	identity, internal, err := service.ParseDashboardAccessToken(raw)
	if !internal || err != nil {
		return nil
	}
	_, user, err := service.ValidateLoginSession(identity)
	if err != nil {
		return nil
	}
	return user
}

// MaintenanceMode redirects dashboard and API traffic to /maintenance while
// maintenance mode is enabled. Administrators and whitelisted users keep full
// access; sign-in, admin routes and authentication APIs are always exempt.
func MaintenanceMode() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestPath := c.Request.URL.Path
		if c.Request.Method == http.MethodOptions || isMaintenanceExemptPath(requestPath) {
			c.Next()
			return
		}

		common.OptionMapRWMutex.RLock()
		enabled := maintenance_setting.Get().MaintenanceEnabled
		common.OptionMapRWMutex.RUnlock()
		if !enabled {
			c.Next()
			return
		}

		if user := maintenanceRequestUser(c); user != nil {
			if user.Role >= common.RoleAdminUser {
				c.Next()
				return
			}
			common.OptionMapRWMutex.RLock()
			whitelisted := maintenance_setting.IsWhitelisted(user.Email, user.Username)
			common.OptionMapRWMutex.RUnlock()
			if whitelisted {
				c.Next()
				return
			}
		}

		c.Header("Cache-Control", "no-store")
		status := http.StatusFound
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			status = http.StatusTemporaryRedirect
		}
		c.Redirect(status, maintenanceRedirectPath)
		c.Abort()
	}
}
