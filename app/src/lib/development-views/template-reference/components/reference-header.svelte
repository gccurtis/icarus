<script lang="ts">
  import { page } from "$app/state";

  import { PAGES, hrefOf, type ReferencePage } from "$development-views/template-reference/procedures/navigation";

  let {
    current,
    material,
    materials = [],
    onmaterial
  }: {
    current: ReferencePage["slug"];
    material?: string;
    materials?: readonly string[];
    onmaterial?: (next: string) => void;
  } = $props();

  const project = $derived(page.params.project ?? "dev-project");

  const NAMES: Record<string, string> = { helios: "Helios", selene: "Selene" };
</script>

<header class="suite">
  <span class="brand">
    <span class="mark">TP</span>
    <strong>Templates</strong>
  </span>
  <nav aria-label="Template reference pages">
    {#each PAGES as item (item.slug)}
      <a href={hrefOf(project, item.slug)} aria-current={current === item.slug ? "page" : undefined}>
        <span>{item.index}</span>
        <b>{item.label}</b>
        <small>{item.sub}</small>
      </a>
    {/each}
  </nav>
  <div class="tail">
    {#if onmaterial !== undefined && materials.length > 1}
      <div class="material" role="group" aria-label="Material">
        {#each materials as name (name)}
          <button type="button" aria-pressed={material === name} onclick={() => onmaterial(name)}>
            {NAMES[name] ?? name}
          </button>
        {/each}
      </div>
    {/if}
    <a class="live" href={`/app/${project}`}>Open the app <span aria-hidden="true">↗</span></a>
  </div>
</header>

<style>
  .suite {
    position: sticky;
    top: 0;
    z-index: 50;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: stretch;
    min-height: 3.5rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: color-mix(in srgb, var(--token-surface-canvas) 92%, transparent);
    backdrop-filter: blur(14px);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: .65rem;
    padding: .65rem 1rem;
    border-right: 1px solid var(--token-border-subtle);
  }

  .mark {
    display: grid;
    width: 1.75rem;
    height: 1.75rem;
    place-items: center;
    border-radius: 5px;
    background: var(--token-ink-primary);
    color: var(--token-surface-canvas);
    font: 700 9px/1 "IBM Plex Mono", ui-monospace, monospace;
    letter-spacing: .06em;
  }

  .brand strong { font-size: 11px; white-space: nowrap; }

  nav { display: flex; min-width: 0; align-items: stretch; overflow-x: auto; scrollbar-width: none; }
  nav::-webkit-scrollbar { display: none; }

  nav a {
    display: flex;
    flex: 0 1 auto;
    flex-direction: column;
    justify-content: center;
    gap: .05rem;
    min-width: 10rem;
    padding: .5rem 1rem;
    border-right: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
    text-decoration: none;
  }

  nav a span { color: var(--token-border-strong); font: 500 8px/1 "IBM Plex Mono", ui-monospace, monospace; }
  nav a b { font-size: 11.5px; font-weight: 700; white-space: nowrap; }
  nav a small { font-size: 10px; white-space: nowrap; }
  nav a:hover { background: var(--token-surface-panel); color: var(--token-ink-primary); }

  nav a[aria-current="page"] {
    box-shadow: inset 0 -3px 0 var(--token-color-active-text);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  nav a[aria-current="page"] span { color: inherit; }

  .tail {
    display: flex;
    align-items: center;
    gap: .6rem;
    padding-inline: .75rem;
    border-left: 1px solid var(--token-border-subtle);
  }

  .material {
    display: flex;
    gap: .15rem;
    padding: .15rem;
    border-radius: var(--token-radius-control);
    background: var(--token-surface-work);
  }

  .material button {
    padding: .25rem .55rem;
    border: 0;
    border-radius: calc(var(--token-radius-control) - 1px);
    background: transparent;
    color: var(--token-ink-secondary);
    font: 650 10px/1.4 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
    cursor: pointer;
  }

  .material button:hover { background: var(--token-surface-panel); color: var(--token-ink-primary); }

  .material button[aria-pressed="true"] {
    background: var(--token-color-interactive-surface);
    color: var(--token-color-interactive-text);
  }

  .live {
    display: flex;
    align-items: center;
    gap: .45rem;
    color: var(--token-color-interactive-text);
    font-size: 10.5px;
    font-weight: 700;
    white-space: nowrap;
    text-decoration: none;
  }

  .live:hover { text-decoration: underline; }

  @media (max-width: 60rem) {
    .live { display: none; }
    nav a small { display: none; }
  }
</style>
