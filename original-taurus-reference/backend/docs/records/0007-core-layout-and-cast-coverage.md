# 0007 — core layout reorg + full cast coverage

Two cleanups: reorganize `core/` into layered groups (so the growing set of
packages stays legible), and fill the intelligence cast tables to full coverage.
No behavior changes — every package builds, tests, and serves exactly as before.

## Directory reorg

`core/` had grown a flat pile of packages (access, document, intelligence, job,
config, devcert, storage, composition, transport, endpoint, application). They are
now grouped by role, using the vocabulary from
[docs/reference/architecture/repository-map.md](../reference/architecture/repository-map.md):

```text
core/
  main.go
  wiring/                       (was composition/ — the composition root)
  transport/  endpoint/
  handlers/                     (was application/ — the thin HTTP handlers)
    auth/ project/ document/ intelligence/ job/ echo/ healthz/
  capability/                   domain / business logic
    access/  document/  intelligence/
  integration/                  concrete external adapters
    intelligence/openrouter/    the OpenRouter provider implementation
  platform/                     technical mechanisms (no product policy)
    config/  devcert/  job/  storage/sqlite/
```

Rationale, matching the reference: **capability** holds domain logic; **platform**
holds cross-cutting technical mechanisms (config, crypto/devcert, jobs, storage);
**integration** holds concrete provider adapters; **transport** is HTTP; **wiring**
is the composition root. `access` sits under capability for now (the reference
would eventually split identity/access into a `control` layer). `job` is platform
(infrastructure), not a capability.

**`application/` → `handlers/`.** The HTTP handler packages were renamed to
`handlers/` (a flat layer, mirroring capability names) rather than nested under
each capability. A handler carries no data model — it binds a request, calls a
capability, and maps the result — so it stays a distinct layer (`transport →
handlers → capability`), the way the reference keeps handlers (`cell/handlers/`)
separate from capabilities. Nesting them per-capability was rejected because the
mapping is not one-to-one (`auth` and `project` both belong to `access`; `job` is
platform; `echo`/`healthz` have no capability).

The move was mechanical: `git mv` each package, then rewrite import paths across
every `.go` (and, to keep them verbatim, every `.go.md`). `composition` was renamed
to `wiring` (package and files), and `main` now calls `wiring.Run`.

### openrouter split into its own package

The OpenRouter implementation moved out of the `intelligence` capability into
`core/integration/intelligence/openrouter` as its own `package openrouter`. The
`Provider` interface and neutral types stay in the capability; the adapter now
depends on the capability (not the reverse) and refers to the neutral types as
`intelligence.ChatRequest`, `intelligence.Provider`, and so on.

```go
// New builds the OpenRouter provider. A blank baseURL falls back to the public
// API root. A blank apiKey yields a provider that constructs fine but fails every
// call with intelligence.ErrProviderNotConfigured, so the server still starts
// without a key configured.
func New(apiKey, baseURL string) intelligence.Provider {
```

`NewOpenRouter` became `openrouter.New`; the composition root calls it in place of
the old in-package constructor. This keeps the capability provider-agnostic — the
seam the reference calls `integrations/`.

## Full cast coverage (27 per kind)

Cast resolution is exact-match with no fallback, so a missing row is a hard "no
model configured" error. The committed cast tables now list **all 27**
`strength × speed × cost` combinations per endpoint kind (81 rows total), so any
cast the frontend requests resolves. Models are chosen for cost-efficiency:
DeepSeek for the mid/upper tiers, small OpenAI models for the cheap tier, and a
premium model only at the high-strength / high-cost corner. Slugs are OpenRouter
slugs, to confirm against its catalogue.

## Follow-up: embedding models and the `code` purpose

The embedding cast table was OpenAI-only (small/large). OpenRouter's `/models`
catalog lists no embedding models, so the available ones were found by probing the
live `/embeddings` endpoint. Confirmed working (with dims): `openai/text-embedding-3-small`
(1536) / `-3-large` (3072), `qwen/qwen3-embedding-8b` (4096) / `-4b` (2560),
`google/gemini-embedding-001` (3072), `mistralai/codestral-embed-2505` (1536), and
`nvidia/nemotron-3-embed-1b:free` (2048, free — the `:free` suffix is required).

The `casts.embedding` table now uses the **`purpose` axis** (which the `Cast` type
already carries — this is config-only): `purpose: general` maps across strength/cost
tiers (cost=low → the free Nemotron model; higher tiers → Qwen3, OpenAI, Gemini),
and `purpose: code` routes to Codestral Embed. Every reachable embedding model is
text-only — `gemini-embedding-001`'s OpenRouter page confirms per-token text
pricing, despite the Gemini *chat* model being multimodal — so `purpose: multimodal`
is deferred until a multimodal embedding model is reachable (Google's multimodal
embedding is a separate model not on OpenRouter). The intelligence dev-test now
exercises a general (NVIDIA free) and a code (Codestral) embedding live.

## Config: full local mirror

`etc/config.local.yaml` (gitignored) is now a **full copy** of `etc/config.yaml`
rather than a minimal overlay — the whole configuration is visible and editable in
one place, and the only value that differs is the OpenRouter `api_key`. Loading is
unchanged (`Default() → etc/config.yaml → etc/config.local.yaml`).

## Docs

- Every paired `.go.md` moved with its `.go` and had import paths rewritten in
  step, so all stay verbatim.
- The intelligence-slice companion docs (provider, openrouter, application
  handlers) and the files the merge had left abbreviated (config, transport,
  wiring) were brought up to the verbatim standard.
- [AGENTS.md](../../AGENTS.md) now documents both practices — the verbatim paired
  `.go.md` companions and the numbered change records.

## Verification

`go build/vet/test ./...` clean under the new layout; all seven dev-test suites
green; the server boots and wires 81 cast routes; the full paired-doc verbatim
check passes.
