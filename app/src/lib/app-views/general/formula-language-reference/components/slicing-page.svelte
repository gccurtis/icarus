<script lang="ts">
  import { CardList, ExampleList, SpecTable } from "$authored-components/reference";
  import { EMPTY, EXAMPLES, POSITIONAL, RULED, RULES, SEMANTIC } from "$app-views/general/formula-language-reference/procedures/slicing";
  import "$app-views/general/formula-language-reference/components/language.css";
</script>

<div class="language-reference">
  <div class="page">
    <header class="mast">
      <div>
        <span class="kicker">02 · Slicing</span>
        <h1>Brackets ask where. Braces ask which.</h1>
        <p class="lede">
          Positional slicing takes a run of rows by number, the way Python does, including from the
          end. Semantic slicing takes the rows that mean something and the fields worth keeping.
          They are different gestures because they are different questions, and neither can be
          mistaken for the other while reading.
        </p>
      </div>
      <aside class="aside">
        <span class="kicker">The table in every example</span>
        <p>
          <code>outages</code> is the seeded sheet: fourteen substations with name, feeder,
          customers, outages, minutes, saidi, restore, rate, cost and tier.
        </p>
      </aside>
    </header>

    <section>
      <div class="section-head">
        <h2>Positional · square brackets</h2>
        <p>
          Zero based, end excluded, negatives count back, either end may be omitted. A row taken from
          a table is a record; a run of rows is a table; a value taken from a list is a value.
        </p>
      </div>
      <SpecTable grid={POSITIONAL} />
    </section>

    <section>
      <div class="section-head">
        <h2>Semantic · a dot and braces</h2>
        <p>
          Inside the braces, a bare name keeps a field and a parenthesised expression keeps a row.
          Both may appear, comma separated, in any order. Selection runs before projection, so a
          predicate may name a field the projection drops.
        </p>
      </div>
      <SpecTable grid={SEMANTIC} />
    </section>

    <section>
      <div class="section-head">
        <h2>The six rules</h2>
        <p>Everything else follows from these.</p>
      </div>
      <CardList cards={RULES} />
    </section>

    <section>
      <div class="section-head">
        <h2>When nothing survives</h2>
        <p>
          A filter that matches no rows is an ordinary outcome. Indexing the result answers empty
          rather than refusing, so an optimistic query does not have to be wrapped to be safe.
        </p>
      </div>
      <SpecTable grid={EMPTY} />
    </section>

    <section>
      <div class="section-head">
        <h2>Read together</h2>
        <p>Six lines that chain the two gestures. Each narrowing is one step, left to right.</p>
      </div>
      <ExampleList examples={EXAMPLES} />
    </section>

    <section>
      <div class="section-head">
        <h2>Settled</h2>
        <p>Eight rulings from review. The first two changed what this page said before it.</p>
      </div>
      <CardList cards={RULED} />
    </section>
  </div>
</div>
