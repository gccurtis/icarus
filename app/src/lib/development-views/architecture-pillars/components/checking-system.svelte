<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import ScanSearch from "@lucide/svelte/icons/scan-search";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import {
    BASELINE_FIELDS,
    CHECKER_ANATOMY,
    CHECKER_LAYERS,
    CI_POLICY,
    EXECUTION_FLOW,
    REPORT_SCHEMA,
    SYSTEM_VERDICT,
    WAVES
  } from "$development-views/architecture-pillars/procedures/checking-system";
  import {
    ALL_CHECKERS,
    CHECKER_COUNTS,
    PILLARS
  } from "$development-views/architecture-pillars/procedures/pillars";
  import "$development-views/architecture-pillars/components/architecture-pillars.css";
</script>

<svelte:head>
  <title>Architecture checking system · Icarus</title>
</svelte:head>

<main class="pillars-page checking-page">
  <a class="back-link" href="/demo/architecture-pillars"><ArrowLeft size={14} aria-hidden="true" /> Architecture pillars</a>

  <header class="pillars-hero detail-hero">
    <div class="pillars-kicker"><ScanSearch size={15} aria-hidden="true" /> Active architecture monitoring</div>
    <h1>Know when the shape begins to bend</h1>
    <p class="pillars-lede">{SYSTEM_VERDICT.summary}</p>
    <div class="pillars-meta">
      <span>{ALL_CHECKERS.length} checker specifications</span>
      {#each CHECKER_COUNTS as entry (entry.status)}<span>{entry.count} {entry.status.toLowerCase()}</span>{/each}
    </div>
  </header>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>01</span><h2>The active policy</h2></div>
      <p>The monitor makes complexity visible during cleanup and preserves functional work while boundaries move.</p>
    </div>
    <div class="system-verdict">
      <ShieldCheck size={22} aria-hidden="true" />
      <div><span>Implemented foundation</span><h3>{SYSTEM_VERDICT.headline}</h3><p>{SYSTEM_VERDICT.caution}</p></div>
    </div>
    <div class="monitor-principles">
      <article><strong>Observe exactly</strong><p>Every checker records structural identity before its deliberate mutation is evaluated.</p></article>
      <article><strong>Block regression</strong><p>New, expanded, moved-without-repair, or unparseable violations fail immediately.</p></article>
      <article><strong>Preserve behavior</strong><p>Contract and Chromium tests establish functional equivalence while implementation boundaries change.</p></article>
      <article><strong>Ratchet downward</strong><p>Resolved findings delete their baseline entries in the same change; allowances cannot accumulate.</p></article>
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>02</span><h2>Five enforcement layers</h2></div>
      <p>No single linter can prove architecture. Each layer states exactly what its green result proves and what remains for the next layer.</p>
    </div>
    <div class="checker-layer-list">
      {#each CHECKER_LAYERS as layer (layer.order)}
        <article>
          <span>{layer.order}</span>
          <div><h3>{layer.name}</h3><small>{layer.cost}</small></div>
          <p><strong>Proves</strong>{layer.proves}</p>
          <p><strong>Does not prove</strong>{layer.cannot}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>03</span><h2>Anatomy of a trustworthy checker</h2></div>
      <p>A rule must be as reviewable as the architecture it protects. Its name alone is never the guarantee.</p>
    </div>
    <div class="anatomy-grid">
      {#each CHECKER_ANATOMY as field (field[0])}
        <article><strong>{field[0]}</strong><p>{field[1]}</p></article>
      {/each}
    </div>
    <pre class="report-schema"><code>{REPORT_SCHEMA}</code></pre>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>04</span><h2>Execution and debt ratchet</h2></div>
      <p>Extend the current auto-discovered checker runner rather than creating a second lint framework.</p>
    </div>
    <ol class="execution-flow">
      {#each EXECUTION_FLOW as step, index (step)}
        <li><span>{index + 1}</span><p>{step}</p></li>
      {/each}
    </ol>
    <div class="baseline-panel">
      <div><TriangleAlert size={19} aria-hidden="true" /><div><h3>Baseline is debt inventory, not an allowlist</h3><p>Matching is structural so adding lines does not hide or duplicate debt. Every record carries ownership and a removal condition.</p></div></div>
      <dl>
        {#each BASELINE_FIELDS as field (field[0])}<div><dt>{field[0]}</dt><dd>{field[1]}</dd></div>{/each}
      </dl>
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>05</span><h2>CI outcomes</h2></div>
      <p>The system stays strict without requiring all current debt to be repaired in one destabilizing change.</p>
    </div>
    <div class="pillar-table-wrap">
      <table class="ci-table">
        <thead><tr><th>Observed state</th><th>Outcome</th><th>Why</th></tr></thead>
        <tbody>{#each CI_POLICY as row (row.state)}<tr><th>{row.state}</th><td>{row.outcome}</td><td>{row.reason}</td></tr>{/each}</tbody>
      </table>
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>06</span><h2>Enforcement sequence</h2></div>
      <p>All four waves are implemented; the sequence now explains how to read and remediate the active checker layers.</p>
    </div>
    <div class="wave-grid">
      {#each WAVES as wave (wave.wave)}
        <article><span>Wave {wave.wave}</span><h3>{wave.title}</h3><p>{wave.objective}</p><small>{wave.includes}</small></article>
      {/each}
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>07</span><h2>Complete checker inventory</h2></div>
      <p>Every checker is attached to a pillar and implementation wave. Open the pillar for its detection strategy, current coverage, and deliberate limit.</p>
    </div>
    {#each PILLARS as pillar (pillar.slug)}
      <div class="inventory-group">
        <div><a href="/demo/architecture-pillars/{pillar.slug}"><code>{pillar.code}</code><strong>{pillar.name}</strong><ArrowRight size={14} aria-hidden="true" /></a><span>{pillar.checkers.length}</span></div>
        <div class="pillar-table-wrap">
          <table class="inventory-table">
            <thead><tr><th>Checker</th><th>Status</th><th>Wave</th><th>Green guarantee</th><th>Mechanism</th></tr></thead>
            <tbody>
              {#each pillar.checkers as checker (checker.id)}
                <tr><th><code>{checker.id}</code><span>{checker.name}</span></th><td><span class="checker-status status-{checker.status.toLowerCase()}">{checker.status}</span></td><td>{checker.wave}</td><td>{checker.guarantee}</td><td>{checker.mechanism}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/each}
  </section>

  <section class="pillar-section final-system-note">
    <ShieldCheck size={20} aria-hidden="true" />
    <div><h2>What “green” now means</h2><p>Not “the architecture is perfect.” Green means all 90 concrete checks ran, all 45 pillar contracts remain mapped to tested implementations, no new or changed debt appeared, no resolved baseline record was retained, and all non-baselinable governance checks passed.</p></div>
  </section>

  <footer class="pillars-footer"><span>Architecture checking system · active reference</span><a href="/demo/state-behavior-audit">Source audit</a></footer>
</main>
