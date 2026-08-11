// Package intelligence is the application's single boundary to model providers.
// Callers ask for a semantic cast — a tier expressed as (purpose, strength,
// speed, cost) — and never name a model; configuration maps each cast to a
// concrete provider and model, per endpoint kind. That keeps the rest of the
// system free of provider, model, and credential mechanics.
//
// It exposes three endpoint kinds. Reasoning and inference both turn a list of
// messages into text, and each also has a structured variant (…JSON) that
// constrains the output to a caller-supplied JSON schema; they differ only in
// intent and in which cast table they resolve against. Reasoning also has the
// bounded ReasonWithTools continuation loop over a fixed application tool set.
// Embedding turns a batch of strings into vectors.
package intelligence

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// Kind names an endpoint kind. Each kind has its own cast table, so the
// strength/speed/cost tradeoffs can differ between, say, reasoning and
// embedding.
type Kind string

const (
	KindReasoning Kind = "reasoning"
	KindInference Kind = "inference"
	KindEmbedding Kind = "embedding"
)

// purposeGeneral is the only purpose supported for now. A cast with an empty
// purpose is treated as general, leaving room for image and other purposes
// later without breaking existing callers.
const purposeGeneral = "general"

// Cast is the semantic selector a caller passes instead of a model. Purpose is
// "general" for now; Strength, Speed, and Cost are each "low", "medium", or
// "high". A cast resolves by exact match against the configured table for its
// endpoint kind — there is no solver and no nearest-neighbour fallback.
type Cast struct {
	Purpose  string
	Strength string
	Speed    string
	Cost     string
}

// normalized fills in the default purpose so an omitted purpose still matches a
// configured "general" row.
func (c Cast) normalized() Cast {
	if c.Purpose == "" {
		c.Purpose = purposeGeneral
	}
	return c
}

// String renders the cast as purpose/strength/speed/cost, used in errors.
func (c Cast) String() string {
	return fmt.Sprintf("%s/%s/%s/%s", c.Purpose, c.Strength, c.Speed, c.Cost)
}

// Route maps a single cast to the provider and model that serve it.
type Route struct {
	Cast     Cast
	Provider string
	Model    string
	// Effort optionally pins how much reasoning the provider should spend on
	// this route (OpenRouter's reasoning.effort: "low"|"medium"|"high"). It
	// belongs to the route rather than the request because it is part of the
	// model choice: the same cast can be served by a cheap model told to think
	// harder, and callers ask for a cast, never for a model or a budget. Empty
	// leaves the provider's default alone.
	Effort string
}

// ErrNoCast is returned when a requested cast has no configured model for its
// endpoint kind. ErrProviderNotConfigured is returned when the resolved provider
// has no credential (e.g. the key was left blank).
// ErrRateLimited is returned by a provider that is refusing work for pace rather
// than for cause. It is distinguished from every other failure because the
// response is different in kind: a bad request will fail again immediately, but
// a rate limit is a request to wait, and waiting is the only thing that resolves
// it. Adapters wrap it around a provider's own message so the cause survives.
// ErrProviderTimeout is returned when a provider did not answer inside the
// deadline the provider itself was given. It exists because that failure is
// otherwise indistinguishable from the caller giving up: an http.Client's own
// Timeout surfaces as an error satisfying errors.Is(err, context.DeadlineExceeded),
// exactly like an expired caller context. The two call for opposite responses —
// abandon the caller's, retry the provider's — so the adapter that knows which one
// happened has to say so.
var (
	ErrNoCast                = errors.New("no model configured for cast")
	ErrProviderNotConfigured = errors.New("intelligence provider not configured")
	ErrRateLimited           = errors.New("intelligence provider is rate limiting")
	ErrProviderTimeout       = errors.New("intelligence provider timed out")
)

// RateLimited is a rate limit that carries what the provider asked for. A 429 may
// come with a Retry-After header, and honouring it is strictly better than
// guessing: the provider knows when its window resets and we do not.
//
// It unwraps to ErrRateLimited so every existing errors.Is check keeps working,
// and so an adapter that has no delay to report can still return the bare
// sentinel.
type RateLimited struct {
	// RetryAfter is the delay the provider asked for; zero means it did not say,
	// and the caller falls back to its own backoff.
	RetryAfter time.Duration
	// Provider names who refused, and Detail carries their message.
	Provider string
	Detail   string
}

func (e *RateLimited) Error() string {
	parts := make([]string, 0, 4)
	if e.Provider != "" {
		parts = append(parts, e.Provider)
	}
	parts = append(parts, ErrRateLimited.Error())
	if e.RetryAfter > 0 {
		parts = append(parts, "retry after "+e.RetryAfter.String())
	}
	if e.Detail != "" {
		parts = append(parts, e.Detail)
	}
	return strings.Join(parts, ": ")
}

// Unwrap is what keeps errors.Is(err, ErrRateLimited) true for this type.
func (e *RateLimited) Unwrap() error { return ErrRateLimited }

// retryAfterFrom reports the delay a provider asked for, or zero when it asked
// for none (or the failure was not a rate limit at all).
func retryAfterFrom(err error) time.Duration {
	var rl *RateLimited
	if errors.As(err, &rl) {
		return rl.RetryAfter
	}
	return 0
}

// pacedRetry reports whether waiting is the response a failure calls for.
//
// Two failures qualify, and they are the same problem seen from two sides. A rate
// limit is the provider saying "too fast"; a provider timeout is the provider
// being too loaded to answer in time. Both resolve by waiting and both happen
// exactly when load is highest — which is precisely when retrying immediately is
// the worst available move.
func pacedRetry(err error) bool {
	return errors.Is(err, ErrRateLimited) || errors.Is(err, ErrProviderTimeout)
}

// ReasonRequest and InferRequest carry a cast and the messages to send. Their
// distinct types keep call sites self-documenting even though the payloads
// match.
type (
	ReasonRequest struct {
		Cast     Cast
		Messages []Message
	}
	InferRequest struct {
		Cast     Cast
		Messages []Message
	}
	// EmbedRequest carries a cast and the batch of strings to embed.
	EmbedRequest struct {
		Cast   Cast
		Inputs []string
	}
)

// Result is a reasoning or inference outcome. For a plain call Text is set; for
// a structured (…JSON) call JSON holds the schema-constrained output. Usage
// reports the provider's token counts.
type Result struct {
	Text  string
	JSON  json.RawMessage
	Usage Usage
}

// EmbedResult is an embedding outcome: one vector per input, in order, plus the
// provider and model the cast resolved to — the vector-space identity a caller
// needs to know which embeddings are comparable.
type EmbedResult struct {
	Vectors  [][]float64
	Provider string
	Model    string
	Usage    Usage
}

// PartialEmbeddingError reports the completed prefix of a chunked embedding
// call. Earlier provider chunks may have succeeded and been billed before a
// later one refused, so returning only the final error would make real spend
// disappear exactly when a retry is most likely.
type PartialEmbeddingError struct {
	CompletedInputs int
	Usage           Usage
	Cause           error
}

func (e *PartialEmbeddingError) Error() string {
	if e == nil || e.Cause == nil {
		return "embedding stopped after a partial result"
	}
	return fmt.Sprintf("embedding stopped after %d completed input(s): %v", e.CompletedInputs, e.Cause)
}

func (e *PartialEmbeddingError) Unwrap() error { return e.Cause }

// Options configure a new Intelligence: the providers it can dispatch to, keyed
// by name, and the cast routes per endpoint kind.
type Options struct {
	Providers map[string]Provider
	Routes    map[Kind][]Route
	// Telemetry, when set, receives one event per provider call. Nil disables
	// measurement without changing behaviour, so focused tests need not supply it.
	Telemetry Telemetry
	// Embedding bounds how an embedding batch is split and paced.
	Embedding EmbeddingOptions
}

// EmbeddingOptions bound one embedding batch's provider traffic: how many inputs
// may travel in a single request, how long one chunk may spend waiting out a
// provider that is refusing or too slow, and the delay it waits when the provider
// gives no delay of its own. Zero values take the defaults.
type EmbeddingOptions struct {
	// MaxBatchInputs is the most inputs one provider request may carry.
	MaxBatchInputs int
	// MaxWait is the total time one chunk may spend waiting before it gives up.
	//
	// It is a time budget rather than an attempt count because patience is what the
	// situation actually calls for. Rate limits are enforced over a window — a
	// minute, typically — so "how many times to try" only bounds the wait by
	// accident: four attempts at a doubling second is seven seconds of patience
	// against a sixty-second window, which is not patience at all. Saying ninety
	// seconds says the thing that was meant.
	MaxWait time.Duration
	// Backoff is the delay before the first paced retry, doubled per retry. It is
	// the fallback for a provider that refuses without saying for how long; one
	// that sends Retry-After is honoured instead.
	Backoff time.Duration
}

// CallEvent is one measured provider call, reported to Telemetry whether the call
// succeeded or failed. It is defined here, rather than imported from the platform
// telemetry package, so this capability keeps depending on nothing outside
// itself; the composition layer adapts it to the central sink.
type CallEvent struct {
	Operation string
	// Subject attributes the call to the unit of work that caused it (a task, a
	// chat turn, a prompt block), empty for a call made outside one.
	Subject  string
	Cast     string
	Provider string
	Model    string
	Effort   string
	Duration time.Duration
	// ToolDuration is the share of Duration spent inside tool handlers rather than
	// waiting on the provider. Set only for a tool loop; it is what lets a slow run
	// be attributed to the model or to our own work.
	ToolDuration time.Duration
	Usage        Usage
	// Attempt is the 1-based position in the cast's candidate list. Above 1 means
	// a fallback absorbed a failure the response itself will not show.
	Attempt int
	// Rounds and Calls are set only for a tool loop.
	Rounds int
	Calls  int
	Err    string
}

// Telemetry receives a measurement for every provider call this capability makes.
// It is a narrow port rather than a direct dependency for the same reason the
// provider interface is: this package is the boundary to the outside world, and
// what happens to a measurement is not its concern.
//
// This is the only place in the system where model latency, per-call cost, the
// model that actually served a request, and a tool loop's shape are all known at
// once — so it is the only place they can be reported together.
type Telemetry interface {
	RecordCall(CallEvent)
}

// record reports one measured call, tolerating an absent recorder so every call
// site can measure unconditionally.
func (in *Intelligence) record(event CallEvent) {
	if in.telemetry == nil {
		return
	}
	in.telemetry.RecordCall(event)
}

// Intelligence resolves casts to providers and dispatches calls. It is safe for
// concurrent use: it is read-only after construction.
type Intelligence struct {
	providers map[string]Provider
	// routes maps a cast to an ORDERED list of candidate routes. The first is the
	// primary; any later ones are fallbacks tried, in order, when an earlier
	// candidate's provider call fails for a reason other than the caller giving up
	// (context cancellation/deadline). Configuration expresses a fallback simply by
	// listing more than one route for the same cast.
	routes map[Kind]map[Cast][]Route
	// telemetry receives one event per provider call; nil disables measurement.
	telemetry Telemetry
	// embedding bounds how an embedding batch is chunked, retried and paced.
	embedding EmbeddingOptions
}

// maxBatchInputs is the configured chunk size, or the default.
func (in *Intelligence) maxBatchInputs() int {
	if in.embedding.MaxBatchInputs > 0 {
		return in.embedding.MaxBatchInputs
	}
	return defaultMaxBatchInputs
}

// embedMaxWait is the configured per-chunk wait budget, or the default.
func (in *Intelligence) embedMaxWait() time.Duration {
	if in.embedding.MaxWait > 0 {
		return in.embedding.MaxWait
	}
	return defaultEmbedMaxWait
}

// embedBackoff is the configured first-retry delay, or the default.
func (in *Intelligence) embedBackoff() time.Duration {
	if in.embedding.Backoff > 0 {
		return in.embedding.Backoff
	}
	return defaultEmbedBackoff
}

// waitFor sleeps d, or returns early if the caller's context ends first. It
// honours the context rather than sleeping blindly: a wait can be a minute long,
// and a request whose caller has already given up should not hold a slot for the
// whole of it.
func (in *Intelligence) waitFor(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// New builds an Intelligence from its options. It indexes every route by its
// normalized cast for O(1) lookup, preserving configuration order so the first
// route for a cast is its primary and the rest are ordered fallbacks. It fails if
// any route names a provider that was not supplied, so a misconfiguration
// surfaces at startup rather than on the first request.
func New(opts Options) (*Intelligence, error) {
	in := &Intelligence{
		providers: opts.Providers,
		routes:    make(map[Kind]map[Cast][]Route),
		telemetry: opts.Telemetry,
		embedding: opts.Embedding,
	}
	if in.providers == nil {
		in.providers = map[string]Provider{}
	}
	providerNames := make(map[string]string, len(in.providers))
	for name, provider := range in.providers {
		if strings.TrimSpace(name) == "" {
			return nil, errors.New("intelligence: provider key is required")
		}
		if provider == nil || (reflect.ValueOf(provider).Kind() == reflect.Pointer && reflect.ValueOf(provider).IsNil()) {
			return nil, fmt.Errorf("intelligence: provider %q is nil", name)
		}
		reportedName := strings.TrimSpace(provider.Name())
		if reportedName == "" {
			return nil, fmt.Errorf("intelligence: provider %q has no name", name)
		}
		if prior, exists := providerNames[reportedName]; exists {
			return nil, fmt.Errorf("intelligence: providers %q and %q both report name %q", prior, name, reportedName)
		}
		providerNames[reportedName] = name
	}
	for kind, routes := range opts.Routes {
		table := make(map[Cast][]Route, len(routes))
		for _, r := range routes {
			if _, ok := in.providers[r.Provider]; !ok {
				return nil, fmt.Errorf("intelligence: %s cast %s references unknown provider %q", kind, r.Cast, r.Provider)
			}
			cast := r.Cast.normalized()
			// Embedding casts get no fallbacks: every stored source records the
			// model identity it was embedded with, and vectors from different
			// models live in different spaces — a fall-over would embed queries in
			// a space the corpus is not in, silently matching nothing. Reject the
			// configuration at startup, where it is loud.
			if kind == KindEmbedding && len(table[cast]) > 0 {
				return nil, fmt.Errorf("intelligence: embedding cast %s has more than one route; embedding casts must not have fallbacks (vectors from different models are incomparable)", cast)
			}
			table[cast] = append(table[cast], r)
		}
		in.routes[kind] = table
	}
	return in, nil
}

// shouldFallover reports whether a failed provider call should advance to the
// next candidate route. Every real provider failure (a bad request, a rate
// limit, a provider outage) is worth trying the next model for; only the caller
// abandoning the request (a cancelled or timed-out context) is not, since a
// fallback would race the same deadline.
//
// ErrProviderTimeout is checked FIRST, and that order is the whole point. A
// provider's own client timeout surfaces as an error satisfying
// errors.Is(err, context.DeadlineExceeded) — identical in shape to the caller's
// context expiring — so without this arm the deadline check below claimed it and
// every slow provider aborted with no retry and no fallback, at exactly the moment
// load was highest. The adapter is the only layer that can tell the two apart, and
// this is where its answer is read.
func shouldFallover(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, ErrProviderTimeout) {
		return true
	}
	return !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded)
}

// Reason turns messages into text using the reasoning cast table.
func (in *Intelligence) Reason(ctx context.Context, req ReasonRequest) (Result, error) {
	return in.generate(ctx, KindReasoning, req.Cast, req.Messages, nil)
}

// ReasonJSON is Reason with output constrained to the given JSON schema. An
// empty schema falls back to a permissive object schema.
func (in *Intelligence) ReasonJSON(ctx context.Context, req ReasonRequest, schema json.RawMessage) (Result, error) {
	return in.generate(ctx, KindReasoning, req.Cast, req.Messages, ensureSchema(schema))
}

// Infer turns messages into text using the inference cast table.
func (in *Intelligence) Infer(ctx context.Context, req InferRequest) (Result, error) {
	return in.generate(ctx, KindInference, req.Cast, req.Messages, nil)
}

// InferJSON is Infer with output constrained to the given JSON schema. An empty
// schema falls back to a permissive object schema.
func (in *Intelligence) InferJSON(ctx context.Context, req InferRequest, schema json.RawMessage) (Result, error) {
	return in.generate(ctx, KindInference, req.Cast, req.Messages, ensureSchema(schema))
}

// Embed turns a batch of strings into vectors using the embedding cast table.
//
// It splits the batch into chunks of at most maxBatchInputs and makes one
// provider call per chunk, concatenating the vectors in input order and summing
// the usage. There is deliberately no separate "batched" entry point: a single
// input is one chunk and behaves exactly as an unchunked call, so every caller
// gets the right pacing without choosing it — and no caller can choose wrong.
//
// The reason it matters is arithmetic. A caller with thousands of windows either
// sends one request too large for the provider to accept, or (the shape this
// replaced) one request per source in a tight loop, which is what a rate limit is
// for. Chunking is the only version that is bounded in both directions.
func (in *Intelligence) Embed(ctx context.Context, req EmbedRequest) (EmbedResult, error) {
	if len(req.Inputs) == 0 {
		return EmbedResult{}, nil
	}
	size := in.maxBatchInputs()

	var out EmbedResult
	out.Vectors = make([][]float64, 0, len(req.Inputs))
	for start := 0; start < len(req.Inputs); start += size {
		end := min(start+size, len(req.Inputs))
		chunk, err := in.embedChunk(ctx, req.Cast, req.Inputs[start:end])
		if err != nil {
			if len(out.Vectors) > 0 {
				return out, &PartialEmbeddingError{
					CompletedInputs: len(out.Vectors), Usage: out.Usage, Cause: err,
				}
			}
			return EmbedResult{}, err
		}
		// Every chunk must resolve to the same route, or the vectors would span two
		// spaces and be silently incomparable. Embedding casts are single-route by
		// construction (New rejects a fallback), so this cannot drift — the identity
		// is simply carried from the first chunk.
		out.Provider, out.Model = chunk.Provider, chunk.Model
		out.Vectors = append(out.Vectors, chunk.Vectors...)
		out.Usage.PromptTokens += chunk.Usage.PromptTokens
		out.Usage.CompletionTokens += chunk.Usage.CompletionTokens
		out.Usage.ReasoningTokens += chunk.Usage.ReasoningTokens
		out.Usage.TotalTokens += chunk.Usage.TotalTokens
		out.Usage.CostUSD += chunk.Usage.CostUSD
		out.Usage.Requests++
	}
	return out, nil
}

// EmbeddingRoute returns the single configured provider/model behind an
// embedding cast. It exposes identity metadata only, never credentials.
func (in *Intelligence) EmbeddingRoute(cast Cast) (provider, model string, err error) {
	candidates, err := in.candidates(KindEmbedding, cast)
	if err != nil {
		return "", "", err
	}
	if len(candidates) != 1 {
		return "", "", fmt.Errorf("intelligence: embedding cast %s does not resolve to exactly one route", cast)
	}
	return candidates[0].Provider, candidates[0].Model, nil
}

// EmbedExact targets one configured provider/model identity directly. Durable
// Knowledge generations use it so a deployment cast change does not make the
// previous active generation unqueryable during an operator-controlled
// migration or rollback window. The provider must still be configured; this
// method never accepts credentials or creates an unentitled route.
func (in *Intelligence) EmbedExact(ctx context.Context, provider, model string, inputs []string) (EmbedResult, error) {
	if _, ok := in.providers[provider]; !ok || strings.TrimSpace(model) == "" {
		return EmbedResult{}, ErrProviderNotConfigured
	}
	identityCast := Cast{
		Purpose: "__embedding_identity__", Strength: provider,
		Speed: model, Cost: "pinned",
	}
	clone := *in
	clone.routes = map[Kind]map[Cast][]Route{
		KindEmbedding: {
			identityCast.normalized(): {{
				Cast: identityCast, Provider: provider, Model: model,
			}},
		},
	}
	return clone.Embed(ctx, EmbedRequest{Cast: identityCast, Inputs: inputs})
}

// defaultMaxBatchInputs bounds one embedding provider request when configuration
// sets no size. 96 windows of ~1000 tokens is ~96k tokens per request, well
// inside typical per-request token caps, while still collapsing a large ingest
// into few enough requests to stay under a per-minute request limit.
const defaultMaxBatchInputs = 96

// embedChunk resolves the cast and makes the provider calls for ONE chunk. It is
// the whole of the previous Embed body: route candidates, the same-model retry,
// and the one-vector-per-input check.
func (in *Intelligence) embedChunk(ctx context.Context, cast Cast, inputs []string) (EmbedResult, error) {
	req := EmbedRequest{Cast: cast, Inputs: inputs}
	candidates, err := in.candidates(KindEmbedding, req.Cast)
	if err != nil {
		return EmbedResult{}, err
	}
	var lastErr error
	for routeIndex, r := range candidates {
		event := CallEvent{
			Operation: string(KindEmbedding), Subject: subjectFrom(ctx), Cast: req.Cast.String(),
			Provider: r.Provider, Model: r.Model, Attempt: routeIndex + 1,
		}
		started := time.Now()
		// Embedding casts have no fallback by design (a second model would embed
		// into a different space), so a transient answer has to be retried on the
		// SAME model or not at all. Two failures get retried, on different terms,
		// because they are asking for different things.
		//
		// A HICCUP — an empty or short vector list, or a one-off provider error — is
		// re-asked immediately and once. A provider that answers wrongly on one call
		// and correctly on the next is having a moment, not broken, and re-embedding
		// the same inputs is side-effect free. Waiting would buy nothing.
		//
		// A RATE LIMIT or a PROVIDER TIMEOUT is waited out against a time budget:
		// the provider's own Retry-After when it sent one, otherwise a doubling
		// backoff, until the accumulated wait would exceed MaxWait. Both are the
		// provider saying it cannot serve this right now, and waiting is the only
		// thing that answers that.
		var resp EmbeddingResponse
		var callErr error
		budget := in.embedMaxWait()
		var waited time.Duration
		paced, hiccups := 0, 0
		for {
			resp, callErr = in.providers[r.Provider].Embed(ctx, EmbeddingRequest{Model: r.Model, Inputs: req.Inputs})
			if callErr == nil && len(resp.Vectors) == len(req.Inputs) {
				break
			}
			if callErr != nil && !shouldFallover(callErr) {
				event.Duration, event.Err = time.Since(started), callErr.Error()
				in.record(event)
				return EmbedResult{}, callErr
			}
			if pacedRetry(callErr) {
				wait := retryAfterFrom(callErr)
				if wait <= 0 {
					wait = in.embedBackoff() << paced
				}
				// Out of patience — including when the provider asked for longer than
				// the whole budget. Honouring that request would hold the caller for
				// however long the provider named, which is exactly the unbounded wait
				// the budget exists to prevent. Give up and surface the rate limit, so
				// something above can decide to come back later.
				if waited+wait > budget {
					break
				}
				if waitErr := in.waitFor(ctx, wait); waitErr != nil {
					event.Duration, event.Err = time.Since(started), waitErr.Error()
					in.record(event)
					return EmbedResult{}, waitErr
				}
				waited += wait
				paced++
				continue
			}
			if hiccups >= embedHiccupRetries {
				break
			}
			hiccups++
		}
		// Measured across every attempt on purpose: a route that answers only after
		// waiting out a rate limit costs the caller the whole wait, and reporting
		// just the successful call would hide that.
		event.Duration = time.Since(started)
		if callErr != nil {
			lastErr = callErr
			event.Err = callErr.Error()
			in.record(event)
			if shouldFallover(callErr) {
				continue
			}
			return EmbedResult{}, callErr
		}
		// A provider owes exactly one vector per input. Returning fewer is a
		// failed call, not a partial success: callers pair inputs to vectors by
		// index, so a short list is read off the end — the knowledge lattice did
		// exactly that and panicked, turning a provider hiccup into an opaque
		// 500. Catch it here, where the provider's answer enters, and treat it
		// like any other provider failure so the next candidate is tried.
		if len(resp.Vectors) != len(req.Inputs) {
			lastErr = fmt.Errorf("intelligence: embedding model %q returned %d vector(s) for %d input(s)",
				r.Model, len(resp.Vectors), len(req.Inputs))
			event.Usage, event.Err = resp.Usage, lastErr.Error()
			in.record(event)
			continue
		}
		event.Usage = resp.Usage
		in.record(event)
		return EmbedResult{Vectors: resp.Vectors, Provider: r.Provider, Model: r.Model, Usage: resp.Usage}, nil
	}
	return EmbedResult{}, lastErr
}

// defaultEmbedMaxWait is how long one chunk may spend waiting out a provider that
// is refusing or too slow. A minute and a half, because rate limits are enforced
// over windows measured in minutes: anything materially shorter gives up before
// the window it is waiting for has even reset.
const defaultEmbedMaxWait = 90 * time.Second

// defaultEmbedBackoff is the delay before the first paced retry, doubled per
// retry, used when the provider does not say how long to wait.
const defaultEmbedBackoff = time.Second

// embedHiccupRetries is how many times a chunk is re-asked IMMEDIATELY after an
// answer that was wrong rather than refused — a short vector list, a one-off
// provider error.
//
// One is the right number and it is not a budget, which is why it is a constant
// and not configuration. A provider that answers correctly on the second ask was
// having a moment; one that fails twice in a row with no rate limit and no timeout
// is not going to be fixed by a third ask, and re-asking costs a full embedding
// request each time.
const embedHiccupRetries = 1

// generate is the shared reasoning/inference path: resolve the cast, dispatch a
// one-shot provider call, and package the result as text (no schema) or
// validated JSON (with a schema). Keeping it in one place is what makes the
// plain and structured variants behave identically apart from their cast table
// and output shape. Tool requests are accepted only by ReasonWithTools, where a
// fixed ToolSet and its limits are present.
func (in *Intelligence) generate(ctx context.Context, kind Kind, cast Cast, msgs []Message, schema json.RawMessage) (Result, error) {
	candidates, err := in.candidates(kind, cast)
	if err != nil {
		return Result{}, err
	}
	var lastErr error
	for attempt, r := range candidates {
		// Measured around the provider call alone, so the duration is the model's
		// response time and not this loop's bookkeeping. event is completed as the
		// call resolves and reported on every exit path below.
		event := CallEvent{
			Operation: string(kind), Subject: subjectFrom(ctx), Cast: cast.String(), Provider: r.Provider,
			Model: r.Model, Effort: r.Effort, Attempt: attempt + 1,
		}
		started := time.Now()
		var content string
		var usage Usage
		switch kind {
		case KindReasoning:
			resp, callErr := in.providers[r.Provider].Reasoning(ctx, ReasoningRequest{Model: r.Model, Messages: msgs, Schema: schema, Effort: r.Effort})
			event.Duration = time.Since(started)
			if callErr != nil {
				lastErr = callErr
				event.Err = callErr.Error()
				in.record(event)
				if shouldFallover(callErr) {
					continue
				}
				return Result{}, callErr
			}
			if len(resp.ToolCalls) > 0 {
				event.Err = ErrToolCallsNotEnabled.Error()
				in.record(event)
				return Result{}, ErrToolCallsNotEnabled
			}
			content, usage = resp.Content, resp.Usage
		case KindInference:
			resp, callErr := in.providers[r.Provider].Inference(ctx, InferenceRequest{Model: r.Model, Messages: msgs, Schema: schema, Effort: r.Effort})
			event.Duration = time.Since(started)
			if callErr != nil {
				lastErr = callErr
				event.Err = callErr.Error()
				in.record(event)
				if shouldFallover(callErr) {
					continue
				}
				return Result{}, callErr
			}
			content, usage = resp.Content, resp.Usage
		default:
			return Result{}, fmt.Errorf("intelligence: unsupported generate kind %q", kind)
		}
		event.Usage = usage
		res := Result{Usage: usage}
		if len(schema) == 0 {
			res.Text = content
			in.record(event)
			return res, nil
		}
		// An unusable structured response is a failed call like any other: record
		// it and try the next candidate. Treating it as fatal would skip the
		// fallback chain for the very failure a fallback is best placed to absorb
		// — a single bad sample from one model.
		payload, ok := extractJSON(content)
		if !ok {
			lastErr = fmt.Errorf("intelligence: %s model %q returned no usable JSON for a structured call: %s",
				kind, r.Model, truncateForError(content))
			// Recorded as a failure even though the provider returned 200: it spent
			// tokens and time and produced nothing usable, which is exactly the shape
			// of waste a per-call log exists to surface.
			event.Err = lastErr.Error()
			in.record(event)
			continue
		}
		res.JSON = payload
		in.record(event)
		return res, nil
	}
	return Result{}, lastErr
}

// extractJSON pulls the JSON value out of a structured response. Strict schema
// mode is requested on every structured call, but whether it is honoured
// depends on the upstream host serving the model, so responses arrive wrapped
// in a markdown fence or padded with a sentence often enough to matter. The
// value is right there in those cases; discarding the answer over its wrapper
// would fail a call the model actually got right. Anything that still does not
// parse is reported, not guessed at.
func extractJSON(content string) (json.RawMessage, bool) {
	trimmed := strings.TrimSpace(content)
	if json.Valid([]byte(trimmed)) {
		return json.RawMessage(trimmed), true
	}
	// A fenced block: ```json … ``` or ``` … ```.
	if fenced, found := strings.CutPrefix(trimmed, "```"); found {
		fenced = strings.TrimPrefix(fenced, "json")
		if end := strings.LastIndex(fenced, "```"); end >= 0 {
			fenced = strings.TrimSpace(fenced[:end])
			if json.Valid([]byte(fenced)) {
				return json.RawMessage(fenced), true
			}
		}
	}
	// Prose around a value: take the widest brace/bracket span and let
	// json.Valid decide — a span that does not parse is rejected, so this
	// cannot invent a payload that was not really there.
	for _, pair := range [][2]byte{{'{', '}'}, {'[', ']'}} {
		start, end := strings.IndexByte(trimmed, pair[0]), strings.LastIndexByte(trimmed, pair[1])
		if start >= 0 && end > start {
			if candidate := trimmed[start : end+1]; json.Valid([]byte(candidate)) {
				return json.RawMessage(candidate), true
			}
		}
	}
	return nil, false
}

// truncateForError bounds quoted provider content so an error stays readable
// while still showing what actually came back — without it, an unusable
// response is indistinguishable from any other and can only be diagnosed by
// re-running against the live provider.
func truncateForError(s string) string {
	const max = 200
	s = strings.TrimSpace(s)
	if s == "" {
		return "(empty response)"
	}
	if len(s) > max {
		return strconv.Quote(s[:max]) + "…"
	}
	return strconv.Quote(s)
}

// candidates returns the ordered candidate routes for a cast within an endpoint
// kind — the primary followed by any fallbacks — or ErrNoCast (naming the kind
// and cast) when none is configured.
func (in *Intelligence) candidates(kind Kind, cast Cast) ([]Route, error) {
	routes, ok := in.routes[kind][cast.normalized()]
	if !ok || len(routes) == 0 {
		return nil, fmt.Errorf("%w: %s cast %s", ErrNoCast, kind, cast.normalized())
	}
	return routes, nil
}

// ensureSchema guarantees a non-empty schema for the structured path: a blank
// schema becomes a permissive object schema, so a …JSON call always requests
// structured output while a plain call (nil schema) never does.
func ensureSchema(schema json.RawMessage) json.RawMessage {
	if len(bytes.TrimSpace(schema)) == 0 {
		return json.RawMessage(`{"type":"object"}`)
	}
	return schema
}
