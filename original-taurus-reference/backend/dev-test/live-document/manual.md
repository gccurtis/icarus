# Manual test / demo runbook: the live document

This is the by-hand version of [`run.sh`](run.sh) — the whole live-document
program in one flow, and the demo script. A **live document** is mostly **prompt
blocks** fed by **context variables** bound to **connector** resources (live
external folders). It resolves grounded in exactly its scoped source, refreshes
when you swap a variable or when the underlying folder changes (on its own,
system-attributed), and the AI quarterback can author and resolve prompt blocks.

## Why this suite needs a real key

Every beat that matters is model-backed (prompt resolution, an agent action), so
it can only be judged against a real model. Without a key the automated
[`run.sh`](run.sh) **skips**, and model-backed behavior is never asserted with a
stubbed model. The run reports its token cost (a full run is ~5k tokens, well
under a cent).

## The beats (each proves an acceptance criterion)

1. **Connectors (1–2).** Two local-folder connectors, each synced from its own
   external `connector-watcher`, with distinguishable content (a finance fact and
   a trivia fact).
2. **A live document.** A heading plus one prompt block; two context variables
   (`finance`, `trivia`) bound to the two connectors; the block scoped to
   `finance`. (Template + bindings + block context are set with `set_template`,
   `set_context_variable`, `set_block_context` ops.)
3. **Scoped resolution.** Resolve the block → it states the finance fact, not the
   trivia fact.
4. **Swap → output flips (criterion 4).** `set_block_context` to `trivia`; refresh
   → the block now states the trivia fact, not the finance one.
5. **External change → auto-refresh, system-attributed (criterion 3).** Change the
   finance folder with **no** API call; within a couple of seconds the detector
   re-syncs and the reference-graph cascade re-resolves the block on its own; the
   edit shows up in `GET /activity` attributed to the **system** actor.
6. **Exact scoping incl. exclude (criterion 5).** `set_block_context` to include
   `finance`+`trivia` but exclude `trivia` → the block states the finance fact and
   never the trivia one (exclude wins).
7. **Quarterback authors prompt blocks (criterion 6).** An Action task asks the
   agent to add an `Overview` and a `Details` prompt block, both using the
   `finance` context, and resolve them. The document gains new, live,
   finance-scoped prompt blocks the agent wrote and resolved.

## By hand (curl sketch)

Sign in, create + select a project. For each connector: `POST /connectors`
(`subkind: local-folder`), start `go run ./cmd/connector-watcher -folder DIR
-addr 127.0.0.1:0`, `PUT /connectors/:id/config {"path":"http://<watcher>"}`,
`POST /connectors/:id/sync`. Create the document with a prompt block, then submit
`set_template` / `set_context_variable` / `set_block_context` ops via
`POST /documents/:id/changes` (each needs a `submissionId` and the current
`expectedRevision` from `GET /documents/:id`). Resolve with
`POST /documents/:id/blocks/:block/resolve {"mode":"reload"}` and poll the job.
Read the block's answer from `data.lastOutput`. Change a folder and watch the
block update on its own. Drive the split with `POST /agent/actions` and poll
`GET /agent/tasks/:id`.

Assertions target scope **membership** (which source's fact appears), not model
wording, because phrasing varies.
