# Change record — 2026-07-20 — Taurus theme toggle + table header controls

Two changes: clicking the center "taurus" wordmark now flips light/dark, and the
resource table's filter/sort/search fold into its header row.

## Light/dark theme, toggled from the wordmark

```ts
export const theme = writable<Theme>(initialTheme());
export function toggleTheme(): void { theme.update((t) => (t === 'eclipse' ? 'celestial' : 'eclipse')); }
```

**Why:** the app already had Celestial Light / Eclipse Dark token layers keyed off
`<html data-theme>`, but no way to switch. **How:** a new [theme.ts](../../../src/lib/theme.ts)
store mirrors the theme to `<html data-theme>` and `localStorage`; the center wordmark
in `ShellTopBar` becomes a button calling `toggleTheme`. A pre-paint inline script in
[app.html](../../../src/app.html) applies the saved/OS-preferred theme before first paint
(no flash), and the root layout imports the store to activate it app-wide. First run
follows `prefers-color-scheme`.

## Filter / sort / search folded into the table header row

```svelte
<div class="grid … border-b … bg-panel/50 px-4 py-1.5">
  {@render sortHeader('Name','name')} {@render sortHeader('Type','kind')} {@render sortHeader('Updated','updated', …)}
  <div class="flex items-center gap-1"> <Popover label="Filter">…</Popover> <Popover label="Search">…</Popover> </div>
</div>
```

**Why:** the separate controls row above the table was redundant — the column header can
own everything. **How:** the table's single header row now sorts on Name/Type/Updated
clicks (the standalone **Sort** popover is gone), and **Filter** + **Search** become
icon-only popovers (`size-8`, so they line up above each row's Download + kebab) on the
right of that row. The header always renders, so filter/search stay reachable even at
zero matches. `Popover` already positions with fixed coordinates, so the popovers
aren't clipped by the frame's `overflow-hidden`.

## Reverted mid-change

An experiment to drop the top-bar/tab-strip divider was reverted at the user's request
— the divider stays. No net change to `ShellTopBar`/`TabStrip` surfaces.
