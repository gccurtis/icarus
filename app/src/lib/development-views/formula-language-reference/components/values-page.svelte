<script lang="ts">
  import CardList from "$development-views/formula-language-reference/components/card-list.svelte";
  import ExampleList from "$development-views/formula-language-reference/components/example-list.svelte";
  import SpecTable from "$development-views/formula-language-reference/components/spec-table.svelte";
  import { EMPTINESS, EXAMPLES, KINDS, RULED, SHAPES } from "$development-views/formula-language-reference/procedures/values";
  import "$development-views/formula-language-reference/components/language.css";
</script>

<div class="language-reference">
  <div class="page">
    <header class="mast">
      <div>
        <span class="kicker">01 · Values</span>
        <h1>Eleven kinds, and three of them are one shape.</h1>
        <p class="lede">
          Every value a formula can answer with, and every value a variable can hold, are the same
          list. A record is a table one row tall. A list is a table one column wide. A reference is
          none of those: it is a pointer, and it is its own kind.
        </p>
      </div>
      <aside class="aside">
        <span class="kicker">Where this comes from</span>
        <p>
          FormulaValue and VariableValue in the representation, unchanged. Nothing on this page asks
          for a new kind, which is the strongest evidence the shape was already right.
        </p>
      </aside>
    </header>

    <section>
      <div class="section-head">
        <h2>The kinds</h2>
        <p>What each one is, how it is written, and what a cell does with it when it lands.</p>
      </div>
      <SpecTable grid={KINDS} />
    </section>

    <section>
      <div class="section-head">
        <h2>One shape, three names</h2>
        <p>
          Index a table and you take a row, which is a record. Name a field and you take a column,
          which is a list. Neither gesture invents a kind the language did not already have.
        </p>
      </div>
      <div class="shapes">
        {#each SHAPES as shape (shape.title)}
          <div class="shape">
            <h3>{shape.title}</h3>
            <div class="cells" style={`grid-template-columns: repeat(${shape.columns}, auto)`}>
              {#each shape.cells as cell, index (index)}
                <span class:head={index < shape.heads}>{cell}</span>
              {/each}
            </div>
            <p>{shape.detail}</p>
          </div>
        {/each}
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>What that buys</h2>
        <p>Seven lines, each answering with a kind from the table above.</p>
      </div>
      <ExampleList examples={EXAMPLES} />
    </section>

    <section>
      <div class="section-head">
        <h2>Emptiness, and other things that are not values</h2>
        <p>The distinctions a spreadsheet gets wrong when it collapses them.</p>
      </div>
      <CardList cards={EMPTINESS} />
    </section>

    <section>
      <div class="section-head">
        <h2>Settled</h2>
        <p>Five rulings from review: three about what the kinds are, two about how a value reaches a sheet.</p>
      </div>
      <CardList cards={RULED} />
    </section>
  </div>
</div>
