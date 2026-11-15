package common

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/go-sql-driver/mysql"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The HTTP error boundary must not echo a driver message, which inlines the
// values of the failing statement and sometimes the statement itself.
func TestApiErrorStatusDoesNotLeakDriverMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)

	ApiErrorStatus(c, http.StatusInternalServerError, &mysql.MySQLError{
		Number:  1062,
		Message: "Duplicate entry 'secret-value' for key 'users.idx'",
	})

	require.Equal(t, http.StatusInternalServerError, recorder.Code)
	assert.NotContains(t, recorder.Body.String(), "secret-value")
	assert.NotContains(t, recorder.Body.String(), "users.idx")
	assert.Contains(t, recorder.Body.String(), "mysql error 1062")
}

// Business and transport errors keep their text: only driver errors carry the
// query values that must not reach a client.
func TestApiErrorStatusKeepsNonDriverMessage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/user/self", nil)

	ApiErrorStatus(c, http.StatusBadRequest, NewMessage("Invalid parameters"))

	assert.Contains(t, recorder.Body.String(), "Invalid parameters")
}
