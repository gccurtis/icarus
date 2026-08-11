# Web context + AI generation (BR-AI-CONTEXT web, BR-AI-GENERATE)

Two AI-context features. "Create with AI" (BR-AI-GENERATE) shipped first, in a
separate commit; this record covers both, since they are one plan phase.

## BR-AI-GENERATE — "Create with AI" (committed separately)

`POST /resources/generate { kind, prompt }` creates a resource through the
canonical family owner, then runs an agent **Action** (scoped to the new
document) that populates it, returning the resource and the populating task id
for the client to poll. The resource handler composes the agent through a
`ResourceGenerator` port (wiring's `resourceGenerator` adapter resolves the
requester's default Persona), so it imports neither agent nor persona. Handler
unit tests use a fake generator; a live dev-test generated a real 9-row document
for ~$0.005.

## BR-AI-CONTEXT (web)

A chat ask-turn can consult the live web for **transient** context that informs
the answer but is never cited as Project evidence and never written to the
lattice.

- **Port + tool** (`core/capability/agent/web.go`): `WebRetriever` +
  `WebResult`, and a `web.search` tool binding. Ask offers the tool to its answer
  call only when the request opts in (`IncludeWeb`) **and** a retriever is
  configured. Web results carry no lattice locator, so the model can use them but
  cannot cite them — matching how prompt-block `inferred` content is kept out of
  citable evidence.
- **Adapter** (`core/integration/context/web/web.go`): implements `WebRetriever`
  against a JSON search endpoint, bounded on every request — query length, result
  count, a 1 MiB response-body cap, and an **HTTPS-only** endpoint — so one lookup
  can neither run away nor reach a private address over plain HTTP.
- **Plumbing**: `AskRequest.IncludeWeb` → the answer's tool set;
  `ChatReplyRequest.IncludeWeb` and the chat turn's `{"web": true}` flag →
  `PostTurn` → the ask engine. Config: `agents.web { endpoint, api_key,
  max_results }`; wiring builds the adapter only when an endpoint is set (nil
  otherwise, so the web source is simply unavailable).

## Tests

- **Web adapter** (`core/integration/context/web/web_test.go`): a fake HTTP
  client proves parsing, the bounded query/count, the bearer header, empty-row
  dropping, non-2xx and empty-query errors, and HTTPS-only construction — no key
  needed.
- **Web integration** (`core/capability/agent/web_test.go`): the tool returns
  snippets and clamps topK; Ask offers `web.search` only when both requested and
  configured (and never otherwise).
- **Generate** (`core/handlers/resource/generate_test.go`): a fake generator
  proves the resource is created and the Action scoped to it, with role / prompt
  / kind / unconfigured guards.
- **Live** (skip-without-key, cost-printing): `dev-test/generate/run.sh` (proven,
  ~$0.005) and `dev-test/web/run.sh` (skips unless both an OpenRouter key and a
  configured `agents.web.endpoint` are present).

`pdf`/`docx` export and Plan/Action web access remain follow-ups.
