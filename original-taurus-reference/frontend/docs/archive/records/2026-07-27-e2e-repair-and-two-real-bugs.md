# 2026-07-27 — Repairing resources.spec.ts, and the two real bugs it was hiding

`resources.spec.ts` had been failing since 2026-07-23 and a wandering second failure had been
written off as "serial-run load". Both explanations were wrong. **The suite is now 12/12, verified
over three consecutive full runs**, and two genuine product bugs came out of the investigation.

## B4 — two kinds of 409, conflated (data loss)

Omega answers **409 for two unrelated conditions**:

- a genuine **revision conflict** — the ops no longer match the server document;
- the **`requireProject` gate** — `{"error":"select a project first"}`, returned by middleware
  *before the handler runs*, so nothing was applied.

`SyncEngine.flush` treated every 409 as the first kind:

```ts
if (isApiError(e) && e.status === 409) {
  this.overlay.settle(extras);   // ← queued ops discarded
  await this.reload();           // ← document rebuilt from server truth
}
```

So a stale session project cell made the editor **throw away unsaved edits and collapse the user's
selection** (`restoreSelection` can only put back a caret, never a range) — for a condition that
only needed the project re-selected. `load` already went through `withProject`; the write path was
the one project-scoped document call that did not.

```ts
const changeSet = await withProject(this.projectId, () =>
  appendChanges(this.docId, this.revision, ops)
);
```

A 409 that *survives* the select-and-retry is the real conflict, and the existing catch handles it
unchanged. `reload` is wrapped the same way.

**How it was found.** An e2e assertion failed intermittently; the DOM selection was collapsed while
the editor was still focused. Omega's own log showed the `"select a project first"` 409s. The
mechanism was then confirmed in isolation: `model/sync.test.ts` has three tests, and **two of them
fail when the wrapper is removed** — checked by removing it.

## B5 — `setNameValue` could never have worked

Omega decodes the body into a `formula.Value`. Its `UnmarshalJSON` requires `kind`, exactly the one
payload field that kind allows, and a **mandatory `shape`** that must equal the payload's own shape:

```go
if raw.Shape == nil || *raw.Shape != decoded.Shape() {
    return fmt.Errorf("formula: value shape does not match its payload")
}
```

The client sent the bare scalar (`42`, `"text"`, `true`), which is rejected with
`400 invalid JSON body` **every time** — so creating a literal named value has never once
succeeded. `taggedValue()` now builds the envelope; numbers travel as strings because formula
arithmetic is exact rational and must not round-trip through a binary float. All four scalar kinds
were probed against the live backend before settling the shape.

## UX1 — two inspector lenses are unreachable (recorded, not fixed)

`3866771` (2026-07-23) removed the left-gutter row/block handles, stating that "block/row inspection
now flows entirely from the editor's own selection". But `deriveSelection`'s live branch only ever
yields `none`/`block`/`new-block`/`new-text`/`run` — `row` and `blocks` come **only** from a pinned
`InspectionOverride`, which only `inspectAnchor` sets, and the gutter was its only caller.

So `RowLens` and `BlocksLens` cannot be opened, and alignment / add-column are reachable only
through a non-text block. `runtime.inspectAnchor` is dead code (catalog **D6**) but is deliberately
**not** deleted: it is the implementation those lenses would need back. Filed as catalog **UX1** —
it is a design decision about the entry point, not a mechanical fix.

## The spec repair

`resources.spec.ts` had drifted against three separate changes. What it asserted, and what is true:

| Was | Now |
| --- | --- |
| `Block type` control | `Text type` (Block lens) / `Style` (the text lenses) |
| `Font`, `Font size` | `Font family`, `Font size (px)` |
| Font value = `IBM Plex Sans` | empty + `Default font` placeholder — the control shows the **explicit** inline font, not the resolved cascade |
| `Quote (Mock)` | `Wrap selection in quotation marks` — a real edit |
| `Row height` (absolute, min 48) | `Line spacing` (increase above standard, min 0) |
| `Pages: 1`, Pages metric, Page size/height | gone with pagination (workstream B) |
| `Select full block`, gutter handles | gone (`3866771`) |
| Formula creator · Mock | real Name Manager (`New name` → `Create`) |
| Comments/History/AI-tasks mock cast (Maya Chen, canned rows) | real, empty on a fresh document |
| Plan mode's canned steps + `Accept plan` | real agent turns |
| `availableKinds` pinned to `['document']` | `toContain('document')` — server truth that grows |

Dropped coverage is marked **in place**, at the line where it used to run, with why and what has to
change for it to come back — rather than silently deleted.

## One genuine harness artefact

ProseMirror syncs its state from the DOM `selectionchange` event asynchronously. Playwright clicks
and types far faster than a person, so a key sent in the same millisecond as a click is applied to
the selection the click was *replacing* — Enter then replaces the old range instead of splitting at
the caret, silently corrupting the document under test. This was diagnosed, not guessed: probing
`window.getSelection()` after each step showed the DOM selection collapsed while ProseMirror still
held the range.

Fixed by settling on the app's own signal where one exists (waiting for the lens to change), and a
documented `clickIntoEditor` helper otherwise. This one really is test-harness speed — but it was
established by measurement, after the two real bugs had been ruled in.

## Verification

`pnpm check` 0 errors / 0 warnings · **330 unit tests** (up from 327; +3 for the 409 split) ·
`pnpm build` clean · companions fresh · **full e2e 12/12, three consecutive runs**.
