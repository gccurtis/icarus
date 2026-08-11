# src/lib/features/stages/new-tab/NewTabStage.svelte — breakdown

Companion to [NewTabStage.svelte](NewTabStage.svelte). The **new-tab launcher** shown
when a blank tab (the "+") is active. It offers ways to start — the shared new resource
panel (per-type creates + **Create with AI**) and a **Templates** carousel — plus the
full resource table. Every action **resolves the blank tab in place** into the
chosen/created resource (browser-style), via `resolveTab`.

## Script — wiring, templates, and actions

### Props, templates, and the resolve-in-place actions

```svelte
<script lang="ts">
  import { Badge, toast } from '$lib/components';
  import { resolveTab, type Tab } from '$data/workspace';
  import { isApiError } from '$data/api';
  import {
    enterProjectResources,
    addResource,
    createResourceFromTemplate,
    generateResource,
    removeResource,
    renameResource,
    canCreate,
    type Resource,
    type ResourceKind
  } from '$data/resources';
  import { listTemplates, type DocumentTemplate } from '$data/documents';
  import { kindMeta } from '$lib/features/shared/kinds';
  import NewResourcePanel from './NewResourcePanel.svelte';
  import TemplatesCarousel from './TemplatesCarousel.svelte';
  import ResourceTable from '$lib/features/stages/shared/ResourceTable.svelte';
  import AiCreateDialog from './AiCreateDialog.svelte';

  let { tab, projectId }: { tab: Tab; projectId: string } = $props();

  $effect(() => {
    enterProjectResources(projectId);
  });

  let aiOpen = $state(false);

  // Real document templates (`GET /documents/templates`), loaded per project.
  let templates = $state<DocumentTemplate[]>([]);
  $effect(() => {
    projectId;
    void loadTemplates();
  });
  async function loadTemplates() {
    try {
      templates = await listTemplates();
    } catch {
      templates = [];
    }
  }

  // Templates are documents; map each to the carousel card, summarizing its context
  // variables as the blurb.
  const templateCards = $derived(
    templates.map((t) => ({
      id: t.id,
      name: t.name,
      kind: 'document' as ResourceKind,
      blurb: t.variables.length
        ? `${t.variables.length} field${t.variables.length === 1 ? '' : 's'} to fill`
        : 'Document template'
    }))
  );

  // Every launcher action resolves this blank tab into the chosen/created resource.
  function resolveInto(name: string, resourceId?: string, kind?: ResourceKind) {
    resolveTab(tab.id, name, resourceId, kind);
  }
  // Create a resource of the given kind, then resolve this tab into it. Kinds Omega
  // can't create yet are gated with a toast rather than a failed request.
  async function createOf(kind: ResourceKind, name: string) {
    if (!canCreate(kind)) {
      toast(`${kindMeta[kind].label} resources aren't available yet.`, { tone: 'attention' });
      return;
    }
    try {
      const r = await addResource(projectId, name, kind);
      resolveInto(r.name, r.id, r.kind);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not create the resource.', { tone: 'danger' });
    }
  }
  function create(kind: ResourceKind) {
    void createOf(kind, `Untitled ${kindMeta[kind].label.toLowerCase()}`);
  }
  async function fromTemplate(t: { id: string; name: string }) {
    try {
      const r = await createResourceFromTemplate(t.id);
      resolveInto(r.name, r.id, r.kind);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not create from template.', { tone: 'danger' });
    }
  }
  async function fromAi(kind: ResourceKind, prompt: string) {
    // Only documents can be AI-generated today; other kinds fall back to a plain create.
    if (kind !== 'document') {
      const name = prompt.length > 40 ? prompt.slice(0, 40).trimEnd() + '…' : prompt;
      void createOf(kind, name);
      return;
    }
    try {
      const { resource } = await generateResource(prompt);
      resolveInto(resource.name, resource.id, resource.kind);
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not generate the document.', { tone: 'danger' });
    }
  }
  function fail(action: string) {
    return (e: unknown) => toast(isApiError(e) ? e.message : `Could not ${action} the resource.`, { tone: 'danger' });
  }
</script>
```

Takes the blank `tab` (to resolve) and `projectId` (to load/mutate resources). Real
document templates are loaded per project: the `templates` state is filled by
`loadTemplates` (calling `listTemplates`, falling back to an empty list on error) from a
`projectId`-keyed `$effect`, and the `templateCards` derived projects each into a carousel
card whose blurb counts its context variables. `resolveInto(name, id, kind)` is the shared
exit — it turns the blank tab into a resource tab named `name`, carrying the resource's id
and kind. The async `createOf(kind, name)` is the shared creation path: it gates on
`canCreate` (a toast when Omega can't make that kind yet), awaits `addResource`, and
`resolveInto`s the result — surfacing any failure as a danger toast. `create` (blank kind)
delegates to it and `fromAi` derives a title from the prompt, while `fromTemplate` instead
awaits `createResourceFromTemplate` (the template id) and resolves into the new document,
toasting on failure. `fail(action)` builds the shared error-toast handler the table's async
`onremove`/`onrename` catch with.

Downloading is **not** wired from here any more. The stage used to define a
`downloadResource` stub and hand it to the table as `ondownload`; it wrote a Markdown file
holding nothing but the resource's name and a "placeholder, no content yet" line — a real
download of a fake document. `ResourceTable` now owns downloading itself, per format,
through the shared per-kind transfer table that knows the real exporters. The stub went, and
the `downloadText` and `slug` imports went with it — the overview stage shed the identical
pair in the same change.

## Markup — header + new resource panel

### Eyebrow and the new resource panel

```svelte

<div class="mx-auto flex h-full max-w-4xl flex-col px-8 pt-6 pb-20">
  <header class="shrink-0">
    <p class="text-label uppercase tracking-wide text-muted">New tab</p>
  </header>

  <!-- New resource panel: AI create + per-type creates -->
  <section class="mt-4 shrink-0">
    <NewResourcePanel {kindMeta} oncreate={create} onai={() => (aiOpen = true)} />
  </section>
```

Same `h-full` flex-column frame as Overview. The header is now just the **"New tab"**
eyebrow (the big "Start something" title was dropped). Directly under it — and **above**
the templates now — the shared [`NewResourcePanel`](NewResourcePanel.svelte) (AI create +
per-type creates).

## Markup — templates carousel + resources

### The carousel and the resource table

```svelte

  <!-- Templates carousel: real document templates (hidden when the project has none). -->
  {#if templateCards.length}
    <section class="mt-6 shrink-0">
      <p class="mb-2 text-label uppercase tracking-wide text-muted">Templates</p>
      <TemplatesCarousel templates={templateCards} {kindMeta} onpick={fromTemplate} />
    </section>
  {/if}

  <!-- All resources (recency-sorted by default; user can re-sort) -->
  <section class="mt-6 flex min-h-0 flex-1 flex-col">
    <p class="mb-2 shrink-0 text-label uppercase tracking-wide text-muted">Resources</p>
    <ResourceTable
      {kindMeta}
      onopen={(r) => resolveInto(r.name, r.id, r.kind)}
      onremove={(r) => void removeResource(projectId, r.id).catch(fail('delete'))}
      onimport={() => toast("Importing files isn't available yet.", { tone: 'attention' })}
      onrename={(id, name) => void renameResource(projectId, id, name).catch(fail('rename'))}
    />
  </section>
</div>

<AiCreateDialog bind:open={aiOpen} oncreate={fromAi} />
```

Then the **Templates** [`TemplatesCarousel`](TemplatesCarousel.svelte) (cyclical scroll,
faded edges) — now fed the real `templateCards` and wrapped in `{#if templateCards.length}`
so the whole section is hidden when the project has no templates — and the **Resources**
table (`ResourceTable`, default recency sort) — whose `onopen` resolves the blank tab into
the chosen resource (carrying its kind). Its
`onremove`/`onrename` fire the mutation and `.catch(fail(...))` any rejection, while
`onimport` just toasts that file import isn't available yet. The
`AiCreateDialog` is bound at the end; its `oncreate` runs `fromAi`. On the launcher, the
**Templates** and **Resources** headings are understated **eyebrow** labels (matching the
"New tab" eyebrow), not big `h2`s.
