<script lang="ts">
  import { PanelActor } from "$authored-components/panel";
  import { ScreenEmpty } from "$authored-components/screen";
  import { taskDetail } from "$app-views/categories/agents/procedures/library.svelte";
  import { clock } from "$app-views/categories/agents/procedures/time";

  let { taskId }: { taskId: string } = $props();

  const detail = $derived(taskDetail(taskId));
  const turns = $derived(detail !== undefined && detail.ready ? (detail.current?.turns ?? []) : []);

  const KIND = { person: "person", agent: "agent", system: "automation" } as const;
</script>

{#if turns.length === 0}
  <ScreenEmpty title="Nothing said yet">The instruction opens the thread once the runner reads it.</ScreenEmpty>
{:else}
  <ol class="feed" aria-label="Conversation">
    {#each turns as turn (turn.id)}
      <li>
        <article class="turn">
          <div class="head">
            <PanelActor name={turn.authorName} kind={KIND[turn.from]} />
            <span class="text-caption text-ink-muted shrink-0 tabular-nums">{clock(turn.at)}</span>
          </div>
          <div class="said" class:agent={turn.from === "agent"}>
            <p class="text">{turn.text}</p>
          </div>
        </article>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .feed {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 4);
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 1);
    list-style: none;
  }

  .turn {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .head {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .said {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    margin-inline-start: calc(var(--token-spacing-unit) * 2.5);
    padding: calc(var(--token-spacing-unit) * 1) 0 calc(var(--token-spacing-unit) * 1)
      calc(var(--token-spacing-unit) * 4);
    border-inline-start: 1px solid var(--token-border-subtle);
  }

  .said.agent {
    border-inline-start-color: var(--token-color-intelligence-border);
  }

  .text {
    max-width: 78ch;
    margin: 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    white-space: pre-wrap;
  }
</style>
