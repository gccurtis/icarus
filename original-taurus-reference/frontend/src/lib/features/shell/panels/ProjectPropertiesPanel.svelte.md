# src/lib/features/shell/panels/ProjectPropertiesPanel.svelte — breakdown

Companion to [ProjectPropertiesPanel.svelte](ProjectPropertiesPanel.svelte). The project-context
rail's **Properties** lens: what this project *is*, and the way to the surfaces that change it.

It used to be three lines — the name, your role, and a sentence explaining that resource editors
replace the panel. That sentence described the panel system to the user, which is not information
they need; this version answers "what am I looking at" instead.

## The lens reads, it does not write

Every field shown here already has an owner: name and icon in `ProjectSettingsDialog`, `purpose`
on the Overview stage's `PurposeStatement`, access mode and member roles in `ProjectSharing`. So
the two buttons at the foot **mount those existing components** rather than growing a second
implementation beside them:

```svelte
<ShareDialog bind:open={shareOpen} projectId={project?.id ?? null} … />
<ProjectSettingsDialog bind:open={settingsOpen} projectId={project?.id ?? null} />
```

That is the lesson of workstream E, where a 41-line mock Share dialog drifted from the real
settings UI a few files away for weeks. One implementation, two entry points.

## Layout — a fixed head, scrolling facts, a fixed foot

```svelte
<div class="flex h-full flex-col">
  <div class="shrink-0 pt-1">…identity + purpose…</div>
  <PanelResults class="mt-4">…facts + contents…</PanelResults>
  <div class="mt-3 flex shrink-0 …">…Share / Settings…</div>
</div>
```

`flex h-full flex-col` is what makes `SidePanel`'s own scroller inert (the reasoning is in
`components/PanelResults.svelte`), so this lens controls its own scrolling: the identity block and
the actions stay put, and only the middle scrolls. The route into sharing is therefore reachable
without hunting for it in a long scroll — the same "always visible" rule the All resources lens
applies to import/export and its search field.

## The one fact that needs a request

```svelte
$effect(() => {
  const id = project?.id;
  if (id) void loadRoster(id);
});
const owner = $derived($roster.projectId === project?.id ? ownerOf($roster.members) : null);
```

The projects store carries only *your* membership (`toProject` seeds `members` with the session
user), so the owner's name is the single field here that needs `GET /projects/:id/members`. It goes
through the shared `roster` store, which the Members lens also reads — flipping between the two
sections costs one request, not one per flip. The `$roster.projectId === project?.id` guard means a
roster still loading for a different project can never be attributed to this one.

An `$effect` rather than `onMount` because a panel is *not* remounted when the active project
changes: the effect re-runs on the id change, which `onMount` would miss (the same pattern the old
`PersonasPanel` used and documented).

## The facts, and what each one really means

```svelte
const facts = $derived([
  { key: 'Access', value: accessLabel },
  { key: 'Your role', … },
  { key: 'Owner', value: ownerLabel },
  { key: 'Created', value: project?.createdAt ? documentEditStamp(project.createdAt) : '—' },
  { key: 'Last activity', value: project?.updatedAt ? relativeTime(project.updatedAt) : '—' }
]);
```

`Access` shows `visibility` using **the same two words `ProjectSharing` uses** — "Private" or
"Anyone with link". This lens is one click from that dialog, so a state that renamed itself on the
way there would read as a different setting. The last row is labelled **Last activity**, not "Updated",
because Omega maxes the project's own update time against its newest activity event; calling it
"Updated" would imply a rename stamp it isn't. Both timestamps are optional at the type level and
draw an em dash when absent, which is what the shell's placeholder project (synthesized from the
route before `GET /projects` answers) actually knows.

## Contents

```svelte
const counts = $derived.by(() => { …count $resources by kind… });
```

Counted from the loaded catalog rather than a separate call, and that is sound rather than lazy:
`enterProjectResources` pages `/resources` to exhaustion, so `$resources` is the complete set this
user is allowed to see. Kinds are ordered by count, then by label, and each row reuses `kindMeta`
so a kind's icon and tone match every other surface that draws it.
