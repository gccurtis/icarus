# Backend request — automatic document → knowledge-lattice ingestion

**Priority:** **High** · **Status:** Open · **Filed:** 2026-07-28
**Blocks:** "the whole project is the default context" being true at all. A user types a fact
into a document, asks the Quarterback bar about it, and gets *"there is no available
evidence"*.

> **Standalone.** Everything needed to build this is in this document: what already works, the
> exact gap, what we need built, the rules, and a numbered verification you can run.

Found in the user's live review 2026-07-28 and reproduced end-to-end against the dev stack
(transcript below).

> **Scope note.** This is the *project-wide* half of the Quarterback context problem: grounded
> retrieval across everything in the project, which only the server can do (embedding and
> indexing content the browser does not have). The *per-turn* half — letting the client send
> the document it is looking at — is a much smaller, separate ask:
> [Let a chat turn carry caller-supplied context items](chat-turn-context-items.md). **If only
> one ships first, we want that one.** Both are wanted; neither replaces the other.
>
> **This request may also be the root cause of a second one.**
> [Ask turns intermittently 500](ask-turn-500s.md) reports ~4% of turns failing
> outright, and our best reading is that it happens *because* the lattice is empty: with nothing
> to cite, the only answer that satisfies the grounded-citation contract is
> `insufficientEvidence: true`, and a model that just answers instead gets rejected into a 500.
> **Re-measure that failure rate after this ships** — it may drop sharply. It should not be
> assumed to reach zero: a question that triages as needing retrieval but finds nothing relevant
> hits the same contract even with a full lattice, which is why the robustness fix is filed
> separately.

## What already works

- **The lattice itself is solid.** When a document IS in the lattice, everything downstream
  behaves exactly as designed: `POST /dev/knowledge/retrieve` returns the grounded span with
  block addresses, and a chat Ask turn answers from it. Reproduced: after a manual dev-only
  ingest, the same question that failed went from *"no available evidence"* to the correct
  answer, citing the document.
- **Ask's retrieval plumbing.** Turns run structured retrieval planning, automatic
  project-scoped retrieval, and a `knowledge.search` tool — all fine, all starved.
- **Chat pinning.** A chat's `resourceId` correctly scopes Plan/Action tasks and chat
  listing.
- **Attachments as context.** Text attachments are inlined as `ContextItem`s per turn.
- **The pattern for auto-ingestion exists.** Connector sources already sync into the lattice
  automatically (`runConnectorDetector` → `connectorLatticeWriter`, every 2s). Documents have
  no equivalent.

## The gap

**Nothing ever ingests a document into the knowledge lattice.** The only entry point is the
dev-only `POST /dev/knowledge/documents/:documentID` — whose own package comment says
"ingestion is normally driven by resource changes, not called directly" — but no
resource-change-driven ingestion exists. And an Ask turn does not read the pinned document
either (`chat_engine.go` uses `req.ResourceID` only for Plan/Action task scoping; Ask context
is attachments only, by design — the lattice is supposed to be the source).

Net effect: **every Ask about project content reports insufficient evidence**, no matter what
the user wrote. What a user sees today: type "The launch code for the Taurus demo rocket is
INDIGO-7." into a document, ask "What is the launch code for the Taurus demo rocket?", get
*"There is no available evidence to provide the launch code for the Taurus demo rocket."*

Reproduction (dev stack, 2026-07-28, via the HTTP API):

1. Create project, select it, create a document containing the fact → **201**.
2. Create an Ask chat pinned to the document; post the question → answer: *"There is no
   available evidence…"*
3. `POST /dev/knowledge/retrieve {"query":"launch code"}` → `{"regions":[]}` — lattice empty.
4. `POST /dev/knowledge/documents/:id` (dev-only ingest) → 201, 1 window embedded.
5. Same retrieve → the span comes back with row/block refs; fresh chat, same question →
   *"The launch code for the Taurus demo rocket is INDIGO-7."*

## What we need

Ingestion driven by the document lifecycle, so the lattice tracks authored content without
any client call:

- **On create / change** (changes applied, undo, redo, import, restore): re-sync the document
  into the lattice — the `flatten` in `core/handlers/knowledge` already produces the text +
  block-span map; `knowledge.Add` is already idempotent per revision.
- **On trash / delete**: `knowledge.Remove` the source (restore re-adds, per above).
- **Backfill**: documents that exist before this ships get ingested (a boot sweep, or lazily
  on first project retrieval — your call).
- **Asynchronous is fine** — the jobs queue or a detector loop both work. Freshness within a
  few seconds is plenty; blocking the document-save path is not wanted.

Optional but requested while you are in here: when the stored vector identity no longer
matches the configured embedding model, a re-sync should **re-embed instead of leaving
retrieval failing with the identity-mismatch conflict**. (Observed operationally: the running
dev lattice stamped `qwen/qwen3-embedding-4b` while the committed manifest now names
`text-embedding-3-small` — harmless today only because nothing auto-ingests.)

## The rules that matter

- Skip `Inferred` blocks (the existing `flatten` already does) — prompt-block output must not
  be indexed as evidence for future prompts.
- Revision-based idempotency: re-syncing an unchanged document must not re-embed (usage cost
  is visible; connector sync already records per-sync cost — do the same).
- Authorization unchanged: ingestion is a server-side reaction, not a new client surface. The
  dev-only routes can stay dev-only (or retire).
- Do **not** change Ask's grounding contract. Project-wide retrieval as the default context
  is exactly the product intent ("the whole project is the default context"); the chat's
  document pin remains a task-scoping affordance, not a context filter.

## How we will verify

1. Create a document containing a distinctive fact (API only, no dev knowledge calls).
2. Within a few seconds, `POST /dev/knowledge/retrieve` for the fact returns its span with
   the document's row/block refs.
3. An Ask chat turn answers the fact and cites the document source.
4. Edit the fact; ask again → the answer reflects the edit (old span gone or superseded).
5. Trash the document → retrieval no longer returns it; restore → it returns.
6. Re-running steps 1–3 with an unchanged document does not re-embed (usage stays flat).

## Current front-end fallback

Nothing project-wide is possible from the browser: sending an entire project's text with every
turn is not a fallback, it is a different (and impossible) feature — the per-turn context
budget is 32KB total. For the single open document there IS a viable client-side path, which
is why it is filed separately as
[chat turn context items](chat-turn-context-items.md).

Until one of the two lands, Ask answers only from chat attachments and the model's own
knowledge — which is exactly what users now see.
