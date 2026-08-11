package requestlog

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
)

func TestMiddlewareCapturesRequestAndResponse(t *testing.T) {
	var got Record
	e := echo.New()
	e.Use(Middleware(func(r Record) { got = r }))
	e.POST("/echo", func(c echo.Context) error {
		var body any
		if err := c.Bind(&body); err != nil {
			return err
		}
		return c.JSON(http.StatusOK, body)
	})

	req := httptest.NewRequest(http.MethodPost, "/echo", strings.NewReader(`{"hello":"world"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if got.Method != http.MethodPost {
		t.Errorf("Method = %q, want POST", got.Method)
	}
	if got.URI != "/echo" {
		t.Errorf("URI = %q, want /echo", got.URI)
	}
	if got.Status != http.StatusOK {
		t.Errorf("Status = %d, want %d", got.Status, http.StatusOK)
	}
	if want := `{"hello":"world"}`; string(got.Request) != want {
		t.Errorf("Request = %s, want %s", got.Request, want)
	}
	if want := `{"hello":"world"}`; strings.TrimSpace(string(got.Response)) != want {
		t.Errorf("Response = %s, want %s", got.Response, want)
	}
	// The captured response must still have reached the client unchanged.
	if want := `{"hello":"world"}`; strings.TrimSpace(rec.Body.String()) != want {
		t.Errorf("client body = %q, want %q", rec.Body.String(), want)
	}
}

func TestMiddlewareRecordsAttachedCause(t *testing.T) {
	var got Record
	e := echo.New()
	e.Use(Middleware(func(r Record) { got = r }))
	e.GET("/boom", func(c echo.Context) error {
		AttachError(c, errors.New("provider returned no usable JSON"))
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "chat operation failed"})
	})

	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/boom", nil))

	if want := "provider returned no usable JSON"; got.Error != want {
		t.Errorf("Error = %q, want %q", got.Error, want)
	}
	// The cause is for the log only — the client still sees the opaque message.
	if strings.Contains(rec.Body.String(), "no usable JSON") {
		t.Errorf("cause leaked to the client: %s", rec.Body.String())
	}
}

func TestMiddlewareOmitsErrorWhenNoneAttached(t *testing.T) {
	var got Record
	e := echo.New()
	e.Use(Middleware(func(r Record) { got = r }))
	e.GET("/ok", func(c echo.Context) error { return c.JSON(http.StatusOK, map[string]string{"status": "ok"}) })

	e.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/ok", nil))

	if got.Error != "" {
		t.Errorf("Error = %q, want empty", got.Error)
	}
	b, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(b), "error") {
		t.Errorf("empty cause was not omitted: %s", b)
	}
}

func TestToRawFallsBackToString(t *testing.T) {
	raw := toRaw([]byte("not json"))
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		t.Fatalf("non-JSON body did not become a JSON string: %v", err)
	}
	if s != "not json" {
		t.Errorf("got %q, want %q", s, "not json")
	}
	if toRaw(nil) != nil {
		t.Error("empty body should produce nil")
	}
}

func TestRedactSecretsRedactsEmailAndCredentials(t *testing.T) {
	body := []byte(`{
		"Email":"alice@example.com",
		"password":"hunter2",
		"user":{"email":"bob@example.com","API_Key":"k-123"},
		"members":[{"email":"carol@example.com","token":"t-9","name":"Carol"}],
		"note":"kept"
	}`)

	out := redactSecrets(body)
	var got map[string]any
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatalf("redacted body is not JSON: %v", err)
	}

	if got["Email"] != "[REDACTED]" {
		t.Errorf("top-level Email = %v, want [REDACTED]", got["Email"])
	}
	if got["password"] != "[REDACTED]" {
		t.Errorf("password = %v, want [REDACTED]", got["password"])
	}
	user := got["user"].(map[string]any)
	if user["email"] != "[REDACTED]" {
		t.Errorf("nested email = %v, want [REDACTED]", user["email"])
	}
	if user["API_Key"] != "[REDACTED]" {
		t.Errorf("nested API_Key = %v, want [REDACTED]", user["API_Key"])
	}
	member := got["members"].([]any)[0].(map[string]any)
	if member["email"] != "[REDACTED]" {
		t.Errorf("email in array = %v, want [REDACTED]", member["email"])
	}
	if member["token"] != "[REDACTED]" {
		t.Errorf("token in array = %v, want [REDACTED]", member["token"])
	}
	if member["name"] != "Carol" {
		t.Errorf("name = %v, want Carol (untouched)", member["name"])
	}
	if got["note"] != "kept" {
		t.Errorf("note = %v, want kept (untouched)", got["note"])
	}
	if strings.Contains(string(out), "@example.com") {
		t.Errorf("redacted body still contains an email address: %s", out)
	}
}

func TestRedactSecretsRedactsDocumentStylePayloads(t *testing.T) {
	body := []byte(`{
		"operations":[{
			"mark":{"attrs":{"href":"javascript:alert(1)","family":"Arial;background:url(x)","value":"red;evil"}},
			"customTypography":{"fontFamily":"Bad;Font","fontSize":"calc(100vw)","fg":"bad","bg":"bad"}
		}]
	}`)
	out := redactSecrets(body)
	for _, unsafe := range []string{"javascript", "background:url", "calc(100vw)", "Bad;Font", "red;evil"} {
		if strings.Contains(string(out), unsafe) {
			t.Errorf("style value %q remained in request log: %s", unsafe, out)
		}
	}
	if got := strings.Count(string(out), "[REDACTED]"); got != 7 {
		t.Errorf("redacted values = %d, want 7: %s", got, out)
	}
}
