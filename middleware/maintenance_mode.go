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

// API surfaces that are blocked while maintenance mode is active. The
// dashboard itself is a single-page app served from the static/NoRoute
// handlers, so document requests and assets are never matched here and always
// load; the SPA moves the user to /maintenance when it receives a maintenance
// response. Relay and legacy billing endpoints are included so clients cannot
// bypass maintenance by calling them directly.
var maintenanceAPIPaths = []string{
	"/api",
	"/v1",
	"/v1beta",
	"/pg",
	"/mj",
	"/dashboard/billing",
}

// Authentication and boot APIs never return the maintenance error, otherwise
// nobody could sign in or the console could not learn the current status while
// maintenance is on.
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

func isMaintenanceAPIPath(requestPath string) bool {
	for _, prefix := range maintenanceAPIPaths {
		if hasPathPrefix(requestPath, prefix) {
			return true
		}
	}
	return false
}

func isMaintenanceExemptAPIPath(requestPath string) bool {
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

// MaintenanceMode blocks API traffic while maintenance mode is enabled. HTML
// documents and static assets always load so the SPA can boot, re-establish the
// session from its refresh cookie and decide client-side whether the user is
// whitelisted. Administrators and whitelisted users keep full API access;
// authentication APIs are always exempt.
func MaintenanceMode() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestPath := c.Request.URL.Path
		if c.Request.Method == http.MethodOptions ||
			!isMaintenanceAPIPath(requestPath) ||
			isMaintenanceExemptAPIPath(requestPath) {
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
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
			"success":            false,
			"message":            "System under maintenance",
			"maintenance_active": true,
		})
	}
}
