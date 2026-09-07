<script lang="ts">
  import CardList from "$development-views/formula-language-reference/components/card-list.svelte";
  import SpecTable from "$development-views/formula-language-reference/components/spec-table.svelte";
  import { CALLS, COUNTS, FILES, GAPS, PRECEDENCE, REPRESENTATION, RULED, STAGES } from "$development-views/formula-language-reference/procedures/built";
  import "$development-views/formula-language-reference/components/language.css";
</script>

<div class="language-reference">
  <div class="page">
    <header class="mast">
      <div>
        <span class="kicker">05 · As built</span>
        <h1>What happens when you press Enter.</h1>
        <p class="lede">
          The path a typed line actually takes today, the file that owns each step, every function
          that runs, and the eight things this evaluator does not do. Written to be checked against
          the code rather than believed.
        </p>
        <p class="open"><a href="/app/dev-project">Open the editor <span aria-hidden="true">↗</span></a></p>
      </div>
      <aside class="aside">
        <span class="kicker">Size</span>
        <ul>
          <li><strong>{COUNTS.written} lines</strong> written, across {COUNTS.created} new files and {COUNTS.changed} changed ones.</li>
          <li><strong>{COUNTS.calls} function names</strong>, {COUNTS.failures} error tokens raised.</li>
          <li><strong>{COUNTS.cases} formula cases</strong> in a suite of {COUNTS.suite}.</li>
        </ul>
      </aside>
    </header>

    <section>
      <div class="section-head">
        <h2>The path</h2>
        <p>One typed line becomes one change set, so undo takes the edit and its consequences back together.</p>
      </div>
      <div class="steps">
        {#each STAGES as stage (stage.index)}
          <div class="step">
            <b>{stage.index}</b>
            <div>
              <h3>{stage.title}</h3>
              <span class="source">{stage.source}</span>
            </div>
            <p>{stage.detail}</p>
          </div>
        {/each}
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Precedence</h2>
        <p>A tokeniser, a precedence parser and a walk. No library, no eval, no regular expression pretending to be a parser.</p>
      </div>
      <SpecTable grid={PRECEDENCE} />
    </section>

    <section>
      <div class="section-head">
        <h2>Functions that run</h2>
        <p>The eleven the builder offers, plus what the seeded sheets and ordinary work need.</p>
      </div>
      <SpecTable grid={CALLS} />
    </section>

    <section>
      <div class="section-head">
        <h2>The files</h2>
        <p>Everything the formula path touches.</p>
      </div>
      <SpecTable grid={FILES} />
    </section>

    <section>
      <div class="section-head">
        <h2>What it does not do</h2>
        <p>The representation already models more than this evaluator uses. Each gap is a thing the tree expects and the code does not honour.</p>
      </div>
      <CardList cards={GAPS} />
    </section>

    <section>
      <div class="section-head">
        <h2>Settled</h2>
        <p>Three rulings from review about which of those gaps closes first, and in what order.</p>
      </div>
      <CardList cards={RULED} />
    </section>

    <section>
      <div class="section-head">
        <h2>What this costs the representation</h2>
        <p>
          Everything the settled design needs that the tree does not already hold. Five changes,
          approved in review and none of them made yet, and one line saying what does not move.
        </p>
      </div>
      <CardList cards={REPRESENTATION} />
    </section>
  </div>
</div>
