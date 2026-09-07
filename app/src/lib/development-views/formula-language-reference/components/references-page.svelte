<script lang="ts">
  import CardList from "$development-views/formula-language-reference/components/card-list.svelte";
  import ExampleList from "$development-views/formula-language-reference/components/example-list.svelte";
  import SpecTable from "$development-views/formula-language-reference/components/spec-table.svelte";
  import { EXAMPLES, KINDS, RULED, WALK, WHY } from "$development-views/formula-language-reference/procedures/references";
  import "$development-views/formula-language-reference/components/language.css";
</script>

<div class="language-reference">
  <div class="page">
    <header class="mast">
      <div>
        <span class="kicker">03 · References</span>
        <h1>Point at the thing. Resolve it on purpose.</h1>
        <p class="lede">
          A value may be a pointer rather than the thing, and a pointer is its own kind rather than a
          box with something in it. That is how a project holds a table with a hundred thousand rows
          without putting it in a cell. Resolution is written down, because the line that costs money
          should look like it.
        </p>
      </div>
      <aside class="aside">
        <span class="kicker">Already modelled</span>
        <p>
          The reference kinds exist in the representation today. None of them resolves yet, which
          makes this page a wiring plan rather than a proposal for new data.
        </p>
      </aside>
    </header>

    <section>
      <div class="section-head">
        <h2>The four references</h2>
        <p>What each one points at, what it resolves to, and how far the code has got.</p>
      </div>
      <SpecTable grid={KINDS} />
    </section>

    <section>
      <div class="section-head">
        <h2>Why a pointer at all</h2>
        <p>Seven arguments, each of which is also a constraint on the design.</p>
      </div>
      <CardList cards={WHY} />
    </section>

    <section>
      <div class="section-head">
        <h2>Reading and resolving</h2>
        <p>Six lines. The first two are the whole idea.</p>
      </div>
      <ExampleList examples={EXAMPLES} />
    </section>

    <section>
      <div class="section-head">
        <h2>How a name becomes a value</h2>
        <p>Five steps, and the reason the formula system can stay ignorant of spreadsheets.</p>
      </div>
      <div class="steps">
        {#each WALK as step (step.index)}
          <div class="step">
            <b>{step.index}</b>
            <div><h3>{step.title}</h3></div>
            <p>{step.detail}</p>
          </div>
        {/each}
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Settled</h2>
        <p>Six rulings from review, one of which replaced the operator this page was built around.</p>
      </div>
      <CardList cards={RULED} />
    </section>
  </div>
</div>
