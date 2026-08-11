# 0006 — Intelligence service (OpenRouter)

The core had no way to reach a model provider. This adds the **intelligence**
capability: the single application boundary to embedding and model providers,
with **OpenRouter** as the first backend. The shape, settled with the user, is a
*utility service* — callers ask for a semantic **cast** `(purpose, strength,
speed, cost)` and never name a model; configuration maps each cast to a concrete
provider and model, per endpoint kind. It exposes three endpoint kinds —
**reasoning**, **inference**, and **embedding** — with reasoning and inference
each gaining a structured (JSON-schema-constrained) variant.

Deliberately out of this first slice (present in `docs/reference/capabilities/intelligence.md`
but deferred): tool calls, multi-turn continuation, usage reservations and
budgets, provider health/admission, and streaming. What ships is cast → provider
resolution and the three call shapes, exercised end-to-end.

Design decisions locked with the user: casts are keyed on three-level axes
(`low|medium|high`) plus a `purpose` (`general` only, for now); resolution is
**exact-match with no fallback** (an unconfigured cast errors clearly); providers
are pluggable behind one interface; and the API key lives in configuration but is
kept out of git via a **base + local overlay** (a gitignored `etc/config.local.yaml`
overlaid on the committed template).

## core/intelligence (new package)

### provider.go — Provider interface and neutral wire types

The seam that makes the service provider-agnostic: the service speaks only these
types, never anything vendor-specific.

```go
type Provider interface {
	Name() string
	Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)   // backs reasoning + inference
	Embed(ctx context.Context, req EmbeddingRequest) (EmbeddingResponse, error)
}
```

**What it does:** defines `Provider` plus `Message`, `Usage`, and the
chat/embedding request/response wrappers. `ChatRequest.Schema` (a `json.RawMessage`)
carries structured-output intent. **Goal:** let a new backend be a single file
implementing this interface. **Why:** the user asked for OpenRouter now but easy
support for other providers later; a narrow two-method interface is the cheapest
way to keep that door open. The doc comment also fixes the rule that an
implementation must never put its credential in a returned error.

### intelligence.go — service, casts, resolution, the five methods

The heart of the package: cast types, the per-kind routing tables, and the public
API.

```go
func (in *Intelligence) Reason(ctx, req) (Result, error)       // messages -> text (reasoning table)
func (in *Intelligence) ReasonJSON(ctx, req, schema) (...)     // reasoning, schema-constrained
func (in *Intelligence) Infer(ctx, req) (Result, error)        // messages -> text (inference table)
func (in *Intelligence) InferJSON(ctx, req, schema) (...)      // inference, schema-constrained
func (in *Intelligence) Embed(ctx, req) (EmbedResult, error)   // strings -> vectors
```

**What it does:** `New` flattens configured routes into `map[Kind]map[Cast]Route`
for O(1) exact-match lookup and rejects any route naming an unknown provider at
construction. All plain/structured reasoning/inference calls funnel through one
private `generate` method (resolve cast → `Chat` → package as `Text`, or validate
and return `JSON`); `Embed` mirrors it against the embedding table. **Goal:**
identical behaviour across variants apart from cast table and output shape, and a
misconfiguration that surfaces at startup rather than on first request. **Why:**
the user chose fixed casts by dimension with a model for every combination and
structured output for *both* reason and infer — a shared path keeps the four
generate variants honest and testable as one unit. `ErrNoCast` /
`ErrProviderNotConfigured` are the sentinels the HTTP layer maps to statuses.

### openrouter.go — the first Provider implementation

Speaks OpenRouter's OpenAI-compatible chat-completions and embeddings endpoints.

```go
func NewOpenRouter(apiKey, baseURL string) Provider {
	if baseURL == "" { baseURL = openRouterDefaultBaseURL }
	return &openRouter{apiKey: apiKey, baseURL: strings.TrimRight(baseURL, "/"),
		client: &http.Client{Timeout: 60 * time.Second}}
}
```

**What it does:** a shared `post` helper sets bearer auth + attribution headers,
checks status, and decodes; `Chat` wraps a present schema in a `json_schema`
`response_format`; `Embed` posts `{model, input}`. A blank key yields a working
value whose calls return `ErrProviderNotConfigured` before any network I/O.
**Goal:** real calls when a key is present, graceful "unavailable" when not, and a
key that never leaks. **Why:** the committed manifest ships with a blank key, so
the server (and its dev-test) must start and behave sensibly without one;
`openRouterError` extracts the provider's message but structurally cannot include
the key (it travels only in the request header).

### intelligence_test.go / openrouter_test.go — unit tests (no key, CI-safe)

```go
func TestInferResolvesToInferenceModel(t *testing.T) { /* reasoning vs inference use separate tables */ }
func TestStructuredForwardsSchemaAndReturnsJSON(t *testing.T) { /* both ReasonJSON and InferJSON */ }
func TestOpenRouterErrorResponse(t *testing.T) { /* asserts the key is not in the error */ }
```

**What it does:** `intelligence_test.go` drives the service with a fake `Provider`
(cast resolution, the separate reasoning/inference tables, the shared structured
path, `ErrNoCast`, unknown-provider rejection, blank-purpose defaulting).
`openrouter_test.go` drives the provider against an `httptest` stub (request URL,
auth header, body, `response_format`, response mapping, no-key behaviour, error
sanitization). **Goal / why:** the user asked for both unit (stub) and live
testing; these are the fast, keyless half that runs anywhere.

## core/application/intelligence (new package)

### intelligence.go — gated HTTP handlers

The application-layer adapter, in the same role as the `auth`/`document`/`job`
application packages.

```go
func (h Handlers) Reason(_ access.Context, req endpoint.Request) endpoint.Response {
	// bind {cast, messages, schema?}; a present schema -> ReasonJSON, else Reason
}
func errFor(err error) endpoint.Response { /* ErrNoCast->400, ErrProviderNotConfigured->503, else 502 */ }
```

**What it does:** binds the request bodies, dispatches to the plain or structured
service method by whether a `schema` was sent, and maps outcomes onto responses
(`text` vs `json`, always with `usage`). **Goal:** keep transport-agnostic and
own the error-to-status mapping. **Why:** the codebase separates domain services
from their endpoint adapters; the catch-all maps to 502 with a *generic* message
so upstream detail is never echoed to callers. (Provider calls use
`context.Background()` — the `endpoint.Request` contract carries no context yet;
noted as a known first-slice limit.)

## core/config/config.go

### Intelligence schema

```go
type Intelligence struct {
	Providers map[string]Provider `yaml:"providers"`
	Casts     Casts               `yaml:"casts"`  // Reasoning / Inference / Embedding []Cast
}
```

**What it does:** adds the `intelligence` section — a name-keyed provider map
(`api_key`, `base_url`) and per-kind cast tables whose rows key
`(purpose, strength, speed, cost)` to `provider` + `model`. **Goal / why:** mirror
the manifest one-to-one (the package's existing convention) and let the
composition root translate rows into service routes.

### Overlay and LocalPath — base + local overlay

```go
func Overlay(cfg Config, path string) (Config, error) { /* missing file is not an error */ }
func LocalPath(path string) string { /* etc/config.yaml -> etc/config.local.yaml */ }
```

**What it does:** extends the defaults-plus-overlay model to a second, optional
file, and derives its sibling `…local` path. **Goal:** a committed template that
never carries a secret, plus a gitignored file that does. **Why:** the user wanted
the key in configuration but confirmed `etc/config.yaml` is tracked; the user chose
the overlay approach so the personal file stays tiny and out of git, with no
environment variable for the key.

## core/transport/transport.go

### Intelligence option and routes

```go
if opts.Intelligence != nil {
	intel := intelligenceapp.NewHandlers(opts.Intelligence)
	gated.POST("/intelligence/reason", s.adaptScoped(intel.Reason))
	gated.POST("/intelligence/infer", s.adaptScoped(intel.Infer))
	gated.POST("/intelligence/embed", s.adaptScoped(intel.Embed))
}
```

**What it does:** adds `Intelligence *intelligence.Intelligence` to `Options` and
registers the three routes in the **gated** group (signed-in user required, no
project needed), guarded so they only exist when a service was supplied. **Goal /
why:** expose the service the same way everything else is tested — over gated
HTTP — while keeping `New` usable in tests/compositions that omit intelligence.

## core/composition/composition.go

### Local overlay in loadConfig

```go
localPath := config.LocalPath(path)
if _, statErr := os.Stat(localPath); statErr == nil {
	cfg, err = config.Overlay(cfg, localPath)   // fatal on parse error
	log.Printf("config: overlaid %s", localPath)
}
```

**What it does:** after loading the base manifest, overlays an optional sibling
`…local` file. **Goal / why:** drive the base + local overlay so secrets load at
startup; a missing local file is silently skipped so the core still runs.

### buildIntelligence and wiring

```go
func buildIntelligence(cfg config.Config) *intelligence.Intelligence {
	// switch on provider name -> NewOpenRouter; castRoutes() per kind; intelligence.New (fatal on bad ref)
}
// in Run:
intel := buildIntelligence(cfg)
e := transport.New(transport.Options{ /* ..., */ Intelligence: intel, /* ... */ })
```

**What it does:** instantiates each configured provider (unknown name is fatal),
turns the three cast tables into routes, constructs the service (validating
provider references), and injects it into the transport. **Goal / why:** the
composition root holds the knowledge of *which* concrete providers exist, so the
intelligence package stays provider-agnostic; a blank key is not fatal, so the
core serves with or without one.

## etc/config.yaml

### intelligence section (committed template)

**What it does:** adds the `intelligence` block with a blank `openrouter.api_key`,
a default `base_url`, and cast tables for all three kinds that default to
**cost-efficient models** — DeepSeek for the mid/upper tiers and small OpenAI
models for the cheap tier, stepping up only where the cast is not the low tier.
**Goal / why:** document the schema and give a sensible, low-cost default while
keeping the key out of git; the slugs are OpenRouter slugs, to confirm against its
current catalogue.

## .gitignore

### /etc/config.local.yaml

**What it does / why:** ignores the local overlay file so the OpenRouter key is
never committed.

## dev-test

### lib.sh — DEV_TEST_EXTRA_CONFIG hook

```sh
if [[ -n "${DEV_TEST_EXTRA_CONFIG:-}" ]]; then
  printf '%s\n' "$DEV_TEST_EXTRA_CONFIG" >>"$cfg"
fi
```

**What it does:** lets a suite append extra manifest sections to the generated
test config. **Goal / why:** the intelligence suite needs a provider + cast in the
manifest; a backward-compatible, opt-in hook avoids duplicating `start_service`.

### intelligence/{run.sh, manual.md} — the live/offline dev-test

**What it does:** injects an inference cast, then asserts the endpoints are gated
(401), an unconfigured cast is refused (400), and — depending on whether a key is
found in `etc/config.local.yaml` — either a real call returns 200 with text or a
configured cast reports the provider unavailable (503). `manual.md` is the by-hand
walkthrough (including structured output and embeddings). **Goal / why:** the user
asked for both stubbed unit tests and a live dev-test; this suite is meaningful
offline (CI-safe) and upgrades to a real OpenRouter call when a key is present.
