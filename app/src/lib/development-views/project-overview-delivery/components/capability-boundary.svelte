<script lang="ts">
  import ShieldCheck from "@lucide/svelte/icons/shield-check";

  import {
    CAPABILITY_FLOW,
    DELIVERED_CAPABILITIES
  } from "$development-views/project-overview-delivery/procedures/contracts";
  import SectionHeading from "$development-views/project-overview-delivery/components/section-heading.svelte";
</script>

<section id="boundary" class="section">
  <SectionHeading
    number="03"
    eyebrow="Server contract"
    title="A bounded Project capability"
    description="Panels do not choose tables or join arbitrary store rows. The active request scope enters once, each public entry validates its own input, and only the projection required by that view crosses back to the client."
  />

  <ol class="flow" aria-label="Project panel data flow">
    {#each CAPABILITY_FLOW as step (step.label)}
      <li><small>{step.label}</small><strong>{step.value}</strong><p>{step.detail}</p></li>
    {/each}
  </ol>

  <div class="contract-table" aria-label="Project capability entries">
    <div class="contract-head">
      <span>Entry</span><span>Input</span><span>Returns</span><span>Guarantee</span>
    </div>
    {#each DELIVERED_CAPABILITIES as capability (capability.name)}
      <article data-capability-entry={capability.name}>
        <div><span class:command={capability.kind === "Command"}>{capability.kind}</span><code>{capability.name}</code></div>
        <p>{capability.input}</p>
        <p>{capability.result}</p>
        <p>{capability.guarantee}</p>
      </article>
    {/each}
  </div>

  <aside class="atomicity">
    <ShieldCheck size={22} aria-hidden="true" />
    <div>
      <small>Mutation invariant</small>
      <h3>Summary, timestamp, and editor are one intent.</h3>
      <p>
        <code>updateProjectResourceSummary</code> resolves ownership inside the transaction and
        routes every write through its unit. A pre-journal fault leaves the resource untouched;
        interruption after any durable boundary recovers the complete update on restart.
      </p>
    </div>
  </aside>
</section>

<style>
  .section { padding: 4.5rem clamp(1.25rem, 5vw, 5rem); border-top: 1px solid var(--token-border-strong); }
  .flow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin: 2rem 0; padding: 0; border: 1px solid var(--token-border-strong); background: var(--token-surface-inverted); color: var(--token-ink-on-inverted); list-style: none; }
  .flow li { position: relative; display: flex; min-height: 9rem; min-width: 0; flex-direction: column; padding: 1rem; border-inline-end: 1px solid color-mix(in srgb, currentColor 22%, transparent); }
  .flow li:last-child { border-inline-end: 0; }
  .flow li::after { position: absolute; top: 50%; right: -0.48rem; z-index: 1; display: grid; width: 0.95rem; height: 0.95rem; place-items: center; background: var(--token-surface-inverted); content: "→"; font-size: 0.65rem; }
  .flow li:last-child::after { display: none; }
  .flow small { opacity: 0.55; font: 500 0.52rem/1.4 "IBM Plex Mono", monospace; }
  .flow strong { margin-top: auto; font-size: 0.73rem; }
  .flow p { margin: 0.5rem 0 0; opacity: 0.62; font-size: 0.58rem; line-height: 1.45; }
  .contract-table { border-top: 3px solid var(--token-color-active-border); border-inline-start: 1px solid var(--token-border-strong); }
  .contract-head, .contract-table article { display: grid; grid-template-columns: minmax(12rem, 0.8fr) minmax(9rem, 0.62fr) minmax(13rem, 0.85fr) minmax(18rem, 1.25fr); }
  .contract-head { background: var(--token-surface-panel); }
  .contract-head span { padding: 0.65rem 0.85rem; border-inline-end: 1px solid var(--token-border-strong); border-bottom: 1px solid var(--token-border-strong); color: var(--token-ink-muted); font-size: 0.53rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; }
  .contract-table article > * { min-width: 0; margin: 0; padding: 0.85rem; border-inline-end: 1px solid var(--token-border-strong); border-bottom: 1px solid var(--token-border-strong); }
  .contract-table article:nth-child(odd) { background: color-mix(in srgb, var(--token-surface-panel) 64%, transparent); }
  .contract-table article > div { display: flex; flex-direction: column; align-items: flex-start; gap: 0.42rem; }
  .contract-table article span { padding: 0.16rem 0.35rem; border: 1px solid var(--token-color-active-border); border-radius: var(--token-radius-control); color: var(--token-color-active-text); font-size: 0.48rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .contract-table article span.command { border-color: var(--token-color-attention-border); color: var(--token-color-attention-text); }
  .contract-table p { color: var(--token-ink-secondary); font-size: 0.64rem; line-height: 1.48; }
  code { color: var(--token-color-interactive-text); font: 500 0.62rem/1.45 "IBM Plex Mono", monospace; overflow-wrap: anywhere; }
  .atomicity { display: grid; grid-template-columns: auto 1fr; gap: 1rem; margin-top: 1.5rem; padding: 1.25rem; border: 1px solid var(--token-color-success-border); background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .atomicity small { font-size: 0.53rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
  .atomicity h3 { margin: 0.25rem 0 0; font-size: 0.9rem; }
  .atomicity p { max-width: 90ch; margin: 0.55rem 0 0; color: var(--token-ink-secondary); font-size: 0.68rem; line-height: 1.55; }
  @media (max-width: 70rem) { .contract-table { overflow-x: auto; } .contract-head, .contract-table article { min-width: 62rem; } }
  @media (max-width: 52rem) { .flow { grid-template-columns: 1fr; } .flow li { min-height: auto; border-inline-end: 0; border-bottom: 1px solid color-mix(in srgb, currentColor 22%, transparent); } .flow li::after { top: auto; right: 50%; bottom: -0.48rem; content: "↓"; } .flow strong { margin-top: 1.5rem; } }
</style>
