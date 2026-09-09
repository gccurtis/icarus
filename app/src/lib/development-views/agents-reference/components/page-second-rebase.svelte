<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import Diagram from "$development-views/agents-reference/components/diagram.svelte";
  import Flow from "$development-views/agents-reference/components/flow.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import Questions from "$development-views/agents-reference/components/questions.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import { questionsFor } from "$development-views/agents-reference/procedures/questions";
  import {
    BUILT,
    CARRIED,
    CHECKS,
    CONFLICTS,
    FIXED,
    HEADLINE,
    HISTORY,
    RESOLUTION,
    SILENT,
    STEPS,
    TOPOLOGY
  } from "$development-views/agents-reference/procedures/second-rebase";

  let { project }: { project: string } = $props();

  const page = pageOf("second-rebase");
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="headline"
    kicker="What happened"
    title="Two commits, replayed over thirty-seven"
    lede="The first rebase put one commit onto a branch that had grown by twenty-one and stopped for nothing. This one put two commits onto a branch that had been rewritten underneath them, and stopped six times. Three of those were git. The other three were the tree telling us it had changed its mind about something."
  >
    <Callouts items={HEADLINE} scope="headline" />
  </ReferenceSection>

  <ReferenceSection
    id="topology"
    kicker="Why it was not a fast replay"
    title="The branch this sat on came back with different hashes"
    lede="main gained three architecture commits, and the derived output branch was rebased onto them. Same patches, same order, new identities — so from this branch's point of view the twenty-one commits it was built on had been replaced by twenty-one strangers, with thirteen more on top."
  >
    <Noted scope="figure" label="Branch topology">
      <Diagram
        label="Before and after"
        source={TOPOLOGY}
        caption="The dotted line is the same patch under two hashes. The heavy line is the replay."
        minHeight="34rem"
      />
    </Noted>
    <SpecTable
      label="The commits that matter"
      columns={["Commit", "Subject", "What it is", "Side"]}
      rows={HISTORY}
      mono={[0]}
      pills={[3]}
      noted="history"
    />
  </ReferenceSection>

  <ReferenceSection
    id="steps"
    kicker="The operation"
    title="Six steps, and the one that is easy to skip"
    lede="Naming the pre-rebase tip costs one command and is the difference between a bad resolution being an inconvenience and being an afternoon. Stopping the dev server first matters for the same reason the store now keeps a journal: a process holding state in memory will write it back over whatever the replay just produced."
  >
    <Noted scope="figure" label="Rebase flow">
      <Flow label="The rebase" steps={STEPS} tone="intelligence" />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="conflicts"
    kicker="Where git stopped"
    title="Three conflicts, and what each side actually wanted"
    lede="A conflict is two intentions in one hunk. Reading the two sides of the marker only tells you the text; what settles it is reading what the branch underneath built, which in one of these three turned a merge into a retraction."
  >
    <div class="conflicts">
      {#each CONFLICTS as item (item.n)}
        <Noted scope="conflict" label={`${item.n} ${item.file}`}>
          <article class="conflict">
            <header>
              <span class="marker" aria-hidden="true">{item.n}</span>
              <div>
                <code>{item.file}</code>
                <small>{item.commit}</small>
              </div>
              <span class="took">{item.took}</span>
            </header>
            <dl>
              <div class="ours">
                <dt>This branch</dt>
                <dd>{item.ours}</dd>
              </div>
              <div class="theirs">
                <dt>The base</dt>
                <dd>{item.theirs}</dd>
              </div>
            </dl>
            <p>{item.why}</p>
          </article>
        </Noted>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="silent"
    kicker="Where git did not stop"
    title="Three more conflicts, found by the tools rather than the merge"
    lede="Every one of these is a file git merged without complaint. A textual merge cannot see a renamed type, a checker that did not exist last week, or a test double that no longer implements the thing it is doubling. This is the half of a rebase that has no marker to search for."
  >
    <div class="silents">
      {#each SILENT as item (item.n)}
        <Noted scope="silent" label={`${item.n} ${item.found}`}>
          <article class="silent">
            <header>
              <span class="marker" aria-hidden="true">{item.n}</span>
              <strong>{item.found}</strong>
            </header>
            <p class="what">{item.what}</p>
            <p class="where"><span>Where</span>{item.cost}</p>
            <p class="fix"><span>Addressed</span>{item.fix}</p>
          </article>
        </Noted>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="resolution"
    kicker="The whole path"
    title="From the replay to green"
    lede="Two commits went in. Three files stopped git; two hundred and seven did not, and three of those turned out to be wrong anyway. Each gate is a different kind of reader, which is why all four had to run."
  >
    <Noted scope="figure" label="Resolution flow">
      <Diagram
        label="Every gate, and what it caught"
        source={RESOLUTION}
        caption="Red is a stop. Amber is a judgement call. Green is a gate that passed."
        minHeight="30rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="fixed"
    kicker="The lint, part one"
    title="A hundred and fourteen findings fixed, and none held"
    lede="The baseline is the repository's own mechanism for an exception that is real but not this change's to close, and the first pass through this used it for ninety entries. That was the wrong call: a checker encodes the agreed structure, and code that has to be excused from it is code that does not yet have the structure. So every finding was worked off instead — and fifteen exceptions the base branch was holding for code this work replaced went with them. The baseline is smaller than it was before the rebase, and holds nothing of this branch's."
  >
    <SpecTable
      label="What was fixed"
      columns={["Check", "Count", "What was done"]}
      rows={FIXED}
      mono={[0]}
      noted="fixed"
    />
  </ReferenceSection>

  <ReferenceSection
    id="built"
    kicker="The lint, part two"
    title="Six things had to exist first"
    lede="A hundred and fourteen findings across ninety files do not come apart one at a time. Each family turned out to name one missing thing, and once that thing existed the findings in it went together. This is what was built, and it is the part worth keeping regardless of what any checker says."
  >
    <SpecTable
      label="What was built"
      columns={["What", "Where", "What it does"]}
      rows={BUILT}
      mono={[1]}
      noted="built"
    />
  </ReferenceSection>

  <ReferenceSection
    id="carried"
    kicker="What the base brought"
    title="Four things this branch now stands on"
    lede="Worth naming separately from the conflicts, because three of them changed code that had no conflict at all — and one of them replaced a mechanism this branch had written itself."
  >
    <SpecTable
      label="What arrived underneath"
      columns={["What", "What it is", "What it meant here"]}
      rows={CARRIED}
      noted="carried"
    />
  </ReferenceSection>

  <ReferenceSection
    id="checks"
    kicker="Evidence"
    title="The moment the replay finished, and now"
    lede="The left column is the state git left behind after the last commit was applied. Nothing in it was a surprise about the work; all of it was a surprise about the floor the work had been standing on."
  >
    <SpecTable
      label="Verification"
      columns={["Gate", "When the replay finished", "Now", "Notes"]}
      rows={CHECKS}
      noted="checks"
    />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions this rebase raised and did not settle"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("second-rebase")} />
  </ReferenceSection>
</ReferenceShell>

<style>
  .conflicts,
  .silents {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .conflict,
  .silent {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 1rem 1.1rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-elevated);
  }

  header {
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
  }

  header div {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
  }

  .marker {
    display: grid;
    width: 1.4rem;
    height: 1.4rem;
    flex: none;
    align-self: center;
    border-radius: 999px;
    background: var(--token-surface-work);
    color: var(--token-color-intelligence-text);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    place-items: center;
  }

  code {
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-body-sm);
  }

  small,
  .where span,
  .fix span {
    color: var(--token-ink-muted);
    font-size: var(--token-text-micro);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .took {
    flex: none;
    align-self: center;
    padding: 0.15rem 0.55rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 999px;
    color: var(--token-color-active-text);
    font-size: var(--token-text-micro);
  }

  strong {
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    font-weight: var(--token-weight-strong);
  }

  dl {
    display: grid;
    margin: 0;
    gap: 0.5rem;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }

  dl div {
    padding: 0.6rem 0.75rem;
    border-left: 2px solid var(--token-border-subtle);
    background: var(--token-surface-work);
  }

  .ours {
    border-left-color: var(--token-color-active-text);
  }

  .theirs {
    border-left-color: var(--token-color-intelligence-text);
  }

  dt {
    color: var(--token-ink-muted);
    font-size: var(--token-text-micro);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  dd {
    margin: 0.25rem 0 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  p {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .what {
    color: var(--token-ink-primary);
  }

  .where span,
  .fix span {
    display: block;
  }
</style>
