<script lang="ts">
  import { Check } from '@lucide/svelte';
  import { cn } from '$lib/utils';
  import { Button, Checkbox, Input, Modal, Select } from '$lib/components';
  import { RESOURCE_KINDS, type Resource, type ResourceKind } from '$data/resources';
  import { kindMeta } from '$lib/features/shared/kinds';
  import { EMPTY_FILTER, isFilterActive, type ActivityFilter } from './activity-filter';

  /**
   * Build an activity filter: one person, and any set of resources — named
   * individually or a whole kind at once.
   *
   * A person is a `Select` because the roster is short and bounded. Resources are
   * NOT: a project can hold hundreds, so they get a searchable list with checkboxes
   * inside this dialog, which is exactly why the filter is a dialog rather than a
   * popover of dropdowns.
   */
  let {
    open = $bindable(false),
    filter,
    resources,
    actors,
    onapply
  }: {
    open?: boolean;
    /** The filter currently in force; edits start from a copy of it. */
    filter: ActivityFilter;
    resources: Resource[];
    /** Everyone who could have acted — the roster, plus actors seen in the feed. */
    actors: { id: string; name: string }[];
    onapply: (filter: ActivityFilter) => void;
  } = $props();

  // A working copy, so Cancel really cancels. Re-seeded each time the dialog opens
  // (and `untrack`-free because `filter` is the only dependency that should re-seed).
  let draft = $state<ActivityFilter>({ ...EMPTY_FILTER });
  let query = $state('');

  $effect(() => {
    if (open) {
      draft = { actorIds: [...filter.actorIds], resourceIds: [...filter.resourceIds], kinds: [...filter.kinds] };
      query = '';
    }
  });

  const actorValue = $derived(draft.actorIds[0] ?? '');
  // "Anyone" is the empty value, so clearing the person filter is a normal option
  // rather than a separate control.
  const actorOptions = $derived([
    { value: '', label: 'Anyone' },
    ...actors.map((a) => ({ value: a.id, label: a.name }))
  ]);

  function chooseActor(id: string) {
    draft = { ...draft, actorIds: id ? [id] : [] };
  }

  function toggleKind(kind: ResourceKind) {
    const has = draft.kinds.includes(kind);
    draft = {
      ...draft,
      kinds: has ? draft.kinds.filter((k) => k !== kind) : [...draft.kinds, kind],
      // Picking "all documents" makes any individually-named document redundant, so
      // they are dropped rather than left as invisible extra state.
      resourceIds: has
        ? draft.resourceIds
        : draft.resourceIds.filter((id) => resources.find((r) => r.id === id)?.kind !== kind)
    };
  }

  function toggleResource(id: string) {
    draft = draft.resourceIds.includes(id)
      ? { ...draft, resourceIds: draft.resourceIds.filter((x) => x !== id) }
      : { ...draft, resourceIds: [...draft.resourceIds, id] };
  }

  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return RESOURCE_KINDS.map((kind) => ({
      ...kind,
      items: resources.filter((r) => r.kind === kind.id && (!q || r.name.toLowerCase().includes(q)))
    })).filter((group) => group.items.length > 0);
  });

  const selectedCount = $derived(draft.resourceIds.length + draft.kinds.length);
</script>

<Modal bind:open title="Filter activity" size="md">
  <div class="space-y-4">
    <div class="space-y-1.5">
      <span class="text-label uppercase tracking-wide text-muted" id="activity-filter-person">Person</span>
      <Select
        value={actorValue}
        options={actorOptions}
        aria-labelledby="activity-filter-person"
        onchange={(e: Event) => chooseActor((e.currentTarget as HTMLSelectElement).value)}
      />
    </div>

    <div class="space-y-1.5">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-label uppercase tracking-wide text-muted">Resources</span>
        <span class="text-caption text-muted">
          {selectedCount === 0 ? 'Everything' : `${selectedCount} selected`}
        </span>
      </div>
      <Input bind:value={query} size="sm" placeholder="Find a resource…" aria-label="Find a resource to filter by" />

      <div class="max-h-64 space-y-2 overflow-auto rounded-control border border-border p-2">
        {#if groups.length === 0}
          <p class="px-1 py-2 text-body-sm text-muted">Nothing matches “{query.trim()}”.</p>
        {/if}

        {#each groups as group (group.id)}
          {@const wholeKind = draft.kinds.includes(group.id)}
          {@const Icon = kindMeta[group.id].icon}
          <div>
            <button
              type="button"
              onclick={() => toggleKind(group.id)}
              aria-pressed={wholeKind}
              class={cn(
                'dur-micro flex w-full items-center gap-2 rounded-control px-1.5 py-1 text-left transition-colors hover:bg-elevated',
                wholeKind && 'bg-action/10'
              )}
            >
              <Icon class="size-3.5 shrink-0 text-muted" />
              <span class="text-label uppercase tracking-wide text-muted">{group.label}</span>
              <span
                class={cn(
                  'ml-auto flex items-center gap-1 text-caption',
                  wholeKind ? 'text-action' : 'text-muted'
                )}
              >
                {#if wholeKind}<Check class="size-3" />{/if}
                All
              </span>
            </button>

            <ul class="mt-0.5 space-y-0.5 pl-1.5">
              {#each group.items as r (r.id)}
                <li>
                  <!-- Checkbox is itself a <label>, so the row must not add another. -->
                  <Checkbox
                    checked={wholeKind || draft.resourceIds.includes(r.id)}
                    disabled={wholeKind}
                    onchange={() => toggleResource(r.id)}
                    class={cn(
                      'w-full rounded-control px-1.5 py-1',
                      wholeKind ? 'text-muted' : 'text-secondary hover:bg-elevated'
                    )}
                  >
                    <span class="min-w-0 truncate">{r.name}</span>
                  </Checkbox>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
      <p class="text-caption text-muted">
        A person narrows to their events; resources and whole kinds combine — “this document or any
        deck”.
      </p>
    </div>
  </div>

  {#snippet footer()}
    <Button
      variant="ghost"
      disabled={!isFilterActive(draft)}
      onclick={() => (draft = { ...EMPTY_FILTER })}
    >
      Clear all
    </Button>
    <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
    <Button
      onclick={() => {
        onapply(draft);
        open = false;
      }}
    >
      Apply
    </Button>
  {/snippet}
</Modal>
