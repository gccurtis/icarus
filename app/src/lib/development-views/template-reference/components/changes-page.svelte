<script lang="ts">
  import { page } from "$app/state";

  import FileLedger from "$development-views/template-reference/components/file-ledger.svelte";
  import ReferenceHeader from "$development-views/template-reference/components/reference-header.svelte";
  import "$development-views/template-reference/components/reference.css";
  import { DECISIONS, MERGE, MODEL_DELTA, OPEN, SYSTEMATIC, VERIFICATION } from "$development-views/template-reference/procedures/changes";
  import { BASELINE, FILES } from "$development-views/template-reference/procedures/inventory";
  import { hrefOf } from "$development-views/template-reference/procedures/navigation";

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

  const app = FILES.filter((file) => file.path.startsWith("app/"));
  const made = app.filter((file) => file.status === "A").length;
  const changed = app.filter((file) => file.status === "M").length;
  const added = app.reduce((sum, file) => sum + file.added, 0);
  const deleted = app.reduce((sum, file) => sum + file.deleted, 0);
  const rounds = [...new Set(DECISIONS.map((decision) => decision.round))];
</script>

<div class="tref">
  <ReferenceHeader current="changes" {material} {materials} {onmaterial} />

  <main class="tref-page">
    <header class="tref-mast">
      <div>
        <span class="tref-kicker">02 · The audit</span>
        <h1>What changed</h1>
        <p class="tref-lede">
          Eleven systematic changes, the decisions three reviews settled, every file with its line count, what
          was run to check the work, and what is still open. Measured against <code>{BASELINE}</code>, the
          commit this branch sits on, so it keeps saying the same thing as main moves on.
        </p>
      </div>
      <div class="tref-facts">
        <dl>
          <div><dt>Files under app/</dt><dd>{app.length}</dd></div>
          <div><dt>Created</dt><dd>{made}</dd></div>
          <div><dt>Changed</dt><dd>{changed}</dd></div>
          <div><dt>Lines</dt><dd>+{added.toLocaleString()} / −{deleted.toLocaleString()}</dd></div>
          <div><dt>Committed</dt><dd>One commit, rebased onto main</dd></div>
        </dl>
      </div>
    </header>

    <nav class="tref-jumps" aria-label="On this page">
      <a href="#systematic">Eleven changes</a>
      <a href="#model">The model, before and after</a>
      <a href="#decisions">What the reviews settled</a>
      <a href="#ledger">Every file</a>
      <a href="#verification">What was checked</a>
      <a href="#open">Still open</a>
      <a href="#merge">Rebased onto main</a>
    </nav>

    <section class="tref-section" id="systematic">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Before → now</span><h2>Eleven systematic changes</h2></div>
        <p>
          Each is a decision with consequences across several files, written with what it replaced and why,
          so the page stays useful after the code is familiar.
        </p>
      </div>

      {#each SYSTEMATIC as change (change.index)}
        <article class="tref-change">
          <span>{change.index}</span>
          <div>
            <h3>{change.title}</h3>
            <p>{change.why}</p>
          </div>
          <div class="state before"><span>Before</span><p>{change.before}</p></div>
          <div class="state after"><span>Now</span><p>{change.now}</p></div>
        </article>
      {/each}
    </section>

    <section class="tref-section" id="model">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Representation</span><h2>The model, before and after</h2></div>
        <p>
          The vocabulary was meant to move as little as possible. One table, two fields and one term were
          added; one field was removed from three tables; the template types themselves are untouched.
        </p>
      </div>

      <div class="tref-cards">
        <article class="tref-card">
          <h3>Added</h3>
          {#each MODEL_DELTA.added as entry (entry.name)}
            <p><code>{entry.name}</code> — {entry.note}</p>
          {/each}
        </article>
        <article class="tref-card">
          <h3>Removed</h3>
          {#each MODEL_DELTA.removed as entry (entry.name)}
            <p><code>{entry.name}</code> — {entry.note}</p>
          {/each}
        </article>
        <article class="tref-card">
          <h3>Deliberately unchanged</h3>
          {#each MODEL_DELTA.unchanged as entry (entry.name)}
            <p><code>{entry.name}</code> — {entry.note}</p>
          {/each}
        </article>
      </div>

      <p class="tref-prose">
        Alongside them, five pure functions were added under <code>representation/data/behavior</code>:
        resolve a template's prompt scopes through answers then defaults, make a live body portable, mint
        fresh ids into a fragment, take one slide out of a deck as a deck, and resolve a resource set
        against a catalogue. They live there because both sides need them — the capability validates with
        them, the editors insert with them — and because the tree's lint keeps them free of clocks,
        randomness and stores.
      </p>
    </section>

    <section class="tref-section" id="decisions">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Review by review</span><h2>What the reviews settled</h2></div>
        <p>
          Ten questions were asked and answered across {rounds.length} rounds. Each row is the question, the
          answer given, and the change it produced — the design record for why the code looks like this.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th>Round</th><th>Question</th><th>Answer</th><th>What it became</th></tr></thead>
          <tbody>
            {#each DECISIONS as decision (decision.question)}
              <tr>
                <td>{decision.round}</td>
                <td>{decision.question}</td>
                <td>{decision.answer}</td>
                <td class="muted">{decision.became}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="tref-section" id="ledger">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The ledger</span><h2>Every file</h2></div>
        <p>
          Generated from the working tree against the branch point by
          <code>scripts/generate-template-reference-inventory.mjs</code>. Filter by area; the counts follow
          the filter.
        </p>
      </div>

      <FileLedger />
    </section>

    <section class="tref-section" id="verification">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Evidence</span><h2>What was checked, and what it said</h2></div>
        <p>
          Every command ran in the worktree after the last edit. The browser suite runs against a clean
          seed with the system Chromium, since the bundled headless shell cannot load its libraries here.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th>Check</th><th>Command</th><th>Result</th><th></th></tr></thead>
          <tbody>
            {#each VERIFICATION as row (row.check)}
              <tr>
                <td>{row.check}</td>
                <td><code>{row.command}</code></td>
                <td>{row.result}</td>
                <td><span class="tref-badge" class:clean={row.clean} class:known={!row.clean}>{row.clean ? "clean" : "known"}</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tref-note">
        <h4>What the browser run turned up while this was built</h4>
        <p>
          The template validator refused a <code>note</code> on a URL link that the vocabulary has allowed
          since links got notes. An editor names its tab from the workspace's scoped table read, so opening
          and discarding a working copy now refresh it. An edit that leaves a body alone carries the copy's
          revision forward, or the next save was refused as stale. And a panel gated on its body unmounted
          its bands for one frame as a new tab attached, which is why panels are gated on the resource id
          and a tab can be opened straight onto a named context view.
        </p>
      </div>
    </section>

    <section class="tref-section" id="open">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Not settled</span><h2>Still open, each built the recommended way</h2></div>
        <p>
          Nothing here blocks the work. Each is a fork that was taken one way so building could continue,
          with the recommendation written down rather than assumed.
        </p>
      </div>

      <div class="tref-cards">
        {#each OPEN as item (item.title)}
          <article class="tref-card">
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <p class="tref-not">{item.recommendation}</p>
          </article>
        {/each}
      </div>
    </section>

    <section class="tref-section" id="merge">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Already done</span><h2>Rebased onto main</h2></div>
        <p>
          One commit on <code>work/template-features</code>, sitting directly on main's head. Everything on
          this page is measured from there, so the numbers say what this branch adds and nothing else.
        </p>
      </div>

      <div class="tref-cards">
        <article class="tref-card">
          <h3>Base</h3>
          <p><code>{MERGE.base}</code> — the commit this branch now sits on.</p>
        </article>
        <article class="tref-card">
          <h3>What main brought</h3>
          <p>{MERGE.commits} commits and {MERGE.mainFiles} files since the original branch point: editor stabilization, the editor audit, and the withdrawal of header and footer authoring.</p>
        </article>
        <article class="tref-card">
          <h3>Files both sides touched</h3>
          <p>{MERGE.overlap.length} of them, and {MERGE.conflicts.length} conflicted. The other {app.length - MERGE.overlap.length} files this branch touches could not.</p>
        </article>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th>File</th><th>How it was reconciled</th></tr></thead>
          <tbody>
            {#each MERGE.conflicts as row (row.path)}
              <tr><td><code>{row.path}</code></td><td>{row.note}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tref-note success">
        <h4>The other nine merged without a decision</h4>
        <p>
          {MERGE.overlap.filter((path) => !MERGE.conflicts.some((row) => path.endsWith(row.path))).join(", ")}
          — both sides edited them, but not the same lines. Every check was re-run afterwards, and the deck
          selection case that had been failing since the branch was cut now passes, because main fixed it.
        </p>
      </div>
    </section>
  </main>

  <footer class="tref-footer">
    <div>
      <span>Icarus · templates</span>
      <span>Measured against {BASELINE}</span>
    </div>
    <div>
      <a href={hrefOf(project, "system")}>← How templates work</a>
      <a href={`/app/${project}`}>Open the app</a>
    </div>
  </footer>
</div>
