<script lang="ts">
  import { NAV } from "$development-views/formula-language-reference/procedures/navigation";
  import type { PageSlug } from "$development-views/formula-language-reference/types";

  let {
    current,
    appearance,
    appearances,
    onappearance
  }: {
    current: PageSlug;
    appearance: string;
    appearances: readonly string[];
    onappearance: (next: string) => void;
  } = $props();

  const LABELS: Record<string, string> = { helios: "Helios", selene: "Selene" };
</script>

<header class="suite">
  <a class="brand" href="/app/dev-project/reference/formulas">
    <span>FX</span>
    <strong>Formula language</strong>
  </a>
  <nav aria-label="Reference pages">
    {#each NAV as item (item.slug)}
      <a href={item.href} aria-current={current === item.slug ? "page" : undefined}>
        <span>{item.index}</span>{item.label}
      </a>
    {/each}
  </nav>
  <div class="material" role="group" aria-label="Appearance">
    {#each appearances as name (name)}
      <button
        type="button"
        aria-pressed={appearance === name}
        onclick={() => onappearance(name)}
      >
        {LABELS[name] ?? name}
      </button>
    {/each}
  </div>
  <a class="live" href="/app/dev-project">Editor <span aria-hidden="true">↗</span></a>
</header>

<style>
  .suite {
    position: sticky;
    top: 0;
    z-index: 50;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: stretch;
    min-height: 3.25rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: color-mix(in srgb, var(--token-surface-canvas) 92%, transparent);
    backdrop-filter: blur(14px);
  }

  .brand,
  .live,
  nav a {
    color: inherit;
    text-decoration: none;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 1rem;
    border-right: 1px solid var(--token-border-subtle);
  }

  .brand > span {
    display: grid;
    width: 1.7rem;
    height: 1.7rem;
    place-items: center;
    border-radius: 5px;
    background: var(--token-color-intelligence-fill);
    color: var(--token-color-intelligence-on-fill);
    font-family: var(--token-font-mono);
    font-size: 9px;
    font-weight: 700;
  }

  .brand strong {
    font-size: 11px;
    white-space: nowrap;
  }

  nav {
    display: flex;
    min-width: 0;
    align-items: stretch;
    overflow-x: auto;
    scrollbar-width: none;
  }

  nav::-webkit-scrollbar {
    display: none;
  }

  nav a {
    display: flex;
    flex: 1 0 auto;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-width: 5.5rem;
    padding: 0.5rem 0.7rem;
    border-right: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
    font-size: 10.5px;
    font-weight: 650;
  }

  nav a span {
    color: var(--token-border-strong);
    font-family: var(--token-font-mono);
    font-size: 8px;
  }

  nav a:hover {
    background: var(--token-surface-panel);
    color: var(--token-ink-primary);
  }

  nav a[aria-current="page"] {
    box-shadow: inset 0 -3px 0 var(--token-color-intelligence-text);
    background: var(--token-color-intelligence-surface);
    color: var(--token-color-intelligence-text);
  }

  nav a[aria-current="page"] span {
    color: inherit;
  }

  .material {
    display: flex;
    align-self: center;
    align-items: center;
    gap: 2px;
    margin-inline: 0.85rem;
    padding: 2px;
    border: 1px solid var(--token-border-strong);
    border-radius: var(--token-radius-control);
  }

  .material button {
    border-radius: var(--token-radius-control);
    padding: 0.28rem 0.65rem;
    color: var(--token-ink-secondary);
    font-size: 10.5px;
    font-weight: 650;
    white-space: nowrap;
  }

  .material button:hover {
    background: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  .material button[aria-pressed="true"] {
    background: var(--token-color-interactive-fill);
    color: var(--token-ink-on-fill);
  }

  .live {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 1rem;
    color: var(--token-color-interactive-text);
    font-size: 10.5px;
    font-weight: 700;
    white-space: nowrap;
  }

  .live:hover {
    text-decoration: underline;
  }
</style>
