// Package echo implements the echo endpoint, which returns the posted JSON body
// unchanged so callers can confirm data sent in a request comes back in the
// response.
package echo

import (
	"net/http"

	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handle returns the posted JSON body unchanged. If the body is not valid JSON
// it replies 400 Bad Request instead.
func Handle(req endpoint.Request) endpoint.Response {
	var body any
	if err := req.Bind(&body); err != nil {
		return endpoint.Response{
			Status: http.StatusBadRequest,
			Body:   map[string]string{"error": "invalid JSON body"},
		}
	}
	return endpoint.Response{Status: http.StatusOK, Body: body}
}
