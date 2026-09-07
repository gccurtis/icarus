<script lang="ts">
  import { PAGES, hrefOf } from "$development-views/agents-reference/procedures/navigation";
  import type { PageSlug } from "$development-views/agents-reference/types";

  let { current, root, project }: { current: PageSlug; root: string; project: string } = $props();
</script>

<header class="suite">
  <a class="brand" href={root} aria-label="Agents reference overview">
    <span>AG</span>
    <strong>Agents reference</strong>
  </a>
  <nav aria-label="Reference pages">
    {#each PAGES as page (page.slug)}
      <a href={hrefOf(root, page)} aria-current={current === page.slug ? "page" : undefined}>
        <span>{page.index}</span>{page.label}
      </a>
    {/each}
  </nav>
  <a class="live" href="/app/{project}" data-sveltekit-reload>Open the app <span aria-hidden="true">↗</span></a>
</header>

<style>
  .suite {
    position: sticky;
    top: 2.75rem;
    z-index: 40;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: stretch;
    min-height: 3.5rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: var(--token-surface-veil);
    backdrop-filter: blur(var(--token-blur-veil));
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
    gap: 0.65rem;
    padding: 0.65rem 1rem;
    border-right: 1px solid var(--token-border-subtle);
  }

  .brand > span {
    display: grid;
    width: 1.75rem;
    height: 1.75rem;
    place-items: center;
    border-radius: var(--token-radius-control);
    background: var(--token-color-intelligence-fill);
    color: var(--token-color-intelligence-on-fill);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    font-weight: var(--token-weight-strong);
    letter-spacing: 0.06em;
  }

  .brand strong {
    font-size: var(--token-text-caption);
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
    gap: 0.4rem;
    min-width: 6rem;
    padding: 0.55rem 0.8rem;
    border-right: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: var(--token-weight-strong);
  }

  nav a span {
    color: var(--token-border-strong);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    font-weight: var(--token-weight-medium);
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

  .live {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.65rem 1rem;
    color: var(--token-color-interactive-text);
    font-size: var(--token-text-caption);
    font-weight: var(--token-weight-strong);
    white-space: nowrap;
  }

  .live:hover {
    text-decoration: underline;
  }

  @media (max-width: 72rem) {
    .suite {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .live {
      display: none;
    }
  }

  @media (max-width: 44rem) {
    .suite {
      display: block;
    }

    .brand {
      min-height: 3.2rem;
      border-right: 0;
      border-bottom: 1px solid var(--token-border-subtle);
    }
  }
</style>
