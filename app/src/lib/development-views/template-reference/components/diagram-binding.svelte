<script lang="ts">
  const named = [
    { field: "name", value: "\"Winter filings\"" },
    { field: "boundTo", value: "absent" },
    { field: "set", value: "{ include, exclude }" }
  ];

  const bound = [
    { field: "name", value: "absent" },
    { field: "boundTo", value: "{ hole, templateId, name }" },
    { field: "set", value: "{ include, exclude }" }
  ];
</script>

<div class="binding">
  <section class="lane">
    <header><span class="tag named">Named</span><b>A project subject</b></header>
    <p>Made in Contexts, listed there, offered by every builder, and deleted only when nothing names it.</p>
    <dl class="row">
      {#each named as line (line.field)}
        <div><dt>{line.field}</dt><dd>{line.value}</dd></div>
      {/each}
    </dl>
    <ul>
      <li>Appears in <code>readResourceSets</code></li>
      <li>Refuses removal while a set or a hole names it</li>
      <li>Survives everything that points at it</li>
    </ul>
  </section>

  <section class="lane">
    <header><span class="tag bound">Bound</span><b>A value something holds</b></header>
    <p>Written by the server when a chosen rule cannot be said inline. Never listed, never named, never reused.</p>
    <dl class="row">
      {#each bound as line (line.field)}
        <div><dt>{line.field}</dt><dd>{line.value}</dd></div>
      {/each}
    </dl>
    <ul>
      <li>Read only through the id that points at it</li>
      <li>Removed with its owner</li>
      <li>Two holes that build the same rule get two rows, and that is correct</li>
    </ul>
  </section>
</div>

<div class="pointers">
  <div class="from">
    <code>templates.holes[i].default</code>
    <small>a template's project-local metadata</small>
  </div>
  <div class="arrow" aria-hidden="true">→</div>
  <div class="term"><code>{"{ select: \"set\", setId }"}</code><small>one term, so it substitutes on either side</small></div>
  <div class="arrow" aria-hidden="true">→</div>
  <div class="to bound-to"><b>A bound row</b><small>owner: that hole</small></div>

  <div class="from">
    <code>documents.body … prompt.scope</code>
    <small>a placed copy, after Insert or Use</small>
  </div>
  <div class="arrow" aria-hidden="true">→</div>
  <div class="term"><code>{"{ select: \"set\", setId }"}</code><small>the only way a body can name particular resources</small></div>
  <div class="arrow" aria-hidden="true">→</div>
  <div class="to bound-to"><b>A bound row</b><small>owner: that resource</small></div>

  <div class="from">
    <code>Contexts · New set</code>
    <small>somebody curating the project</small>
  </div>
  <div class="arrow" aria-hidden="true">→</div>
  <div class="term"><code>createResourceSet(name, rule)</code><small>the only door that takes a name</small></div>
  <div class="arrow" aria-hidden="true">→</div>
  <div class="to named-to"><b>A named row</b><small>listed, offerable, reusable</small></div>
</div>

<style>
  .binding { display: grid; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); gap: 1.25rem; }

  .lane {
    display: grid;
    align-content: start;
    gap: .6rem;
    padding: 1rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 8px;
    background: var(--token-surface-elevated);
  }

  header { display: flex; align-items: center; gap: .5rem; }
  header b { font-size: 13.5px; }

  .tag {
    padding: .1rem .4rem;
    border-radius: 4px;
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 9px;
    font-weight: 750;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .tag.named { background: var(--token-color-accent-2-surface); color: var(--token-color-accent-2-text); }
  .tag.bound { background: var(--token-color-accent-1-surface); color: var(--token-color-accent-1-text); }

  .lane > p { margin: 0; color: var(--token-ink-secondary); font-size: 12.5px; }

  .row {
    display: grid;
    gap: .2rem;
    margin: 0;
    padding: .6rem .7rem;
    border-radius: 6px;
    background: var(--token-surface-work);
  }

  .row div { display: flex; justify-content: space-between; gap: 1rem; }

  dt {
    color: var(--token-ink-muted);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 11px;
  }

  dd {
    margin: 0;
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 11px;
    text-align: right;
  }

  .lane ul { margin: 0; padding-left: 1.05rem; color: var(--token-ink-secondary); font-size: 12px; }
  .lane li { margin-bottom: .2rem; }

  .pointers {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) auto minmax(0, 1.3fr) auto minmax(0, .9fr);
    gap: .6rem .8rem;
    align-items: center;
    margin-top: 1.5rem;
  }

  .from,
  .term,
  .to { display: grid; gap: .1rem; padding: .55rem .7rem; border-radius: 6px; }

  .from { background: var(--token-surface-work); }
  .term { border: 1px dashed var(--token-border-strong); }
  .to { background: var(--token-surface-elevated); border: 1px solid var(--token-border-subtle); }
  .to.bound-to { border-color: var(--token-color-accent-1-text); }
  .to.named-to { border-color: var(--token-color-accent-2-text); }

  .pointers code {
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 11px;
    overflow-wrap: anywhere;
  }

  .to b { font-size: 12px; }
  .pointers small { color: var(--token-ink-muted); font-size: 10.5px; }
  .arrow { color: var(--token-ink-muted); font-size: 15px; text-align: center; }

  @media (max-width: 64rem) {
    .pointers { grid-template-columns: minmax(0, 1fr); }
    .arrow { display: none; }
    .term { margin-left: 1rem; }
    .to { margin-left: 2rem; }
  }
</style>
