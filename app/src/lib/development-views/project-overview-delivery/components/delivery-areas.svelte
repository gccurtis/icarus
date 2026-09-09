<script lang="ts">
  import { DELIVERY_AREAS } from "$development-views/project-overview-delivery/procedures/release";
  import SectionHeading from "$development-views/project-overview-delivery/components/section-heading.svelte";
</script>

<section id="scope" class="section">
  <SectionHeading
    number="01"
    eyebrow="Scope map"
    title="Six coherent delivery areas"
    description="The apparent panel change crosses UI, capability, representation, reusable vocabulary, and evidence boundaries. These totals partition every file in the pinned Git range exactly once."
  />

  <div class="area-grid">
    {#each DELIVERY_AREAS as area, index (area.id)}
      <article id={`area-${area.id}`} data-delivery-area={area.id}>
        <header>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div><small>{area.files} files</small><h3>{area.label}</h3></div>
          <code>+{area.additions.toLocaleString("en-US")} / −{area.deletions}</code>
        </header>
        <p>{area.outcome}</p>
        <ul>
          {#each area.details as detail (detail)}<li>{detail}</li>{/each}
        </ul>
      </article>
    {/each}
  </div>
</section>

<style>
  .section { padding: 4.5rem clamp(1.25rem, 5vw, 5rem); }
  .area-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 2rem; border-top: 1px solid var(--token-border-strong); border-inline-start: 1px solid var(--token-border-strong); }
  article { min-width: 0; padding: 1.4rem; border-inline-end: 1px solid var(--token-border-strong); border-bottom: 1px solid var(--token-border-strong); background: color-mix(in srgb, var(--token-surface-elevated) 92%, transparent); }
  article header { display: grid; grid-template-columns: 2rem minmax(0, 1fr) auto; gap: 0.7rem; align-items: start; }
  header > span { color: var(--token-color-active-text); font: 600 0.58rem/1.5 "IBM Plex Mono", monospace; }
  small { color: var(--token-ink-muted); font-size: 0.55rem; letter-spacing: 0.08em; text-transform: uppercase; }
  h3 { margin: 0.22rem 0 0; font-size: 1rem; }
  code { color: var(--token-ink-muted); font: 500 0.58rem/1.5 "IBM Plex Mono", monospace; }
  article > p { max-width: 65ch; margin: 1.25rem 0; color: var(--token-ink-secondary); font-size: 0.78rem; line-height: 1.55; }
  ul { margin: 0; padding: 0; border-top: 1px solid var(--token-border-subtle); list-style: none; }
  li { position: relative; padding: 0.62rem 0 0.62rem 1rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-ink-muted); font-size: 0.68rem; line-height: 1.5; }
  li:last-child { border-bottom: 0; }
  li::before { position: absolute; top: 0.88rem; left: 0; width: 0.35rem; height: 0.35rem; background: var(--token-color-active-fill); content: ""; }
  @media (max-width: 52rem) { .area-grid { grid-template-columns: 1fr; } }
  @media (max-width: 34rem) { article header { grid-template-columns: 1.5rem 1fr; } article header code { grid-column: 2; } }
</style>
