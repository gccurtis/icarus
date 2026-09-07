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
          Eight tokens are raised today, one is declared and unused, and three more are proposed for
          the slicing this language is about to grow. Every one of them is a stored value that
          travels through arithmetic, lists in the Problems panel, and explains itself in the lens.
        </p>
      </div>
      <aside class="aside">
        <span class="kicker">The one distinction</span>
        <p>
          An error means the formula is wrong. Unsupported means the evaluator has nothing to say
          and the cell keeps what it had. Conflating them would turn every unfinished feature into a
          red cell.
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
        <p>Three rulings from review, and all three of them change the representation.</p>
      </div>
      <CardList cards={RULED} />
    </section>
  </div>
</div>
