<script lang="ts">
  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import MetricStrip from "$development-views/derived-output-rebase/components/metric-strip.svelte";
  import ReferenceSection from "$development-views/derived-output-rebase/components/reference-section.svelte";
  import ReferenceShell from "$development-views/derived-output-rebase/components/reference-shell.svelte";
  import { AUDIT } from "$development-views/derived-output-rebase/procedures/audit";
  import { STALE_BASELINE_RECORDS } from "$development-views/derived-output-rebase/procedures/baseline-records";
  import { IMPORT_BLOCKED_SUITES, TYPE_DIAGNOSTICS } from "$development-views/derived-output-rebase/procedures/diagnostics";
  import { BASELINE_DIAGRAM, CHECKER_DIAGRAM } from "$development-views/derived-output-rebase/procedures/diagrams";
  import {
    BASELINE_RETIREMENTS,
    CHECK_RESULTS,
    DELETED_SCHEMA_READERS,
    TYPE_FINDINGS
  } from "$development-views/derived-output-rebase/procedures/findings";
  import { pageOf } from "$development-views/derived-output-rebase/procedures/navigation";

  let { project }: { project: string } = $props();
  const page = pageOf("checkers");

  const metrics = [
    { value: AUDIT.architectureChecks, label: "architecture checks", tone: "pass" as const },
    { value: AUDIT.staleBaselineRecords, label: "records to retire", tone: "attention" as const },
    { value: AUDIT.typeErrors, label: "type diagnostics", tone: "danger" as const },
    { value: AUDIT.rootRepairs, label: "root repairs", tone: "attention" as const },
    { value: AUDIT.passedVitestAssertions, label: "assertions already passing", tone: "pass" as const }
  ];
</script>

<ReferenceShell {page} {project}>
  <MetricStrip items={metrics} />

  <ReferenceSection
    id="matrix"
    eyebrow="Gate matrix"
    title="Seven signals, one integrated result"
    lede="Every static, server-side and browser behavior gate is green. Chromium collected all 91 scenarios: 87 passed locally and the four scenarios that intentionally require paid providers were skipped."
  >
    <div class="reb-check-matrix">
      {#each CHECK_RESULTS as result (result.gate)}
        <article class={result.kind}>
          <span>{result.gate}</span>
          <strong>{result.result}</strong>
          <p>{result.detail}</p>
        </article>
      {/each}
    </div>
    <div class="reb-callout success">
      <span>Checker-system answer</span>
      <p>
        The branch runs the current <strong>90-check</strong> architecture system. It adds stronger detection for lazily created global maps, controllers and mutable objects, then passes those checks without a new waiver.
      </p>
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="types"
    eyebrow="Compiler reduction"
    title="Eighteen initial diagnostics became four repairs"
    lede="Five missing slide imports erased types downstream and created nine callback errors. Current slide readiness repaired those cascades without any annotations; the three other roots remained local and are now green."
  >
    <div class="reb-diagram">
      <MermaidDiagram
        source={CHECKER_DIAGRAM}
        label="Reduction of eighteen type diagnostics into four root repairs"
        caption="Historical reduction: the 14-diagnostic slide group was five missing-module diagnostics plus nine type-inference cascades. All four roots are repaired."
        minHeight="25rem"
      />
    </div>
    <div class="reb-finding-groups">
      {#each TYPE_FINDINGS as finding, index (finding.title)}
        <article>
          <header><span>F{index + 1}</span><h3>{finding.title}</h3><b>{finding.count}</b></header>
          <dl>
            <div><dt>Cause</dt><dd>{finding.cause}</dd></div>
            <div><dt>Repair</dt><dd>{finding.repair}</dd></div>
            <div><dt>Prove</dt><dd>{finding.verification}</dd></div>
          </dl>
          <details><summary>{finding.files.length} implementation {finding.files.length === 1 ? "file" : "files"}</summary><ul>{#each finding.files as file (file)}<li><code>{file}</code></li>{/each}</ul></details>
        </article>
      {/each}
    </div>
    <details class="reb-exact-ledger">
      <summary>Initial compiler ledger · {TYPE_DIAGNOSTICS.length} repaired diagnostics</summary>
      <div class="reb-ledger type-ledger">
        <div class="head"><span>Root</span><span>File</span><span>At</span><span>Diagnostic</span></div>
        {#each TYPE_DIAGNOSTICS as diagnostic (diagnostic[1] + diagnostic[2])}
          <div><b>{diagnostic[0]}</b><code>{diagnostic[1]}</code><code>{diagnostic[2]}</code><span>{diagnostic[3]}</span></div>
        {/each}
      </div>
    </details>
  </ReferenceSection>

  <ReferenceSection
    id="baseline"
    eyebrow="Architecture ratchet"
    title="A baseline was reconciled, never chosen"
    lede="The resulting source graph proved twenty-eight records stale, including newly atomic document and slide mutations. Removing those exact records leaves 257 live entries and a fully clean suite."
  >
    <div class="reb-diagram compact">
      <MermaidDiagram
        source={BASELINE_DIAGRAM}
        label="Architecture baseline reconciliation after rebase"
        caption="Main's 295 and the source branch's 285 were not unioned. The resulting source graph is authoritative and needs 257 live records."
        minHeight="22rem"
      />
    </div>
    <div class="reb-baseline-table" role="table" aria-label="Baseline retirements by checker">
      <div class="head" role="row"><span>Checker</span><span>Count</span><span>Resolved scope</span></div>
      {#each BASELINE_RETIREMENTS as retirement (retirement[0])}
        <div role="row"><code>{retirement[0]}</code><b>{retirement[1]}</b><span>{retirement[2]}</span></div>
      {/each}
      <div class="total" role="row"><strong>Total proven stale</strong><b>{AUDIT.staleBaselineRecords}</b><span>Remove; do not replace</span></div>
    </div>
    <details class="reb-exact-ledger">
      <summary>Exact deletion ledger · {STALE_BASELINE_RECORDS.length} records</summary>
      <div class="reb-ledger baseline-ledger">
        <div class="head"><span>Checker</span><span>Path</span><span>Subject</span><span>Fingerprint</span></div>
        {#each STALE_BASELINE_RECORDS as record (record.join("|"))}
          <div><code>{record[0]}</code><code>{record[1]}</code><span>{record[2]}</span><code>{record[3]}</code></div>
        {/each}
      </div>
    </details>
  </ReferenceSection>

  <ReferenceSection
    id="schema"
    eyebrow="Representation policy"
    title="Deleted readers are a migration boundary"
    lede="Main's head intentionally removes compatibility paths. A green typecheck achieved by reconstructing them would reverse the architecture decision and reintroduce the exact debt the checker retires."
  >
    <div class="reb-deleted">
      {#each DELETED_SCHEMA_READERS as path (path)}
        <div><span>deleted on main</span><code>{path}</code></div>
      {/each}
    </div>
    <div class="reb-two-up">
      <article class="bad"><span>Do not</span><h3>Restore legacy normalization</h3><p>It hides the representation mismatch and will revive legacy-schema-support findings.</p></article>
      <article class="good"><span>Do</span><h3>Adapt each consumer</h3><p>Use slide readiness, authoritative document bodies and current CellFormat at the capability boundary.</p></article>
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="tests"
    eyebrow="Test interpretation"
    title="The complete behavior graph now executes"
    lede="Vitest discovers 170 files. Every one that is meant to execute passes: 168 files and 1,474 assertions are green, while two files and two assertions are deliberately skipped."
  >
    <div class="reb-test-flow">
      <div><b>{AUDIT.discoveredVitestFiles}</b><span>discovered files</span></div><i>→</i>
      <div class="pass"><b>{AUDIT.passedVitestFiles}</b><span>passed files</span></div><i>+</i>
      <div class="pass"><b>{AUDIT.failedVitestFiles}</b><span>failed files</span></div><i>+</i>
      <div><b>{AUDIT.skippedVitestFiles}</b><span>skipped files</span></div>
    </div>
    <div class="reb-callout attention">
      <span>Executed evidence</span>
      <p>The import-blocked set below is retained as a historical diagnostic ledger. After repairing the shared imports, all twenty-seven loaded and the full suite completed without a failing assertion.</p>
    </div>
    <details class="reb-exact-ledger">
      <summary>Historical import-blocked ledger · {IMPORT_BLOCKED_SUITES.length} now-passing files</summary>
      <div class="reb-suite-grid">
        {#each IMPORT_BLOCKED_SUITES as suite, index (suite)}
          <div><span>{String(index + 1).padStart(2, "0")}</span><code>{suite}</code></div>
        {/each}
      </div>
    </details>
    <div class="reb-callout plain">
      <span>Patch hygiene</span>
      <p><code>git diff --check</code> is empty. The inherited template-feature artifact no longer contributes whitespace-only lines or an extra EOF line.</p>
    </div>
  </ReferenceSection>
</ReferenceShell>
