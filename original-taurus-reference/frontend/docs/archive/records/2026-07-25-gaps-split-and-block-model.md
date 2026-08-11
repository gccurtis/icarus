# Ready-vs-gapped split, backend-gaps doc, and the block/style architecture decision

Follow-up to the UX audit after user direction: (1) make the ready-vs-gapped split unambiguous,
(2) put the genuinely-gapped items in their own backend TODO, and (3) record the internal block/style
model decisions. Driven by a full read of Omega's route table (`core/transport/transport.go`).

## Corrections to the audit (I had several wrong)

A full route inventory showed **references, import, export, files, and AI-create are NOT gaps** — they
have real Omega routes:
- `GET /documents/:id/references` + `/backlinks` (real reference graph from inline links).
- `POST /documents/import` + `GET /documents/:id/export` (**Markdown**; pdf/docx are Omega follow-ups).
- `/files` (upload/download/meta) for images/attachments.
- `/resources/generate` (AI-create → an Action task).

The **genuinely gapped** set is only: document **templates**, **user notifications**, **pdf/docx**
formats, and **resource visibility/options** (unverified). Prompt-block is backable and has
`prompt_test.go` in Omega.

## New docs

- `docs/backend-requests/alpha-remaining-gaps-2026-07-25.md` — the backend TODO: just G1–G4, plus a
  "ready" table for contrast.
- `docs/architecture/document-block-and-style-model.md` — the internal three-axis block model (kind ×
  semantic style × custom typography) and the resolved product decisions: the **semantic style
  registry is internal** (kept, not surfaced); user-facing controls are **Add/Create element** (kind)
  + **Text type** (semantic type; "body" kept) + real **font/size/color** (custom typography, per
  block). One open mapping question recorded: does "Header 1" set kind, style, or both (recommended).

## Audit updated

`docs/integration/current/alpha-ux-audit-2026-07-25.md` now leads with a ready-vs-gapped TL;DR,
reclassifies references/import/export as READY, resolves the two prior open decisions, and links the
two new docs.

Docs-only; no code changed. Direction also refreshed in session memory.
