<script lang="ts">
  import type { Snippet } from 'svelte';
  import { closeAssistant, openAssistant, assistant, type LibrarySpace } from './library-assistant';
  import AgentLens from './AgentLens.svelte';
  import type { AgentTask } from './agents-mock';

  // The right-hand panel frame, with the one section switch every library space
  // shares: what you are looking at, or the agent working on it. This mirrors
  // the workspace inspector, whose sections include the AI panel — and the same
  // rule applies: composer and panel are one surface, so sending from the bar
  // flips this switch.
  //
  // BOTH labels name what you would get, because on Agents the second tab has two
  // meanings: "Agent" continues the selected task's exchange, "New agent" starts
  // one. The left one names what it shows — Task over a selected task, Now over
  // the Activity summary, Details over an asset.
  let {
    space,
    detailsLabel = 'Details',
    agentLabel = 'Agent',
    assetLabel = null,
    task = null,
    details
  }: {
    space: LibrarySpace;
    detailsLabel?: string;
    agentLabel?: string;
    /** The asset the request is about — always in the Agent lens's scope. */
    assetLabel?: string | null;
    /** Agents only: the task the bar and the lens are addressing. */
    task?: AgentTask | null;
    details: Snippet;
  } = $props();
</script>

<aside class="surface-inspector flex w-inspector shrink-0 flex-col">
  <div class="flex shrink-0 items-center gap-0.5 border-b border-border px-2 py-1.5" role="tablist">
    <button
      role="tab"
      aria-selected={!$assistant.open}
      onclick={closeAssistant}
      class="dur-micro flex-1 rounded-control px-2 py-1 text-label font-medium transition-colors {!$assistant.open
        ? 'bg-selection text-primary'
        : 'text-muted hover:text-secondary'}"
    >
      {detailsLabel}
    </button>
    <button
      role="tab"
      aria-selected={$assistant.open}
      onclick={openAssistant}
      class="dur-micro flex-1 rounded-control px-2 py-1 text-label font-medium transition-colors {$assistant.open
        ? 'bg-selection text-primary'
        : 'text-muted hover:text-secondary'}"
    >
      {agentLabel}
    </button>
  </div>

  <div class="quiet-scroll min-h-0 flex-1 overflow-y-auto">
    {#if $assistant.open}
      <div class="p-3"><AgentLens {space} {assetLabel} {task} /></div>
    {:else}
      {@render details()}
    {/if}
  </div>
</aside>

<style>
  .quiet-scroll {
    scrollbar-width: none;
  }
  .quiet-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
