# Markdown import / export

Real Markdown import + export against Omega, per user direction. Verified round-trip on a fresh
Omega build on `:8444`.

## Placement (per user)

- **Document editor bar**: a single quick **Export** button (downloads the current document as
  Markdown). No import here — import creates a *new* document, so it belongs at the project level.
- **"All resources" panel** (renamed from "Resources"): project-level **Import** and **Export**,
  both **modals**. Import = a Markdown file picker → new document → opens it. Export = pick one of the
  project's documents → download its Markdown.

## Omega

- Export: `GET /documents/:id/export` → raw Markdown (`text/markdown`; docx/pdf are follow-ups, G3).
- Import (two-step, needs `opts.Files`): `POST /files {name, contentType, content(base64)}` → `fileId`,
  then `POST /documents/import {fileId, name}` → new document.

## Alpha

- New `systems/documents/io.ts`: `exportDocumentMarkdown` (raw fetch, not the JSON `api` helper),
  `downloadMarkdown` (Blob + anchor), `importMarkdownFile` (base64 upload → import → `{id, name}`).
- `DocumentStage.svelte`: Export button in the bar's right zone.
- `ResourcesPanel.svelte`: Import + Export modal buttons + the two modals; `documentResources` filters
  the exportable kinds.
- `AppShell.svelte`: side-panel label "Resources" → "All resources".
- `Combobox.svelte`: (from A1) unchanged here.

## Verification

- `:8444`: export → `200 text/markdown` (correct content); upload → `201` + fileId; import → `201`
  new 2-row document. `svelte-check` clean; vitest 227/227; touched companions reproduce.

## Follow-ups

docx/pdf formats (G3, backend); verify against the live `:8443` (`opts.Files` must be enabled there).
