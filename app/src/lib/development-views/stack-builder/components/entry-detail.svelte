<script lang="ts">
  import { stackOf } from "$development-views/stack-builder/shared/stack.svelte";
  import { Input } from "$vendored-components/input";
  import { Textarea } from "$vendored-components/textarea";

  const stack = stackOf();
</script>

<div class="flex h-full flex-col gap-2 p-3">
  {#if stack.selected}
    {@const selected = stack.selected}
    <div class="flex items-baseline gap-2">
      {#if selected.kind === "component"}
        <span class="text-body-sm font-semibold">{selected.name}</span>
        <span class="text-caption text-ink-muted truncate font-mono">{selected.path}</span>
      {:else}
        <Input
          class="h-7 w-64"
          aria-label="What this entry is called"
          value={selected.name}
          oninput={(event) => stack.rename(selected.id, event.currentTarget.value)}
        />
        <span class="text-caption text-ink-muted">{selected.kind}</span>
      {/if}
    </div>

    <Textarea
      class="min-h-0 flex-1"
      placeholder="What should this show?"
      aria-label="What this entry should show"
      value={selected.description}
      oninput={(event) => stack.describe(selected.id, event.currentTarget.value)}
    />
  {:else}
    <p class="text-caption text-ink-muted">Select an entry to describe what it shows.</p>
  {/if}
</div>
