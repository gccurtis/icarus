<script lang="ts">
  import AssuranceReference from "$development-views/project-overview-delivery/components/assurance-reference.svelte";
  import CapabilityBoundary from "$development-views/project-overview-delivery/components/capability-boundary.svelte";
  import DeliveredPanels from "$development-views/project-overview-delivery/components/delivered-panels.svelte";
  import DeliveryAreas from "$development-views/project-overview-delivery/components/delivery-areas.svelte";
  import DeliveryHero from "$development-views/project-overview-delivery/components/delivery-hero.svelte";
  import FileLedger from "$development-views/project-overview-delivery/components/file-ledger.svelte";
  import IntegrationDetails from "$development-views/project-overview-delivery/components/integration-details.svelte";
</script>

<svelte:head>
  <title>Project Overview delivery — reference</title>
  <meta
    name="description"
    content="Complete delivery record for the Project Overview panels merged between 3e670c5 and 930fb95."
  />
</svelte:head>

<div class="delivery-page">
  <DeliveryHero />

  <nav class="section-nav" aria-label="Delivery reference sections">
    <a href="#scope"><span>01</span>Scope</a>
    <a href="#panels"><span>02</span>Panels</a>
    <a href="#boundary"><span>03</span>Capability</a>
    <a href="#integration"><span>04</span>Integration</a>
    <a href="#assurance"><span>05</span>Assurance</a>
    <a href="#ledger"><span>06</span>File ledger</a>
  </nav>

  <main>
    <DeliveryAreas />
    <DeliveredPanels />
    <CapabilityBoundary />
    <IntegrationDetails />
    <AssuranceReference />
    <FileLedger />
  </main>

  <footer>
    <span>Delivery snapshot</span>
    <p>
      Facts on this page are pinned to <code>3e670c5..930fb95</code>. The reference page itself is
      intentionally outside that range, so reviewing it never changes the delivery it describes.
    </p>
    <a href="/demo/project-overview-panels">Open the interactive panel reference →</a>
  </footer>
</div>

<style>
  :global(html) { scroll-behavior: smooth; }
  .delivery-page {
    min-width: 0;
    min-height: 100%;
    background:
      linear-gradient(var(--token-border-subtle) 1px, transparent 1px),
      linear-gradient(90deg, var(--token-border-subtle) 1px, transparent 1px),
      var(--token-surface-canvas);
    background-size: 3rem 3rem;
    color: var(--token-ink-primary);
  }
  .section-nav { position: sticky; top: 2.75rem; z-index: 20; display: flex; min-width: 0; padding-inline: clamp(1.25rem, 5vw, 5rem); border-bottom: 1px solid var(--token-border-strong); background: color-mix(in srgb, var(--token-surface-elevated) 94%, transparent); backdrop-filter: blur(12px); overflow-x: auto; }
  .section-nav a { display: flex; flex: 1 0 auto; gap: 0.45rem; justify-content: center; padding: 0.72rem 1rem; border-inline-end: 1px solid var(--token-border-subtle); color: var(--token-ink-secondary); font-size: 0.62rem; font-weight: 650; }
  .section-nav a:first-child { border-inline-start: 1px solid var(--token-border-subtle); }
  .section-nav a:hover { background: var(--token-surface-panel-hover); color: var(--token-ink-primary); }
  .section-nav span { color: var(--token-color-active-text); font: 600 0.56rem/1.4 "IBM Plex Mono", monospace; }
  main { min-width: 0; }
  footer { display: grid; grid-template-columns: auto minmax(16rem, 1fr) auto; gap: 2rem; align-items: center; padding: 2rem clamp(1.25rem, 5vw, 5rem); border-top: 1px solid var(--token-border-strong); background: var(--token-surface-inverted); color: var(--token-ink-on-inverted); }
  footer > span { font-size: 0.55rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; }
  footer p { max-width: 80ch; margin: 0; opacity: 0.64; font-size: 0.63rem; line-height: 1.55; }
  footer code { color: inherit; font-family: "IBM Plex Mono", monospace; }
  footer a { color: var(--token-color-interactive-text-on-inverted); font-size: 0.65rem; font-weight: 650; }
  @media (max-width: 50rem) { footer { grid-template-columns: 1fr; gap: 0.8rem; } }
</style>
