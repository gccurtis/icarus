# Architecture migration, endpoint wiring, and slide editor

## Data layer architecture migration

Reorganized `src/lib/data/` into `src/lib/systems/` — 6 domain systems (session, projects,
resources, workspace, documents, ai-agent, identity-directory) each with focused files
for types, stores, API, mocks, and actions. Added `src/lib/services/` for cross-cutting
coordination (identity resolution, project runtime). Added import aliases `$data`,
`$systems`, `$services`.

Unified scattered infrastructure:
- `data/time.ts` — single time formatting module (4 scattered implementations → 1)
- `data/project-retry.ts` — 409 retry wrapper (3 duplicate patterns → 1 function)
- `utils.ts` — slug() (3 private copies → 1 public export)
- `resources.ts` — toKind() exported (duplicate in overview.ts removed)
- `components/MockBadge.svelte` — shared mock indicator (19 inline → 1 component)
- `components/IdentityHoverCard.svelte` — universal hover card with portalled mode

Built the Resource Registry (`systems/resources/registry.ts`):
- Per-kind runtime factory registration (document registered, slides/sheets/chats ready)
- `active()` query for sibling coordination (QB, panels, stages)
- Workspace subscriber for hard project isolation (dispose on project/tab change)

Scoped aiAgent store per-project — workspace subscriber resets on project switch.

## Wire real Omega endpoints

Document history: replaced 3 mock entries with real `GET /history` + `undoChange`/`redoChange`.

Document names/formulas: replaced 4 mock entries with real `GET /names` + `POST /evaluate`.

Session presence: polling `GET /sessions` every 30s, filtered by document ID, displayed
in document bar. Removed hardcoded Maya Chen / Owen Park.

Identity resolution: `resolveFromUserId()` calls `GET /users/:userID` with in-memory
cache. Activity feed and history panel now show real names instead of email addresses.

## Slide editor (mock, Fabric.js)

Installed Fabric.js 7.4.0. Built mock slide editor with:
- `FabricCanvas.svelte` — mounts Fabric.js on canvas ref, bridges deck store ↔ Fabric objects
- `SlideListPanel.svelte` — context panel with thumbnails, drag-to-reorder, right-click delete
- `SlideActionsPanel.svelte` — inspector panel with add text box / add rectangle
- `SlideStage.svelte` — top bar (name, presence) + FabricCanvas center
- Panel contributions via `activeSurface` (context + inspector rails)

Slide data model: Deck → Slides (indexed, no names) → Objects (text, shape) with sections for future grouping.

Slides resource kind enabled as creatable mock — local store, no Omega persistence.

## Tests

163 tests across 13 files covering: time formatting, slug, toKind, project-retry (409 recovery),
UserService (all resolve methods), ResourceRegistry (register/acquire/active/dispose/isolation),
aiAgent (project switch reset, prompt edge cases), deck store (object CRUD, selection,
reorder, delete, null-safety), history API (operationLabel, scopeLabel, fetchDocumentHistory),
presence store (polling, dedup, document filter), names API.

## Docs

- `docs/integration/omega-integration.md` — complete mock vs Omega capability audit
- `docs/integration/backend-contract.md` — Omega work requests (endpoint + capability)
- `docs/integration/alpha-implementation-plan.md` — Alpha implementation checklist
- `docs/plans/2026-07-24-runtime-architecture.md` — layered runtime model
- `docs/plans/2026-07-24-data-layer-architecture-migration.md` — migration plan
- `docs/plans/2026-07-24-slide-editor-fabric.md` — slide editor architecture
- `docs/plans/2026-07-24-slide-editor-checklist.md` — implementation checklist
