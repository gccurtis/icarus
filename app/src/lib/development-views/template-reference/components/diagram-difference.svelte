<script lang="ts">
  const included = [
    { term: "kinds", reads: "Documents", picks: 12 },
    { term: "set", reads: "Winter filings", picks: 9 },
    { term: "resources", reads: "Q3 exposure memo", picks: 1 }
  ];

  const excluded = [
    { term: "kinds", reads: "Research threads", picks: 4 },
    { term: "resources", reads: "Board review", picks: 1 }
  ];
</script>

<div class="difference">
  <section class="lane include">
    <header><b>Include</b><span>union</span></header>
    {#each included as term (term.reads)}
      <div class="term">
        <code>{term.term}</code>
        <b>{term.reads}</b>
        <span>{term.picks}</span>
      </div>
    {/each}
    <footer>17 distinct resources</footer>
  </section>

  <div class="operator" aria-hidden="true">−</div>

  <section class="lane exclude">
    <header><b>Exclude</b><span>union</span></header>
    {#each excluded as term (term.reads)}
      <div class="term">
        <code>{term.term}</code>
        <b>{term.reads}</b>
        <span>{term.picks}</span>
      </div>
    {/each}
    <footer>5 distinct resources</footer>
  </section>

  <div class="operator" aria-hidden="true">=</div>

  <section class="lane result">
    <header><b>Selects</b><span>now</span></header>
    <div class="count"><b>13</b><span>resources</span></div>
    <p>Counted when the set is read, never stored. A document made after this was built is already inside it.</p>
  </section>
</div>

<style>
  .difference {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
    gap: .9rem;
    align-items: stretch;
  }

  .lane {
    display: grid;
    align-content: start;
    gap: .4rem;
    padding: .85rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 8px;
    background: var(--token-surface-elevated);
  }

  .lane.exclude { background: var(--token-surface-work); }
  .lane.result { border-color: var(--token-color-active-text); background: var(--token-color-active-surface); }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: .5rem;
    padding-bottom: .35rem;
    border-bottom: 1px solid var(--token-border-subtle);
  }

  header b { font-size: 10px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
  header span { color: var(--token-ink-muted); font-size: 10px; }

  .term {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: .5rem;
    align-items: center;
    font-size: 12px;
  }

  .term code {
    padding: .05rem .3rem;
    border-radius: 3px;
    background: var(--token-surface-canvas);
    color: var(--token-ink-muted);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 9.5px;
  }

  .term b { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .term span { color: var(--token-ink-muted); font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11px; }

  footer {
    margin-top: .2rem;
    padding-top: .35rem;
    border-top: 1px dashed var(--token-border-subtle);
    color: var(--token-ink-muted);
    font-size: 11px;
  }

  .operator {
    align-self: center;
    color: var(--token-ink-muted);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 18px;
  }

  .count { display: flex; align-items: baseline; gap: .4rem; }
  .count b { font-size: 26px; font-weight: 700; letter-spacing: -.02em; }
  .count span { color: var(--token-ink-secondary); font-size: 12px; }

  .result p { margin: .2rem 0 0; color: var(--token-ink-secondary); font-size: 11.5px; }

  @media (max-width: 60rem) {
    .difference { grid-template-columns: minmax(0, 1fr); }
    .operator { justify-self: center; }
  }
</style>
