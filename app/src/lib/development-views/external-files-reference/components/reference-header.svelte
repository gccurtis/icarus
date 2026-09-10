<script lang="ts">
  import FileArchive from "@lucide/svelte/icons/file-archive";

  import { EXTERNAL_FILE_REFERENCE_NAV } from "$development-views/external-files-reference/procedures/navigation";
  import type { ReferenceSlug } from "$development-views/external-files-reference/types";

  let { current }: { current: ReferenceSlug } = $props();
</script>

<header class="suite-header">
  <a class="suite-brand" href="/demo/external-files" aria-label="External files reference overview">
    <span><FileArchive size={15} strokeWidth={1.8} aria-hidden="true" /></span>
    <strong>External files</strong>
    <small>architecture reference</small>
  </a>

  <nav aria-label="External-files reference pages">
    {#each EXTERNAL_FILE_REFERENCE_NAV as item (item.slug)}
      <a href={item.href} aria-current={current === item.slug ? "page" : undefined}>
        <span>{item.index}</span>{item.label}
      </a>
    {/each}
  </nav>

  <div class="branch">
    <span>branch</span>
    <code>work/external-files</code>
  </div>
</header>

<style>
  .suite-header {
    position: sticky;
    top: 0;
    z-index: 60;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: stretch;
    min-height: 3.55rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: color-mix(in srgb, var(--token-surface-canvas) 94%, transparent);
    backdrop-filter: blur(16px);
  }

  a { color: inherit; text-decoration: none; }

  .suite-brand {
    display: flex;
    align-items: center;
    gap: .62rem;
    padding: .65rem 1rem;
    border-right: 1px solid var(--token-border-subtle);
  }

  .suite-brand > span {
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    border-radius: var(--token-radius-control);
    background: var(--token-color-active-fill);
    color: var(--token-ink-on-fill);
  }

  .suite-brand strong { font-size: 11px; white-space: nowrap; }
  .suite-brand small { color: var(--token-ink-muted); font-size: 9px; white-space: nowrap; }

  nav {
    display: flex;
    min-width: 0;
    align-items: stretch;
    overflow-x: auto;
    scrollbar-width: none;
  }

  nav::-webkit-scrollbar { display: none; }

  nav a {
    display: flex;
    min-width: 7.4rem;
    flex: 1 0 auto;
    align-items: center;
    justify-content: center;
    gap: .4rem;
    padding: .55rem .85rem;
    border-right: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
    font-size: 10.5px;
    font-weight: 650;
  }

  nav a span {
    color: var(--token-border-strong);
    font: 600 8px/1 var(--token-font-mono);
  }

  nav a:hover { background: var(--token-surface-panel); color: var(--token-ink-primary); }

  nav a[aria-current="page"] {
    box-shadow: inset 0 -3px 0 var(--token-color-active-text);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  nav a[aria-current="page"] span { color: inherit; }

  .branch {
    display: grid;
    align-content: center;
    gap: .15rem;
    padding: .55rem 1rem;
    color: var(--token-ink-muted);
  }

  .branch span { font-size: 7px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
  .branch code { color: var(--token-ink-secondary); font: 500 9px/1.2 var(--token-font-mono); }

  @media (max-width: 74rem) {
    .suite-header { grid-template-columns: auto minmax(0, 1fr); }
    .branch, .suite-brand small { display: none; }
  }

  @media (max-width: 46rem) {
    .suite-header { display: block; }
    .suite-brand { min-height: 3.1rem; border-right: 0; border-bottom: 1px solid var(--token-border-subtle); }
    nav a { min-width: 6.4rem; }
  }
</style>
