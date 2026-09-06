<script lang="ts">
  import { REFERENCE_NAV } from "$development-views/document-editor-reference/procedures/navigation";
  import type { AreaSlug } from "$development-views/document-editor-reference/types";

  let { current }: { current: "overview" | AreaSlug | "ledger" } = $props();
</script>

<header class="suite-header">
  <a class="suite-brand" href="/demo/document-editor-reference" aria-label="Document editor reference overview">
    <span>DE</span>
    <strong>Editor system reference</strong>
  </a>
  <nav aria-label="Reference pages">
    {#each REFERENCE_NAV as item (item.slug)}
      <a href={item.href} aria-current={current === item.slug ? "page" : undefined}>
        <span>{item.index}</span>{item.label}
      </a>
    {/each}
  </nav>
  <a class="live" href="/app/dev-project">Open live editor <span aria-hidden="true">↗</span></a>
</header>

<style>
  .suite-header {
    position: sticky;
    top: 0;
    z-index: 50;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: stretch;
    min-height: 3.5rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: color-mix(in srgb, var(--token-surface-canvas) 94%, transparent);
    backdrop-filter: blur(14px);
  }
  .suite-brand, .live, nav a { color: inherit; text-decoration: none; }
  .suite-brand { display: flex; align-items: center; gap: .65rem; padding: .65rem 1rem; border-right: 1px solid var(--token-border-subtle); }
  .suite-brand > span { display: grid; width: 1.75rem; height: 1.75rem; place-items: center; border-radius: 5px; background: var(--token-ink-primary); color: var(--token-surface-canvas); font: 700 9px/1 "IBM Plex Mono", ui-monospace, monospace; letter-spacing: .06em; }
  .suite-brand strong { font-size: 11px; white-space: nowrap; }
  nav { display: flex; min-width: 0; align-items: stretch; overflow-x: auto; scrollbar-width: none; }
  nav::-webkit-scrollbar { display: none; }
  nav a { display: flex; flex: 1 0 auto; align-items: center; justify-content: center; gap: .35rem; min-width: 5.7rem; padding: .55rem .7rem; border-right: 1px solid var(--token-border-subtle); color: var(--token-ink-muted); font-size: 10.5px; font-weight: 650; }
  nav a span { color: var(--token-border-strong); font: 500 8px/1 "IBM Plex Mono", ui-monospace, monospace; }
  nav a:hover { background: var(--token-surface-panel); color: var(--token-ink-primary); }
  nav a[aria-current="page"] { box-shadow: inset 0 -3px 0 var(--token-color-active-text); background: var(--token-color-active-surface); color: var(--token-color-active-text); }
  nav a[aria-current="page"] span { color: inherit; }
  .live { display: flex; align-items: center; gap: .45rem; padding: .65rem 1rem; color: var(--token-color-interactive-text); font-size: 10.5px; font-weight: 700; white-space: nowrap; }
  .live:hover { text-decoration: underline; }
  @media (max-width: 72rem) {
    .suite-header { grid-template-columns: auto minmax(0, 1fr); }
    .live { display: none; }
  }
  @media (max-width: 44rem) {
    .suite-header { display: block; }
    .suite-brand { min-height: 3.2rem; border-right: 0; border-bottom: 1px solid var(--token-border-subtle); }
    nav a { min-width: 5.3rem; }
  }
</style>
