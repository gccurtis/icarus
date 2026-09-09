<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Braces from "@lucide/svelte/icons/braces";
  import ScanSearch from "@lucide/svelte/icons/scan-search";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";

  import PillarCard from "$development-views/architecture-pillars/components/pillar-card.svelte";
  import {
    ALL_CHECKERS,
    CHECKER_COUNTS,
    PILLARS
  } from "$development-views/architecture-pillars/procedures/pillars";
  import { TARGET_LAYERS } from "$development-views/architecture-pillars/procedures/checking-system";
  import "$development-views/architecture-pillars/components/architecture-pillars.css";
</script>

<svelte:head>
  <title>Architecture pillars · Icarus</title>
</svelte:head>

<main class="pillars-page">
  <header class="pillars-hero">
    <div class="pillars-kicker"><ShieldCheck size={15} aria-hidden="true" /> Desired structure + enforcement</div>
    <h1>Architecture as a monitored shape</h1>
    <p class="pillars-lede">
      Eight pillars turn “separate state and behavior” into operational boundaries. Each pillar is
      an equivalence class: its infractions share one violated rule, one general repair, and a
      checker family that can detect future drift.
    </p>
    <div class="pillars-meta">
      <span>8 architecture pillars</span>
      <span>{ALL_CHECKERS.length} checker specifications</span>
      <span>Checker catalog verified against source</span>
    </div>
  </header>

  <section class="pillars-metrics" aria-label="Checker coverage">
    <article><strong>{PILLARS.length}</strong><span>Pillars</span><p>Distinct architectural rules and repair strategies.</p></article>
    <article><strong>{ALL_CHECKERS.length}</strong><span>Specified checkers</span><p>Static, contract, browser, and declaration checks.</p></article>
    {#each CHECKER_COUNTS as entry (entry.status)}
      <article class="metric-{entry.status.toLowerCase()}"><strong>{entry.count}</strong><span>{entry.status}</span><p>{entry.status === "Enforced" ? "Current rules directly provide the stated guarantee." : entry.status === "Partial" ? "A current rule catches only a proxy or subset." : "No current checker provides this guarantee."}</p></article>
    {/each}
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>01</span><h2>The desired structure</h2></div>
      <p>State follows lifetime. Behavior follows intent. Environment crossings occur only at named gates.</p>
    </div>
    <div class="target-layer-table">
      <div class="target-layer-head"><span>Layer</span><span>State owner</span><span>Behavior</span><span>Permitted crossing</span></div>
      {#each TARGET_LAYERS as layer (layer.layer)}
        <article>
          <strong>{layer.layer}</strong>
          <div><small>{layer.owner}</small><p>{layer.state}</p></div>
          <p>{layer.behavior}</p>
          <p>{layer.crossing}</p>
        </article>
      {/each}
    </div>
    <div class="structure-rule">
      <Braces size={19} aria-hidden="true" />
      <p><strong>Models are not merely where procedures go.</strong> A model owns state with a lifetime and invariant. Its methods are the stable procedural calls that change that state; their implementations still belong in methods/. A component controller is local instance state, not another global model.</p>
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>02</span><h2>The eight pillars</h2></div>
      <p>Open any pillar for the operational contract, concrete current infraction, equivalence class, general repair, and checker specifications.</p>
    </div>
    <div class="pillar-card-grid">
      {#each PILLARS as pillar (pillar.slug)}
        <PillarCard {pillar} />
      {/each}
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>03</span><h2>How the categories were chosen</h2></div>
      <p>A category is useful only when grouping its members produces one actionable repair rather than a vague theme.</p>
    </div>
    <div class="category-test-grid">
      <article><span>Same violated rule</span><p>Every member can be described without syntax-specific language at the architecture level.</p></article>
      <article><span>Same state or procedure boundary</span><p>The failure occurs at the same ownership, authority, lifecycle, transaction, crossing, truth, or cohesion boundary.</p></article>
      <article><span>Same general repair</span><p>Moving to the right owner or gate resolves the class; only tactical implementation differs.</p></article>
      <article><span>Same checker family</span><p>A shared set of static or behavioral monitors can detect future instances and explain the same remediation.</p></article>
    </div>
    <p class="category-note">Authority and atomicity remain separate even though both execute on the server: authority asks <em>may this caller request the transition?</em>; atomicity asks <em>can the permitted transition partially persist?</em> Lifecycle remains separate from state placement because the correct state object can still be acquired and released by the wrong caller.</p>
  </section>

  <section class="pillar-section checker-system-callout">
    <div>
      <span class="callout-icon"><ScanSearch size={21} aria-hidden="true" /></span>
      <div><small>Active merge boundary</small><h2>Use the checking system during broad cleanup</h2><p>All forty-five contracts are now mapped to executable checkers: existing infractions stay visible, new or expanded ones fail immediately, and resolved baseline entries must be removed.</p></div>
    </div>
    <a href="/demo/architecture-pillars/checking-system">Open the checking system <ArrowRight size={15} aria-hidden="true" /></a>
  </section>

  <section class="pillar-section quick-links">
    <a href="/demo/state-behavior-audit"><span>Source audit</span><strong>14 current findings</strong><ArrowRight size={14} aria-hidden="true" /></a>
    <a href="/demo/editor-audit"><span>Behavior evidence</span><strong>Editor audit</strong><ArrowRight size={14} aria-hidden="true" /></a>
  </section>

  <footer class="pillars-footer"><span>Architecture pillars · reference specification</span><a href="/demo">Icarus demos</a></footer>
</main>
