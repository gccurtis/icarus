<script lang="ts">
  import { FileText, Presentation } from '@lucide/svelte';
  import { Badge, Button, Input, Modal, MockBadge, toast } from '$lib/components';
  import { searchTemplates } from './mock-templates';

  // The Add-template modal: search the (mock) catalog, pick one, and it "drops
  // in" — today that is a toast; the insertion mechanics arrive with the real
  // template backend.
  let { open = $bindable(false) }: { open?: boolean } = $props();

  let query = $state('');
  const results = $derived(searchTemplates(query));

  function add(name: string) {
    toast(`“${name}” would drop in here — templates are mocked for now.`, { tone: 'intel' });
    open = false;
    query = '';
  }
</script>

<Modal bind:open title="Add template" size="md">
  <div class="space-y-3">
    <p class="flex items-center gap-2 text-body-sm text-muted">
      Drop a template into this resource.
      <MockBadge class="px-1.5 py-0" />
    </p>
    <Input
      bind:value={query}
      size="sm"
      type="search"
      placeholder="Search templates…"
      aria-label="Search templates"
    />
    {#if results.length === 0}
      <p class="rounded-control border border-dashed border-border px-2.5 py-3 text-caption text-muted">
        No templates match this search.
      </p>
    {:else}
      <ul class="divide-y divide-border overflow-hidden rounded-control border border-border">
        {#each results as template (template.id)}
          <li>
            <button
              type="button"
              onclick={() => add(template.name)}
              class="dur-micro flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-panel"
            >
              {#if template.kind === 'slides'}
                <Presentation class="size-4 shrink-0 text-muted" />
              {:else}
                <FileText class="size-4 shrink-0 text-muted" />
              {/if}
              <span class="min-w-0 flex-1">
                <span class="block truncate text-label font-medium text-secondary">
                  {template.name}
                </span>
                <span class="block truncate text-caption text-muted">{template.description}</span>
              </span>
              <Badge tone={template.kind === 'slides' ? 'attention' : 'action'} class="shrink-0 px-1 py-0">
                {template.kind === 'slides' ? 'Slides' : 'Document'}
              </Badge>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
  {/snippet}
</Modal>
