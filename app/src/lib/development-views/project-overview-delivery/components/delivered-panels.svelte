<script lang="ts">
  import { DELIVERED_PANELS } from "$development-views/project-overview-delivery/procedures/contracts";
  import SectionHeading from "$development-views/project-overview-delivery/components/section-heading.svelte";
</script>

<section id="panels" class="section">
  <SectionHeading
    number="02"
    eyebrow="Product surface"
    title="What each panel now does"
    description="The centre remains the Project Overview. Context answers broad project questions; Inspector explains one selected subject. Every view key, read, and interaction below is production wiring rather than mock-only behavior."
  />

  <div class="surface-group">
    <div class="surface-label"><span>Context</span><p>Persistent project-wide companions with no selected subject.</p></div>
    <div class="panels context-panels">
      {#each DELIVERED_PANELS.filter((panel) => panel.surface === "Context") as panel, index (panel.key)}
        <article data-delivered-panel={panel.key}>
          <header><span>{String(index + 1).padStart(2, "0")}</span><h3>{panel.name}</h3><code>{panel.key}</code></header>
          <dl>
            <div><dt>Reads</dt><dd><code>{panel.reads}</code></dd></div>
            <div><dt>Presents</dt><dd>{panel.presents}</dd></div>
            <div><dt>Behavior</dt><dd>{panel.behavior}</dd></div>
          </dl>
        </article>
      {/each}
    </div>
  </div>

  <div class="surface-group">
    <div class="surface-label"><span>Inspector</span><p>Subject-specific lenses opened by an explicit typed selection.</p></div>
    <div class="panels inspector-panels">
      {#each DELIVERED_PANELS.filter((panel) => panel.surface === "Inspector") as panel, index (panel.key)}
        <article data-delivered-panel={panel.key}>
          <header><span>{String(index + 3).padStart(2, "0")}</span><h3>{panel.name}</h3><code>{panel.key}</code></header>
          <dl>
            <div><dt>Reads</dt><dd><code>{panel.reads}</code></dd></div>
            <div><dt>Presents</dt><dd>{panel.presents}</dd></div>
            <div><dt>Behavior</dt><dd>{panel.behavior}</dd></div>
          </dl>
        </article>
      {/each}
    </div>
  </div>

  <a class="visual-link" href="/demo/project-overview-panels">
    <span>Interactive visual companion</span>
    <strong>Open all six panels at review width →</strong>
  </a>
</section>

<style>
  .section { padding: 4.5rem clamp(1.25rem, 5vw, 5rem); border-top: 1px solid var(--token-border-strong); background: var(--token-surface-work); }
  .surface-group { display: grid; grid-template-columns: minmax(10rem, 0.24fr) minmax(0, 1fr); margin-top: 2rem; border-top: 3px solid var(--token-border-strong); }
  .surface-label { padding: 1.2rem 1rem 1.2rem 0; }
  .surface-label span { color: var(--token-color-active-text); font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .surface-label p { max-width: 22ch; margin: 0.65rem 0 0; color: var(--token-ink-muted); font-size: 0.67rem; line-height: 1.5; }
  .panels { display: grid; border-inline-start: 1px solid var(--token-border-strong); }
  .context-panels { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .inspector-panels { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  article { min-width: 0; border-inline-end: 1px solid var(--token-border-strong); border-bottom: 1px solid var(--token-border-strong); background: var(--token-surface-elevated); }
  article header { display: grid; grid-template-columns: 2rem 1fr; gap: 0.35rem 0.6rem; padding: 1rem; border-bottom: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); }
  header > span { grid-row: 1 / 3; color: var(--token-color-active-text); font: 600 0.57rem/1.5 "IBM Plex Mono", monospace; }
  h3 { margin: 0; font-size: 0.92rem; }
  header code { color: var(--token-ink-muted); font-size: 0.58rem; overflow-wrap: anywhere; }
  dl { margin: 0; }
  dl > div { display: grid; grid-template-columns: 5rem minmax(0, 1fr); gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--token-border-subtle); }
  dl > div:last-child { border-bottom: 0; }
  dt { color: var(--token-ink-muted); font-size: 0.55rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  dd { margin: 0; color: var(--token-ink-secondary); font-size: 0.68rem; line-height: 1.5; }
  code { color: var(--token-color-interactive-text); font-family: "IBM Plex Mono", monospace; }
  .visual-link { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.5rem; padding: 1rem 1.2rem; border: 1px solid var(--token-color-active-border); background: var(--token-color-active-surface); color: var(--token-color-active-text); font-size: 0.72rem; }
  .visual-link span { color: var(--token-ink-secondary); }
  @media (max-width: 64rem) { .surface-group { grid-template-columns: 1fr; } .surface-label { display: flex; justify-content: space-between; gap: 1rem; padding-right: 0; } .surface-label p { max-width: 52ch; margin: 0; } .panels { border-inline-start: 0; } }
  @media (max-width: 48rem) { .context-panels, .inspector-panels { grid-template-columns: 1fr; } .visual-link { align-items: flex-start; flex-direction: column; } }
  @media (max-width: 34rem) { .surface-label { flex-direction: column; } dl > div { grid-template-columns: 1fr; gap: 0.3rem; } }
</style>
