# 2026-07-28 — Documentation reorganization: everything outside `archive/` is current

The user's verdict on `docs/`: *"I don't like that we have these dated versions. That should
be an archive. What I see in documents, everything there should be current."* Plus a specific
ask — a document for **what we need to do**, clearly distinct from the one for **backend
requests**.

## The rule this establishes

**Everything outside `docs/archive/` is current.** A doc in a live directory that describes
something which no longer exists is a bug, not history. Written into
[`docs/README.md`](../../README.md) (new — there was no docs index at all) and into AGENTS.md
beside the repository layout.

## What moved

| From | To | Why |
| --- | --- | --- |
| `docs/records/` (137 files) | `docs/archive/records/` | A change record is history the moment it lands. 137 dated files were the single biggest source of "is any of this still true?" |
| `docs/plans/*.md` (6 dated) | `docs/archive/plans/` | Four described completed or deleted work. `plans/` now holds active plans only — currently none. |
| `docs/archive/*.md` (11 loose) | `docs/archive/plans/`, `…/backend-requests/` | The archive root had accumulated its own unsorted pile. |
| `docs/reference/` | `docs/support/reference/` | It is support material by its own description ("non-authoritative"); support material belongs in support. |
| `docs/support/slides-v1.md` | `docs/support/omega-deck-contract.md` | The name said nothing; the file is Omega's Deck data-model contract. |
| `discrepancies/ai-agent.md`, `discrepancies/document-inspector.md` | `docs/archive/discrepancies/` | Both fully stale — see the audit below. |

## What is new

- **[`docs/roadmap.md`](../../roadmap.md)** — what **Alpha** needs to build, standing and
  undated: the Context/Templates spaces, the templates context panel and library modal, the
  whole-project default context, the other resource editors (**including fixing the slide
  editor**, which the user called "in shambles"), continuous live validation, and adopting
  each backend request as it lands. Open questions are named rather than assumed — most
  importantly *what is a "context asset"?*, which blocks designing the context library.
- **[`docs/README.md`](../../README.md)** — the map: one table saying what each directory
  answers and the rule that governs it.
- **[`docs/support/README.md`](../../support/README.md)** — frames the deck contract as a
  target, not a description (nothing in it is implemented on either side).

The two "what's next" lists stay **separate on purpose**: `roadmap.md` is our work,
`backend-requests/` is Omega's, and each blocked roadmap item links the request that blocks
it. Merging them is what made the old integration lists untrustworthy.

## Staleness audit and repairs

An audit of every live doc against the actual source found the 2026-07-27 reorg had updated
the plans and code companions but **not** `discrepancies/` or `architecture/`. Repairs:

- `discrepancies/documents.md` — removed claims that collaboration, context, and inspection
  are mocked (all real now), the page-count/derived-sheets paragraph (pagination is deleted),
  and three deleted file paths; rewrote the row-window section as the accepted whole-document
  ceiling.
- `discrepancies/resources.md` — import and export are **real and shipped**, not placeholders;
  documented the local `slides` injection into `availableKinds`.
- `discrepancies/overview.md` — `data/overview.ts` → `systems/projects/activity.ts`;
  `ActivityActor.svelte` → the shared `IdentityHoverCard`.
- `discrepancies/README.md` — index entries no longer repeat the stale claims, and name what
  was retired and why.
- `architecture/document-editor.md` and `architecture/document-block-and-style-model.md` —
  rewritten against the current source (the block model is 7 kinds + `TextSubKind`, inline
  font/fg/bg marks are real and run-level, `runtime.ts` is an orchestrator over `model/*`,
  pagination is gone).

## Backend request re-scoped after user pushback

The user challenged yesterday's framing: *"The context we select should be from the front end,
right, because we send a prompt and the context. So I don't know why this would be fully back
end."* **They were right, and the request was mis-scoped.** `agent.AskRequest.Context` already
exists in Omega — labelled, bounded (16KB/item, 32KB total), injected as untrusted user
content — but `POST /agent/chats/:id/turns` never exposes it, so the client cannot send
anything. Split into two:

1. **[`chat-turn-context-items.md`](../../backend-requests/chat-turn-context-items.md)** (new)
   — expose the existing field on the turn endpoint. Small, front-end-driven, ships first.
2. **[`document-knowledge-ingestion.md`](../../backend-requests/document-knowledge-ingestion.md)**
   — rescoped to the *project-wide* half, which genuinely requires server-side embedding and
   indexing.

## One real test flake fixed on the way

The full e2e run surfaced `resources.spec.ts` failing on a selection preview showing `"Al"`
where `"Alpha"` was expected — five `Shift+ArrowRight` presses, three of them swallowed. The
spec already guards this race by waiting for the caret lens before sending selection keys, but
that only proves the *first* key can land; individual keys can still be lost mid-flight,
leaving a short selection that then fails every retry of a plain assertion. Fixed the way this
repo fixes races — re-drive the whole selection inside `expect(...).toPass()`, so a lost key
costs another round instead of the run. Verified over three consecutive spec runs plus a full
suite pass. Unrelated to the docs work, but it was in the gate output, so it got fixed rather
than re-run until green.

## Verification

`pnpm check` 0/0 · vitest **350/350** · build clean · companions OK (two source comments cited
moved plan paths; `runtime.ts.md` gained the reference its file's header carries) · e2e
**19/19**.

Link integrity was checked mechanically across every relative markdown link under `docs/` plus
AGENTS.md and CLAUDE.md: **54 broken links before this change, 0 after.** Links *inside* the
archive are deliberately left alone where a record points at its own moment in time.
