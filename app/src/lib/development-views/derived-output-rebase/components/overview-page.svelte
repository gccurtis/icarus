<script lang="ts">
  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import MetricStrip from "$development-views/derived-output-rebase/components/metric-strip.svelte";
  import ReferenceSection from "$development-views/derived-output-rebase/components/reference-section.svelte";
  import ReferenceShell from "$development-views/derived-output-rebase/components/reference-shell.svelte";
  import { AUDIT, DECISION, MAIN_COMMITS } from "$development-views/derived-output-rebase/procedures/audit";
  import { TOPOLOGY_DIAGRAM } from "$development-views/derived-output-rebase/procedures/diagrams";
  import { pageOf } from "$development-views/derived-output-rebase/procedures/navigation";

  let { project }: { project: string } = $props();
  const page = pageOf("overview");

  const metrics = [
    { value: `${AUDIT.mainOnlyCommits} / ${AUDIT.sourceOnlyCommits}`, label: "main / source commits" },
    { value: AUDIT.conflictStops, label: "replay stops", tone: "attention" as const },
    { value: AUDIT.uniqueConflictPaths, label: "unique conflict paths", tone: "attention" as const },
    { value: AUDIT.rootRepairs, label: "post-replay root repairs", tone: "attention" as const },
    { value: `${AUDIT.architectureChecks}/${AUDIT.architectureChecks}`, label: "architecture checks", tone: "pass" as const }
  ];

  const verdicts = [
    ["Can Git replay it automatically?", "No", "Eight semantic stops require human resolutions."],
    ["Is the checker system current?", "Yes", "Both branches execute the same 90-check architecture graph."],
    ["Does main introduce new architecture debt?", "No", "The trial reaches 90/90 without adding a baseline record."],
    ["Is the rebased tree compile-ready?", "Not yet", "Eighteen diagnostics reduce to four representation repairs."],
    ["Is the rebase path known?", "Yes", "Every stop, root failure, command and acceptance gate is recorded here."]
  ] as const;
</script>

<ReferenceShell {page} {project}>
  <div class="reb-verdict">
    <div>
      <span>Recommendation</span>
      <strong>{DECISION.status}</strong>
      <p>{DECISION.short}</p>
    </div>
    <aside><span>Safety boundary</span><p>{DECISION.boundary}</p></aside>
  </div>

  <MetricStrip items={metrics} />

  <ReferenceSection
    id="topology"
    eyebrow="Branch topology"
    title="Two histories meet in a disposable proof"
    lede="The audit replayed every source-only commit onto the exact local and origin/main head without touching the working branch. The result is evidence for the operation, not the operation itself."
  >
    <div class="reb-diagram">
      <MermaidDiagram
        source={TOPOLOGY_DIAGRAM}
        label="Branch topology and audited rebase path"
        caption="Diagram colors come from the active Mermaid theme; the diagram re-renders when Helios or Selene changes."
        minHeight="25rem"
      />
    </div>
    <div class="reb-equation" aria-label="Rebase workload equation">
      <span><b>{AUDIT.sourceOnlyCommits}</b><small>commits replayed</small></span>
      <i>→</i>
      <span><b>{AUDIT.conflictStops}</b><small>stops resolved</small></span>
      <i>→</i>
      <span><b>{AUDIT.typeErrors}</b><small>diagnostics observed</small></span>
      <i>→</i>
      <span class="pass"><b>{AUDIT.rootRepairs}</b><small>root fixes required</small></span>
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="decision"
    eyebrow="Decision matrix"
    title="What the audit does—and does not—prove"
    lede="Counts alone overstate the risk. This matrix separates Git conflicts, architectural validity, compiler compatibility and behavior verification."
  >
    <div class="reb-verdict-grid">
      {#each verdicts as verdict (verdict[0])}
        <article>
          <span>{verdict[0]}</span>
          <strong class:negative={verdict[1] === "No" || verdict[1] === "Not yet"}>{verdict[1]}</strong>
          <p>{verdict[2]}</p>
        </article>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="main"
    eyebrow="Incoming main"
    title="Eighteen commits change four integration fronts"
    lede="Main is not merely ahead. It establishes spreadsheet ownership and formula behavior, tightens transaction and runtime boundaries, retires architecture debt, deliberately removes legacy representation readers, and delivers Project Overview context/inspector panels plus their reference proof."
  >
    <ol class="reb-main-rail">
      {#each MAIN_COMMITS as commit, index (commit[0])}
        <li>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <code>{commit[0]}</code>
          <p>{commit[1]}</p>
        </li>
      {/each}
    </ol>
    <div class="reb-callout attention">
      <span>Most important incoming contract</span>
      <p>
        <code>3e670c5</code> removes document typography and slide normalization compatibility readers.
        The correct integration adapts derived-output, semantic-overlay, research and templates to the current schema; it does not resurrect those files.
      </p>
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="reading"
    eyebrow="How to use this suite"
    title="One decision page; three operational pages"
    lede="Read left to right when executing. Replay names every conflict. Checkers shows which failures share a cause. Runbook gives the ordered operation and stopping conditions."
  >
    <div class="reb-page-cards">
      <a href="./derived-output-rebase/replay"><b>01</b><span>Replay map</span><p>Every stopped commit, path and merge decision.</p></a>
      <a href="./derived-output-rebase/checkers"><b>02</b><span>Checker map</span><p>Architecture, types, tests, baseline and patch hygiene.</p></a>
      <a href="./derived-output-rebase/runbook"><b>03</b><span>Runbook</span><p>Commands, checkpoints, rollback and acceptance.</p></a>
    </div>
  </ReferenceSection>
</ReferenceShell>
