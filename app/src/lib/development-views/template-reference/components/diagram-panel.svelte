<script lang="ts">
</script>

<div class="panels">
  <figure class="mock">
    <figcaption>An ordinary document or deck</figcaption>
    <div class="panel">
      <header><b>Templates</b></header>
      <div class="field"><span class="input">Winter readiness brief</span><span class="button primary">Save</span></div>
      <div class="hint">The name is required; Save opens the new template's working copy in a new tab.</div>
      <div class="section">List <em>⌄</em></div>
      <div class="search">Search templates…</div>
      <div class="row"><b>Decision memo</b><small>2 holes · revision 4</small><span><span class="button">Insert</span><span class="button">Edit</span></span></div>
      <div class="row"><b>Technical glossary</b><small>1 hole · revision 3</small><span><span class="button">Insert</span><span class="button">Edit</span></span></div>
    </div>
  </figure>

  <figure class="mock">
    <figcaption>The same panel on a working copy</figcaption>
    <div class="panel">
      <header><b>Templates</b><span class="actions"><span class="button primary">Save</span><span class="button danger">Discard</span></span></header>
      <div class="section">Holes <em>1 ⌄</em></div>
      <div class="hole">
        <span class="chip">source_material</span>
        <b>Source material</b>
        <span class="description">Documents and findings whose terminology should be normalized.</span>
        <span class="button wide">Default scope</span>
      </div>
      <div class="section">List <em>⌄</em></div>
      <div class="search">Search templates…</div>
      <div class="row"><b>Decision memo</b><small>2 holes · revision 4</small><span><span class="button">Insert</span><span class="button">Edit</span></span></div>
    </div>
  </figure>
</div>

<ul class="notes">
  <li><b>No name field</b> on a working copy — the tab already says <code>Template · name</code>, and Save and Discard sit where it was, above a rule.</li>
  <li><b>Create hole</b> sits at the top of Holes and makes a text hole: it takes a name, a description and default words, then drops the atom at the caret. A scope hole cannot be made here — that list is what the body's prompts ask for.</li>
  <li><b>Default scope</b> opens the modal; what it currently selects is on the button's title rather than in its label.</li>
  <li><b>List</b> is a collapsible section of its own behind a rule, so inserting a template into a template is plainly a different thing from the holes above it.</li>
</ul>

<style>
  .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); gap: 1.5rem; }

  .mock { margin: 0; }

  figcaption { margin-bottom: .5rem; color: var(--token-ink-muted); font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }

  .panel {
    display: grid;
    gap: .5rem;
    padding: .7rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 8px;
    background: var(--token-surface-panel);
    font-size: 11.5px;
  }

  header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .4rem; padding-bottom: .5rem; border-bottom: 1px solid var(--token-border-subtle); }
  header b { font-size: 12.5px; }
  .actions { display: flex; gap: .3rem; }

  .field { display: grid; gap: .35rem; }

  .input {
    padding: .35rem .5rem;
    border: 1px solid var(--token-border-strong);
    border-radius: 5px;
    background: var(--token-surface-canvas);
    color: var(--token-ink-primary);
  }

  .button {
    display: inline-block;
    padding: .25rem .55rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 5px;
    background: var(--token-surface-elevated);
    color: var(--token-ink-secondary);
    font-size: 10.5px;
    font-weight: 650;
  }

  .button.primary { border-color: var(--token-color-active-text); background: var(--token-color-active-surface); color: var(--token-color-active-text); }
  .button.danger { border-color: var(--token-color-danger-text); background: var(--token-color-danger-surface); color: var(--token-color-danger-text); }
  .button.wide { justify-self: start; }

  .hint { color: var(--token-ink-muted); font-size: 10.5px; }

  .section {
    display: flex;
    justify-content: space-between;
    margin-top: .3rem;
    padding-top: .5rem;
    border-top: 1px solid var(--token-border-subtle);
    color: var(--token-ink-secondary);
    font-size: 10.5px;
    font-weight: 750;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .section em { color: var(--token-ink-muted); font-style: normal; }

  .search { padding: .3rem .5rem; border: 1px solid var(--token-border-subtle); border-radius: 5px; color: var(--token-ink-muted); }

  .row { display: grid; gap: .1rem; padding: .4rem .1rem; border-top: 1px solid var(--token-border-subtle); }
  .row small { color: var(--token-ink-muted); font-size: 10px; }
  .row span { display: flex; gap: .3rem; margin-top: .2rem; }

  .hole { display: grid; justify-items: start; gap: .35rem; padding: .5rem; border: 1px solid var(--token-border-subtle); border-radius: 6px; background: var(--token-surface-elevated); }
  .description { color: var(--token-ink-secondary); }

  .chip {
    padding: .05rem .35rem;
    border: 1px solid var(--token-color-accent-1-border);
    border-radius: 4px;
    background: var(--token-color-accent-1-surface);
    color: var(--token-color-accent-1-text);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 10px;
  }

  .notes { max-width: 70ch; margin: 1.4rem 0 0; padding-left: 1.1rem; list-style: disc; color: var(--token-ink-secondary); font-size: 13px; }
  .notes li { margin-bottom: .35rem; }
  .notes code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11.5px; }
</style>
