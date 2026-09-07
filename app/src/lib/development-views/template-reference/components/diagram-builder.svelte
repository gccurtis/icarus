<script lang="ts">
  const offers = [
    { label: "Winter readiness brief", note: "document" },
    { label: "Substation 14 incident write-up", note: "document" },
    { label: "Interconnect glossary", note: "document" },
    { label: "Board review — Q1 exposure", note: "slides" }
  ];
</script>

<div class="builder">
  <figure class="mock">
    <figcaption>Placing a template asks for everything at once</figcaption>
    <div class="modal">
      <header>
        <b>Insert “Technical glossary”</b>
        <p>Every parameter this template asks for. Open one to read what it means.</p>
      </header>
      <div class="body">
        <div class="row">
          <span class="key"><em>▸</em> Source material</span>
          <span class="value">Default · Documents, Findings</span>
        </div>
        <div class="row needs">
          <span class="key"><em>▾</em> Subject line</span>
          <span class="value outline">Needs input</span>
        </div>
        <p class="what">The one line at the top that says what this glossary covers.</p>
        <div class="field">What subject line says here</div>
      </div>
      <footer>
        <span class="blocked">Subject line still needs words.</span>
        <span class="ghost">Cancel</span><span class="primary">Insert</span>
      </footer>
    </div>
  </figure>

  <figure class="mock">
    <figcaption>The builder, on the side being edited</figcaption>
    <div class="modal">
      <header>
        <b>What Source material selects here</b>
        <p>For this copy only. Nothing here changes the template.</p>
      </header>
      <div class="body">
        <div class="tabs"><span>Include <i>1</i></span><span class="on">Exclude <i>0</i></span></div>
        <div class="panes">
          <section class="pane">
            <b>Add to exclude</b>
            <div class="sources"><span>Kinds</span><span>Sets</span><span class="on">Resources</span></div>
            <div class="search">Search this project…</div>
            {#each offers as offer (offer.label)}
              <div class="offer"><span>{offer.label}</span><small>{offer.note}</small><span class="add">Add</span></div>
            {/each}
          </section>
          <section class="pane">
            <b>Excluded</b>
            <p class="empty">Nothing is taken back out.</p>
          </section>
        </div>
        <div class="sentence">Documents, Findings</div>
        <div class="foot">
          <span class="floor"><span class="add">Whole project</span><span class="ghost">Default</span></span>
          <span class="count"><b>6</b> resources <span class="ghost">Show</span></span>
        </div>
      </div>
      <footer><span class="ghost">Cancel</span><span class="primary">Use this</span></footer>
    </div>
  </figure>
</div>

<ul class="notes">
  <li>
    <b>Every parameter, always.</b> The list is the shape of the thing about to be made, so it is the
    whole list even when most rows say Default. A row that needs words carries a rule down its left
    edge until it has some, and the confirm says which one is holding it up.
  </li>
  <li>
    <b>The description is one press away.</b> A row opens to explain itself, which is where the
    sentence whoever made the template wrote belongs — rather than under every row at once, where it
    becomes wallpaper.
  </li>
  <li>
    <b>The value is the control.</b> A scope's value opens the builder; a text parameter's opens a
    field under its description. Nothing here is a menu, and nothing opens a third lid.
  </li>
  <li>
    <b>Two tabs, not two lists.</b> Every set is a difference, and the side you are not editing is a
    list you are only reading — which the sentence underneath already says better.
  </li>
  <li>
    <b>The floor is a button.</b> Whole project is the common answer, and Default puts a parameter
    back to whatever the template suggested. Both sit under the panes, where a decision about the
    whole rule belongs.
  </li>
</ul>

<style>
  .builder { display: grid; grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr)); gap: 1.5rem; }

  .mock { margin: 0; }

  figcaption {
    margin-bottom: .5rem;
    color: var(--token-ink-muted);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .modal {
    display: grid;
    border: 1px solid var(--token-border-strong);
    border-radius: 10px;
    background: var(--token-surface-canvas);
    box-shadow: var(--token-shadow-overlay);
    font-size: 11.5px;
  }

  header { padding: .8rem .9rem; border-bottom: 1px solid var(--token-border-subtle); }
  header b { font-size: 12.5px; }
  header p { margin: .2rem 0 0; color: var(--token-ink-muted); font-size: 11px; }

  .body { display: grid; gap: .6rem; padding: .9rem; }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: .8rem;
    padding: .4rem .55rem;
    border: 1px solid var(--token-border-subtle);
    border-inline-start: 3px solid transparent;
    border-radius: 6px;
    background: var(--token-surface-elevated);
  }

  .row.needs { border-inline-start-color: var(--token-color-danger-text); }

  .key { display: flex; align-items: center; gap: .35rem; font-weight: 650; }
  .key em { color: var(--token-ink-muted); font-size: 9px; font-style: normal; }

  .value {
    padding: .1rem .45rem;
    border-radius: 5px;
    background: var(--token-surface-work);
    font-size: 10.5px;
    white-space: nowrap;
  }

  .value.outline { border: 1px solid var(--token-border-strong); background: transparent; }

  .what { margin: 0 .55rem; color: var(--token-ink-secondary); font-size: 10.5px; }

  .field,
  .search {
    padding: .35rem .5rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 6px;
    background: var(--token-surface-elevated);
    color: var(--token-ink-muted);
  }

  .field { min-height: 2.4rem; margin: 0 .55rem; }

  .tabs { display: flex; gap: .5rem; border-bottom: 1px solid var(--token-border-subtle); }

  .tabs span {
    display: flex;
    align-items: center;
    gap: .3rem;
    padding: .3rem .45rem;
    color: var(--token-ink-secondary);
    font-weight: 650;
  }

  .tabs .on { box-shadow: inset 0 -2px 0 var(--token-color-active-text); color: var(--token-color-active-text); }

  .tabs i {
    padding: 0 .3rem;
    border-radius: 4px;
    background: var(--token-surface-work);
    color: var(--token-ink-muted);
    font-size: 9px;
    font-style: normal;
  }

  .panes { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; }

  .pane {
    display: grid;
    align-content: start;
    gap: .35rem;
    min-height: 9rem;
    padding: .5rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 8px;
    background: var(--token-surface-panel);
  }

  .pane > b {
    color: var(--token-ink-muted);
    font-size: 9px;
    font-weight: 750;
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .sources { display: flex; gap: .25rem; }

  .sources span {
    padding: .1rem .35rem;
    border-radius: 4px;
    color: var(--token-ink-secondary);
    font-size: 10px;
  }

  .sources .on { background: var(--token-color-active-surface); color: var(--token-color-active-text); }

  .offer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: .35rem;
    align-items: center;
    padding: .2rem 0;
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .offer > span:first-child { overflow: hidden; font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
  .offer small { color: var(--token-ink-muted); font-size: 9px; }

  .empty { margin: 0; color: var(--token-ink-muted); font-size: 10px; font-style: italic; }

  .sentence {
    padding: .45rem .55rem;
    border-inline-start: 2px solid var(--token-color-accent-1-text);
    border-radius: 0 5px 5px 0;
    background: var(--token-color-accent-1-surface);
    font-size: 11px;
  }

  .foot { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
  .floor { display: flex; gap: .35rem; }
  .count { display: flex; align-items: baseline; gap: .3rem; color: var(--token-ink-secondary); font-size: 10.5px; }
  .count b { color: var(--token-ink-primary); font-size: 15px; }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: .4rem;
    padding: .7rem .9rem;
    border-top: 1px solid var(--token-border-subtle);
  }

  .blocked { margin-inline-end: auto; color: var(--token-color-attention-text); font-size: 10.5px; }

  .add,
  .ghost,
  .primary {
    padding: .15rem .5rem;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 650;
    white-space: nowrap;
  }

  .add,
  .ghost { border: 1px solid var(--token-border-subtle); color: var(--token-ink-secondary); }
  .primary { background: var(--token-color-active-text); color: var(--token-surface-canvas); }

  .notes { margin: 1.5rem 0 0; padding-left: 1.1rem; color: var(--token-ink-secondary); font-size: 13px; }
  .notes li { margin-bottom: .45rem; }
  .notes b { color: var(--token-ink-primary); }
</style>
