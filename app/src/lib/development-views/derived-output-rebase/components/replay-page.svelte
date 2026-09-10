<script lang="ts">
  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceSection from "$development-views/derived-output-rebase/components/reference-section.svelte";
  import ReferenceShell from "$development-views/derived-output-rebase/components/reference-shell.svelte";
  import { CONFLICTS, ROUTE_RELOCATIONS } from "$development-views/derived-output-rebase/procedures/conflicts";
  import { REPLAY_COMMITS, PHASE_LABELS } from "$development-views/derived-output-rebase/procedures/commits";
  import { CONFLICT_DIAGRAM } from "$development-views/derived-output-rebase/procedures/diagrams";
  import { pageOf } from "$development-views/derived-output-rebase/procedures/navigation";
  import type { ReplayCommit } from "$development-views/derived-output-rebase/types";

  let { project }: { project: string } = $props();
  const page = pageOf("replay");
  const phases: readonly ReplayCommit["phase"][] = [
    "foundation",
    "editor",
    "templates",
    "agents",
    "audit"
  ];
</script>

<ReferenceShell {page} {project}>
  <div class="reb-callout warning top">
    <span>Conflict policy</span>
    <p>
      Resolve behavior, not lines. At any stop, an unlisted unmerged path or a moved main head invalidates this audit and requires a fresh disposable replay.
    </p>
  </div>

  <ReferenceSection
    id="sequence"
    eyebrow="Stop sequence"
    title="The seven stops are ordered dependencies"
    lede="The dependency manifest lands before runtime code; resource creation before editors; template representation before route relocation; overview composition before final workspace ownership."
  >
    <div class="reb-diagram">
      <MermaidDiagram
        source={CONFLICT_DIAGRAM}
        label="Ordered rebase conflict and repair sequence"
        caption="High-risk stops combine behavior from both histories. Low-risk does not mean optional: the lockfile still must be regenerated."
        minHeight="28rem"
      />
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="stops"
    eyebrow="Resolution ledger"
    title="Twenty-seven occurrences; seven merge decisions"
    lede="Project Overview conflicted at two architectural stages, so twenty-seven occurrences map to twenty-six unique paths. The scope-from-terms commit replayed automatically; it is not inflated into a stop after the fact."
  >
    <div class="reb-conflicts">
      {#each CONFLICTS as conflict (conflict.stop)}
        <article class={conflict.risk}>
          <header>
            <span>{String(conflict.stop).padStart(2, "0")}</span>
            <div><code>{conflict.commit}</code><h3>{conflict.subject}</h3></div>
            <em>{conflict.risk} risk</em>
          </header>
          <div class="reb-conflict-grid">
            <div><b>Collision</b><p>{conflict.collision}</p></div>
            <div><b>Resolution</b><p>{conflict.resolution}</p></div>
            <div><b>Proof before continue</b><p>{conflict.proof}</p></div>
          </div>
          <details>
            <summary>{conflict.files.length} conflicted {conflict.files.length === 1 ? "path" : "paths"}</summary>
            <ul>{#each conflict.files as file (file)}<li><code>{file}</code></li>{/each}</ul>
          </details>
        </article>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="routes"
    eyebrow="File/location resolution"
    title="The formula reference follows the move to /demo"
    lede="Git correctly detects nine main-created reference files as belonging at the branch's development-only destination. This preserves the rule that reference/demo code is not a production /app surface."
  >
    <div class="reb-route-map">
      <div><span>incoming</span><code>/app/[project]/reference/…</code></div>
      <i>relocate</i>
      <div class="destination"><span>resolved</span><code>/demo/[project]/reference/…</code></div>
    </div>
    <div class="reb-path-grid">
      {#each ROUTE_RELOCATIONS as route (route)}<code>{route}</code>{/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="history"
    eyebrow="Complete replay ledger"
    title="All forty-one commits, in replay order"
    lede="A filled stop marker is where the disposable rebase paused. Commits between those markers replayed automatically; they still receive final range-diff and test coverage."
  >
    <div class="reb-commit-groups">
      {#each phases as phase (phase)}
        <section>
          <header><span>{phase}</span><h3>{PHASE_LABELS[phase]}</h3></header>
          <ol>
            {#each REPLAY_COMMITS.filter((commit) => commit.phase === phase) as commit (commit.hash)}
              <li class:stop={commit.stops}>
                <i aria-hidden="true"></i><code>{commit.hash}</code><span>{commit.subject}</span>{#if commit.stops}<b>stop</b>{/if}
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    </div>
  </ReferenceSection>
</ReferenceShell>
