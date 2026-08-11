# Remaining Omega gaps blocking Alpha (2026-07-25)

The **short** list of Alpha surfaces that Omega genuinely **cannot** back today — the backend TODO.
Everything else the document + AI cockpit needs is already backable (see the ready list at the bottom
and the full audit `../integration/current/alpha-ux-audit-2026-07-25.md`). Verified against Omega's
registered routes (`core/transport/transport.go`) + capabilities on 2026-07-25.

> Corrects earlier notes: **references, import, export, comments, files, and AI-create are NOT gaps**
> — they have real Omega routes.
>
> **Update 2026-07-25 (Omega `f8774ab`):** Omega has since shipped **G1 (templates)**, **G2
> (notifications feed)**, and **G4 (resource access/attributes/pinning)** — these are now
> *integratable*, not gaps (see
> [`../integration/current/2026-07-25-integratable-now.md`](../integration/current/2026-07-25-integratable-now.md)
> §3). The genuinely-remaining backend gaps are **G3, G5, G6**; the full outstanding list is
> [`../integration/current/2026-07-25-backend-outstanding.md`](../integration/current/2026-07-25-backend-outstanding.md).

## G1. Document templates — ✅ SHIPPED — integrate — **P3**

> **Shipped** in Omega (`ce27803`): `GET /documents/templates` + `Base.Template`. Integrate per
> [`../integration/current/2026-07-25-integratable-now.md`](../integration/current/2026-07-25-integratable-now.md)
> §3 — do not hide.

**Alpha surface:** `NewTabStage.svelte` "Templates" (MockBadge) — start a new document from a template.
**Omega:** no template store/API. (`/documents/duplicate` clones an existing doc; `/resources/generate`
AI-generates one — neither is a curated template library.) The only "template" in Omega is internal
**prompt** templates for resolution, unrelated.
**Proposed:** a project (or global) template library — `GET /templates`, `POST /documents` with a
`templateId`, or a "save as template" on a document. **Or** decide templates are a *frontend-only*
concept (canned starting content the client owns) and drop the backend need. **Product decision.**
**Meanwhile:** hide the Templates affordance (per "nothing mocked").

## G2. User notifications — ✅ SHIPPED (feed) — integrate — **P3**

> **Shipped** in Omega (`de9b047`): a `/notifications` ephemeral feed (`Toast`/`Notifications`).
> Integrate the feed; **verify** whether user *preference toggles* still need backend work (below).

**Alpha surface:** `UserSettingsDialog.svelte` "Notifications" (MockBadge).
**Omega:** no notifications capability or routes.
**Proposed:** a notifications service (preferences + a feed) — e.g. `GET /notifications`,
`PATCH /notifications/preferences`. Large; likely out of near-term scope.
**Meanwhile:** hide the Notifications settings section.

## G3. Non-Markdown export / import (PDF, DOCX) — partial — **P3**

**Alpha surface:** `ExportDialog.svelte` / `ImportDialog.svelte` (MockBadge).
**Omega:** **Markdown** export (`GET /documents/:id/export`) and **Markdown** import
(`POST /documents/import`, needs the file store) **exist** — so Markdown import/export is *ready to
wire now*. Omega's own comment marks **pdf/docx as follow-ups**.
**Proposed:** additional export/import formats — `GET /documents/:id/export?format=pdf|docx` and the
matching import. **Meanwhile:** implement Markdown import/export for real; offer only Markdown until
the other formats land (don't show pdf/docx as working).

## G4. Resource visibility / options — ✅ SHIPPED — integrate — **P3**

> **Shipped** in Omega (`0de183d`/`a5a08d7`): `/resources/:kind/:id/access` (`AccessScope`),
> `/resources/:kind/:id/attributes`, and resource pinning. Integrate in ResourceSettingsDialog.

**Alpha surface:** `ResourceSettingsDialog.svelte` "Visibility" + "Options" (MockBadge).
**Omega:** resources have real CRUD (`/resources*`) but the resource model wasn't confirmed to carry
visibility/options fields. **Action:** verify the resource model in `core/capability/resource`; if
those fields are absent, file the specific field/route request; if present, un-mock (it's ready).

## G5. A `list` block kind + a general text indent level — no capability — **P2**

**Alpha surface:** the A2 document inspector's **list element** (a single list you insert and edit —
marker type, per-item checked, nesting) and the **Extra formatting → Indent level** control for text.
**Omega:** has only flat `list_item` (one block per line) with **no op to edit its data after insert**
(`set_block` changes kind only; no `set_block_data`), so it can't model "one list element with internal
items." And no block carries an **indent** level (only alignment / line height), so text indent has
nowhere to persist.
**Proposed:** a native `list` block kind (items held internally) + an `indent` field on `BlockStyle`
via `set_block_indent` — full request in [`list-block.md`](list-block.md).
**Meanwhile:** A2 **defers lists** and the indent control (hidden, not mocked); this pass ships the
other elements (code / callout / divider) + the inspector redesign (Text type + Line spacing).

## G6. Document & per-kind typography defaults (real fonts) — no capability — **P3**

**Alpha surface:** the A2 **Layout** panel's real-font defaults — a **page default font** and **body /
heading** defaults as real font/size/color (not semantic tokens).
**Omega:** custom typography (real fonts) is **per-block only** (`styleRef.overrides.custom` via
`set_block_custom_typography`); style definitions carry only semantic tokens, and there is no document-
or kind-level default font. Also a terminology mismatch: block kind `paragraph` vs semantic type `body`.
**Proposed:** document + per-kind default real typography + naming alignment — full request in
[`typography-defaults.md`](typography-defaults.md).
**Meanwhile:** the Layout panel shows **Page + Margins** only (the semantic token selects are removed —
the internal style registry stays, unsurfaced); real-font defaults appear when this lands.

---

## Everything else is READY (backable now — not a gap)

For contrast — these need **frontend** work only (Omega routes exist; some are behind `opts.*` config
guards that must be enabled on the running server):

| Surface | Omega route(s) |
|---|---|
| Real fonts (family/size/color) | `set_block_custom_typography` op |
| Block kind / text-type / insert-element | `set_block`, `insert_block`, `split_block`, `join_blocks` |
| Prompt-block editing + resolve | `set_prompt`/`resolve_block` ops, `POST /documents/:id/blocks/:id/resolve` (async) — has `prompt_test.go` |
| AI dock (chats/tasks/plans/actions/personas) | `/agent/chats`, `/agent/plans`, `/agent/actions`, `/agent/tasks`, `/personas` |
| Comments (+ replies) | `/documents/:id/comments`, `PATCH/DELETE /comments/:id`, `/comments/:id/replies` |
| References + backlinks | `/documents/:id/references`, `/documents/:id/backlinks` |
| Files / images | `/files` (upload/download/meta) |
| Markdown import / export | `/documents/import`, `/documents/:id/export` |
| AI-create a resource | `/resources/generate` |
| Name Manager | `/projects/:id/names/*` |
| Anchors (comment/reference pinning) | `/documents/:id/anchors*` |

**Config note:** several routes above are guarded by `opts.References`/`opts.Comments`/`opts.Files`/
`opts.Chats`/etc. in the composition root — confirm they're enabled in the running server's config
(`etc/config.local.yaml` on `:8443`). A disabled capability 404s; the client should degrade
gracefully (hide the surface) rather than error.
