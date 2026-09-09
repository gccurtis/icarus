<script lang="ts">
  import { CardList, SpecTable } from "$authored-components/reference";
  import { GRAMMAR, PILLARS, READING, RESOLUTION, RULED, TRANSLATION } from "$app-views/general/formula-language-reference/procedures/overview";
  import { NAV } from "$app-views/general/formula-language-reference/procedures/navigation";
  import "$app-views/general/formula-language-reference/components/language.css";
</script>

<div class="language-reference">
  <div class="page">
    <header class="mast">
      <div>
        <span class="kicker">Formula language · specification and state</span>
        <h1>A formula is a question about a project.</h1>
        <p class="lede">
          Not a calculator over one grid. A spreadsheet translates what you typed into a formula and
          asks for a value; the formula system answers without ever knowing a sheet was involved.
          This is what that language is going to be, what it already is, and what stands between.
        </p>
        <p class="open"><a href="/app/dev-project">Open the editor <span aria-hidden="true">↗</span></a></p>
      </div>
      <aside class="aside">
        <span class="kicker">Read in this order</span>
        <ul>
          {#each READING as item (item.index)}
            <li><strong>{item.title}.</strong> {item.detail}</li>
          {/each}
        </ul>
      </aside>
    </header>

    <section>
      <div class="section-head">
        <h2>Before the formula: what a spreadsheet does</h2>
        <p>
          Four steps that belong to the sheet and not to the language. They are the reason a formula
          can be project global while an address means something only where it was typed.
        </p>
      </div>
      <div class="steps">
        {#each TRANSLATION as stage (stage.index)}
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
        <h2>Then: how a name becomes a value</h2>
        <p>
          Three questions in order, and a sheet is not one of the answers. The formula system takes a
          name, asks the built-ins, then the project, then whatever the id names, and refuses out
          loud when none of them can place it.
        </p>
      </div>
      <SpecTable grid={RESOLUTION} />
    </section>

    <section>
      <div class="section-head">
        <h2>The shape of the language</h2>
        <p>Everything the grammar allows, in eight lines. The pages that follow are these lines in detail.</p>
      </div>
      <div class="grammar">
        {#each GRAMMAR as rule (rule.name)}
          <div><b>{rule.name}</b><span>{rule.form}</span></div>
        {/each}
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>What the design commits to</h2>
        <p>Seven claims. Five hold in code today, and the other two were settled in review.</p>
      </div>
      <CardList cards={PILLARS} />
    </section>

    <section>
      <div class="section-head">
        <h2>Settled</h2>
        <p>Rulings from review. Nothing on this page is a fork any more, and every page that follows is written against these.</p>
      </div>
      <CardList cards={RULED} />
    </section>

    <section>
      <div class="section-head">
        <h2>The rest of the suite</h2>
        <p>Each page stands alone and names the rulings that belong to it.</p>
      </div>
      <div class="cards">
        {#each NAV.slice(1) as item (item.slug)}
          <a class="card" href={item.href} style="text-decoration: none; color: inherit; display: block;">
            <h3>{item.index} · {item.label}</h3>
            <p>{READING.find((entry) => entry.title === item.label)?.detail ?? ""}</p>
          </a>
        {/each}
      </div>
    </section>
  </div>
</div>
