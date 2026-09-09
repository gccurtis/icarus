<script lang="ts">
  import CheckCircle2 from "@lucide/svelte/icons/circle-check-big";
  import Shield from "@lucide/svelte/icons/shield";

  import SectionHeading from "$development-views/project-overview-delivery/components/section-heading.svelte";
  import { INTENTIONAL_BOUNDARIES } from "$development-views/project-overview-delivery/procedures/contracts";
  import {
    ARCHITECTURE_REPAIRS,
    VERIFICATION_FACTS
  } from "$development-views/project-overview-delivery/procedures/release";
</script>

<section id="assurance" class="section">
  <SectionHeading
    number="05"
    eyebrow="Assurance"
    title="Architecture repaired, boundaries held"
    description="The integration work did more than make the panels render. It removed direct component crossings, gave commands and effects explicit owners, proved the only mutation atomic, and kept deliberately unsupported behavior visible rather than approximated."
  />

  <div class="repair-grid" aria-label="Architecture repairs">
    {#each ARCHITECTURE_REPAIRS as fact (fact.label)}
      <article>
        <small>{fact.label}</small>
        <strong>{fact.value}</strong>
        <p>{fact.detail}</p>
      </article>
    {/each}
  </div>

  <div class="boundary-grid">
    <article class="boundaries">
      <header><Shield size={18} aria-hidden="true" /><div><small>Intentional boundaries</small><h3>What this delivery does not pretend to support</h3></div></header>
      <dl>
        {#each INTENTIONAL_BOUNDARIES as boundary (boundary.label)}
          <div><dt>{boundary.label}</dt><dd><strong>{boundary.value}</strong><span>{boundary.detail}</span></dd></div>
        {/each}
      </dl>
    </article>

    <article class="verification">
      <header><CheckCircle2 size={18} aria-hidden="true" /><div><small>Merge gate</small><h3>Executable evidence at 930fb95</h3></div></header>
      <dl>
        {#each VERIFICATION_FACTS as fact (fact.label)}
          <div><dt>{fact.label}</dt><dd><strong>{fact.value}</strong><span>{fact.detail}</span></dd></div>
        {/each}
      </dl>
    </article>
  </div>
</section>

<style>
  .section { padding: 4.5rem clamp(1.25rem, 5vw, 5rem); border-top: 1px solid var(--token-border-strong); }
  .repair-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 2rem; border-top: 1px solid var(--token-border-strong); border-inline-start: 1px solid var(--token-border-strong); }
  .repair-grid article { min-width: 0; padding: 1rem; border-inline-end: 1px solid var(--token-border-strong); border-bottom: 1px solid var(--token-border-strong); background: color-mix(in srgb, var(--token-surface-elevated) 90%, transparent); }
  small { color: var(--token-ink-muted); font-size: 0.53rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  .repair-grid strong { display: block; margin-top: 1.6rem; color: var(--token-color-active-text); font: 650 1.45rem/1 "IBM Plex Mono", monospace; }
  .repair-grid p { margin: 0.65rem 0 0; color: var(--token-ink-secondary); font-size: 0.66rem; line-height: 1.5; }
  .boundary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; margin-top: 1.5rem; }
  .boundary-grid > article { min-width: 0; border: 1px solid var(--token-border-strong); background: var(--token-surface-elevated); }
  .boundary-grid header { display: flex; gap: 0.8rem; align-items: flex-start; padding: 1.1rem; border-bottom: 1px solid var(--token-border-strong); color: var(--token-color-active-text); }
  h3 { margin: 0.25rem 0 0; color: var(--token-ink-primary); font-size: 0.86rem; }
  dl { margin: 0; }
  dl > div { display: grid; grid-template-columns: minmax(7rem, 0.45fr) minmax(0, 1fr); gap: 1rem; padding: 0.8rem 1rem; border-bottom: 1px solid var(--token-border-subtle); }
  dl > div:last-child { border-bottom: 0; }
  dt { color: var(--token-ink-muted); font-size: 0.55rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  dd { display: flex; min-width: 0; flex-direction: column; gap: 0.25rem; margin: 0; }
  dd strong { font: 600 0.69rem/1.4 "IBM Plex Mono", monospace; overflow-wrap: anywhere; }
  dd span { color: var(--token-ink-secondary); font-size: 0.64rem; line-height: 1.5; }
  .verification { border-top-color: var(--token-color-success-border) !important; }
  .verification header { background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  @media (max-width: 60rem) { .repair-grid { grid-template-columns: repeat(2, 1fr); } .boundary-grid { grid-template-columns: 1fr; } }
  @media (max-width: 38rem) { .repair-grid { grid-template-columns: 1fr; } dl > div { grid-template-columns: 1fr; gap: 0.3rem; } }
</style>
