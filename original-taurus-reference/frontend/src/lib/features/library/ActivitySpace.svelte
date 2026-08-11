<script lang="ts">
  import TaskList from './TaskList.svelte';
  import { ACTIVE_STATES, type AgentTask } from './agents-mock';

  // The Activity view: every agent working for you, across projects, live work
  // first. Two groups and nothing else — a monitor earns its keep by being
  // glanceable, not dense.
  let {
    tasks,
    selectedId,
    onselect
  }: { tasks: AgentTask[]; selectedId: string | null; onselect: (id: string) => void } = $props();

  let active = $derived(tasks.filter((t) => ACTIVE_STATES.includes(t.state)));
  let settled = $derived(tasks.filter((t) => !ACTIVE_STATES.includes(t.state)));
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4 px-8 pb-24">
  <section class="flex shrink-0 flex-col overflow-hidden rounded-panel border border-border">
    <h2 class="shrink-0 border-b border-border bg-panel px-4 py-2.5 text-body font-semibold">
      Working now <span class="font-normal text-muted">({active.length})</span>
    </h2>
    <div class="quiet-scroll max-h-72 overflow-y-auto bg-work">
      {#if active.length}
        <TaskList tasks={active} {selectedId} {onselect} />
      {:else}
        <p class="px-4 py-3 text-caption text-muted">Nothing running right now.</p>
      {/if}
    </div>
  </section>

  <section class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-border">
    <h2 class="shrink-0 border-b border-border bg-panel px-4 py-2.5 text-body font-semibold">
      Recently finished <span class="font-normal text-muted">({settled.length})</span>
    </h2>
    <div class="quiet-scroll min-h-0 flex-1 overflow-y-auto bg-work">
      {#if settled.length}
        <TaskList tasks={settled} {selectedId} {onselect} />
      {:else}
        <p class="px-4 py-3 text-caption text-muted">Nothing finished yet.</p>
      {/if}
    </div>
  </section>
</div>

<style>
  .quiet-scroll {
    scrollbar-width: none;
  }
  .quiet-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
