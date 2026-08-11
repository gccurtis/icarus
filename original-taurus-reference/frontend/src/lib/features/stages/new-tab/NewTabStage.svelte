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

<div class="mx-auto flex h-full max-w-4xl flex-col px-8 pt-6 pb-20">
  <header class="shrink-0">
    <p class="text-label uppercase tracking-wide text-muted">New tab</p>
  </header>

  <!-- New resource panel: AI create + per-type creates -->
  <section class="mt-4 shrink-0">
    <NewResourcePanel {kindMeta} oncreate={create} onai={() => (aiOpen = true)} />
  </section>

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
