# 2026-07-27 — "All resources", header Import/Export, top-bar Share, no Notifications mock

A demo-readiness pass on the Overview + shell surfaces. The goal was to clear or honestly
surface the mocks a viewer would hit, per the user's direction: rename the resources section,
promote Import/Export to obvious header buttons, add a Share entry point (a mock modal whose
real model is designed later), and remove the non-functional Notifications toggles.

## Overview resources section renamed to "All resources"

```svelte
<!-- OverviewStage.svelte -->
<!-- All resources (eyebrow header matching Create/Activity); kept as a table -->
<p class="mb-2 shrink-0 text-label uppercase tracking-wide text-muted">All resources</p>
```

**Why:** the section previously read just "Resources"; the user wanted "All resources" so the
table reads as the project's complete catalog, matching the Create/Activity eyebrows above it.

## Import + Export as two buttons in the resource-table header

```svelte
<!-- ResourceTable.svelte — right control cluster -->
<button onclick={() => (importOpen = true)} …><Upload class="size-3.5" /> Import</button>
<button onclick={() => (exportOpen = true)} …><Download class="size-3.5" /> Export</button>
```

The easy-to-miss `+` import icon (only shown when `general` was creatable) is gone; Import and
Export are now labeled buttons next to Filter/Search, opening the existing **mock** dialogs
(`MockBadge` intact). Export targets the checked rows, or every visible row when nothing is
selected. Per-row download/menu is untouched.

**Why:** the user remembered import/export controls and wanted them clearly present in the
header. They stay mock on purpose for now — the buttons are the ask; wiring is later.

## Top-bar Share button + mock ShareDialog

```svelte
<!-- ShellTopBar.svelte -->
<IconButton label="Share" size="sm" onclick={() => (shareOpen = true)}><Share2 …/></IconButton>
<ShareDialog bind:open={shareOpen} {projectName} />
```

A new `ShareDialog` (a badged mock: a placeholder link + Copy, no real access change) opens from
a Share button placed between Export and the account menu.

**Why:** the user asked for a Share entry point in the top bar that opens a modal; the real
sharing model is deferred, so this is an honest, badged placeholder until then.

## Notifications section removed from User settings

```svelte
<!-- UserSettingsDialog.svelte: the mock "Notifications" block (email/mentions/product
     Switches) and its local `notif` state were deleted; Switch/MockBadge imports dropped. -->
```

**Why:** the Notifications preferences had no backend and the user chose to defer them entirely,
so the mock toggles were removed rather than shown as dead controls.
