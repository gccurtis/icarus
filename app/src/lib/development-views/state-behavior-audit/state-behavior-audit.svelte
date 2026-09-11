<script lang="ts">
  import AlertTriangle from "@lucide/svelte/icons/triangle-alert";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Check from "@lucide/svelte/icons/circle-check-big";
  import ClipboardCheck from "@lucide/svelte/icons/clipboard-check";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";

  import ArchitectureFlow from "$development-views/state-behavior-audit/components/architecture-flow.svelte";
  import FindingCard from "$development-views/state-behavior-audit/components/finding-card.svelte";
  import {
    AUDIT_META,
    FINDING_GROUPS,
    FINDING_TOTALS,
    GUARDRAILS,
    HOTSPOTS,
    METRICS,
    MODEL_GRANULARITY,
    REMEDIATION,
    SCORECARD,
    STATE_OWNERS,
    STRENGTHS,
    TARGET_SHAPE,
    VERDICT,
    gradeClass
  } from "$development-views/state-behavior-audit/procedures/report";
  import "$development-views/state-behavior-audit/components/state-behavior-audit.css";
</script>

<svelte:head>
  <title>State + behavior architecture audit · Icarus</title>
</svelte:head>

<main class="architecture-audit">
  <header class="architecture-hero">
    <div class="architecture-kicker">
      <ClipboardCheck size={15} aria-hidden="true" /> State + behavior architecture
    </div>
    <h1>Is the codebase shaped the way we describe it?</h1>
    <p class="architecture-lede">{VERDICT.answer}</p>
    <div class="architecture-meta">
      <span>Audited {AUDIT_META.date}</span>
      <span>{AUDIT_META.branch} · {AUDIT_META.revision}</span>
      <span>Static source audit + architecture suite</span>
    </div>
  </header>

  <section class="architecture-metrics" aria-label="Audit measurements">
    {#each METRICS as metric (metric.label)}
      <article class:metric-positive={metric.tone === "positive"} class:metric-attention={metric.tone === "attention"} class:metric-danger={metric.tone === "danger"}>
        <strong>{metric.value}</strong>
        <span>{metric.label}</span>
        <p>{metric.detail}</p>
      </article>
    {/each}
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>01</span><h2>Executive answer</h2></div>
      <p>A boundary can be syntactically legal while state ownership or behavior placement is still wrong.</p>
    </div>
    <div class="verdict-panel">
      <div class="verdict-mark"><AlertTriangle size={21} aria-hidden="true" /></div>
      <div>
        <span class="eyebrow">Overall assessment · Partial</span>
        <h3>{VERDICT.headline}</h3>
        <p>{VERDICT.summary}</p>
      </div>
    </div>
    <div class="finding-counts" aria-label="Finding priorities">
      <span><strong>{FINDING_TOTALS.all}</strong> findings</span>
      <span class="count-p0"><strong>{FINDING_TOTALS.p0}</strong> P0</span>
      <span class="count-p1"><strong>{FINDING_TOTALS.p1}</strong> P1</span>
      <span><strong>{FINDING_TOTALS.p2}</strong> P2</span>
    </div>
    <div class="architecture-decision">
      <ShieldCheck size={19} aria-hidden="true" />
      <p><strong>No product decision is needed to begin.</strong> The findings follow the architecture you described. The recommended first four phases are boundary repairs, not aesthetic or domain choices.</p>
    </div>
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>02</span><h2>The target call graph</h2></div>
      <p>The smallest complete path. Local behavior ends at a client owner; durable behavior crosses through one capability.</p>
    </div>
    <ArchitectureFlow />
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>03</span><h2>Conformance scorecard</h2></div>
      <p>Your description is strongest at the server and representation layers and weakest where complex views became controllers.</p>
    </div>
    <div class="architecture-table-wrap">
      <table class="scorecard-table">
        <thead><tr><th>Concern</th><th>Grade</th><th>Assessment</th><th>Evidence</th></tr></thead>
        <tbody>
          {#each SCORECARD as row (row.concern)}
            <tr>
              <th>{row.concern}</th>
              <td><span class="grade grade-{gradeClass(row.grade)}">{row.grade}</span></td>
              <td>{row.assessment}</td>
              <td>{row.evidence}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>04</span><h2>What is already structurally sound</h2></div>
      <p>This is not a ground-up architecture problem. These existing boundaries should be preserved while the gaps are repaired.</p>
    </div>
    <div class="strength-grid">
      {#each STRENGTHS as strength (strength.title)}
        <article>
          <Check size={18} aria-hidden="true" />
          <h3>{strength.title}</h3>
          <p>{strength.description}</p>
          <code>{strength.evidence}</code>
        </article>
      {/each}
    </div>
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>05</span><h2>State ownership ledger</h2></div>
      <p>The useful test is not “global or local?” It is “what lifetime and invariant does this value participate in?”</p>
    </div>
    <div class="architecture-table-wrap">
      <table class="owner-table">
        <thead><tr><th>State</th><th>Correct owner</th><th>As built</th><th>Grade</th></tr></thead>
        <tbody>
          {#each STATE_OWNERS as row (row.state)}
            <tr>
              <th>{row.state}</th>
              <td>{row.intendedOwner}</td>
              <td>{row.asBuilt}</td>
              <td><span class="grade grade-{gradeClass(row.grade)}">{row.grade}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div class="ownership-rule">
      <article><span>Interaction lifetime</span><strong>Component instance</strong><p>DOM refs, hover, pointer gestures, open menus, and unsubmitted field drafts.</p></article>
      <article><span>Tab lifetime</span><strong>WorkspaceState / TabView</strong><p>Selection, zoom, panel geometry, navigation, and other state that survives remounts.</p></article>
      <article><span>Resource lifetime</span><strong>Resource runtime</strong><p>Body, unsent edits, revision, synchronization, history, and resource-level derived state.</p></article>
      <article><span>Durable lifetime</span><strong>Server model</strong><p>Represented project data and process infrastructure, changed through typed capabilities.</p></article>
    </div>
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>06</span><h2>Model granularity</h2></div>
      <p>The codebase does not have a tiny-model epidemic. The better admission test is independent lifetime plus a real invariant—not file size.</p>
    </div>
    <div class="model-grid">
      {#each MODEL_GRANULARITY as row (row.subject)}
        <article>
          <span>{row.decision}</span>
          <h3>{row.subject}</h3>
          <p>{row.reason}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>07</span><h2>Complete finding register</h2></div>
      <p>Each finding names the observed boundary, its consequence, the recommended ownership rule, and a testable completion condition.</p>
    </div>
    {#each FINDING_GROUPS as group (group.area)}
      <div class="finding-group">
        <div class="finding-group-heading">
          <h3>{group.area}<span>{group.findings.length}</span></h3>
          <p>{group.summary}</p>
        </div>
        <div class="finding-list">
          {#each group.findings as finding (finding.id)}
            <FindingCard {finding} />
          {/each}
        </div>
      </div>
    {/each}
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>08</span><h2>Review hotspots</h2></div>
      <p>Size is a signal, not the rule. These files combine enough independent responsibilities to obscure the procedure graph.</p>
    </div>
    <div class="architecture-table-wrap">
      <table class="hotspot-table">
        <thead><tr><th>Source</th><th>Lines</th><th>Why it is difficult to review</th><th>Natural split</th></tr></thead>
        <tbody>
          {#each HOTSPOTS as hotspot (hotspot.path)}
            <tr><th><code>{hotspot.path}</code></th><td>{hotspot.lines}</td><td>{hotspot.concern}</td><td>{hotspot.split}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>09</span><h2>Reviewable directory shape</h2></div>
      <p>A predictable tree lets a reviewer locate state, effects, transitions, remote procedures, and persistence without reading the implementation first.</p>
    </div>
    <div class="target-shape">
      {#each TARGET_SHAPE as line, index (line)}
        <div><span>{String(index + 1).padStart(2, "0")}</span><code>{line}</code></div>
      {/each}
    </div>
    <p class="shape-note">Component state modules are local controllers, not new global models. Document, presentation, and spreadsheet runtimes should remain independent implementations with the same visible shape; consistency does not require a shared superclass.</p>
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>10</span><h2>Enforced guardrails</h2></div>
      <p>These once-missing boundaries now run as blocking checks. The baseline names current debt without allowing the boundary to move farther out.</p>
    </div>
    <div class="guardrail-grid">
      {#each GUARDRAILS as guardrail (guardrail.name)}
        <article>
          <code>{guardrail.name}</code>
          <h3>{guardrail.rule}</h3>
          <p>{guardrail.catches}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="architecture-section">
    <div class="architecture-section-heading">
      <div><span>11</span><h2>Recommended remediation order</h2></div>
      <p>Safety and ownership come before extraction. Otherwise, refactoring can make the wrong boundary look cleaner without making it correct.</p>
    </div>
    <div class="remediation-list">
      {#each REMEDIATION as phase (phase.phase)}
        <article>
          <div><span>{phase.phase}</span><h3>{phase.objective}</h3></div>
          <ol>
            {#each phase.changes as change, index (change)}
              <li><span>{index + 1}</span>{change}</li>
            {/each}
          </ol>
        </article>
      {/each}
    </div>
  </section>

  <section class="architecture-section evidence-section">
    <div class="architecture-section-heading">
      <div><span>12</span><h2>Method, evidence, and limits</h2></div>
      <p>This is a source architecture audit, not a claim that every behavior was exercised end to end.</p>
    </div>
    <div class="method-grid">
      <article><strong>Inventory</strong><p>Mapped first-party production components, procedure trees, client/server models, runtimes, capabilities, representation tables, composition roots, and direct I/O.</p></article>
      <article><strong>Static evidence</strong><p>Counted local state, lifecycle sites, direct capability crossings, render-triggered runtime access, procedure exports, and component script size.</p></article>
      <article><strong>Enforcement evidence</strong><p>Ran the full 90-check architecture suite and mutation-tested every checker. The 45 pillar contracts now cover both dependency direction and the audited ownership boundaries.</p></article>
      <article><strong>Limits</strong><p>No production behavior was edited. Runtime and persistence consequences are source-derived and should be closed with the acceptance tests specified in each finding.</p></article>
    </div>
    <p class="scope-note"><strong>Scope:</strong> {AUDIT_META.scope}</p>
  </section>

  <footer class="architecture-footer">
    <span>State + behavior audit · {AUDIT_META.revision}</span>
    <a href="/demo/architecture-pillars">Architecture pillars <ArrowRight size={14} aria-hidden="true" /></a>
  </footer>
</main>
