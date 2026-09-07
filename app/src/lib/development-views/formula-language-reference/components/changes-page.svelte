<script lang="ts">
  import CardList from "$development-views/formula-language-reference/components/card-list.svelte";
  import SpecTable from "$development-views/formula-language-reference/components/spec-table.svelte";
  import { GROUPS, SHAPE } from "$development-views/formula-language-reference/procedures/changes";
  import { COUNTS } from "$development-views/formula-language-reference/procedures/built";
  import "$development-views/formula-language-reference/components/language.css";
</script>

<div class="language-reference">
  <div class="page">
    <header class="mast">
      <div>
        <span class="kicker">07 · The build</span>
        <h1>Every file that moved, and why.</h1>
        <p class="lede">
          The settled design, built. Six groups of files, each one answering a ruling from the pages
          before it, and one change to the representation that was not approved in advance and is
          named as such.
        </p>
        <p class="open"><a href="/app/dev-project">Open the editor <span aria-hidden="true">↗</span></a></p>
      </div>
      <aside class="aside">
        <span class="kicker">Size</span>
        <ul>
          <li><strong>{COUNTS.written} lines</strong> written, across {COUNTS.created} new files.</li>
          <li><strong>{COUNTS.changed} files</strong> changed, {COUNTS.deleted} deleted.</li>
          <li><strong>{COUNTS.cases} cases</strong> for the language, in a suite of {COUNTS.suite}.</li>
        </ul>
      </aside>
    </header>

    {#each GROUPS as group (group.title)}
      <section>
        <div class="section-head">
          <h2>{group.title}</h2>
          <p>{group.detail}</p>
        </div>
        <SpecTable grid={group.files} />
      </section>
    {/each}

    <section>
      <div class="section-head">
        <h2>What the shape says</h2>
        <p>Four things that are true of the tree now, and would not be true of a smaller change.</p>
      </div>
      <CardList cards={SHAPE} />
    </section>
  </div>
</div>
