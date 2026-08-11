# ProjectSettingsDialog.svelte

The project settings modal. Since workstream E it owns only what is *unique to settings* — name,
icon, and the danger zone — and delegates everything about sharing.

> **Rewritten 2026-07-27.** This companion was a ~510-line byte-for-byte mirror of a file that has
> since lost about two-thirds of its body to `ProjectSharing.svelte`. It is now prose, per the
> current companion practice (orientation §5).

## What moved out, and why

Access mode, share links, and the member list left for
[`ProjectSharing.svelte`](ProjectSharing.svelte.md). They moved because the top bar's Share dialog
needed exactly that surface and had been faking it with a mock link — two implementations of one
concept, one of them lying. Both dialogs now render the same component, so they cannot drift.

That took ~200 lines and nine handlers (`loadMembers`, `chooseVisibility`, `invite`, `changeRole`,
`kick`, `loadLinks`, `rotate`, `turnOff`, `copyShareLink`) out of this file.

```svelte
<!-- Access, share links, and members — the SAME component the top bar's
     Share dialog renders, so the two surfaces cannot drift. -->
<ProjectSharing {projectId} />
```

## What is left

**Name** — owner-editable, `PATCH /projects/:id` via `updateProject`. Save is disabled until the
trimmed value differs from the current name, so it cannot fire a no-op rename. Non-owners see it
readonly.

**Icon** — the `ICON_COLORS` swatch row; each is a `PATCH` with the chosen colour, applied through
the projects store. Disabled for non-owners.

**Danger zone** — owners get a two-step Delete (a confirm strip replaces the button rather than a
native `confirm()`); non-owners get Leave. Both close the modal and call `onexit`, which
`ShellTopBar` points at `/projects` — necessary because after deleting or leaving, the current
project route no longer resolves.

## The open effect

```svelte
$effect(() => {
  const id = projectId;
  if (open && id) untrack(() => { editName = project?.name ?? ''; confirmDelete = false; });
});
```

It reseeds the editable name and clears a half-confirmed delete each time the dialog opens on a
project. `untrack` keeps those writes from re-triggering it.

It no longer *loads* anything: `ProjectSharing` fetches its own members and links, and because
`Modal` renders children behind `{#if open}`, mounting that component is the lazy load. The
open-guard this effect used to carry for those fetches went with them.

Every failed call surfaces a `danger` toast rather than throwing — a settings dialog that died on a
failed rename would strand the user with no way to fix it.
