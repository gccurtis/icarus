package web

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

// fakeDoer captures the request and returns a canned response.
type fakeDoer struct {
	lastReq *http.Request
	status  int
	body    string
	err     error
}

func (f *fakeDoer) Do(req *http.Request) (*http.Response, error) {
	f.lastReq = req
	if f.err != nil {
		return nil, f.err
	}
	status := f.status
	if status == 0 {
		status = 200
	}
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(strings.NewReader(f.body)),
		Header:     make(http.Header),
	}, nil
}

func newClient(t *testing.T, doer Doer) *Client {
	t.Helper()
	c, err := New(Options{Endpoint: "https://search.example/api", APIKey: "secret", HTTPClient: doer, MaxResults: 10})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return c
}

func TestSearchParsesResultsAndSendsBoundedQuery(t *testing.T) {
	doer := &fakeDoer{body: `{"results":[
		{"title":"Tides","url":"https://a.example","snippet":"about tides"},
		{"title":"Moon","url":"https://b.example","snippet":"about the moon"}
	]}`}
	c := newClient(t, doer)

	results, err := c.SearchWeb(context.Background(), "how tides work", 5)
	if err != nil {
		t.Fatalf("SearchWeb: %v", err)
	}
	if len(results) != 2 || results[0].Title != "Tides" || results[1].URL != "https://b.example" {
		t.Fatalf("unexpected results: %+v", results)
	}
	// The request carried the query, a bounded count, and the bearer key.
	q := doer.lastReq.URL.Query()
	if q.Get("q") != "how tides work" || q.Get("count") != "5" {
		t.Errorf("query params wrong: q=%q count=%q", q.Get("q"), q.Get("count"))
	}
	if doer.lastReq.Header.Get("Authorization") != "Bearer secret" {
		t.Errorf("auth header wrong: %q", doer.lastReq.Header.Get("Authorization"))
	}
}

func TestSearchClampsLimit(t *testing.T) {
	doer := &fakeDoer{body: `{"results":[]}`}
	c, _ := New(Options{Endpoint: "https://search.example/api", HTTPClient: doer, MaxResults: 3})
	if _, err := c.SearchWeb(context.Background(), "x", 99); err != nil {
		t.Fatalf("SearchWeb: %v", err)
	}
	if got := doer.lastReq.URL.Query().Get("count"); got != "3" {
		t.Errorf("count should clamp to MaxResults=3, got %q", got)
	}
}

func TestSearchDropsEmptyRows(t *testing.T) {
	doer := &fakeDoer{body: `{"results":[{"title":"","url":"","snippet":""},{"title":"Keep","url":"https://k","snippet":"s"}]}`}
	c := newClient(t, doer)
	results, err := c.SearchWeb(context.Background(), "q", 5)
	if err != nil {
		t.Fatalf("SearchWeb: %v", err)
	}
	if len(results) != 1 || results[0].Title != "Keep" {
		t.Errorf("empty rows should be dropped, got %+v", results)
	}
}

func TestSearchErrorStatus(t *testing.T) {
	c := newClient(t, &fakeDoer{status: 503, body: "unavailable"})
	if _, err := c.SearchWeb(context.Background(), "q", 5); err == nil {
		t.Errorf("non-2xx should error")
	}
}

func TestSearchEmptyQuery(t *testing.T) {
	c := newClient(t, &fakeDoer{body: `{"results":[]}`})
	if _, err := c.SearchWeb(context.Background(), "   ", 5); err == nil {
		t.Errorf("empty query should error")
	}
}

func TestNewRejectsNonHTTPS(t *testing.T) {
	if _, err := New(Options{Endpoint: "http://insecure.example/api"}); err == nil {
		t.Errorf("plain-http endpoint should be rejected")
	}
	if _, err := New(Options{Endpoint: ""}); err == nil {
		t.Errorf("empty endpoint should be rejected")
	}
}
