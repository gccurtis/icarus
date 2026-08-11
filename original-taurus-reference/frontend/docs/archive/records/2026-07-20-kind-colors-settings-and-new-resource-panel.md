# Change record — 2026-07-20 — Kind colors, resource settings, reliable select, new resource panel

Several resource-table + create-flow refinements: product-matched kind colors, a
reliable multi-select, a per-resource settings modal, and the create carousel becomes a
full-width "new resource panel" with Create-with-AI built in.

## Kind colors (traditional product palettes)

```ts
spreadsheet: 'success' (green), slides: 'attention' (amber), chat: 'intel' (violet), board: 'focus' (cyan)
```

**Why:** the kinds should echo the products they resemble. **How:** `kindMeta` tones now
map document → blue (Word), spreadsheet → green (Sheets/Excel), slides → amber
(PowerPoint), **chat → violet** (it's an AI chat space, so it shares the AI/intel
color), board → cyan.

## Reliable multi-select

```svelte
<button aria-pressed={isSel} onclick={(e) => toggleRow(e, r.id, i)}>{#if isSel}<Check/>{/if}</button>
```

**Why:** the native `<input type="checkbox">` wasn't reflecting the checked state
(preventDefault + controlled `checked` fought each other), so rows didn't appear to
select. **How:** replaced both the row and select-all checkboxes with **custom buttons**
whose fill/check is purely state-driven — no native checkbox to fight. Shift-click range
select is unchanged.

## Per-resource settings modal

```svelte
<IconButton label="Resource settings" onclick={…}><Settings/></IconButton>
<ResourceSettingsDialog bind:open resource={settingsResource} {kindMeta} {onrename} {onremove} />
```

**Why:** each resource needs its own settings. **How:** the row kebab is replaced by a
**settings gear** that opens a new
[`ResourceSettingsDialog`](../../../src/lib/features/stages/ResourceSettingsDialog.svelte) —
kind identity, **rename** (real, via a new `renameResource` in the store), mock per-kind
options, and **Remove** (moved here from the kebab). `ResourceTable` gained an `onrename`
prop; both stages wire it to `renameResource`.

## New resource panel (Create-with-AI built in)

```svelte
<!-- NewResourcePanel: [ Create with AI ] | divider | New document · New spreadsheet · … -->
```

**Why:** the user wanted Create-with-AI in the create row (far left, with a divider) and
the whole thing to read as a panel, not a "carousel." **How:** renamed
`CreateResourceRow` → [`NewResourcePanel`](../../../src/lib/features/stages/NewResourcePanel.svelte):
a full-width `surface-panel` with the intel-toned **Create with AI** button on the left,
a divider, then the per-type creates (each `flex-1`). It emits `onai()`; Overview now
also mounts `AiCreateDialog` (previously only the launcher did), so AI create works from
both stages.
