# src/lib/features/stages/overview/OverviewStage.svelte — breakdown

Companion to [OverviewStage.svelte](OverviewStage.svelte). The Overview stage is the
**project's home**: a centered project name + a full-width editable
[purpose](PurposeStatement.svelte), then a two-column band of the
[Create panel](CreateColumn.svelte) (left) and the [Activity feed](ActivityFeed.svelte)
(right, filling the width) — both bordered panels of equal height — and finally the full
[ResourceTable](../shared/ResourceTable.svelte) under an eyebrow header matching the other two. The
frame never scrolls; the activity feed and the table body scroll within their own regions.

## Script

### Wiring and actions

```svelte
<script lang="ts">
  import { openTab } from '$data/workspace';
  import { getResourceMetadata, type ActivityTarget } from '$data/projects';
  import { isApiError } from '$data/api';
  import { toast } from '$lib/components';
  import {
    enterProjectResources,
    addResource,
    removeResource,
    renameResource,
    canCreate,
    type Resource,
    type ResourceKind
  } from '$data/resources';
  import { kindMeta } from '$lib/features/shared/kinds';
  import PurposeStatement from './PurposeStatement.svelte';
  import CreateColumn from './CreateColumn.svelte';
  import ActivityFeed from './ActivityFeed.svelte';
  import ResourceTable from '$lib/features/stages/shared/ResourceTable.svelte';

  let { projectId, projectName }: { projectId: string; projectName: string } = $props();

  $effect(() => {
    enterProjectResources(projectId);
  });

  async function create(kind: ResourceKind) {
    if (!canCreate(kind)) {
      toast(`${kindMeta[kind].label} resources aren't available yet.`, { tone: 'attention' });
      return;
    }
    const name = `Untitled ${kindMeta[kind].label.toLowerCase()}`;
    try {
      const r = await addResource(projectId, name, kind);
      openTab(r.name, r.id, r.kind);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not create the resource.', { tone: 'danger' });
    }
  }
  function openResource(r: Resource) {
    openTab(r.name, r.id, r.kind);
  }
  function fail(action: string) {
    return (e: unknown) => toast(isApiError(e) ? e.message : `Could not ${action} the resource.`, { tone: 'danger' });
  }
  async function openActivityTarget(target: ActivityTarget) {
    try {
      const resource = await getResourceMetadata(target.kind, target.id);
      openTab(resource.name, resource.id, resource.kind);
    } catch {
      toast('This resource is no longer available.', { tone: 'attention' });
    }
  }
</script>

```

Loads the project's resources; `kindMeta` gives each kind its icon/tone/label. `create`
is async: it gates on `canCreate` (a toast when Omega can't make that kind yet), awaits
`addResource`, and opens the new resource as a tab (passing its kind) — surfacing any
failure as a danger toast. `openResource` is passed to the table, and `fail(action)` builds
the shared error-toast handler its async `onremove`/`onrename` callbacks catch with.
`openActivityTarget` resolves a real current Resource before opening it, giving a deleted
target a compact user-visible fallback. There's **no project rename here** — renaming is a
backend feature we don't fake client-side (`onrename` on the table is *resource* rename).

Downloading is no longer wired from here. The stage used to define a `downloadResource` stub
and hand it to the table as `ondownload`; it wrote a Markdown file holding nothing but the
resource's name and a "placeholder, no content yet" line — a real download of a fake
document. `ResourceTable` now owns downloading itself, per format, through the shared
per-kind transfer table that knows the real exporters. The stub went, and the `downloadText`
and `slug` imports went with it.

## Markup — identity + purpose

### Name over the full-width purpose

```svelte
<!--
  Overview = the project's home. The stage frame never scrolls; the activity feed and
  the table body scroll within their own regions. pb-20 reserves room for the floating
  Quarterback dock so the table clears it.
-->
<div class="mx-auto flex h-full max-w-4xl flex-col px-8 pt-6 pb-20">
  <!-- Project identity + full-width purpose -->
  <header class="shrink-0">
    <h1 class="text-center text-h2 font-semibold">{projectName}</h1>
    <div class="mt-3">
      <PurposeStatement {projectId} />
    </div>
  </header>

```

The stage is an `h-full` flex column so the frame never scrolls; `pb-20` clears the
Quarterback dock. The header centers the project name, with the full-width
[PurposeStatement](PurposeStatement.svelte) beneath it.

## Markup — create + activity band

### Two equal-height bordered panels

```svelte
  <!-- Create + Activity: two equal-height bordered panels, moved down a little; activity fills the width -->
  <div class="mt-8 grid h-56 shrink-0 grid-cols-1 grid-rows-2 gap-6 sm:grid-cols-[15rem_minmax(0,1fr)] sm:grid-rows-1">
    <CreateColumn {kindMeta} oncreate={create} />
    <ActivityFeed
      {projectId}
      onopen={openActivityTarget}
    />
  </div>

```

A fixed-height (`h-56`) band, dropped a little (`mt-8`) below the header. On `sm+` it's a
15rem [CreateColumn](CreateColumn.svelte) with the [ActivityFeed](ActivityFeed.svelte)
**filling the rest** (`minmax(0,1fr)`), `grid-rows-1` giving both cells the full height so
the two bordered panels match. On narrow widths they stack, each still bounded so the feed
scrolls.

## Markup — resources table

### The All resources section (eyebrow header)

```svelte
  <!-- All resources (eyebrow header matching Create/Activity); kept as a table -->
  <section class="mt-3 flex min-h-0 flex-1 flex-col">
    <p class="mb-2 shrink-0 text-label uppercase tracking-wide text-muted">All resources</p>
    <ResourceTable
      {kindMeta}
      onopen={openResource}
      onremove={(r) => void removeResource(projectId, r.id).catch(fail('delete'))}
      onimport={() => toast("Importing files isn't available yet.", { tone: 'attention' })}
      onrename={(id, name) => void renameResource(projectId, id, name).catch(fail('rename'))}
    />
  </section>
</div>
```

The **All resources** header is now the same **eyebrow** (`text-label uppercase … text-muted`)
as Create and Activity — not a bold `h2` — so the three sections read as one family. The
section is the flex column's growing child (`min-h-0 flex-1`) with a snug `mt-3`, so the
`ResourceTable` (kept as a table, itself a bordered panel) fills the remaining height and
scrolls its own body. Its callbacks are async-safe: `onremove`/`onrename` fire the
mutation and `.catch(fail(...))` any rejection, while `onimport` just toasts that file
import isn't available yet.

## Contributing the inspector lens

```ts
activeSurface.set({
  id: `overview:${projectId}`,
  scope: projectName,
  inspector: [
    { id: 'details', label: 'Details', icon: SlidersHorizontal, content: OverviewDetailsPanel }
  ]
});
```

Overview contributes **only** an inspector section. Leaving `context` undefined is the load-bearing
part: `contextSectionsFor` reads `surface?.context ?? projectContext`, so an omitted set keeps the
project-context rail (Properties / All resources / History / Personas), which is exactly what this
stage wants on the left. Contributing an empty array instead would replace it with nothing.

The contributed `details` id overrides the shell's universal Details fallback while Overview is the
active surface, per `inspectorSectionsFor`. The effect's teardown clears both the surface and the
selection, and re-runs on `projectId` change — selections and surfaces never cross projects.

## Two inspected ids, not one

```ts
const inspectedResourceId = $derived(
  $overviewSelection.mode === 'resource' ? $overviewSelection.resourceId : null
);
const inspectedActivityId = $derived(
  $overviewSelection.mode === 'activity' ? $overviewSelection.event.id : null
);
```

Each surface reads only its own mode, so inspecting a resource never leaves a highlight sitting in
the activity feed and vice versa. There is one selection at a time; these two derives are how the
single selection is projected onto the two places that can draw it.

Row click (`oninspect`) and the checkbox set (`onselectionchange`) are wired to *different* store
actions on purpose — see [overview-session.ts.md](overview-session.ts.md) for why they are kept
apart rather than merged into one notion of "selected".
