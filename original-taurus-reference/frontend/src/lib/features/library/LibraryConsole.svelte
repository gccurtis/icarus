<script lang="ts">
  import { Building2, FolderInput, MoreHorizontal } from '@lucide/svelte';
  import { Button, Menu, toast } from '$lib/components';
  import LibraryShell from './LibraryShell.svelte';
  import LibraryRail from './LibraryRail.svelte';
  import ContextSpace from './ContextSpace.svelte';
  import TemplateSpace from './TemplateSpace.svelte';
  import LibraryDetails from './LibraryDetails.svelte';
  import LibraryPanel from './LibraryPanel.svelte';
  import LibraryQuarterback from './LibraryQuarterback.svelte';
  import { resetAssistant } from './library-assistant';
  import {
    CONTEXTS,
    OWNERS,
    TEMPLATES,
    type LibraryContext,
    type LibraryTemplate
  } from './library-mock';

  /**
   * The console behind the Context and Templates spaces (the Agents space has its
   * own console — its rail and center are a different shape). The two spaces here
   * share everything except the center, because a context's substance is its
   * membership and a template's is its preview.
   *
   * **The data is mocked** — badged in the shell's top bar — until the backend
   * grows owner-scoped contexts and templates.
   */
  let { space }: { space: 'context' | 'templates' } = $props();

  let query = $state('');
  let owner = $state('all');
  let selectedContextId = $state(CONTEXTS[0].id);
  let selectedTemplateId = $state(TEMPLATES[0].id);

  const matches = (name: string, description: string) =>
    `${name} ${description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const ownerOk = (id: string) => owner === 'all' || id === owner;

  let contexts = $derived(
    CONTEXTS.filter((c) => ownerOk(c.ownerId) && matches(c.name, c.description))
  );
  let templates = $derived(
    TEMPLATES.filter((t) => ownerOk(t.ownerId) && matches(t.name, t.description))
  );

  let context = $derived(
    (CONTEXTS.find((c) => c.id === selectedContextId) ?? CONTEXTS[0]) as LibraryContext
  );
  let template = $derived(
    (TEMPLATES.find((t) => t.id === selectedTemplateId) ?? TEMPLATES[0]) as LibraryTemplate
  );
  let asset = $derived(space === 'context' ? context : template);

  const ownerLabel = (id: string) => OWNERS.find((o) => o.id === id)?.label ?? id;
  const isOrg = (id: string) => OWNERS.find((o) => o.id === id)?.kind === 'org';

  // A conversation about a context means nothing on the templates screen.
  $effect(() => {
    void space;
    resetAssistant();
  });
</script>

<LibraryShell {space} title={space === 'context' ? 'Context' : 'Templates'}>
  <LibraryRail
    {space}
    {contexts}
    {templates}
    bind:query
    bind:owner
    selectedId={space === 'context' ? selectedContextId : selectedTemplateId}
    onselect={(id) => (space === 'context' ? (selectedContextId = id) : (selectedTemplateId = id))}
  />

  <main class="surface-work relative flex min-w-0 flex-1 flex-col overflow-hidden">
    <!-- No rule under the title: a divider here read as a second, cramped top
         bar. Air separates it instead. The kebab is nudged into the corner,
         because a kebab reads as chrome only when it sits AT the edge. -->
    <header class="flex shrink-0 items-start gap-4 px-8 pb-4 pt-5">
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-h3 font-semibold">{asset.name}</h1>
        <p class="mt-1 flex items-center gap-1.5 text-caption text-muted">
          Owner:
          <span class="text-secondary">{ownerLabel(asset.ownerId)}</span>
          {#if isOrg(asset.ownerId)}<Building2 class="size-3" />{/if}
        </p>
      </div>
      <div class="-mr-3 -mt-1.5 flex shrink-0 flex-col items-end gap-2">
        <Menu
          align="end"
          label="More"
          items={[
            { label: 'Share' },
            { label: 'Duplicate' },
            { divider: true },
            { label: 'Delete', danger: true }
          ]}
        >
          {#snippet trigger()}<MoreHorizontal class="size-4" />{/snippet}
        </Menu>
        {#if space === 'templates'}
          <!-- Templates only, and no project picker: it goes into the project
               you are working in. A context is reached for from the project
               instead, so it has no equivalent here. -->
          <Button
            variant="secondary"
            size="sm"
            class="mr-3"
            onclick={() =>
              toast('Bringing a template into a project is not wired up yet.', {
                tone: 'attention'
              })}
          >
            <FolderInput class="size-3.5" /> Bring into project
          </Button>
        {/if}
      </div>
    </header>

    {#if space === 'context'}
      <ContextSpace {context} />
    {:else}
      <TemplateSpace {template} />
    {/if}

    <LibraryQuarterback {space} assetName={asset.name} />
  </main>

  <LibraryPanel {space} assetLabel={asset.name}>
    {#snippet details()}
      <!-- The copy rule, named for the asset in hand. Only a template is ever
           "brought into" a project — the header's own action, a few inches up,
           says so — so that clause belongs to Templates. On Context it would name
           a motion the screen does not offer, leaving the one sentence that
           matters: your edits here stay here. -->
      <LibraryDetails
        {asset}
        copiesNote={space === 'templates'
          ? `Editing this template does not change the copy in ${asset.origin.project}, and bringing it into a project copies it again.`
          : `Editing this context does not change the copy in ${asset.origin.project}.`}
      />
    {/snippet}
  </LibraryPanel>
</LibraryShell>
