<script lang="ts">
  import Layers3 from "@lucide/svelte/icons/layers-3";

  import SectionHeading from "$development-views/project-overview-delivery/components/section-heading.svelte";
  import { VOCABULARY_CHANGES } from "$development-views/project-overview-delivery/procedures/contracts";
  import { REPRESENTATION_FACTS } from "$development-views/project-overview-delivery/procedures/release";
</script>

<section id="integration" class="section">
  <SectionHeading
    number="04"
    eyebrow="Shared integration"
    title="What changed beneath the panels"
    description="The delivery extends the shared panel language only where an existing primitive owns the behavior, then represents the new resource facts and view destinations explicitly. Every vocabulary addition is opt-in; no compatibility layer was introduced."
  />

  <div class="integration-grid">
    <article class="vocabulary">
      <header>
        <Layers3 size={18} aria-hidden="true" />
        <div><small>Reusable vocabulary</small><h3>Seven bounded-content additions</h3></div>
      </header>
      <div class="vocabulary-list">
        {#each VOCABULARY_CHANGES as change (change.component)}
          <div>
            <code>{change.component}</code>
            <strong>{change.addition}</strong>
            <p>{change.reason}</p>
          </div>
        {/each}
      </div>
    </article>

    <article class="representation">
      <header>
        <small>Representation + workspace</small>
        <h3>New facts have explicit owners</h3>
        <p>
          The UI does not infer these concepts from unrelated fields. The current schema and
          workspace registry name them directly, while retired destinations are removed instead of
          translated.
        </p>
      </header>
      <dl>
        {#each REPRESENTATION_FACTS as fact (fact.label)}
          <div>
            <dt>{fact.label}</dt>
            <dd><strong>{fact.value}</strong><span>{fact.detail}</span></dd>
          </div>
        {/each}
      </dl>
    </article>
  </div>
</section>

<style>
  .section {
    padding: 4.5rem clamp(1.25rem, 5vw, 5rem);
    border-top: 1px solid var(--token-border-strong);
    background: var(--token-surface-work);
  }

  .integration-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(18rem, 0.7fr);
    gap: 1.5rem;
    margin-top: 2rem;
  }

  article {
    min-width: 0;
    border: 1px solid var(--token-border-strong);
    background: var(--token-surface-elevated);
  }

  article > header {
    display: flex;
    gap: 0.8rem;
    align-items: flex-start;
    padding: 1.2rem;
    border-bottom: 1px solid var(--token-border-strong);
    color: var(--token-color-active-text);
  }

  small {
    display: block;
    color: var(--token-ink-muted);
    font-size: 0.54rem;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  h3 {
    margin: 0.28rem 0 0;
    color: var(--token-ink-primary);
    font-size: 0.95rem;
  }

  .vocabulary-list > div {
    display: grid;
    grid-template-columns: minmax(8.5rem, 0.5fr) minmax(9rem, 0.6fr) minmax(16rem, 1.25fr);
    gap: 1rem;
    align-items: baseline;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .vocabulary-list > div:last-child { border-bottom: 0; }
  code { color: var(--token-color-interactive-text); font: 600 0.62rem/1.5 "IBM Plex Mono", monospace; overflow-wrap: anywhere; }
  .vocabulary-list strong { font-size: 0.66rem; overflow-wrap: anywhere; }
  .vocabulary-list p { margin: 0; color: var(--token-ink-secondary); font-size: 0.66rem; line-height: 1.5; }

  .representation > header {
    display: block;
    color: inherit;
  }

  .representation > header p {
    margin: 0.65rem 0 0;
    color: var(--token-ink-secondary);
    font-size: 0.69rem;
    line-height: 1.55;
  }

  dl { margin: 0; }
  dl > div { padding: 0.9rem 1rem; border-bottom: 1px solid var(--token-border-subtle); }
  dl > div:last-child { border-bottom: 0; }
  dt { margin-bottom: 0.35rem; color: var(--token-ink-muted); font-size: 0.54rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; }
  dd { display: flex; flex-direction: column; gap: 0.3rem; margin: 0; }
  dd strong { font: 600 0.72rem/1.4 "IBM Plex Mono", monospace; }
  dd span { color: var(--token-ink-secondary); font-size: 0.65rem; line-height: 1.48; }

  @media (max-width: 68rem) {
    .integration-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 48rem) {
    .vocabulary-list > div { grid-template-columns: 1fr; gap: 0.25rem; }
  }
</style>
