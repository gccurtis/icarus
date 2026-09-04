<script lang="ts">
  import { Draggable } from "$authored-components/drag";
  import { stackOf } from "$development-views/stack-builder/shared/stack.svelte";
  import { Input } from "$vendored-components/input";

  const stack = stackOf();

  let filter = $state("");
  let closed = $state<Record<string, boolean>>({});

  const matching = $derived(
    stack.entries.filter((entry) =>
      `${entry.name} ${entry.family}`.toLowerCase().includes(filter.trim().toLowerCase())
    )
  );

  const families = $derived(
    [...new Set(matching.map((entry) => entry.family))].map((family) => ({
      family,
      entries: matching.filter((entry) => entry.family === family)
    }))
  );

  const DESTINATIONS = [{ value: "stack", label: "Add to the stack" }];
</script>

<div class="flex flex-col gap-1 p-3">
  <Input bind:value={filter} placeholder="Filter components" aria-label="Filter components" />

  {#each families as group (group.family)}
    <button
      type="button"
      class="text-caption text-ink-muted flex items-center gap-2 pt-3 text-left font-semibold tracking-wide uppercase"
      aria-expanded={!closed[group.family]}
      onclick={() => (closed[group.family] = !closed[group.family])}
    >
      {group.family}
      <span class="tabular-nums">{group.entries.length}</span>
    </button>

    {#if !closed[group.family]}
      {#each group.entries as entry (entry.id)}
        <Draggable
          id={entry.id}
          label={entry.name}
          destinations={DESTINATIONS}
          onplace={() => stack.add(entry.id)}
        >
          <div class="min-w-0 py-0.5">
            <div class="text-body-sm truncate">{entry.name}</div>
            {#if entry.reason}
              <div class="text-caption text-ink-muted truncate">{entry.reason}</div>
            {/if}
          </div>
        </Draggable>
      {/each}
    {/if}
  {/each}
</div>
