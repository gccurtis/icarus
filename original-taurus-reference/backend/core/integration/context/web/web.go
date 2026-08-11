// Package web implements the agent.WebRetriever port against a JSON web-search
// endpoint. The agent capability sees only provider-neutral WebResults; the HTTP
// call, the API key, and the response shape stop here. Every request is bounded
// — query length, result count, a response-body size cap, and an HTTPS-only
// endpoint — so a single web lookup can neither run away nor reach a private
// address over plain HTTP.
package web

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/agent"
)

// Bounds applied to every search.
const (
	maxQueryLen    = 512
	maxResultsCap  = 10
	defaultResults = 5
	maxBodyBytes   = 1 << 20 // 1 MiB
	defaultTimeout = 10 * time.Second
	maxRedirects   = 5
)

// Doer is the minimal HTTP contract the client needs, so tests can inject a fake.
type Doer interface {
	Do(*http.Request) (*http.Response, error)
}

// Options configure the client. Endpoint must be an https URL that answers a
// `q`/`count` query with {"results":[{title,url,snippet}]}.
type Options struct {
	Endpoint   string
	APIKey     string
	HTTPClient Doer
	MaxResults int
}

// Client is a bounded web-search retriever.
type Client struct {
	endpoint   string
	apiKey     string
	http       Doer
	maxResults int
}

// New validates the options and constructs a client. The endpoint is required
// and must be HTTPS.
func New(opts Options) (*Client, error) {
	endpoint := strings.TrimSpace(opts.Endpoint)
	if endpoint == "" {
		return nil, errors.New("web: endpoint is required")
	}
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return nil, errors.New("web: endpoint must be a valid https URL")
	}
	max := opts.MaxResults
	if max < 1 || max > maxResultsCap {
		max = maxResultsCap
	}
	doer := opts.HTTPClient
	if doer == nil {
		doer = &http.Client{
			Timeout: defaultTimeout,
			// Never follow a redirect to a non-HTTPS target, so a hostile or
			// compromised search endpoint cannot bounce the request to an internal
			// address over plain HTTP.
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= maxRedirects {
					return errors.New("web: too many redirects")
				}
				if req.URL.Scheme != "https" {
					return errors.New("web: refusing to follow a non-HTTPS redirect")
				}
				return nil
			},
		}
	}
	return &Client{endpoint: endpoint, apiKey: strings.TrimSpace(opts.APIKey), http: doer, maxResults: max}, nil
}

// searchResponse is the JSON contract expected from the endpoint.
type searchResponse struct {
	Results []struct {
		Title   string `json:"title"`
		URL     string `json:"url"`
		Snippet string `json:"snippet"`
	} `json:"results"`
}

// SearchWeb implements agent.WebRetriever: it issues one bounded search and maps
// the response into provider-neutral results.
func (c *Client) SearchWeb(ctx context.Context, query string, limit int) ([]agent.WebResult, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, errors.New("web: query is required")
	}
	if len(query) > maxQueryLen {
		query = query[:maxQueryLen]
	}
	if limit < 1 {
		limit = defaultResults
	}
	if limit > c.maxResults {
		limit = c.maxResults
	}

	u, err := url.Parse(c.endpoint)
	if err != nil {
		return nil, err
	}
	q := u.Query()
	q.Set("q", query)
	q.Set("count", strconv.Itoa(limit))
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("web: search returned status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return nil, err
	}
	var parsed searchResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("web: decode response: %w", err)
	}
	results := make([]agent.WebResult, 0, len(parsed.Results))
	for _, r := range parsed.Results {
		if strings.TrimSpace(r.Title) == "" && strings.TrimSpace(r.Snippet) == "" {
			continue
		}
		results = append(results, agent.WebResult{Title: r.Title, URL: r.URL, Snippet: r.Snippet})
		if len(results) >= limit {
			break
		}
	}
	return results, nil
}

// Ensure the client satisfies the port at compile time.
var _ agent.WebRetriever = (*Client)(nil)
