# Change record — 2026-07-20 — Kebab menu, resource-panel restyle, templates carousel

Refines the resource-table row menu, the new-resource panel, and the New-tab layout.

## Row kebab menu (back), per-kind settings

```svelte
items={[
  { label: `${meta.label} settings`, onselect: … },  // "Document settings", etc.
  { label: 'Share link', onselect: () => shareResource(r) },
  { divider: true },
  { label: 'Remove', danger: true, onselect: () => onremove(r) }
]}
```

**Why:** the standalone settings gear was replaced by the requested three-dots dropdown.
**How:** the row actions are Download + a **kebab** whose menu is **per-kind** —
**"{Kind} settings"** (opens `ResourceSettingsDialog`), **Share link** (mock — copies a
resource link + toast), and **Remove**. Visibility is deliberately *not* here — it lives
in the settings modal.

## Resource settings: visibility

**Why:** changing visibility belongs in a resource's settings. **How:** added a mock
**Visibility** control (Private / Anyone with link) to `ResourceSettingsDialog`, beside
the (real) rename and remove.

## New resource panel: background-free, no scroll, "AI create"

```svelte
<div class="flex w-full items-stretch gap-1"> … </div>   <!-- was surface-panel + overflow-x-auto -->
```

**Why:** the panel's background muted the purple AI button and it shouldn't scroll. **How:**
dropped the container background (buttons sit on the stage; each create button gets a
`hover:bg-panel`), removed the scroll, shortened **Create with AI → AI create**, and
tightened spacing so it fits on one row. It's now a plain panel of clickable surfaces,
not a carousel.

## New tab: templates carousel first, restyled

```svelte
<div class="tmpl-scroll … overflow-x-auto rounded-panel bg-canvas p-2 shadow-[inset_…]">
  <button class="surface-panel … hover:-translate-y-0.5 hover:bg-elevated hover:shadow-overlay">…</button>
```

**Why:** the launcher should lead with templates, and the templates should read as a real
carousel. **How:** reordered to **templates → new resource panel → table**. The templates
carousel now has a **recessed `bg-canvas` background** and scrolls; its cards have their
own `surface-panel` background and **lift on hover**, so they float within the carousel.
