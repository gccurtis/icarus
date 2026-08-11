# Taurus Omega core — run & integrate

A practical guide to running the **core** (the Go backend) and driving it over
HTTP. Written for a front-end cockpit / harness (human or agent) that needs to
stand the backend up and talk to it. Nothing here is aspirational — every
endpoint below exists in the running server today.

For a deep, by-hand walkthrough of any one feature, the
[`dev-test/`](../dev-test/README.md) suites each ship a `manual.md` with exact
`curl` commands and expected responses; they are the authoritative per-feature
reference. This document is the map that ties them together.

---

## 1. Run it

Prerequisites: a **Go toolchain** (see [`go.mod`](../go.mod) for the version).
That's all — storage is pure-Go SQLite (no cgo, no external database), and the
server generates its own TLS certificate in dev.

```bash
# from the repo root
go run ./core
```

On first start in dev it:

- writes a self-signed certificate to `var/dev-cert.pem` / `var/dev-key.pem`,
- opens (creating if needed) a SQLite database at `var/taurus-omega.db`,
- listens on **`https://127.0.0.1:8443`**.

Register a local dev account against the running server:

```bash
./scripts/dev-setup.sh          # creates dev@taurus.local / devpassword
```

Then exercise the whole platform end-to-end (this is also the fastest way to
confirm a working build):

```bash
./dev-test/run.sh               # starts its own isolated instance per suite
```

### The core always serves HTTPS

Even in dev. The certificate is self-signed, so:

- **`curl`** needs `-k` (accept the self-signed cert) on every call.
- A **browser** front-end must trust the dev cert (or sit behind a TLS-terminating
  proxy) before it can call the API or hold the session cookie.
- A **programmatic** client needs a cookie jar (see §3) and, in dev, to skip cert
  verification (or trust `var/dev-cert.pem`).

---

## 2. Configure it

Configuration is a YAML manifest overlaid on built-in defaults. Resolution order:

1. built-in defaults (prod-safe),
2. `etc/config.yaml` (committed template),
3. `etc/config.local.yaml` (gitignored overlay — **secrets live here**),

each overwriting only the keys it sets. Point the server at a different file with
the `TAURUS_OMEGA_CONFIG` environment variable.

Keys a harness usually cares about:

```yaml
mode: dev                 # dev = self-signed cert + local db; prod requires a real cert
server:
  addr: ":8443"
storage:
  dsn: "var/taurus-omega.db"
access:
  session_ttl: "24h"      # how long a login stays valid

# Model provider — needed for /intelligence/* and /dev/knowledge/*.
# The committed template keeps api_key BLANK; put the real key in the gitignored
# etc/config.local.yaml, never in etc/config.yaml.
intelligence:
  providers:
    openrouter:
      api_key: "sk-or-..."   # in etc/config.local.yaml only
  casts:
    embedding:
      - { purpose: general, strength: medium, speed: medium, cost: medium,
          provider: openrouter, model: "openai/text-embedding-3-small" }

# Knowledge lattice (retrieval). See §7.
knowledge:
  window:   { target_runes: 4000, overlap_runes: 400 }
  cluster:  { percentile: 0.75, floor: 0.30 }
  descent:  { enabled: false, beam: 3, threshold: 0.35, audit: true }
  retrieval: { char_budget: 4000 }
```

Without an API key the server still runs and every non-model endpoint works;
model-backed calls just return `503 { "error": "...not configured" }`.

---

## 3. API conventions

- **Transport**: HTTPS, JSON request and response bodies
  (`Content-Type: application/json`).
- **Auth**: a **cookie session**. Login sets an opaque, `HttpOnly`, `Secure`,
  `SameSite=Lax` cookie named **`to_session`**; send it back on every subsequent
  request. With `curl`, use a shared cookie jar: `-c cookies.txt` (save) and
  `-b cookies.txt` (send).
- **Three access tiers**:
  - **Public** — no session (`/healthz`, `/auth/register`, `/auth/login`).
  - **Gated** — any signed-in user (everything else).
  - **Project-scoped** — a project must be *selected* in the session first
    (documents, knowledge, …). Calling these with no selected project returns
    `409 { "error": "select a project first" }`.
- **Errors**: a JSON object `{ "error": "<message>" }` with a matching HTTP
  status. Common ones: `400` bad body, `401` not signed in, `403` role forbids
  it, `404` not found, `409` conflict / no project selected, `503` model provider
  unavailable.
- **Roles**: project membership is `owner` / `edit` / `read`. Writes require
  owner or edit.
- **Rate limit**: `/auth/register` and `/auth/login` are throttled per client IP
  (≈5/s, burst 10).

---

## 4. The golden path

A complete session a harness would automate. `$B=https://127.0.0.1:8443`, and
`-b/-c cookies.txt` carries the session throughout.

```bash
# 1. Create an account (idempotent-ish: 409 if the email already exists).
#    "name" is optional (a display name; ≤80 chars); omit it and it stays empty.
curl -k -c cookies.txt -X POST $B/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@taurus.local","password":"devpassword","name":"Dev"}'
# 201 {"id":"...","email":"dev@taurus.local","name":"Dev"}

# 2. Sign in — this sets the to_session cookie into cookies.txt.
curl -k -b cookies.txt -c cookies.txt -X POST $B/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@taurus.local","password":"devpassword"}'
# 200 {"status":"signed in"}

# 3. Create a project and select it into the session.
curl -k -b cookies.txt -X POST $B/projects \
  -H 'Content-Type: application/json' -d '{"name":"Cockpit"}'
# 201 {"id":"<PROJECT_ID>","name":"Cockpit","role":"owner"}

curl -k -b cookies.txt -X POST $B/session/project \
  -H 'Content-Type: application/json' -d '{"projectId":"<PROJECT_ID>"}'
# 200

# 4. Create a document (optional page layout, then rows -> blocks -> text atoms).
curl -k -b cookies.txt -X POST $B/documents \
  -H 'Content-Type: application/json' \
  -d '{"name":"Notes","rows":[{"blocks":[
        {"kind":"paragraph","atoms":[{"kind":"text","text":"Solar panels convert sunlight into power."}]}
      ]}],"pageLayout":{"width":612,"height":792,"marginTop":72,"marginRight":72,"marginBottom":72,"marginLeft":72}}'
# 201 { "id":"<DOC_ID>", ... }

# 5. Index it into the knowledge lattice, then retrieve against it.
curl -k -b cookies.txt -X POST $B/dev/knowledge/documents/<DOC_ID>
curl -k -b cookies.txt -X POST $B/dev/knowledge/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"query":"how do panels make electricity","topK":3}'
```

---

## 5. Endpoint reference

### Public

| Method & path | Purpose |
|---|---|
| `GET /healthz` | Liveness. `200` when up. |
| `POST /auth/register` | Create an account. Body `{email, password}` → `201 {id, email}`. |
| `POST /auth/login` | Start a session. Body `{email, password}` → `200 {status}` + `to_session` cookie. |

### Session (any signed-in user)

| Method & path | Purpose |
|---|---|
| `GET /auth/me` | The current user: `{ id, email, name }` (`name` may be empty). |
| `PATCH /auth/me` | Set the display name: body `{name}` → `200 {id, email, name}` (`400` if over 80 chars). |
| `POST /auth/logout` | End the session and clear the cookie. |
| `GET /projects` | `{ "projects": [...] }` the user belongs to; each carries `id, name, role, icon, purpose, visibility, createdAt, updatedAt`. `updatedAt` is the latest profile or Resource activity time. |
| `POST /projects` | Create a project (caller becomes owner, `visibility:"private"`) → `201`. |
| `PATCH /projects/:projectID` | Partial profile update: `{name?, icon?, purpose?, visibility?}`. Owner may change all; edit may change purpose only; read may change none. Purpose is trimmed plain text, ≤1,000 runes, and empty clears it. Empty/mixed-unauthorized patches fail atomically. |
| `DELETE /projects/:projectID` | Delete (owner only). |
| `POST /projects/:projectID/leave` | Leave a project you're a member of. `409` if you are the sole owner (delete or hand off first). |
| `POST /join/:token` | Join a project via a share-link token, granting (or upgrading to) the link's role → `200` the project. Upgrade-only (never demotes; owners unaffected). `404` if the token is unknown or its project's `visibility` is not `link` (the master switch is off). |
| `GET /projects/:projectID/members` | List members (any member): `{members:[{userId,name,email,role}]}`. |
| `POST /projects/:projectID/members` | Add an existing user by email at a role (owner): body `{email, role}` → `201`. `404` no such account, `409` already a member, `400` bad role. |
| `PATCH /projects/:projectID/members/:userID` | Change a member's role (owner): body `{role}`. `409` if it drops the last owner. |
| `DELETE /projects/:projectID/members/:userID` | Remove a member (owner). `409` if it drops the last owner. |
| `GET /projects/:projectID/links` | List the project's active share links (owner): `{links:[{role,token}]}`. |
| `PUT /projects/:projectID/links/:role` | Create or rotate the `read`/`edit` share link (owner) → `200 {role, token}`. Rotating invalidates the old token. `400` if role isn't `read`/`edit`. |
| `DELETE /projects/:projectID/links/:role` | Turn off the `read`/`edit` share link (owner) → `200`. |
| `POST /session/project` | Select the active project: body `{projectId}`. |
| `GET /session/project` | The selected project, or `{ "selected": false }`. |
| `GET /jobs/:jobID` | Poll a background job's status (see §6). |
| `POST /echo` | Diagnostic: return the posted JSON body unchanged. |
| `POST /intelligence/reason` · `/infer` · `/embed` | Model calls by semantic cast (see §7). |
| `GET /projects/:projectID/names` | List the formula names in a project's namespace (any member). |
| `GET /projects/:projectID/names/:name` | Get one name (any member). `404` if absent. |
| `DELETE /projects/:projectID/names/:name` | Delete one name (edit/owner). `404` if absent. |
| `PUT /projects/:projectID/names/:name/value` | Set a scalar (edit/owner): body is a `formula.Value` JSON scalar. |
| `POST /projects/:projectID/names/:name/table` | Create a new empty typed table (edit/owner): body `{columns}`; `409` if the name exists. |
| `PUT /projects/:projectID/names/:name/table` | Set a table wholesale (edit/owner): body `{columns, rows}`. |
| `PUT /projects/:projectID/names/:name/function` | Set a function (edit/owner): body `{source}`. |
| `POST /projects/:projectID/names/:name/columns` | Add a column to an existing table (edit/owner). |
| `POST /projects/:projectID/names/:name/rows` | Append rows to an existing table (edit/owner). |
| `POST /projects/:projectID/evaluate` | Evaluate a Formula expression against a project's namespace (any member): body `{source}`. |

### Project-scoped (a project must be selected)

| Method & path | Purpose |
|---|---|
| `GET /users/:userID` | Safe current-member profile `{id, kind, name, email?, role, description, createdAt}`. A user outside the selected project returns 404. |
| `POST /sessions` | Open/re-activate your **presence** in the selected project (upsert). Body `{sessionId?}` → `200` the `Session`. |
| `PUT /sessions/current` | Update presence focus/caret: `{currentDocumentId, caretAtomId, caretOffset, selectionStart…, selectionEnd…}` → `200`. |
| `DELETE /sessions/current` | End your presence → `200 {status:"closed"}`. |
| `GET /sessions` | List active (non-stale) presence in the project: `{sessions:[…]}`. |
| `GET /documents` | List documents in the selected project. |
| `POST /documents` | Create a document with `{name, rows, pageLayout?}`. The response includes server-captured `layoutRules`; dimensions are integer typographic points. |
| `GET /documents/:documentID` | Fetch the resolved document, including its current content `revision`, page layout, row metrics, document-owned semantic style registry, and row/block styles. |
| `PATCH /documents/:documentID` | Rename a document with `{name}` (owner/edit). |
| `DELETE /documents/:documentID` | Move a document to the trash (soft delete). |
| `POST /documents/:documentID/restore` | Restore a trashed document. |
| `DELETE /documents/:documentID/purge` | Permanently delete a trashed document. |
| `POST /documents/:documentID/duplicate` | Copy a document — content and creator attribution — into a new one (`201`). |
| `GET /documents/:documentID/diff` | Compare two revisions of the document (revisions selected by query params). |
| `POST /documents/:documentID/anchors` · `GET …/anchors` · `DELETE …/anchors/:anchorID` · `POST …/anchors/:anchorID/validate` | Create, list, delete, and re-validate stable content **anchors** — `(row, block, atom, offset)` positions that survive edits and report whether they still resolve. |
| `GET /documents/revision-hints` | Bulk current-revision hints for the project's documents. |
| `POST /documents/:documentID/changes` | Append an idempotent authored change set. The typed operation vocabulary includes document layout, semantic style registry/default/reference changes, text and movement edits, mark updates, and prompt resolution. Current-head edits apply directly; stale edits are admitted only when retained semantic footprints prove them disjoint, including coordinate transformation for disjoint same-Atom splices. Returns durable ID, trusted author, client-observed `authoredRevision`, actual `priorRevision`, and assigned `seq`; overlap or insufficient proof is `409 document_revision_conflict`. |
| `GET /documents/:documentID/history?limit&cursor` | List newest-first bounded revision summaries with trusted author, lineage, affected stable IDs, detail availability, and viewer-specific undo/redo eligibility. Default 20, max 100. |
| `GET /documents/:documentID/history/:changeSetID` | Fetch one retained public ChangeSet; private inverse state is never returned. Pruned detail is 404. |
| `POST /documents/:documentID/changes/:changeSetID/undo` | Append a compensating revision for the current user's current-head non-undo change. Returns a new ChangeSet with `undoOf`; another author gets `403`, while an older/ineligible/unavailable target gets `409`. |
| `POST /documents/:documentID/changes/:changeSetID/redo` | Explicitly compensate the current user's current-head undo. Returns a new ChangeSet with `redoOf`; the same author/head/availability protections apply. |
| `POST /documents/:documentID/blocks/:blockID/resolve` | **async**: resolve a prompt block (body `{mode: reload\|refresh}`). `202 {jobId, status}` (see §7). |
| `GET /resources?limit&cursor` | Unified catalog ordered by latest update; returns `resources`, `availableKinds`, and `nextCursor`. Default 100, max 500. |
| `GET /resources/:kind/:resourceID` | Current canonical metadata `{id,kind,name,createdAt,updatedAt}`. Missing/foreign 404; unknown kind 400; unavailable kind 409. |
| `POST /resources` | Create through a canonical owner with `{kind,name}`. Only `document` is currently available; recognized unavailable kinds return 409. |
| `PATCH /resources/:kind/:resourceID` | Rename the canonical Resource with `{name}`. |
| `DELETE /resources/:kind/:resourceID` | Delete through the canonical owner while retaining its Activity snapshot. |
| `GET /activity?limit&cursor` | Semantic Project activity ordered newest first. Default 8, max 100. |
| `POST /agent/plans` | Create a Quarterback **Plan** task: `{objective, context:[{label,content}], persona:{id,version}}` → `201` a queued `Task` that runs on the job pool; poll `GET /agent/tasks/:taskID`. |
| `POST /agent/actions` | Create an **Action** task (same body) that executes with tools → `201` a queued `Task`. |
| `GET /agent/tasks` · `GET /agent/tasks/:taskID` | List the project's agent tasks / fetch one (poll it for the plan draft or execution report). |
| `POST /agent/tasks/:taskID/plans/:planID/accept` | Mark a plan revision `accepted` (does **not** execute anything). |
| `POST /agent/chats` | Open a project-scoped AI chat: `{mode, title?, resourceId?}` → `201` `Chat`. |
| `GET /agent/chats` · `GET /agent/chats/:chatID` | List the project's chats (`?resourceId=` filters to one resource) / fetch one with its ordered turns. |
| `POST /agent/chats/:chatID/turns` | Append `{message}`; runs the chat's mode (Ask inline, Plan/Action spawn a task) → `200 {userTurn, agentTurn}` (`agentTurn.taskId` set for plan/action). |
| `GET /personas` · `POST /personas` | List persona records / create one: `{name, description, definition{focus, behavioralGuidance, contextReferences, defaultVerification, outputPreferences}}`. |
| `GET /personas/default` · `PUT /personas/default` | Read / set your own default persona (`{personaId}`; any member). |
| `GET /personas/:personaID` · `PUT /personas/:personaID` · `DELETE /personas/:personaID` | Read, update (`{expectedVersion, name, description, definition}`), or delete a persona. The **General** persona is managed (`403`). |
| `POST /personas/:personaID/revisions` | Append a new definition version: `{expectedVersion, definition}`. |
| `GET /personas/:personaID/versions` · `GET …/versions/:version` | The immutable version history, and one exact version. |
| `GET /personas/:personaID/tasks` | Agent tasks attributed to this persona. |
| `POST /dev/documents/:documentID/rebase` | **async**: fold pending changes into a new base. `202 {jobId, status}`. |
| `POST /dev/knowledge/documents/:documentID` | Index (add) or re-sync (update) a document in the lattice (see §7). |
| `DELETE /dev/knowledge/documents/:documentID` | Remove a document from the lattice; `404` if it was never indexed. |
| `POST /dev/knowledge/retrieve` | Grounded retrieval (see §7). |

#### Document link and typography validation

Document admission owns one closed, render-safe contract. It applies to inline
marks, block custom typography, style-definition custom typography, and document
defaults on create, import, duplicate, template instantiation, ordinary edits,
undo, and redo. Accepted strings round-trip byte-for-byte; the backend does not
trim or rewrite them.

| Field | Exact accepted grammar |
|---|---|
| Link `href` | Valid UTF-8, at most 2,048 bytes, no leading/trailing whitespace, controls, or backslashes. Absolute schemes are only `http`, `https`, and `mailto`; HTTP(S) requires a host and `mailto` a recipient. Relative values must begin `/`, `#`, or `?`. `//` protocol-relative values are denied. |
| Font family | Valid UTF-8, 1–128 bytes, containing at least one Unicode letter or digit. Other admitted characters are space, single/double quote, comma, hyphen, period, and underscore. |
| Font size | 1–32 bytes: a positive decimal immediately followed by `px`, `pt`, `em`, `rem`, or `%` (for example `16px`, `13.5pt`, `.75em`, `120%`). Zero, signs, exponent form, whitespace, and CSS functions are denied. |
| Color | 1–64 bytes. Either `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`; an ASCII alphabetic name; or `rgb`/`rgba`/`hsl`/`hsla` with only ASCII letters, digits, period, comma, percent, spaces, and parentheses. Declaration punctuation such as `;`, `:`, `{`, and `}` is denied. |

Mark attributes are also closed: `link` accepts only `href`; `font` accepts one
or both of `family`/`size`; `fg` and `bg` accept only `value`; bold, italic,
underline, strike, and code accept none. Empty fields on `CustomTypography` mean
“absent” and are valid; every present field uses the same grammar above.

A rejected write is atomic and returns:

```json
{
  "code": "document.invalid_style",
  "field": "link.href",
  "error": "document style value is invalid"
}
```

`field` is one of `link.href`, `font.family`, `font.size`, `color.value`,
`color.fg`, `color.bg`, or `mark.attrs`. The operator cause contains the stable
code, field, and reason but never the submitted value. Raw style fields are
redacted from request logs. At startup, SQLite scrubs legacy unsafe mark/style
values to absent values before the server is ready and logs synthetic counts
only; the migration is resumable and idempotent.

`limit` and `cursor` implement keyset pagination. `limit` is the maximum number
of results in one response (`/activity`: default 8, max 100; `/resources`:
default 100, max 500; Document History: default 20, max 100). When a response has more data, copy its opaque
`nextCursor` unchanged into the next request, for example
`GET /activity?limit=8&cursor=<nextCursor>`. A `null` next cursor means the
traversal is complete. Cursors are ordering bookmarks, not authority or frozen
snapshots; every page rechecks the selected Project.

> **`/dev/*`** marks operations that are not part of the eventual production
> client surface — maintenance (`rebase`) and lattice tooling normally driven by
> internal flows, exposed directly so a harness can trigger and observe them.

Per-feature manuals with full request/response bodies:
[gateway](../dev-test/gateway/manual.md) ·
[projects](../dev-test/projects/manual.md) ·
[links](../dev-test/links/manual.md) ·
[documents](../dev-test/documents/manual.md) ·
[resources](../dev-test/resources/manual.md) ·
[names](../dev-test/names/manual.md) ·
[changesets](../dev-test/changesets/manual.md) ·
[jobs](../dev-test/jobs/manual.md) ·
[intelligence](../dev-test/intelligence/manual.md) ·
[knowledge](../dev-test/knowledge/manual.md) ·
[prompt](../dev-test/prompt/manual.md) ·
[agents](../dev-test/agents/manual.md).

---

## 6. Async operations & jobs

Most endpoints are synchronous. Re-base maintenance and model-backed prompt
resolution run asynchronously and return **`202 Accepted`** with a job id
instead of doing the work inline:

```json
{ "jobId": "<JOB_ID>", "status": "queued" }
```

Poll it:

```bash
curl -k -b cookies.txt $B/jobs/<JOB_ID>
# {"id":"...","type":"document.rebase|document.resolve",
#  "status":"queued|running|done|failed","attempts":1,...}
```

A worker runs the job off the request path; a failing job retries with backoff up
to `jobs.max_attempts`. Only lifecycle fields are exposed — internal payloads
never leak through the status endpoint. The `202`-returning async entry points are
`POST /dev/documents/:id/rebase` and
`POST /documents/:id/blocks/:blockID/resolve`. Agent **Plan/Action** tasks are
job-backed too, but they return `201` with the `Task` and are polled through
`GET /agent/tasks/:taskID` rather than the `/jobs` endpoint.

---

## 7. Model-backed features

The model-backed features below need a provider key configured (§2); without
one they return `503` when invoked.

### Intelligence — model calls by semantic cast

Callers never name a model. They ask for a **cast**
`{purpose, strength, speed, cost}`, and configuration maps it to a concrete
provider/model per kind (reasoning, inference, embedding).

```bash
curl -k -b cookies.txt -X POST $B/intelligence/embed \
  -H 'Content-Type: application/json' \
  -d '{"cast":{"purpose":"general","strength":"medium","speed":"medium","cost":"medium"},
       "inputs":["hello world"]}'
# 200 { "vectors":[[...]], "usage":{...} }
```

`/intelligence/reason` and `/intelligence/infer` take `{cast, messages:[{role,content}]}`
and return `{ "text": "...", "usage": {...} }`. An unconfigured cast → `400`; an
unconfigured provider → `503`.

### Knowledge — grounded retrieval lattice (`/dev`)

Adding a document flattens it to text, windows it, embeds the windows, and
clusters them into a per-source forest joined by a cross-source corpus tier.
Retrieval embeds the query and returns **grounded regions** — verbatim, cited
spans of source text.

```bash
# Add or re-sync (update) a document. 201 with window/node counts and usage.
curl -k -b cookies.txt -X POST $B/dev/knowledge/documents/<DOC_ID>
# { ..., "windows":3, "nodes":2, "reused":0, "embedded":3, "usage":{...} }

# Remove a document from the lattice.
curl -k -b cookies.txt -X DELETE $B/dev/knowledge/documents/<DOC_ID>
# 200 {"removed":true}   (404 if it was never indexed)

# Retrieve.
curl -k -b cookies.txt -X POST $B/dev/knowledge/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"query":"how do leaves turn sunlight into energy","topK":3}'
```

The full source lifecycle is add / update / remove / retrieve. `POST` both
**adds** a new document and **updates** an existing one — an update re-syncs the
source and **reuses the embedding of every window whose text is unchanged**,
embedding only what changed. `reused`/`embedded` in the response show the split;
`usage` counts only the embedded windows, so re-posting an unchanged document
costs nothing (`"embedded":0`, zero usage). `DELETE` removes the source and
rebuilds the lattice.

Knowledge ingestion is capacity-bounded. A source or run that crosses its
decoded-byte cap receives **413** with `knowledge.source_bytes_limit` or
`knowledge.run_bytes_limit`; a project whose exact windows-plus-nodes candidate
crosses `max_artifacts` receives **422** with
`knowledge.project_artifact_limit`. Each response includes the stable `code`,
`limit`, `actual`, `subject`, `retryable:false`, and remediation fields.

Response:

```json
{
  "regions": [
    { "sourceType":"document", "sourceId":"<DOC_ID>",
      "indexedRevision":7, "generationId":"...", "sourceHash":"...",
      "windowIds":["..."],
      "start":0, "end":481, "relevance":0.54, "density":1,
      "text":"Photosynthesis is how green plants convert sunlight...",
      "blocks":[{"rowId":"...","blockId":"..."}] }
  ],
  "mode": "descent",
  "generationId": "...",
  "sourceCursor": 12,
  "spaceIdentity": "...",
  "usage": { "promptTokens":10, "totalTokens":10, "requests":1, "costUsd":0.00001 }
}
```

- **`regions`** — merged, de-duplicated, verbatim spans; each carries provenance
  (`generationId`, `sourceHash`, `windowIds`, indexed revision, and origin
  blocks), a byte range, a `relevance` score, and a `density` count. Total text
  is bounded by `knowledge.retrieval.char_budget`.
- **`mode`** — `descent` or `exact-fallback`; the internal `RetrieveExact`
  certification oracle reports `exact`.
- A replacement or promotion during ranking/hydration retries the whole read
  once, then returns `knowledge.evidence_changed`. Missing or malformed source,
  window, graph, range, block, vector, or overlap data returns
  `knowledge.evidence_corrupt`; partial citations are never emitted.
- Deployment embedding drift leaves the old active generation queryable and
  makes ordinary ingest return `knowledge.embedding_space_change_required`.

Project owners migrate embedding space explicitly:

```bash
# 1. Freeze the target identity and receive size/usage estimates plus the
#    current expectedStateRevision.
curl -k -b cookies.txt -X POST $B/dev/knowledge/reembed/preview \
  -H 'Content-Type: application/json' \
  -d '{"toSpace":{"provider":"openrouter","model":"<MODEL>","dimensions":1536,
       "normalization":"unit-l2","vectorFormat":"float32-le",
       "schemaVersion":1,"algorithm":"klr-text-v1"},
       "policy":{"maxSources":10000,"maxBytes":536870912,
       "maxVectors":1000000,"maxPromptTokens":5000000,
       "maxRequests":10000,"maxCostUsd":5}}'

# 2. Start idempotently. This returns 202; poll the run until ready.
curl -k -b cookies.txt -X POST $B/dev/knowledge/reembed/runs \
  -H 'Content-Type: application/json' \
  -d '{"previewId":"<PREVIEW>","idempotencyKey":"rollout-2026-07",
       "expectedStateRevision":<REV>}'

curl -k -b cookies.txt $B/dev/knowledge/reembed/runs/<RUN>

# 3. ready is not automatic publication. Promote with the preview revision.
curl -k -b cookies.txt -X POST \
  $B/dev/knowledge/reembed/runs/<RUN>/promote \
  -H 'Content-Type: application/json' \
  -d '{"expectedStateRevision":<REV>}'

# Roll back within seven days only if no source cursor change followed promotion.
curl -k -b cookies.txt -X POST $B/dev/knowledge/reembed/rollback \
  -H 'Content-Type: application/json' \
  -d '{"expectedStateRevision":<CURRENT_REV>}'
```

Pause, resume, and cancel are `POST` operations beside the run:
`.../<RUN>/pause`, `.../<RUN>/resume`, and `.../<RUN>/cancel`. Workers
reauthorize the Project owner and every Resource snapshot. Runs/checkpoints,
usage, provider-reported cost, validation, promotion, rollback, and generation
events are durable; startup requeues interrupted runs.

Full walkthrough: [knowledge manual](../dev-test/knowledge/manual.md).

### Prompt blocks — grounded generation in a document

A **prompt block** is a document block whose text is generated from the project's
own knowledge. It has `kind: "prompt"` and a `data.instruction`; **resolving** it
plans retrieval queries, retrieves grounded evidence from the lattice,
synthesizes an answer, and writes it into the block as ordinary (editable,
markable) text — with its evidence and status. Generated content is `inferred`,
so it is never fed back into the lattice.

```bash
# Create a document with a prompt block (give it an explicit block id).
curl -k -b cookies.txt -X POST $B/documents -H 'Content-Type: application/json' \
  -d '{"name":"Report","rows":[{"blocks":[
        {"id":"pb1","kind":"prompt","data":{"instruction":"How do plants make energy? Answer from the sources."}}]}]}'

# Resolve it — async, like re-base: 202 + a job id to poll.
curl -k -b cookies.txt -X POST $B/documents/<DOC_ID>/blocks/pb1/resolve \
  -H 'Content-Type: application/json' -d '{"mode":"reload"}'
# {"jobId":"<JOB_ID>","status":"queued"}   → poll $B/jobs/<JOB_ID> to "done"

# Read the result back: the block now holds generated atoms + data.
curl -k -b cookies.txt $B/documents/<DOC_ID>
```

The resolved block's `data` carries `status` (`ok` | `insufficient` |
`contradiction` — a stable non-answer when the evidence doesn't support one) and
`evidence` (the supporting spans, each with its `sourceId` and byte range).

- **`mode`** — `reload` always re-resolves; `refresh` only if something changed
  (a prompt edit, or the project's knowledge changing since the last resolve);
  the empty mode is auto (reload if the block has no text, else refresh).
- The models are configured under `documents.prompt` (`plan_cast`,
  `synthesis_cast`), resolved through the reasoning cast table.

Full walkthrough: [prompt manual](../dev-test/prompt/manual.md). The block model
itself is documented in
[architecture/…/documents](architecture/capabilities/documents/README.md).

---

## 8. Where things live

- [`core/`](../core/) — the backend. Every non-test `*.go` has a sibling
  `*.go.md` describing it verbatim.
- [`etc/`](../etc/) — configuration templates.
- [`scripts/dev-setup.sh`](../scripts/dev-setup.sh) — register a dev account.
- [`dev-test/`](../dev-test/README.md) — end-to-end suites + per-feature manuals.
- [`docs/records/`](records/) — a numbered log of what changed and why.
- [`docs/reference/`](reference/README.md) — prior design material (aspirational,
  not a description of what exists).
- [`AGENTS.md`](../AGENTS.md) — how we work in this repo.
