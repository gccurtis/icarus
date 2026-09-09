<script lang="ts">
  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceSection from "$development-views/derived-output-rebase/components/reference-section.svelte";
  import ReferenceShell from "$development-views/derived-output-rebase/components/reference-shell.svelte";
  import { RUNBOOK_DIAGRAM } from "$development-views/derived-output-rebase/procedures/diagrams";
  import { pageOf } from "$development-views/derived-output-rebase/procedures/navigation";
  import { ACCEPTANCE, COMMANDS, RUNBOOK } from "$development-views/derived-output-rebase/procedures/runbook";

  let { project }: { project: string } = $props();
  const page = pageOf("runbook");

  const commitPlan = [
    ["Rewritten history", "Eight conflict resolutions live in the commits where their behavior originally entered."],
    ["Compatibility repair", "One bounded commit adapts current slide/document/spreadsheet contracts and literal result typing."],
    ["Ratchet reconciliation", "One commit removes 26 stale baseline records and updates the 20 → 18 test expectation."],
    ["Artifact hygiene", "One mechanical commit regenerates or cleans the template-feature report."],
    ["Reference audit", "This served reference can remain its own documentation commit for an auditable plan/result delta."]
  ] as const;
</script>

<ReferenceShell {page} {project}>
  <div class="reb-callout warning top">
    <span>Start condition</span>
    <p>
      This runbook is certified only for audited source <code>bef7239</code> onto main <code>06708d9</code>. The recertification commit that updates this page is documentation-only; any later product commit or main movement requires R0 and a fresh disposable audit before rewriting the real branch.
    </p>
  </div>

  <ReferenceSection
    id="flow"
    eyebrow="Critical path"
    title="Eight phases; a red gate loops, it never leaks forward"
    lede="Conflict resolution, representation adaptation and verification are separate gates. This keeps a successful Git replay from being mistaken for a successful integration."
  >
    <div class="reb-diagram">
      <MermaidDiagram
        source={RUNBOOK_DIAGRAM}
        label="Eight-phase rebase runbook with stop and repair paths"
        caption="Unexpected conflicts abort and recertify. Post-replay test failures become bounded repair commits, then re-enter the proof gate."
        minHeight="25rem"
      />
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="phases"
    eyebrow="Operational procedure"
    title="Every phase has actions, gates and a way back"
    lede="The phase is not done when its edits look plausible. It is done only when every named gate is green. Files identify review surfaces, not permission to ignore adjacent behavior."
  >
    <div class="reb-runbook">
      {#each RUNBOOK as phase, index (phase.id)}
        <article>
          <header><span>{phase.id}</span><div><small>phase {index + 1} of {RUNBOOK.length}</small><h3>{phase.title}</h3><p>{phase.intent}</p></div></header>
          <div class="reb-runbook-grid">
            <div><b>Actions</b><ol>{#each phase.actions as action (action)}<li>{action}</li>{/each}</ol></div>
            <div><b>Green gates</b><ul class="checks">{#each phase.gates as gate (gate)}<li>{gate}</li>{/each}</ul></div>
            <div><b>Review surfaces</b><ul>{#each phase.files as file (file)}<li><code>{file}</code></li>{/each}</ul></div>
          </div>
          <footer><b>Rollback</b><span>{phase.rollback}</span></footer>
        </article>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="commands"
    eyebrow="Command card"
    title="The executable verification sequence"
    lede="Run in this order. Earlier gates are cheaper and make later output more trustworthy. Browser tests and manual appearance review come after the production graph can build."
  >
    <div class="reb-command-list">
      {#each COMMANDS as command, index (command[0])}
        <div><span>{String(index + 1).padStart(2, "0")}</span><b>{command[0]}</b><code>{command[1]}</code></div>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="commits"
    eyebrow="Review shape"
    title="Keep repair intent visible in history"
    lede="Rebase resolutions belong with their original commits. New compatibility and cleanup work should be separated so reviewers can distinguish product semantics, architecture debt and generated-file noise."
  >
    <div class="reb-commit-plan">
      {#each commitPlan as item, index (item[0])}
        <article><span>C{index + 1}</span><h3>{item[0]}</h3><p>{item[1]}</p></article>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="acceptance"
    eyebrow="Definition of done"
    title="Eight statements must all be true"
    lede="A clean rebase command is not acceptance. The integrated branch is done only when durability, reachability, schema policy, architecture, behavior and patch hygiene are proven together."
  >
    <ol class="reb-acceptance">
      {#each ACCEPTANCE as item, index (item)}
        <li><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p><b>required</b></li>
      {/each}
    </ol>
    <div class="reb-final-gate">
      <span>Release decision</span>
      <strong>All green, or not rebased</strong>
      <p>No force-push of rewritten history until the command card, browser matrix and human range-diff review are complete.</p>
    </div>
  </ReferenceSection>
</ReferenceShell>
