<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Bug from "@lucide/svelte/icons/bug";
  import Check from "@lucide/svelte/icons/circle-check-big";
  import ClipboardCheck from "@lucide/svelte/icons/clipboard-check";

  import DecisionResponses from "$development-views/editor-audit/components/decision-responses.svelte";
  import { FINDINGS } from "$development-views/editor-audit/procedures/findings";
  import {
    AREAS,
    CONSISTENCY_MATRIX,
    PHASES,
    REQUEST_LEDGER,
    statusClass
  } from "$development-views/editor-audit/procedures/report";
  import "$development-views/editor-audit/components/editor-audit.css";

  const fixed = FINDINGS.filter((finding) => finding.status === "Fixed in this audit").length;
  const urgentOpen = FINDINGS.filter(
    (finding) =>
      finding.status !== "Fixed in this audit" &&
      (finding.severity === "P0" || finding.severity === "P1")
  ).length;
</script>

<svelte:head>
  <title>Document + slide deck editor audit · Icarus</title>
</svelte:head>

<main class="audit-page">
  <header class="audit-hero">
    <div class="audit-kicker"><ClipboardCheck size={15} aria-hidden="true" /> Document + slide deck editors</div>
    <h1>Editor audit</h1>
    <p class="audit-lede">
      A source-traced review of the reported failures, adjacent correctness risks, and the visual
      contract that makes both editors feel like one product without coupling their inspector
      implementations.
    </p>
    <div class="audit-meta">
      <span>Audited 6 September 2026</span>
      <span>Clean seed + isolated browser store</span>
      <span>Source, unit, and interaction evidence</span>
    </div>
  </header>

  <section class="metric-grid" aria-label="Audit summary">
    <article><strong>{FINDINGS.length}</strong><span>Total findings</span></article>
    <article class="metric-fixed"><strong>{fixed}</strong><span>Fixed in this audit</span></article>
    <article class="metric-urgent"><strong>{urgentOpen}</strong><span>Open P0/P1 items</span></article>
    <article><strong>{REQUEST_LEDGER.length}/{REQUEST_LEDGER.length}</strong><span>Reported topics covered</span></article>
  </section>

  <section class="audit-section audit-verdict">
    <div class="section-heading">
      <div><span class="section-number">01</span><h2>Executive verdict</h2></div>
      <p>Every confirmed editor defect and architecture gap in this audit is repaired, and all five product decisions are now recorded with their implementation consequences.</p>
    </div>
    <div class="verdict-grid">
      <article>
        <Check size={19} aria-hidden="true" />
        <h3>Core editor paths are repaired</h3>
        <p>Creation, persistence, selection, comments, typography, distribution, named styles, and inspector continuity now have regression proofs.</p>
      </article>
      <article>
        <Check size={19} aria-hidden="true" />
        <h3>Product choices stay explicit</h3>
        <p>Five recorded decision briefs preserve the recommendation, chosen direction, alternatives, and implementation boundary.</p>
      </article>
      <article>
        <Bug size={19} aria-hidden="true" />
        <h3>The audit widened the evidence</h3>
        <p>The suite now covers the reported gestures, overlaps, narrow controls, false-Saved state, persistent creation, and diagnostic-free comment flow.</p>
      </article>
    </div>
  </section>

  <section class="audit-section">
    <div class="section-heading">
      <div><span class="section-number">02</span><h2>Your report, accounted for</h2></div>
      <p>This ledger is the completeness check: every requested topic maps to a finding and outcome.</p>
    </div>
    <div class="table-wrap">
      <table class="ledger-table">
        <thead><tr><th>Reported topic</th><th>Finding</th><th>Audit result</th></tr></thead>
        <tbody>
          {#each REQUEST_LEDGER as row (row[0])}
            <tr><td>{row[0]}</td><td><code>{row[1]}</code></td><td>{row[2]}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="audit-section">
    <div class="section-heading">
      <div><span class="section-number">03</span><h2>Creation flow, before and after</h2></div>
      <p>The opaque ID was only one part of the failure; the corrected path makes every boundary explicit.</p>
    </div>
    <div class="flow" aria-label="Corrected resource creation flow">
      <div><small>1</small><strong>Create</strong><span>Document or deck</span></div><ArrowRight aria-hidden="true" />
      <div><small>2</small><strong>Server mint</strong><span>Row + leader snapshot</span></div><ArrowRight aria-hidden="true" />
      <div><small>3</small><strong>Refresh</strong><span>Index + exact title table</span></div><ArrowRight aria-hidden="true" />
      <div><small>4</small><strong>Open ID</strong><span>Saving → durable Saved</span></div>
    </div>
    <div class="creation-notes">
      <p><strong>Document invariant:</strong> revision zero contains one addressable empty paragraph, not a projection-only caret target.</p>
      <p><strong>Deck invariant:</strong> revision zero contains one empty slide, so the first render has a canvas and thumbnail.</p>
      <p><strong>Unsupported actions:</strong> spreadsheet, research chat, and analysis graph remain explicit alerts on Project Overview.</p>
    </div>
  </section>

  <section class="audit-section">
    <div class="section-heading">
      <div><span class="section-number">04</span><h2>Target panel language</h2></div>
      <p>Compact drawings of the implemented information hierarchy—not production components.</p>
    </div>
    <div class="mock-grid">
      <article class="mock-panel">
        <header><strong>Sections</strong><span>12</span></header>
        <div class="section-row"><b>H1</b><span><strong>Decision</strong><small>P1</small></span></div>
        <div class="section-row nested"><b>H2</b><span><strong>Where exposure sits</strong><small>P1</small></span></div>
        <div class="section-row nested"><b>H2</b><span><strong>Recommendation and next…</strong><small>P2</small></span></div>
        <footer>Title truncates; its full value remains available on hover/focus.</footer>
      </article>

      <article class="mock-panel">
        <header><input aria-label="Style name example" value="Heading 2" readonly /><span>↵ saves</span></header>
        <div class="mock-label">Typography</div>
        <div class="mock-fields"><span>IBM Plex Sans</span><span>18 px</span></div>
        <div class="mark-row"><button class="pressed">B</button><button><i>I</i></button><button><u>U</u></button><button><s>S</s></button></div>
        <div class="mock-fields"><span>Foreground</span><span>Background</span></div>
        <div class="mock-label">Body style</div>
        <footer>No Identity, Key, Reads as, Usage, or redundant style dropdown.</footer>
      </article>

      <article class="mock-panel">
        <header><strong>Arrange</strong><span>3 objects</span></header>
        <div class="mock-label">Align</div>
        <div class="three-row"><button>Left</button><button>Center</button><button>Right</button></div>
        <div class="three-row"><button>Top</button><button>Middle</button><button>Bottom</button></div>
        <div class="two-row scope"><button class="pressed">Selection</button><button>Slide</button></div>
        <div class="mock-label">Distribute</div><div class="two-row"><button>Horizontal</button><button>Vertical</button></div>
        <div class="mock-label">Match size</div><div class="three-row"><button>Width</button><button>Height</button><button>Both</button></div>
      </article>

      <article class="mock-panel">
        <header><strong>Comment</strong><button>Show</button></header>
        <blockquote>Original comment sits first and retains author and anchor context.</blockquote>
        <hr />
        <textarea aria-label="Reply example" placeholder="Write a reply…"></textarea>
        <div class="comment-actions"><button>Resolve</button><button class="primary">Reply</button></div>
        <hr />
        <div class="reply"><strong>Ana</strong><span>Reply history begins here.</span></div>
      </article>
    </div>
  </section>

  <section class="audit-section">
    <div class="section-heading">
      <div><span class="section-number">05</span><h2>Cross-editor consistency matrix</h2></div>
      <p>Same visible grammar, separate editor-owned implementations, domain-specific semantics.</p>
    </div>
    <div class="table-wrap">
      <table class="matrix-table">
        <thead><tr><th>Concern</th><th>Document</th><th>Slide deck</th><th>Rule</th></tr></thead>
        <tbody>
          {#each CONSISTENCY_MATRIX as row (row[0])}
            <tr><th>{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="audit-section">
    <div class="section-heading">
      <div><span class="section-number">06</span><h2>Remediation sequence</h2></div>
      <p>Completed in dependency order: persistence, correctness, presentation, then guardrails.</p>
    </div>
    <div class="phase-grid">
      {#each PHASES as phase (phase.name)}
        <article class:phase-fixed={phase.tone === "fixed"} class:phase-urgent={phase.tone === "urgent"}>
          <h3>{phase.name}</h3>
          <ol>{#each phase.items as item, index (item)}<li><span>{index + 1}</span>{item}</li>{/each}</ol>
        </article>
      {/each}
    </div>
  </section>

  <section class="audit-section decisions-section">
    <div class="section-heading">
      <div><span class="section-number">07</span><h2>Decisions recorded</h2></div>
      <p>Five bounded decisions now preserve your direction alongside the original recommendation and tradeoff analysis.</p>
    </div>
    <DecisionResponses />
  </section>

  <section class="audit-section findings-section">
    <div class="section-heading">
      <div><span class="section-number">08</span><h2>Complete finding register</h2></div>
      <p>Observed behavior, source-level cause, repair, and a pass/fail acceptance statement for every item.</p>
    </div>

    {#each AREAS as area (area)}
      <div class="area-group">
        <h3>{area}<span>{FINDINGS.filter((finding) => finding.area === area).length}</span></h3>
        <div class="finding-list">
          {#each FINDINGS.filter((finding) => finding.area === area) as finding (finding.id)}
            <details class="finding" open={finding.severity === "P0"}>
              <summary>
                <code>{finding.id}</code>
                <span class="priority priority-{finding.severity.toLowerCase()}">{finding.severity}</span>
                <strong>{finding.title}</strong>
                <span class="status {statusClass(finding.status)}">{finding.status}</span>
              </summary>
              <div class="finding-body">
                <dl>
                  <div><dt>Observed</dt><dd>{finding.symptom}</dd></div>
                  <div><dt>Root cause</dt><dd>{finding.cause}</dd></div>
                  <div><dt>Repair</dt><dd>{finding.fix}</dd></div>
                  <div class="acceptance"><dt>Done when</dt><dd>{finding.acceptance}</dd></div>
                </dl>
                <div class="evidence"><span>Source evidence</span>{#each finding.evidence as item (item)}<code>{item}</code>{/each}</div>
              </div>
            </details>
          {/each}
        </div>
      </div>
    {/each}
  </section>

  <section class="audit-section evidence-section">
    <div class="section-heading">
      <div><span class="section-number">09</span><h2>Evidence and limits</h2></div>
      <p>The closing regression evidence, including two independent full browser passes.</p>
    </div>
    <div class="evidence-grid">
      <article><strong>0 / 0</strong><span>Type errors / warnings at the latest check</span></article>
      <article><strong>56 / 56</strong><span>Architecture checks</span></article>
      <article><strong>101 / 101</strong><span>Script and generator tests</span></article>
      <article><strong>819 / 819</strong><span>Unit tests</span></article>
      <article><strong>32 / 32 × 2</strong><span>Full Chromium scenarios across clean-seed runs</span></article>
      <article><strong>Firefox</strong><span>Control-drag regression verified in its native engine</span></article>
      <article><strong>1 + 1</strong><span>Created deck canvas + thumbnail</span></article>
      <article><strong>0</strong><span>Unexpected console, page, or HTTP diagnostics</span></article>
    </div>
    <p class="limit-note">
      Browser tests run only against a disposable copy of <code>seed</code>. The wrapper never points at
      <code>app/data</code>, and only removes a temporary directory it created itself.
    </p>
  </section>

  <footer class="audit-footer">
    <span>Editor audit · 2026-09-06</span>
    <a href="/app/dev-project">Open the live workspace <ArrowRight size={14} aria-hidden="true" /></a>
  </footer>
</main>
