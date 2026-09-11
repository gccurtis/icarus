<script lang="ts">
  import { page } from "$app/state";

  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceHeader from "$development-views/template-reference/components/reference-header.svelte";
  import "$development-views/template-reference/components/reference.css";
  import { hrefOf } from "$development-views/template-reference/procedures/navigation";
  import {
    DEFECTS,
    DIVERGENCE,
    MEETING,
    PREREQUISITES,
    RECONCILED,
    TOPOLOGY
  } from "$development-views/template-reference/procedures/rebase";

  let {
    material,
    materials = [],
    onmaterial
  }: {
    material?: string;
    materials?: readonly string[];
    onmaterial?: (next: string) => void;
  } = $props();

  const project = $derived(page.params.project ?? "dev-project");

  const ontoBase = RECONCILED.filter((row) => row.when.includes("the base")).length;
</script>

<div class="tref">
  <ReferenceHeader current="rebase" {material} {materials} {onmaterial} />

  <main class="tref-page">
    <header class="tref-mast">
      <div>
        <span class="tref-kicker">05 · The meeting</span>
        <h1>Where it meets the base</h1>
        <p class="tref-lede">
          This branch no longer sits on main. It sits on <code>{MEETING.base}</code>, because that is
          where prompt blocks are and a prompt's scope is what a slot fills. Getting there took
          {MEETING.rebases} replays in all; {MEETING.conflicted} files have ever needed a decision, over
          {MEETING.events} conflict events, and {ontoBase} of those decisions belong to the move onto
          this base. Every one is written out below with what each side had wanted, what was kept, and
          why.
        </p>
      </div>
      <div class="tref-facts">
        <dl>
          <div><dt>Sits on</dt><dd><code>{MEETING.baseHead}</code></dd></div>
          <div><dt>Base is ahead of main by</dt><dd>{MEETING.baseAhead} commits</dd></div>
          <div><dt>Commits here</dt><dd>{MEETING.commits}</dd></div>
          <div><dt>Files that ever conflicted</dt><dd>{MEETING.conflicted}</dd></div>
          <div><dt>Defects found by the move</dt><dd>{DEFECTS.length}</dd></div>
        </dl>
      </div>
    </header>

    <nav class="tref-jumps" aria-label="On this page">
      <a href="#topology">Which branch is where</a>
      <a href="#conflicts">Every conflict</a>
      <a href="#defects">Every defect</a>
      <a href="#divergence">What each side owns</a>
      <a href="#prerequisites">What the base needs to run</a>
    </nav>

    <section class="tref-section" id="topology">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The shape</span><h2>Which branch is where</h2></div>
        <p>
          Both branches were cut from the same commit. The base went one way — retrieval, derived
          outputs, prompt blocks — and this one went the other, into templates. They were replayed
          together rather than merged, so the history stays a straight line and the branch can be read
          as a single change on top of a known base.
        </p>
      </div>

      <div class="tref-figure">
        <MermaidDiagram
          source={TOPOLOGY}
          label="Both branches cut from one commit; the template work replayed on top of the derived-output work"
          caption="Main appears only as the branch point, because everything it has since gained is already inside the base. Rebasing rather than merging is what keeps “what this branch adds” a question with an answer."
          minHeight="22rem"
        />
      </div>

      <div class="tref-note">
        <h4>Why not main</h4>
        <p>
          On main, a scope slot could only ever come from a template that already had one, because
          nothing wrote prompts. On this base, prompts exist and generate. That does not finish the
          chain on its own — see
          <a href={hrefOf(project, "integration")}>end to end with prompts</a> — but it is the
          difference between one open link and two.
        </p>
      </div>
    </section>

    <section class="tref-section" id="conflicts">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Reconciled by hand</span><h2>Every conflict, and what was kept</h2></div>
        <p>
          Five files across five replays. Four were two sides adding something adjacent, where the
          decision was only where to put each. The fifth is the interesting one: taking either side
          whole would have shipped a bug.
        </p>
      </div>

      {#each RECONCILED as row (row.index)}
        <article class="tref-change conflict">
          <span>{row.index}</span>
          <div>
            <h3><code>{row.path}</code></h3>
            <p><b>{row.when}.</b> {row.why}</p>
          </div>
          <div class="state before"><span>The base wanted</span><p>{row.base}</p></div>
          <div class="state before"><span>This branch wanted</span><p>{row.branch}</p></div>
          <div class="state after"><span>What was kept</span><p>{row.kept}</p></div>
        </article>
      {/each}

      <div class="tref-note success">
        <h4>And the ones that did not conflict</h4>
        <p>
          Twenty other files were edited on both sides and merged with no decision at all, including the
          store's table definitions, the document editor's projection and schema, and the workspace's
          tab type. Both later replays — onto main's newer head, and onto this base's newer head —
          replayed every commit with nothing to reconcile. That is what a narrow branch buys.
        </p>
      </div>
    </section>

    <section class="tref-section" id="defects">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Actually broken</span><h2>Two defects the move turned up</h2></div>
        <p>
          Neither was caused by the rebase. One had been latent since text slots were added; the other
          was waiting for a project that had ever converted a text box into a Prompt Block, which is
          exactly what the base makes ordinary.
        </p>
      </div>

      {#each DEFECTS as defect (defect.index)}
        <article class="tref-defect">
          <header>
            <span>{defect.index}</span>
            <h3>{defect.title}</h3>
          </header>
          <dl>
            <div><dt>How it showed</dt><dd>{defect.symptom}</dd></div>
            <div><dt>What was wrong</dt><dd>{defect.cause}</dd></div>
            <div><dt>The fix</dt><dd>{defect.fix}</dd></div>
            <div><dt>What proves it</dt><dd>{defect.proof}</dd></div>
          </dl>
        </article>
      {/each}
    </section>

    <section class="tref-section" id="divergence">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Two changes, one tree</span><h2>What each side owns</h2></div>
        <p>
          The useful question is not what changed but where the two changes touch. In four layers out of
          five they do not touch at all — which is why five replays needed five decisions rather than
          fifty.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th>Layer</th><th>The base branch</th><th>This branch</th><th>Where they meet</th></tr></thead>
          <tbody>
            {#each DIVERGENCE as row (row.layer)}
              <tr>
                <td>{row.layer}</td>
                <td class="muted">{row.base}</td>
                <td class="muted">{row.branch}</td>
                <td>{row.meets}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tref-note">
        <h4>One shared function, and it is the one that conflicted</h4>
        <p>
          <code>displayOfAtom</code> in <code>behavior/content/positions.ts</code> is the whole of the
          shared surface between the two changes: it says how wide an atom draws, so the presentation's typing
          can place a caret. The base needed it to understand a Prompt Block's atoms; this branch needed
          it to understand a template atom. Both editors now measure through it, and nothing else in
          either change calls into the other.
        </p>
      </div>
    </section>

    <section class="tref-section" id="prerequisites">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Before it runs</span><h2>What the base needs that a fresh worktree has not got</h2></div>
        <p>
          Worth knowing before the first check fails in a way that looks like this branch's fault.
        </p>
      </div>

      <div class="tref-cards">
        {#each PREREQUISITES as item (item.what)}
          <article class="tref-card">
            <h3><code>{item.what}</code></h3>
            <p>{item.why}</p>
            <p class="tref-meta">{item.how}</p>
          </article>
        {/each}
      </div>
    </section>
  </main>

  <footer class="tref-footer">
    <div>
      <span>Icarus · templates</span>
      <span>Measured against {MEETING.baseHead}</span>
    </div>
    <div>
      <a href={hrefOf(project, "integration")}>← End to end with prompts</a>
      <a href={hrefOf(project, "changes")}>What changed</a>
    </div>
  </footer>
</div>

<style>
  .conflict {
    grid-template-columns: auto minmax(0, 1.1fr) repeat(3, minmax(0, 1fr));
  }

  .conflict h3 {
    overflow-wrap: anywhere;
  }

  .conflict .state p {
    overflow-wrap: anywhere;
  }

  .tref-defect {
    display: grid;
    gap: 1rem;
    margin-top: 1.5rem;
    padding: 1.5rem;
    border: 1px solid var(--token-border-subtle);
    border-inline-start: 3px solid var(--token-color-attention-text);
    border-radius: 8px;
    background: var(--token-surface-panel);
  }

  .tref-defect header {
    display: flex;
    gap: 1rem;
    align-items: baseline;
  }

  .tref-defect header span {
    color: var(--token-color-attention-text);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 12px;
  }

  .tref-defect h3 {
    margin: 0;
    font-size: 16px;
    letter-spacing: -0.01em;
  }

  .tref-defect dl {
    display: grid;
    gap: 0.9rem;
    margin: 0;
    grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
  }

  .tref-defect div {
    display: grid;
    gap: 0.3rem;
    align-content: start;
  }

  .tref-defect dt {
    color: var(--token-ink-muted);
    font-size: 9.5px;
    font-weight: 750;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .tref-defect dd {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  @media (max-width: 68rem) {
    .conflict {
      grid-template-columns: 2rem minmax(0, 1fr);
    }
  }
</style>
