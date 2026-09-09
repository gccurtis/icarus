<script lang="ts">
  import { CardList, SpecTable } from "$authored-components/reference";
  import { CALLS, COUNTS, FILES, GAPS, PRECEDENCE, REPRESENTATION, RULED, STAGES } from "$app-views/general/formula-language-reference/procedures/built";
  import "$app-views/general/formula-language-reference/components/language.css";
</script>

<div class="language-reference">
  <div class="page">
    <header class="mast">
      <div>
        <span class="kicker">05 · As built</span>
        <h1>What happens when you press Enter.</h1>
        <p class="lede">
          The path a typed line actually takes, the file that owns each step, every function that
          runs, and the six things it still does not do. Written to be checked against the code
          rather than believed.
        </p>
        <p class="open"><a href="/app/dev-project">Open the editor <span aria-hidden="true">↗</span></a></p>
      </div>
      <aside class="aside">
        <span class="kicker">Size</span>
        <ul>
          <li><strong>{COUNTS.written} lines</strong> written, across {COUNTS.created} new files and {COUNTS.changed} changed ones.</li>
          <li><strong>{COUNTS.calls} function names</strong>, {COUNTS.failures} declared error tokens.</li>
          <li><strong>{COUNTS.cases} cases</strong> for the language alone, in a suite of {COUNTS.suite}.</li>
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
        <p>Thirty-three names. Three of them decide for themselves which arguments to evaluate.</p>
      </div>
      <SpecTable grid={CALLS} />
    </section>

    <section>
      <div class="section-head">
        <h2>The files</h2>
        <p>What the language and its wiring are made of. Every path is under <code>src/lib</code>.</p>
      </div>
      <SpecTable grid={FILES} />
    </section>

    <section>
      <div class="section-head">
        <h2>What it does not do</h2>
        <p>Six things, each one a claim on these pages that the code does not yet keep.</p>
      </div>
      <CardList cards={GAPS} />
    </section>

    <section>
      <div class="section-head">
        <h2>What review settled, and what happened</h2>
        <p>Three rulings about the order of work, and how each one turned out.</p>
      </div>
      <CardList cards={RULED} />
    </section>

    <section>
      <div class="section-head">
        <h2>What it cost the representation</h2>
        <p>
          The four changes approved in review, all of them made, and one more that was not approved
          and had to be.
        </p>
      </div>
      <CardList cards={REPRESENTATION} />
    </section>
  </div>
</div>
