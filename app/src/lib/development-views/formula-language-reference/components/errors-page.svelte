<script lang="ts">
  import CardList from "$development-views/formula-language-reference/components/card-list.svelte";
  import SpecTable from "$development-views/formula-language-reference/components/spec-table.svelte";
  import { BEHAVIOUR, RULED, TOKENS } from "$development-views/formula-language-reference/procedures/errors";
  import "$development-views/formula-language-reference/components/language.css";
</script>

<div class="language-reference">
  <div class="page">
    <header class="mast">
      <div>
        <span class="kicker">04 · Errors</span>
        <h1>A refusal is an answer.</h1>
        <p class="lede">
          Eleven tokens are raised today, including the three the slicing needed, and one is declared
          and unused. Every one of them is a stored refusal that travels through arithmetic, lists in
          the Problems panel, and explains itself in the lens.
        </p>
      </div>
      <aside class="aside">
        <span class="kicker">The one distinction</span>
        <p>
          An error means the formula is wrong. A formula naming a sheet the browser has not loaded is
          not wrong, so the cell keeps what it had and the capability answers it. Conflating the two
          would turn a sheet nobody opened into a red cell.
        </p>
      </aside>
    </header>

    <section>
      <div class="section-head">
        <h2>Every token</h2>
        <p>What raises it, and whether it is raised today.</p>
      </div>
      <SpecTable grid={TOKENS} />
    </section>

    <section>
      <div class="section-head">
        <h2>How a refusal behaves</h2>
        <p>Six rules, all of them already in code.</p>
      </div>
      <CardList cards={BEHAVIOUR} />
    </section>

    <section>
      <div class="section-head">
        <h2>Settled</h2>
        <p>Three rulings from review, and all three of them are made.</p>
      </div>
      <CardList cards={RULED} />
    </section>
  </div>
</div>
