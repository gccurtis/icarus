// Package healthz implements the liveness endpoint.
package healthz

import (
	"net/http"

	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handle reports that the server is up. It ignores the request and always
// replies 200 OK with {"status":"ok"}.
func Handle(endpoint.Request) endpoint.Response {
	return endpoint.Response{
		Status: http.StatusOK,
		Body:   map[string]string{"status": "ok"},
	}
}
