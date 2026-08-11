# Intelligence capability — OpenRouter connection (first slice)

Status: design approved, pending spec review
Date: 2026-07-19
Branch: `feat/intelligence`

## Purpose

Introduce the Intelligence utility service: the single application boundary to
model providers. Callers ask for a *cast* (a semantic tier), never a concrete
model; configuration maps casts to a provider and model. This first slice wires
up OpenRouter as the first provider and delivers three endpoint kinds —
**reasoning**, **inference**, and **embedding** — each usable in-process and over
gated HTTP so we can drive them end-to-end.

This is intentionally a small, working slice of the larger `docs/reference`
Intelligence vision. It follows the working agreement: build the smallest useful
piece, exercise it, then grow.

## Scope

In scope:

- A `core/intelligence` package exposing Reason, Infer, Embed — plus structured
  (JSON-schema-constrained) variants for Reason and Infer.
- A `Provider` interface and an OpenRouter implementation. Adding another
  provider later is one new file plus a config entry.
- Cast resolution from `(purpose, strength, speed, cost)` to `provider + model`,
  per endpoint kind, via configuration.
- Config schema for providers and cast tables, with a base + local overlay so
  the API key is never committed.
- Gated HTTP endpoints and composition wiring.
- Unit tests (stubbed, no key) and a live dev-test (real call, run manually).

Out of scope for this slice (present in the reference, deferred here): tool
calls / typed-tool validation, multi-turn continuation, usage reservations and
accounting, budgets, provider health/admission state, streaming.

## Endpoint contracts

All three kinds take a `Cast` and return the provider's `Usage` (token counts
when the provider reports them).

- **Reason** — `messages -> text`. The higher-capability "thinking" tier.
  - `Reason(ctx, ReasonRequest) (ReasonResult, error)` → `Text`
  - `ReasonJSON(ctx, ReasonRequest, schema) (ReasonResult, error)` → `JSON`
- **Inference** — one-shot generation / transformation, `messages -> text`.
  - `Infer(ctx, InferRequest) (InferResult, error)` → `Text`
  - `InferJSON(ctx, InferRequest, schema) (InferResult, error)` → `JSON`
- **Embedding** — `[]string -> [][]float64`.
  - `Embed(ctx, EmbedRequest) (EmbedResult, error)` → `Vectors`

`Message` is `{Role, Content}` with roles `system | user | assistant`.

The two `…JSON` variants share one internal structured-output helper (it sets the
provider `response_format`); that helper is tested as its own unit. `Reason` vs
`Infer` differ by intent and by which config cast table they resolve against
(`casts.reasoning` vs `casts.inference`), not by transport mechanics — both
compile down to a provider `Chat` call.

## Casts and resolution

A cast is the tuple `(purpose, strength, speed, cost)`:

- `purpose`: `general` (only supported value now; the type leaves room for
  `image`, etc. later).
- `strength`, `speed`, `cost`: each `low | medium | high`.

Resolution is **exact-match lookup** within the requested endpoint kind. There is
no solver and no nearest-neighbor fallback. A requested cast with no configured
row returns `ErrNoCast` with a message naming the kind and tuple (e.g.
`no model configured for reasoning cast general/high/low/high`). A cast row that
references an unconfigured provider is a startup/config error, not a per-request
error.

## Configuration

New `intelligence` section on `config.Config`, mirrored in `etc/config.yaml` and
`Default()`. Providers are a name-keyed map so more can be added later; cast
tables are per endpoint kind.

```yaml
intelligence:
  providers:
    openrouter:
      api_key: ""                              # blank in the committed template
      base_url: "https://openrouter.ai/api/v1"
  casts:
    reasoning:
      - { purpose: general, strength: high,   speed: low,    cost: high,   provider: openrouter, model: "anthropic/claude-opus-4" }
      - { purpose: general, strength: medium, speed: medium, cost: medium, provider: openrouter, model: "anthropic/claude-sonnet-4" }
      - { purpose: general, strength: low,    speed: high,   cost: low,    provider: openrouter, model: "..." }
    inference:
      - { purpose: general, strength: medium, speed: medium, cost: medium, provider: openrouter, model: "anthropic/claude-sonnet-4" }
    embedding:
      - { purpose: general, strength: high,   speed: low,    cost: high,   provider: openrouter, model: "openai/text-embedding-3-large" }
```

### Secret handling: base + local overlay

- Committed `etc/config.yaml` stays a clean template with `api_key: ""`.
- A gitignored `etc/config.local.yaml` holds only overrides — in practice the
  real key (and `mode: dev`). Added to `.gitignore`.
- Loading order: built-in `Default()` → overlay `etc/config.yaml` → overlay
  `etc/config.local.yaml` if it exists. Each overlay only sets the keys it
  names, so the local file stays tiny and never drifts from the template.
- No environment variable holds the key.

The config loader gains the ability to overlay a local sibling file when present;
the composition root drives base-then-local loading. A missing local file is not
an error.

## Provider abstraction

```go
type Provider interface {
    Name() string
    Chat(ctx context.Context, req ChatRequest) (ChatResponse, error)   // backs Reason + Infer
    Embed(ctx context.Context, req EmbedRequest) (EmbedResponse, error)
}
```

`ChatRequest` carries `Model`, `Messages`, and an optional `ResponseFormat` (set
by the `…JSON` variants). `EmbedRequest` carries `Model` and `Inputs`. The
`openrouter` implementation:

- Uses an `http.Client` with a timeout.
- `POST {base_url}/chat/completions` and `POST {base_url}/embeddings` with
  `Authorization: Bearer <key>` and the recommended `HTTP-Referer` / `X-Title`
  headers.
- Parses `choices[0].message.content` / `data[].embedding` and `usage`.
- Sanitizes errors — the key is never included in any returned error or log.

## HTTP surface and wiring

Gated behind login (same gate as `/echo`). Added to `transport.Options` as
`Intelligence *intelligence.Intelligence`:

- `POST /intelligence/reason` — `{cast, messages, schema?}` → `{text|json, usage}`
- `POST /intelligence/infer`  — `{cast, messages, schema?}` → `{text|json, usage}`
- `POST /intelligence/embed`  — `{cast, inputs}` → `{vectors, usage}`

`cast` is `{purpose, strength, speed, cost}`. When `schema` is present on a
reason/infer request, the handler calls the corresponding `…JSON` function.

Composition builds the `intelligence.Intelligence` from the loaded config
(providers + cast tables) and injects it into transport. A provider with a blank
key is constructed but any call it backs returns a sanitized "provider not
configured" error, so the server still starts without a key (the live dev-test
skips in that case).

## Testing

- **Unit (no key, CI-safe):**
  - `openrouter_test.go` — drives the provider against an `httptest` stub;
    asserts request URL, `Authorization` header, request body (model, messages,
    `response_format`), and response mapping for both chat and embeddings.
  - `intelligence_test.go` — cast resolution (hit; miss → `ErrNoCast`;
    unconfigured provider); the shared structured-output helper (schema is passed
    through as `response_format` and JSON is returned) for both Reason and Infer.
- **Live dev-test:** `dev-test/intelligence/{run.sh, manual.md}` — logs in, makes
  one real `POST /intelligence/infer`, expects 200 and non-empty text. Skips with
  a clear message when no key is configured, so it is safe to run alongside the
  other dev-tests.

## Files

New:

- `core/intelligence/intelligence.go` (+ `.go.md`) — service, cast types and
  resolution, request/response contracts, the five public methods, errors.
- `core/intelligence/provider.go` (+ `.go.md`) — `Provider` interface and the
  neutral wire types.
- `core/intelligence/openrouter.go` (+ `.go.md`) — OpenRouter implementation.
- `core/intelligence/intelligence_test.go`
- `core/intelligence/openrouter_test.go`
- `dev-test/intelligence/run.sh`
- `dev-test/intelligence/manual.md`

Modified:

- `core/config/config.go` (+ `.go.md`) — `Intelligence` section, `Default()`,
  local-overlay loading support.
- `etc/config.yaml` — `intelligence` section (blank key).
- `.gitignore` — add `etc/config.local.yaml`.
- `core/transport/transport.go` (+ `.go.md`) — `Intelligence` option and routes.
- `core/composition/composition.go` (+ `.go.md`) — build and inject the service,
  base-then-local config loading.

## Notes

- Work happens on branch `feat/intelligence` (the user asked for a branch this
  time, overriding the usual work-on-main convention).
- Model IDs in the config examples above are placeholders to confirm during
  implementation against OpenRouter's current catalog.
