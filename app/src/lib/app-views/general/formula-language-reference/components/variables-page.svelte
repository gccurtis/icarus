<script lang="ts">
  import { CardList, ExampleList, SpecTable } from "$authored-components/reference";
  import { COLLISION, EXAMPLES, HOLDS, RESOLUTION, RULED, SHAPE, STATE } from "$app-views/general/formula-language-reference/procedures/variables";
  import "$app-views/general/formula-language-reference/components/language.css";
</script>

<div class="language-reference">
  <div class="page">
    <header class="mast">
      <div>
        <span class="kicker">06 · Variables</span>
        <h1>The other half of a formula.</h1>
        <p class="lede">
          A variable is a name, a value and who last touched it. It is also the only way a formula
          can say something about the project rather than about a rectangle of cells. The table is
          written, the value type is complete, and a formula that says a name gets an answer.
        </p>
      </div>
      <aside class="aside">
        <span class="kicker">Today</span>
        <p>
          capabilities/variables reads, saves and removes a project's names, and six are seeded. The
          Variables panel is on the rail where the shell's placeholder used to be.
        </p>
      </aside>
    </header>

    <section>
      <div class="section-head">
        <h2>The shape of a variable</h2>
        <p>Seven fields, all of them in the table. The declared type is what lets a formula be checked before it runs.</p>
      </div>
      <SpecTable grid={SHAPE} />
    </section>

    <section>
      <div class="section-head">
        <h2>What a variable can hold</h2>
        <p>Every value kind, dates and references included. The list is identical to what a formula can answer with, which is what makes a variable a formula's memory.</p>
      </div>
      <SpecTable grid={HOLDS} />
    </section>

    <section>
      <div class="section-head">
        <h2>How a formula finds a name</h2>
        <p>Built-in, then project, then id, then refusal. The sheet is not in the list: it did its work before the formula was asked anything.</p>
      </div>
      <div class="steps">
        {#each RESOLUTION as step (step.index)}
          <div class="step">
            <b>{step.index}</b>
            <div>
              <h3>{step.title}</h3>
              <span class="source">{step.source}</span>
            </div>
            <p>{step.detail}</p>
          </div>
        {/each}
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>What that reads like</h2>
        <p>Five lines the language answers, once the project holds the names.</p>
      </div>
      <ExampleList examples={EXAMPLES} />
    </section>

    <section>
      <div class="section-head">
        <h2>Naming, and the dot problem</h2>
        <p>The one collision between how names are written today and what the language needs the dot to mean.</p>
      </div>
      <CardList cards={COLLISION} />
    </section>

    <section>
      <div class="section-head">
        <h2>Settled</h2>
        <p>Seven rulings from review: what a variable holds, who resolves it, and how a name is written.</p>
      </div>
      <CardList cards={RULED} />
    </section>

    <section>
      <div class="section-head">
        <h2>Where this stands</h2>
        <p>Four facts about the code as it is.</p>
      </div>
      <CardList cards={STATE} />
    </section>
  </div>
</div>
