<script lang="ts">
  const sources = [
    { key: "kinds", label: "Kinds", hint: "Documents · Slide decks · Spreadsheets · Findings · Research threads" },
    { key: "sets", label: "Sets", hint: "The project's named sets, searchable" },
    { key: "resources", label: "Resources", hint: "Everything the project holds, searchable, multi-select" }
  ];
</script>

<div class="builder">
  <figure class="mock">
    <figcaption>At rest, on a variable that has never been narrowed</figcaption>
    <div class="modal">
      <header>
        <b>Default scope for Source material</b>
        <p>What the variable selects until whoever places the template says otherwise.</p>
      </header>
      <div class="body">
        <div class="segmented">
          <span class="on">Everything in the project</span>
          <span>Choose what to include</span>
        </div>
        <p class="resting">
          Every resource the project holds, now and later. This is also the floor: a variable with no
          default selects exactly this.
        </p>
        <div class="count"><b>24</b><span>resources right now</span></div>
      </div>
      <footer><span class="ghost">Cancel</span><span class="primary">Set the default scope</span></footer>
    </div>
  </figure>

  <figure class="mock">
    <figcaption>The same modal, narrowed</figcaption>
    <div class="modal">
      <header>
        <b>Default scope for Source material</b>
        <p>What the variable selects until whoever places the template says otherwise.</p>
      </header>
      <div class="body">
        <div class="segmented">
          <span>Everything in the project</span>
          <span class="on">Choose what to include</span>
        </div>

        <div class="list">
          <div class="list-head"><b>Include</b><span class="add">Add ⌄</span></div>
          <div class="chip"><code>kinds</code><b>Documents</b><span class="drop">×</span></div>
          <div class="chip"><code>set</code><b>Winter filings</b><span class="drop">×</span></div>
          <div class="chip"><code>resources</code><b>Q3 exposure memo</b><span class="drop">×</span></div>
        </div>

        <div class="list">
          <div class="list-head"><b>Exclude</b><span class="add">Add ⌄</span></div>
          <div class="chip"><code>kinds</code><b>Research threads</b><span class="drop">×</span></div>
          <div class="empty">Nothing is excluded yet.</div>
        </div>

        <div class="sentence">
          Documents, Winter filings and one named resource, minus Research threads
        </div>
        <div class="count"><b>13</b><span>resources right now</span><span class="show">Show them ⌄</span></div>
      </div>
      <footer><span class="ghost">Cancel</span><span class="primary">Set the default scope</span></footer>
    </div>
  </figure>

  <figure class="mock">
    <figcaption>Add, with one source open</figcaption>
    <div class="modal">
      <header>
        <b>Add to Include</b>
        <p>Three sources, one list. Anything already in either list is shown as held rather than offered twice.</p>
      </header>
      <div class="body">
        <div class="tabs">
          {#each sources as source (source.key)}
            <span class={source.key === "resources" ? "on" : ""}>{source.label}</span>
          {/each}
        </div>
        <div class="search">Search this project…</div>
        <div class="pick"><b>Q3 exposure memo</b><small>document</small><span class="held">Held</span></div>
        <div class="pick"><b>Winter readiness brief</b><small>document</small><span class="take">Add</span></div>
        <div class="pick"><b>Board review — Q1 exposure</b><small>slides</small><span class="take">Add</span></div>
        <div class="pick"><b>Field note · pump housing</b><small>finding</small><span class="take">Add</span></div>
        <p class="resting">
          A set that already reaches this one is offered, then refused with the loop it would close.
        </p>
      </div>
      <footer><span class="ghost">Back</span><span class="primary">Done</span></footer>
    </div>
  </figure>
</div>

<ul class="notes">
  <li>
    <b>Two lists, never nested.</b> Every set is a difference, so Exclude is always there, empty most of
    the time. Nothing in the builder can produce a rule the vocabulary cannot hold.
  </li>
  <li>
    <b>The whole project is a mode, not a term you add.</b> It is the common answer and the floor a
    variable falls back to, so it is one press rather than three.
  </li>
  <li>
    <b>The count is the point of the modal.</b> A rule with no number beside it is a guess; the count is
    resolved in the client from the project index on every change, and the list opens under it.
  </li>
  <li>
    <b>The rule reads as one sentence</b>, the same sentence the button's title carries afterwards and the
    same one the library inspector prints. One function, four places.
  </li>
  <li>
    <b>Nothing here is named.</b> Confirm sends the rule; the server stores it only if it has to, and what
    it stores has no name and is never listed anywhere.
  </li>
</ul>

<style>
  .builder { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: 1.5rem; }

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

  .body { display: grid; gap: .7rem; padding: .9rem; }

  .segmented {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: .25rem;
    padding: .2rem;
    border-radius: 7px;
    background: var(--token-surface-work);
  }

  .segmented span {
    padding: .35rem .4rem;
    border-radius: 5px;
    color: var(--token-ink-secondary);
    text-align: center;
  }

  .segmented .on {
    background: var(--token-surface-canvas);
    color: var(--token-ink-primary);
    font-weight: 650;
    box-shadow: var(--token-shadow-panel);
  }

  .resting { margin: 0; color: var(--token-ink-secondary); font-size: 11px; }

  .list { display: grid; gap: .3rem; }

  .list-head { display: flex; align-items: center; justify-content: space-between; }
  .list-head b { font-size: 9.5px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }

  .add,
  .take,
  .show {
    padding: .1rem .4rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 5px;
    color: var(--token-color-interactive-text);
    font-size: 10px;
    font-weight: 650;
  }

  .chip {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: .45rem;
    align-items: center;
    padding: .3rem .45rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 6px;
    background: var(--token-surface-elevated);
  }

  .chip code {
    padding: .05rem .28rem;
    border-radius: 3px;
    background: var(--token-surface-work);
    color: var(--token-ink-muted);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 9px;
  }

  .chip b { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .drop { color: var(--token-ink-muted); font-size: 12px; }

  .empty { color: var(--token-ink-muted); font-size: 10.5px; font-style: italic; }

  .sentence {
    padding: .45rem .55rem;
    border-left: 2px solid var(--token-color-accent-1-text);
    border-radius: 0 5px 5px 0;
    background: var(--token-color-accent-1-surface);
    font-size: 11px;
  }

  .count { display: flex; flex-wrap: wrap; align-items: baseline; gap: .4rem; }
  .count b { font-size: 20px; font-weight: 700; letter-spacing: -.02em; }
  .count span { color: var(--token-ink-secondary); font-size: 11px; }
  .count .show { margin-inline-start: auto; }

  .tabs { display: flex; gap: .25rem; border-bottom: 1px solid var(--token-border-subtle); }

  .tabs span {
    padding: .3rem .5rem;
    color: var(--token-ink-muted);
    font-size: 11px;
  }

  .tabs .on {
    box-shadow: inset 0 -2px 0 var(--token-color-active-text);
    color: var(--token-color-active-text);
    font-weight: 650;
  }

  .search {
    padding: .35rem .5rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 6px;
    background: var(--token-surface-elevated);
    color: var(--token-ink-muted);
  }

  .pick {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: .45rem;
    align-items: center;
    padding: .3rem .1rem;
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .pick b { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .pick small { color: var(--token-ink-muted); font-size: 9.5px; }

  .held {
    padding: .1rem .4rem;
    border-radius: 5px;
    background: var(--token-surface-work);
    color: var(--token-ink-muted);
    font-size: 10px;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: .4rem;
    padding: .7rem .9rem;
    border-top: 1px solid var(--token-border-subtle);
  }

  .ghost,
  .primary {
    padding: .3rem .6rem;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 650;
  }

  .ghost { border: 1px solid var(--token-border-subtle); color: var(--token-ink-secondary); }
  .primary { background: var(--token-color-active-text); color: var(--token-surface-canvas); }

  .notes { margin: 1.5rem 0 0; padding-left: 1.1rem; color: var(--token-ink-secondary); font-size: 13px; }
  .notes li { margin-bottom: .45rem; }
  .notes b { color: var(--token-ink-primary); }
</style>
