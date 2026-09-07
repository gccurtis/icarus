<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";

  let {
    label,
    steps,
    tone = "active"
  }: {
    label: string;
    steps: readonly { actor: string; action: string; artifact?: string }[];
    tone?: "active" | "intelligence";
  } = $props();
</script>

<div class="flow flow-{tone}" role="list" aria-label={label}>
  {#each steps as step, index (index)}
    <article role="listitem">
      <span class="n">{String(index + 1).padStart(2, "0")}</span>
      <small>{step.actor}</small>
      <p>{step.action}</p>
      {#if step.artifact}<code>{step.artifact}</code>{/if}
    </article>
    {#if index < steps.length - 1}
      <span class="arrow" aria-hidden="true"><ArrowRight size={16} /></span>
    {/if}
  {/each}
</div>

<style>
  .flow {
    display: flex;
    flex-wrap: wrap;
    align-items: stretch;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-work);
  }

  article {
    display: flex;
    min-width: 12rem;
    flex: 1 1 12rem;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.8rem 0.9rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-elevated);
    box-shadow: var(--token-shadow-panel);
  }

  .n {
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    letter-spacing: var(--token-tracking-caps);
  }

  .flow-active .n,
  .flow-active .arrow {
    color: var(--token-color-active-text);
  }

  .flow-intelligence .n,
  .flow-intelligence .arrow {
    color: var(--token-color-intelligence-text);
  }

  small {
    color: var(--token-ink-muted);
    font-size: var(--token-text-micro);
    font-weight: var(--token-weight-strong);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  p {
    margin: 0.15rem 0 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  code {
    margin-top: 0.35rem;
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
  }

  .arrow {
    display: grid;
    flex: none;
    place-items: center;
  }
</style>
