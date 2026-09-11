<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import CheckCircle from "@lucide/svelte/icons/circle-check-big";
  import ClipboardCheck from "@lucide/svelte/icons/clipboard-check";
  import FileSearch from "@lucide/svelte/icons/file-search";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";

  import InvestigationSection from "$development-views/backlog-investigations/components/investigation-section.svelte";
  import ReviewNotes from "$development-views/backlog-investigations/components/review-notes.svelte";
  import {
    INVESTIGATIONS,
    PRINCIPLES,
    REPORT,
    REVIEW_DECISIONS,
    SOURCE_ANCHOR_COUNT
  } from "$development-views/backlog-investigations/procedures/report";
  import "$development-views/backlog-investigations/components/backlog-investigations.css";
</script>

<svelte:head>
  <title>Backlog design investigations · Icarus</title>
  <meta name="description" content="Evidence-backed decisions for the design investigations in the Icarus backlog." />
</svelte:head>

<main class="backlog-report" id="top">
  <header class="report-hero">
    <div class="hero-kicker"><FileSearch size={15} aria-hidden="true" /> Backlog investigation record</div>
    <h1>Nine open questions.<br /><em>One coherent system.</em></h1>
    <p class="hero-lede">{REPORT.headline}</p>
    <div class="hero-meta">
      <span>Audited {REPORT.auditedAt}</span>
      <span>{REPORT.base}</span>
      <span>{REPORT.method}</span>
    </div>
    <a class="hero-jump" href="#index"><ArrowDown size={14} aria-hidden="true" /> Read the decisions</a>
  </header>

  <section class="report-score" aria-label="Investigation outcome">
    <article><strong>{REPORT.auditedQuestions}</strong><span>investigations completed</span><p>Seven scoped design groups and two repeated UX investigations.</p></article>
    <article><strong>{SOURCE_ANCHOR_COUNT}</strong><span>evidence anchors</span><p>Current implementation sources plus primary Chromium-host references.</p></article>
    <article><strong>{REPORT.ownerChoices}</strong><span>owner confirmations</span><p>The work can proceed; these choices determine intentional product semantics.</p></article>
    <article class="score-outcome"><CheckCircle size={28} aria-hidden="true" /><span>Outcome</span><p>Every question has a recommended contract and executable acceptance checks.</p></article>
  </section>

  <section class="executive" aria-labelledby="executive-title">
    <div class="section-heading"><span>Executive finding</span><h2 id="executive-title">A boundary problem, not nine isolated features.</h2></div>
    <div class="executive-grid">
      <div class="executive-answer">
        <ShieldCheck size={19} aria-hidden="true" />
        <div><strong>Direction is established.</strong><p>{REPORT.summary}</p></div>
      </div>
      <div class="flow" aria-label="Shared system transition">
        <span>Observed or generated evidence</span><i aria-hidden="true">→</i><span>Inspectable proposal</span><i aria-hidden="true">→</i><span>Explicit authorized decision</span><i aria-hidden="true">→</i><span>Canonical revision</span>
      </div>
    </div>
  </section>

  <section class="principles" aria-labelledby="principles-title">
    <div class="section-heading"><span>Cross-cutting contract</span><h2 id="principles-title">Six rules reconcile the recommendations.</h2></div>
    <div class="principle-grid">
      {#each PRINCIPLES as principle, index (principle.label)}
        <article><span>{String(index + 1).padStart(2, "0")}</span><h3>{principle.label}</h3><p>{principle.statement}</p></article>
      {/each}
    </div>
  </section>

  <section class="report-index" id="index" aria-labelledby="index-title">
    <div class="section-heading"><span>Decision index</span><h2 id="index-title">Jump to an investigation.</h2></div>
    <nav aria-label="Investigation index">
      {#each INVESTIGATIONS as investigation (investigation.id)}
        <a href={`#${investigation.id}`}><span>{investigation.number}</span><strong>{investigation.label}</strong><p>{investigation.verdict}</p></a>
      {/each}
    </nav>
  </section>

  <div class="investigation-list">
    {#each INVESTIGATIONS as investigation (investigation.id)}
      <InvestigationSection {investigation} />
    {/each}
  </div>

  <ReviewNotes decisions={REVIEW_DECISIONS} />

  <section class="method" aria-labelledby="method-title">
    <div class="method-icon"><GitBranch size={20} aria-hidden="true" /></div>
    <div><span>Evidence boundary</span><h2 id="method-title">What this page does—and does not—claim.</h2></div>
    <p>This is a source-backed design conclusion against the named main revision. “Observed” statements describe current code. Recommended contracts and implementation sequences are design inferences from that evidence and the backlog’s settled decisions. Chromium clipboard support is grounded in the linked primary standards and vendor documentation. No product behavior was changed by this investigation.</p>
    <div class="method-checks"><span><ClipboardCheck size={14} aria-hidden="true" /> Current schema only</span><span><ClipboardCheck size={14} aria-hidden="true" /> No legacy support proposed</span><span><ClipboardCheck size={14} aria-hidden="true" /> No main integration</span></div>
  </section>

  <footer><span>Icarus · Backlog investigations</span><a href="#top">Return to top</a></footer>
</main>
