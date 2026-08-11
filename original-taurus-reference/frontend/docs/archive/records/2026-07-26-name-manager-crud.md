# 2026-07-26 — B6: Name Manager full CRUD (edit, delete, value)

The Name Manager panel was wired for **create-formula + read + evaluate** only; the data
layer already exported `deleteProjectName` and `setNameValue`, but no UI called them. This
change verifies the manager end-to-end by wiring the missing operations — **delete**, **edit**,
and literal **value** assignment — so every `/projects/:id/names/*` route the client exposes
now has a control.

All routes were already present and correct in `systems/projects/api.ts`; this is a
frontend-only change that surfaces them.

## Delete a name (inline confirm)

```svelte
<!-- per-row, on hover -->
<IconButton label={`Delete ${entry.name}`} onclick={() => (pendingDelete = entry.name)}><Trash2/></IconButton>
<!-- when pendingDelete === entry.name -->
Delete? <IconButton onclick={() => confirmRemove(entry.name)}><Check/></IconButton> <IconButton onclick={() => (pendingDelete = null)}><X/></IconButton>
```

`confirmRemove` calls `deleteProjectName(projectId, name)` (`DELETE …/names/:name`) then
reloads. A two-step inline confirm (trash → Delete? ✓/✗) guards the destructive action
without a modal, matching the panel's compact side-rail layout.

## Edit an existing name

```ts
function openEdit(entry: NamesEntry) {
  editingName = entry.name;
  assignedName = entry.name;               // fixed — Omega upserts, there is no rename
  if (entry.type === 'function') { mode = 'formula'; formula = entry.source ?? ''; void handleEvaluate(); }
  else { mode = 'value'; literal = entry.value == null ? '' : String(entry.value); }
  creatorOpen = true;
}
```

A pencil action reopens the creator pre-filled: a function loads in **Formula** mode with its
source; any other entry loads in **Value** mode with its current value. The name field is
disabled while editing because the backend has no rename — re-saving upserts the same name via
`PUT …/function` or `PUT …/value`. The modal title and primary button switch to Edit/Save.

## Assign a literal value (un-mocks `setNameValue`)

```ts
function parseLiteral(raw: string): unknown {
  const s = raw.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s !== '' && Number.isFinite(Number(s))) return Number(s);
  return raw;
}
// Value mode: setNameValue(projectId, name, parseLiteral(literal))  → PUT …/names/:name/value
```

The creator gained a **Formula | Value** toggle. Value mode assigns a literal — boolean,
number, or text — through `setNameValue` (`PUT …/names/:name/value`), which previously had no
UI. Numeric and true/false inputs are coerced so the stored JSON matches its type; everything
else is stored as text. (The "Formula creator" button is renamed "New name" to cover both.)

## Verification

- `pnpm check` — 0 errors, 0 warnings. `pnpm test` — 271 passed (no regressions; this is UI
  wiring of already-tested data-layer routes).
- Routes exercised match the existing client: `PUT …/function`, `PUT …/value`,
  `DELETE …/:name`, `POST /evaluate`, `GET …/names`.
- Companion byte-verified.
- Live UI E2E pending (no headless Chrome). To try it on `:8443`: in a document, open the
  Names panel → **New name**, create a Value (e.g. `mass = 42`) and a Formula; then hover a row
  to **edit** or **delete** it.
