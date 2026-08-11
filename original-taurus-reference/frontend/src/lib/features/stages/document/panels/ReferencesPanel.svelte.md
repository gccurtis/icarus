# src/lib/features/stages/document/panels/ReferencesPanel.svelte — breakdown

Companion to [ReferencesPanel.svelte](ReferencesPanel.svelte). The document's **real**
reference graph (Goal B5): two collapsible lists — what this document links to
(outgoing) and what links to it (backlinks) — loaded from Omega’s reference routes.

## Script — load references + backlinks

### Load outgoing references and incoming backlinks, group into sections

```svelte
<script lang="ts">
  import { ChevronDown, ExternalLink } from '@lucide/svelte';
  import { Badge } from '$lib/components';
  import { isApiError } from '$data/api';
  import { loadReferences, loadBacklinks, type ReferenceRef } from '$data/documents';
  import { openTab } from '$data/workspace';
  import { editorSession } from '../editor/session';

  const documentId = $derived($editorSession?.docId ?? '');

  let outgoing = $state<ReferenceRef[]>([]);
  let incoming = $state<ReferenceRef[]>([]);
  let loading = $state(true);
  let error = $state('');
  let openIds = $state(['outgoing', 'incoming']);

  $effect(() => {
    const id = documentId;
    if (!id) {
      outgoing = [];
      incoming = [];
      loading = false;
      return;
    }
    void load(id);
  });

  async function load(id: string) {
    loading = true;
    error = '';
    try {
      const [refs, backs] = await Promise.all([loadReferences(id), loadBacklinks(id)]);
      // Outgoing edges point AT their toResource; backlinks come FROM their fromResource.
      outgoing = refs.map((edge) => edge.toResource);
      incoming = backs.map((edge) => edge.fromResource);
    } catch (e) {
      error = isApiError(e) ? e.message : 'Failed to load references';
    } finally {
      loading = false;
    }
  }

  const sections = $derived([
    {
      id: 'outgoing',
      title: 'This file references',
      description: 'Resources this document links to',
      items: outgoing
    },
    {
      id: 'incoming',
      title: 'Referencing this file',
      description: 'Resources that link to this document',
      items: incoming
    }
  ]);

  function toggle(id: string) {
    openIds = openIds.includes(id) ? openIds.filter((candidate) => candidate !== id) : [...openIds, id];
  }

  // Navigate to a referenced resource (opens/activates its tab).
  function openRef(ref: ReferenceRef) {
    openTab(ref.name ?? ref.id, ref.id, ref.kind as never);
  }
</script>

```

Loads both edge lists in parallel on document change, mapping each edge to the *other* end
(`toResource` for outgoing, `fromResource` for incoming). `sections` groups them; `openRef`
opens a referenced resource as a tab.

## Markup — loading/error + the two sections

### Loading/error states and the two collapsible reference lists

```svelte
<div class="space-y-3">
  {#if loading}
    <p class="text-body-sm text-muted">Loading references…</p>
  {:else if error}
    <p class="text-body-sm text-danger">Couldn’t load references — {error}</p>
  {:else}
    {#each sections as section (section.id)}
      {@const open = openIds.includes(section.id)}
      <section class="overflow-hidden rounded-panel border border-border bg-work">
        <button
          type="button"
          class="dur-micro flex w-full items-center justify-between gap-2 bg-panel px-3 py-2.5 text-left transition-colors hover:bg-elevated"
          aria-expanded={open}
          onclick={() => toggle(section.id)}
        >
          <span class="min-w-0">
            <span class="block text-label font-medium text-primary">{section.title}</span>
            <span class="block truncate text-caption text-muted">{section.description}</span>
          </span>
          <span class="flex shrink-0 items-center gap-1.5">
            <Badge tone="neutral">{section.items.length}</Badge>
            <ChevronDown
              class={`size-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {#if open}
          {#if section.items.length === 0}
            <p class="border-t border-border px-3 py-2.5 text-caption text-muted">None.</p>
          {:else}
            <ul class="divide-y divide-border border-t border-border">
              {#each section.items as reference (reference.id)}
                <li>
                  <button
                    type="button"
                    class="group flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-panel/70"
                    onclick={() => openRef(reference)}
                  >
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-body-sm font-medium text-primary">
                        {reference.name ?? reference.id}
                      </span>
                      <Badge tone="neutral" class="mt-1.5">{reference.kind}</Badge>
                    </span>
                    <ExternalLink
                      class="mt-0.5 size-3.5 shrink-0 text-muted group-hover:text-secondary"
                    />
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </section>
    {/each}
  {/if}
</div>
```

Loading / error states, then a collapsible section per direction with a count badge; each
row shows the resource’s name (or id) + kind and opens it on click, or "None." when empty.
The Mock badge is gone.
