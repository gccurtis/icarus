# ORIENTATION — read this first (full-integration effort)

Continuation guide for the Alpha↔Omega integration push. If you're resuming after a
compaction, start here. Last refreshed 2026-07-26 (after the doc-model adaptation).

---

## Status: the block-model migration LANDED and the frontend is adapted

Omega finished the block-model overhaul (record 0079–0082 + follow-ups): the document
model is now **7 kinds** — `text` (carrying a semantic **`subKind`**), `code`, `callout`,
`list`, `divider`, `image`, `prompt` — with **inline `font`/`fg`/`bg` typography** resolved
down a **5-level cascade** (inline → block-override → sub-kind → document-default → built-in),
a general block **`indent`**, and **native lists**. Omega wiped existing documents once on
first boot under the new model.

**The Alpha document editor has been fully adapted to this** (doc-model Stages 1–5, all on
`main`). It is no longer mid-migration — build normally. If the backend moves again, re-check
`taurus-omega` `core/capability/document/model.go` before assuming a shape.

## The mission

Integrate **everything Omega backs today**, each piece **documented** and, per the principle
**nothing is hidden**, either integrated or made visible + tracked (never hidden). Verify with
`pnpm check` + `pnpm test` + a live check on `:8443`.

## Shipped so far (git log on `main`, newest first)

- **Doc-model adaptation (Stages 1–5)** — the editor speaks the new `text`+`subKind` model:
  `447c1b3` engine core (kinds + subKind + bridge/diff), `c083906` inline typography + inspector
  redesign (Font/Text-fg/Fill-bg marks, Insert element, Indent, new-block typography),
  `1fcbbf3` native lists (bullet/ordered/check + nesting + click-to-check), `63fb864` document
  default font. Records: `docs/records/2026-07-26-doc-model-*.md`.
- `ef79b88` — **B2a**: un-mocked the AI dock against real Omega chats/turns/tasks (+ companions).
- **B2b** (`aad6780`, `f47ab46`) — finished the AI dock: persona picker, Ask-only Web toggle,
  honest context badging, real chat attachments.
- **G4** (`6612ba2`, `66741dc`) — resource pinning + access scope; **Organizations** (module +
  account-menu manager + access-by-org).
- **B6** (`ee6136a`) — Name Manager full CRUD (edit / delete / value).
- **Templates G1** (`1442d0c`) — real `GET /documents/templates` carousel + create-from-template.
- **Phase G** (`883ae33`) — real project member summary (avatar cluster) on the projects list.
- **Phase F** (`0722482`) — per-user workspace state (cross-device tabs + panels; degrades on 404).
- **Companion overhaul** (`c1c916b`, `725b0a1`, `4bcf453`, `2e5ade6`) — the whole repo is now
  multi-section + byte-exact (149 companioned), gated by `scripts/verify-companions.mjs`.
- `62060d6` — re-ordered the plan around the migration; earlier: A1 fonts, import/export, B1
  prompt, B3 comments, B5 references, B4 task polling, AI-create.

## What's next

**Every buildable integration is shipped.** What remains is deferred:

- **Windowed row reads — DEFERRED** (decided 2026-07-26): the editor keeps loading the whole
  document (`GET /documents/:id`). It's an editor-core change (the diff needs the whole doc in
  memory), not a data-layer bolt-on — see Task 4.3 in the plan for the shape when it's picked up.
- **Notifications (G2)** — discuss the shape first (an ephemeral destructive-drain channel, not
  the settings toggles). The existing `toast()` stays.
- **pdf/docx export/import options** — most deferred, badged mock. Markdown import/export stays real.
- **4 giant companions** (`runtime.ts`, `DetailsPanel`, `DocumentStage`, `bridge.ts`) + the 2 e2e
  specs — still single-fence, allowlisted in the verifier for a focused multi-section follow-up.
- Backend: the **chat/agent-unification** request (per-chat personas) is filed and awaiting Omega.

## Decisions locked (do NOT re-litigate)

- **Doc model is DONE (Stages 1–5).** Text type = **sub-kind** (Body + Heading 1–6) via
  `set_block_subkind`; **Insert element** = code / callout / divider / list / prompt. **Callout is
  a real kind** (not a sub-kind). **Quote is gone** (markdown imports it as body text). `image` is
  the only kind still round-trip-only (renders as a read-only placeholder; the Files/upload pass is
  separate). Lists are the native `list` kind (flat items with a `level`), diffed via `set_block_data`.
- **Typography is inline + cascading.** Font/size/**fg**/**bg** are inline **marks**
  (`setInlineStyle`) over a selection or stored for next-text; block-override `CustomTypography`
  carries `fg`/`bg`; the **document default** is `set_default_typography` (Layout panel). The color
  terminology is **`fg`/`bg`**, not color/background.
- **Persona picker is interim.** It sets the per-user default (`PUT /personas/default`) — the
  only lever today. The real model (a persona **per chat**, tasks that adopt it and speak back
  through their chat) is requested in
  [`chat-agent-unification`](../../backend-requests/chat-agent-unification.md); rewire the picker
  when it ships.
- **Companions are multi-section + byte-exact** (AGENTS.md Practice 1). Never a single
  whole-file fence; verify with `scripts/verify-companions.mjs`.
- **Notifications** may come soon; build nothing yet, discuss the shape first.
- **pdf/docx options** are the most deferred (after notifications).
- **Nothing hidden** — visible + tracked over hidden.

## Working conventions (must follow)

- **Companions (Practice 1):** every touched `*.ts`/`*.svelte`/`*.css` (except `src/lib/components/`)
  has a `<file>.md` whose fenced code blocks reproduce the source **byte-for-byte**; update it in the
  same change. Test files (`*.test.ts`) have **no** companion. For large multi-file changes, a small
  node script that writes `<file>.md = intro + one fenced block of the source` is byte-exact and fast
  (see the doc-model commits); verify with the extract-and-compare check.
- **Change record (Practice 2):** one `docs/records/YYYY-MM-DD-<slug>.md` per commit.
- **Gates:** `pnpm check` + `pnpm test` green before every commit. Commit to `main`; trailer
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Verify ops:** `:8444` = a fresh Omega build; `:8443` = the user's live engine-enabled stack
  (proxied from the alpha dev server on `:5173`). Use `node` (not `python3`) for JSON.
- **No headless browser here** (Playwright can't launch Chrome), so interactive UI E2E is done by
  the user on `:5173`; verify logic with unit tests + contract-match to the Omega source, and say so.

## Doc map

| Doc | Purpose |
| --- | --- |
| [integration-completion plan](../../superpowers/plans/2026-07-26-integration-completion.md) | **Current driver** — companion redo + backend request + remaining features |
| [integratable-now](2026-07-25-integratable-now.md) | What Omega backs + what we build |
| [backend-outstanding](2026-07-25-backend-outstanding.md) | What Omega still needs |
| [doc-model records](../../records/) | `2026-07-26-doc-model-*.md` — the 5 stages, in detail |
| [AGENTS.md](../../../AGENTS.md) | Conventions (companions, change records, style) |

Superseded roadmaps (the A2 plan/spec, the prior full-integration plan, the playwright harness)
are archived in [`docs/archive/`](../../archive/README.md).

## Gotchas learned

- **The bridge diff distinguishes** a kind change (`set_block`) from a text sub-kind change
  (`set_block_subkind`); lists diff via `set_block_data` (whole payload, deduped by a structural
  signature that ignores atom ids). Don't reintroduce per-item list ops without need.
- `flush()` snapshots `pendingOps` by copy (`[...this.pendingOps]`), never by reference.
- Omega source: `/home/jakul/cyberia/taurus-omega` (routes: `core/transport/transport.go`;
  capabilities: `core/capability/*`; block model: `core/capability/document/model.go`).
