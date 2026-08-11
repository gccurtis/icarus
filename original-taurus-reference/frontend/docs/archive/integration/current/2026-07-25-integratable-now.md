# Integratable now — Omega capabilities + Alpha plan (2026-07-25)

Re-audited against **Omega `HEAD` = `f8774ab`** (2026-07-25) — its registered routes
(`core/transport/transport.go`) and capabilities (`core/capability/*`). This and its
companion [`2026-07-25-backend-outstanding.md`](2026-07-25-backend-outstanding.md) are
the **live** integration view; the earlier audit/plan/contract are frozen in
[`../old/`](../old/README.md).

> **Guiding principle (revised 2026-07-25): nothing is hidden.** We do **not** hide a
> surface because the backend isn't ready — hiding means we forget to build it. Every
> surface is either **integrated** (below) or **tracked as an outstanding need**
> (companion file), so it stays visible on our radar.

> **Why this re-audit:** since the last pass Omega shipped a large batch straight from
> our gap list — **templates, notifications, resource access/attributes/pinning,
> windowed row reads, live-web chat context, organizations**. Most of what we had
> slated to "hide" is now buildable. This file recuts the plan around that.

## 1. Already integrated (landed on `main`)

Un-mocked against Omega, verified, committed: **A1** real fonts (`set_block_custom_typography`),
**Markdown import/export**, **B1** prompt-block editing, **B3** comments (+replies),
**B5** references + backlinks, **B4** AI-task polling, **AI-create** (`/resources/generate`).

## 2. In flight — A2 (designed + planned, fully backable today)

Block kinds **code / callout / divider** + inspector redesign (Insert element; Extra
formatting: Text type + Line spacing; new-block typography) + Layout cleanup. Spec:
[`../../superpowers/specs/2026-07-25-a2-block-kinds-design.md`](../../superpowers/specs/2026-07-25-a2-block-kinds-design.md);
plan: [`../../superpowers/plans/2026-07-25-a2-block-kinds.md`](../../superpowers/plans/2026-07-25-a2-block-kinds.md).
Uses only shipped ops — no backend dependency.

## 3. Newly available in Omega — ready to wire (the delta)

Each is a real, shipped capability. Confirm exact request/response shapes at wiring
time (translate at `src/lib/data|systems/*`, per AGENTS.md).

| Capability | Omega surface | Alpha surface to wire | Was |
| --- | --- | --- | --- |
| **Templates** | `GET /documents/templates`; `Base.Template` = `TemplateInfo{ isTemplate, variables[] }`; create-from-template via `POST /documents { fromTemplateId }`; mark-as-template via a `set_template` changeset op | NewTabStage **Templates** carousel → real templates + "save as template"; template context variables | gap **G1** (mock) |
| **Notifications** | `/notifications` — `Toast` + `Notifications` (ephemeral in-app feed) | **DEFERRED (2026-07-26): build nothing yet** — do it last, after every other phase, and discuss the shape first. It's an ephemeral drain-toast channel, not the preference toggles the settings panel mocks; the existing `toast()` stays. | gap **G2** (mock) |
| **Resource access & options** | **PATCH** `/resources/:kind/:id/access` (`AccessScope{ projectWide, orgIds[], userIds[] }`, **owner-only**) + **PATCH** `/resources/:kind/:id/attributes` (`{ pinned }`); both are read off the resource **summary** (no GET) | ResourceSettingsDialog **Access** (scope) + **pin** | **G4 shipped** |
| **Windowed row reads** | `/documents/:id/{descriptor,row-manifest,rows,rows/locate}` + `/documents/revision-hints` (**no `/missing` route exists** — that was a doc error) | Bounded large-doc load in the runtime (the `ensurePageRange`/`rowRepository` seam already scaffolds this) | **DEFERRED** — editor-core change (the diff needs the whole doc); full-doc load kept |
| **Live-web chat context** | agent `web.go` — per ask-turn live web | B2 dock: a per-turn **Web** toggle | noted "absent" |
| **Organizations** | `/organizations`, `/organizations/:orgID/members[/:userID]` | Org membership UI (account-menu manager); also feeds resource `AccessScope.orgIds` | **shipped** |

## 4. B2 — the AI Quarterback dock (the main remaining integration)

Now strongly backable — Omega has a first-class **chat** capability plus a rich agent
surface:

- **Chats:** `GET/POST /agent/chats`, `/agent/chats/:id/turns` (userTurn + agentTurn; a chat may pin `resourceId`; a turn carries `taskId`).
- **Tasks:** `/agent/tasks`, `/agent/tasks/:id` (live state; **doc-scoped**), `/agent/plans`, `/agent/actions`, `…/plans/:planID/accept`.
- **Personas:** `/personas`, `/personas/default`, `/personas/:id` (+ `/versions`, `/revisions`, `/tasks`).
- **Live-web** per ask turn; **model fallback chains** per cast; Plan strict-mode 400 fixed.

**Wire (Goal 3.3):** replace the mocked `ai-agent` store with real chats + turn/task
polling, the persona dropdown (default **General**) beside the mode selector, **task ↔
chat** (double-click a task → its chat via the turn `taskId`), live task **progress**,
and the per-turn **Web** toggle. Drop the MockBadge + mock copy. Per the no-hide rule,
the one genuinely-absent bit — **attachments** — stays visible and is tracked in File B
(not silently removed).

## 5. Small

- **B6 — Name Manager:** already wired to `/projects/:id/names/*`; verify create/edit/delete end-to-end on `:8443`.

## 6. Recommended order (revised 2026-07-26)

Live status — the current driver is the
[integration-completion plan](../../superpowers/plans/2026-07-26-integration-completion.md):

- ✅ **Shipped (all buildable integrations):** doc-model Stages 1–5, **B2a + B2b** (AI dock incl.
  attachments), **G4** (resource pinning + access), **Organizations**, **B6** (Name Manager CRUD),
  **Templates (G1)**, **project member summary (Phase G)**, **per-user workspace state (Phase F)**,
  plus the full **companion overhaul** (149 companioned, verifier-gated).
- ⏸️ **Deferred:** **windowed row reads** (editor-core change — the diff needs the whole doc in
  memory; full-doc load kept); **Notifications (G2)** (discuss the shape first); **pdf/docx
  export/import options** (most deferred, badged mock); the 4 giant single-fence companions.

What still needs backend work is in
[`2026-07-25-backend-outstanding.md`](2026-07-25-backend-outstanding.md); the per-chat persona
model is filed as `chat-agent-unification`.
