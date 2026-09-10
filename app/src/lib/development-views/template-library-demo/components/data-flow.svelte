<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Braces from "@lucide/svelte/icons/braces";
  import Database from "@lucide/svelte/icons/database";
  import FileJson2 from "@lucide/svelte/icons/file-json-2";
  import Files from "@lucide/svelte/icons/files";
  import PanelsTopLeft from "@lucide/svelte/icons/panels-top-left";
  import ServerCog from "@lucide/svelte/icons/server-cog";

  const LIBRARY = [
    { label: "Seed", detail: "templates + independent example resources", icon: FileJson2 },
    { label: "State", detail: "templates · versions · created resources", icon: Database },
    { label: "Door", detail: "Templates capability", icon: ServerCog },
    { label: "Read model", detail: "library procedures", icon: Braces },
    { label: "Surfaces", detail: "context · content · inspector", icon: PanelsTopLeft }
  ];

  const EDITING = [
    { label: "Template", detail: "body + variables", icon: Files },
    { label: "Authoring session", detail: "proposed durable lease", icon: Braces },
    { label: "Scratch resource", detail: "proposed editor identity", icon: Database },
    { label: "Existing editor", detail: "document · deck · sheet later", icon: PanelsTopLeft },
    { label: "Done or Cancel", detail: "resolve, then clean up", icon: ServerCog }
  ];
</script>

{#snippet flow(items: typeof LIBRARY)}
  <div class="flow">
    {#each items as item, index (item.label)}
      {@const Icon = item.icon}
      <article>
        <span class="node-icon"><Icon size={17} aria-hidden="true" /></span>
        <div><strong>{item.label}</strong><small>{item.detail}</small></div>
      </article>
      {#if index < items.length - 1}
        <span class="arrow" aria-hidden="true"><ArrowRight size={16} /></span>
      {/if}
    {/each}
  </div>
{/snippet}

<div class="flows">
  <section>
    <header><span>01 / LIBRARY</span><h3>One source of truth reaches three panes.</h3></header>
    {@render flow(LIBRARY)}
    <p>
      Search, summaries and inspection are projections over the same returned rows. Today that set
      is viewer-owned only and emits Personal; Project waits for a represented ownership model.
      A mutation completes at the server boundary before the library refreshes; no pane owns a private copy.
    </p>
  </section>

  <section class="instantiate">
    <header><span>02 / PROPOSED AUTHORING</span><h3>One Template shell, borrowed editor runtimes.</h3></header>
    {@render flow(EDITING)}
    <p>
      This lifecycle is deferred. Done would await editor flush, compare-and-swap a new template
      revision, then remove scratch state; Cancel would discard it. A tab switch suspends the durable
      session—generic close or navigation must never race a flush by deleting underneath it.
    </p>
  </section>
</div>

<style>
  .flows {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
  }

  section {
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  section > header {
    display: flex;
    align-items: baseline;
    gap: calc(var(--token-spacing-unit) * 3);
    padding: calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 4);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  section > header span {
    flex: none;
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    color: var(--token-ink-primary);
    font-size: 0.85rem;
    font-weight: 550;
  }

  .flow {
    display: grid;
    grid-template-columns: minmax(8rem, 1fr) auto minmax(8rem, 1fr) auto minmax(8rem, 1fr) auto minmax(8rem, 1fr) auto minmax(8rem, 1fr);
    gap: calc(var(--token-spacing-unit) * 2);
    align-items: center;
    padding: calc(var(--token-spacing-unit) * 5) calc(var(--token-spacing-unit) * 4);
    background:
      radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--token-color-active-fill) 7%, transparent), transparent 28rem),
      var(--token-surface-work);
  }

  .flow article {
    display: flex;
    min-width: 0;
    min-height: calc(var(--token-spacing-unit) * 18);
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2.5);
    padding: calc(var(--token-spacing-unit) * 3);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-elevated);
    box-shadow: var(--token-shadow-raised);
  }

  .node-icon {
    display: grid;
    flex: none;
    width: calc(var(--token-spacing-unit) * 8);
    height: calc(var(--token-spacing-unit) * 8);
    place-items: center;
    border-radius: 999px;
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .flow strong,
  .flow small {
    display: block;
  }

  .flow strong {
    color: var(--token-ink-primary);
    font-size: 0.75rem;
    font-weight: 550;
  }

  .flow small {
    margin-top: calc(var(--token-spacing-unit) * 1);
    color: var(--token-ink-muted);
    font-size: 0.75rem;
    line-height: 1.4;
  }

  .arrow {
    display: grid;
    place-items: center;
    color: var(--token-color-active-text);
  }

  section > p {
    padding: calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 4);
    border-top: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
    font-size: 0.75rem;
    line-height: 1.55;
  }

  .instantiate .node-icon {
    color: var(--token-color-intelligence-text);
  }

  @media (max-width: 70rem) {
    .flow {
      grid-template-columns: 1fr;
    }

    .arrow {
      justify-self: center;
      transform: rotate(90deg);
    }
  }

  @media (max-width: 36rem) {
    section > header {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
