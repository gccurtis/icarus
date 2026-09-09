<script lang="ts">
  import {
    PANEL_REFERENCES,
    REFERENCE_GROUPS,
    READINESS_LABELS,
    referenceById
  } from "$development-views/project-overview-panels/procedures/catalog";
  import type {
    PanelReferenceId,
    SourceReadiness
  } from "$development-views/project-overview-panels/types";

  let selectedId = $state<PanelReferenceId>("overview");
  let stress = $state(false);
  const current = $derived(referenceById(selectedId));
  const Mock = $derived(current.component);

  const READINESS_ORDER: readonly SourceReadiness[] = [
    "available",
    "join",
    "capability",
    "missing"
  ];

  const countOf = (readiness: SourceReadiness): number =>
    current.sources.filter((source) => source.readiness === readiness).length;

  const numberOf = (id: PanelReferenceId): string =>
    String(PANEL_REFERENCES.findIndex((panel) => panel.id === id) + 1).padStart(2, "0");
</script>

<svelte:head>
  <title>Project overview panels — reference</title>
  <meta
    name="description"
    content="Code-derived visual and data reference for the Project Overview context and inspector panels."
  />
</svelte:head>

<div class="reference-page">
  <header class="masthead">
    <div class="mast-copy">
      <span class="eyebrow">Project overview · working reference</span>
      <h1>Six flanks, one data contract.</h1>
      <p>
        Desired panel states rendered with the production vocabulary, paired with the reads the
        current application can actually make. Seed values illustrate the shape; capability status
        comes from code.
      </p>
      <a class="delivery-link" href="/demo/project-overview-panels/delivery">
        Read the complete 3e670c5..930fb95 delivery record →
      </a>
    </div>

    <dl class="scorecard" aria-label="Reference coverage">
      <div><dt>Context</dt><dd>02</dd></div>
      <div><dt>Inspector</dt><dd>04</dd></div>
      <div><dt>Implemented</dt><dd>06</dd></div>
      <div><dt>Data gaps</dt><dd>01</dd></div>
    </dl>
  </header>

  <nav class="panel-nav" aria-label="Project overview panel mocks">
    {#each REFERENCE_GROUPS as group (group.label)}
      <div class="nav-group">
        <span>{group.label}</span>
        <div>
          {#each group.ids as id (id)}
            {@const panel = referenceById(id)}
            <button
              type="button"
              class:active={panel.id === selectedId}
              aria-pressed={panel.id === selectedId}
              onclick={() => (selectedId = panel.id)}
            >
              <i>{numberOf(panel.id)}</i>
              <strong>{panel.label}</strong>
              <small>{panel.implementation === "existing" ? "live" : "mock"}</small>
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </nav>

  <main class="workbench">
    <section class="preview-column" aria-labelledby="preview-title">
      <header class="column-head">
        <div>
          <span>{current.surface} panel</span>
          <h2 id="preview-title">{current.label}</h2>
        </div>
        <div class="preview-tools">
          <button
            type="button"
            class="stress-toggle"
            class:active={stress}
            aria-pressed={stress}
            onclick={() => (stress = !stress)}
          >
            Long-content stress
          </button>
          <span class="implementation" class:live={current.implementation === "existing"}>
            {current.implementation === "existing" ? "Implemented view" : "Destination is placeholder"}
          </span>
        </div>
      </header>

      <div class="stage">
        <div class="stage-grid" aria-hidden="true"></div>
        <div class="flank">
          {#key `${selectedId}:${stress}`}
            <Mock {stress} />
          {/key}
        </div>
        <div class="width-mark" aria-hidden="true"><span>320 px review width</span></div>
      </div>

      <div class="identity-card">
        <div>
          <span>View key</span>
          <code>{current.viewKey}</code>
        </div>
        <div>
          <span>Selection contract</span>
          <code>{current.selection}</code>
        </div>
        <div>
          <span>Production destination</span>
          <code>{current.destination}</code>
        </div>
      </div>
    </section>

    <aside class="contract-column" aria-labelledby="contract-title">
      <header class="column-head contract-head">
        <div>
          <span>Code-derived provenance</span>
          <h2 id="contract-title">Where the panel gets its facts</h2>
        </div>
      </header>

      <p class="purpose">{current.purpose}</p>

      <div class="readiness-summary" aria-label="Current data readiness">
        {#each READINESS_ORDER as readiness (readiness)}
          <span class={readiness}>
            <b>{countOf(readiness)}</b>
            {READINESS_LABELS[readiness]}
          </span>
        {/each}
      </div>

      <div class="source-list">
        {#each current.sources as source, index (source.label)}
          <article class="source-card">
            <header>
              <span class="source-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{source.label}</h3>
                <span class="status {source.readiness}">{READINESS_LABELS[source.readiness]}</span>
              </div>
            </header>
            <code class="read">{source.read}</code>
            <dl>
              <div><dt>Owner</dt><dd>{source.owner}</dd></div>
              <div><dt>Provides</dt><dd>{source.provides}</dd></div>
            </dl>
            <p>{source.note}</p>
          </article>
        {/each}
      </div>

      <section class="decisions" aria-labelledby="decisions-title">
        <span>Build decisions</span>
        <h3 id="decisions-title">Hold these boundaries</h3>
        <ol>
          {#each current.decisions as decision, index (decision)}
            <li><span>{String(index + 1).padStart(2, "0")}</span><p>{decision}</p></li>
          {/each}
        </ol>
      </section>
    </aside>
  </main>

  <section class="architecture" aria-labelledby="architecture-title">
    <header>
      <span class="eyebrow">Current application path</span>
      <h2 id="architecture-title">A panel is a projection, not a table reader.</h2>
      <p>
        The filesystem remains the component registry. Named view procedures now call a scoped
        Project capability, which returns subject-owned projections instead of exposing represented
        rows directly to components.
      </p>
    </header>

    <ol class="flow" aria-label="Panel data flow">
      <li><span>01</span><strong>Selection</strong><code>TabView.contextId / inspected + selection</code></li>
      <li><span>02</span><strong>Filesystem registry</strong><code>categories/*/context|inspector/*.svelte</code></li>
      <li><span>03</span><strong>View procedure</strong><code>joins, labels, empty and loading states</code></li>
      <li><span>04</span><strong>Subject capability</strong><code>scope, validation, paging, mutation</code></li>
      <li><span>05</span><strong>Representation</strong><code>tables.ts + append-only records</code></li>
    </ol>
  </section>

  <footer class="reference-footer">
    <span>Delivery <code>3e670c5..930fb95</code></span>
    <a href="/demo/project-overview-panels/delivery">Complete delivery reference →</a>
    <span>Mocks mirror current seed names; no mock reads seed files at runtime.</span>
  </footer>
</div>

<style>
  .reference-page {
    min-height: 100%;
    background:
      linear-gradient(var(--token-border-subtle) 1px, transparent 1px),
      linear-gradient(90deg, var(--token-border-subtle) 1px, transparent 1px),
      var(--token-surface-canvas);
    background-size: 3rem 3rem;
    color: var(--token-ink-primary);
  }

  .masthead {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(24rem, 0.62fr);
    gap: 4rem;
    align-items: end;
    padding: 4rem clamp(1.5rem, 5vw, 5rem) 3rem;
    border-bottom: 1px solid var(--token-border-strong);
    background: color-mix(in srgb, var(--token-surface-canvas) 94%, transparent);
  }

  .eyebrow,
  .column-head span,
  .nav-group > span,
  .identity-card span,
  .decisions > span {
    color: var(--token-ink-muted);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .mast-copy h1 {
    max-width: 12ch;
    margin: 0.8rem 0 0;
    font-size: clamp(3rem, 6vw, 6rem);
    line-height: 0.9;
    letter-spacing: -0.06em;
  }

  .mast-copy p {
    max-width: 66ch;
    margin: 1.5rem 0 0;
    color: var(--token-ink-secondary);
    font-size: 1rem;
    line-height: 1.65;
  }

  .delivery-link {
    display: inline-flex;
    margin-top: 1rem;
    padding-bottom: 0.2rem;
    border-bottom: 1px solid var(--token-color-active-border);
    color: var(--token-color-interactive-text);
    font-size: 0.68rem;
    font-weight: 650;
  }

  .scorecard {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0;
    border-top: 3px solid var(--token-color-active-border);
    border-inline-start: 1px solid var(--token-border-strong);
    background: var(--token-surface-elevated);
    box-shadow: var(--token-shadow-panel);
  }

  .scorecard div {
    display: flex;
    min-height: 5.5rem;
    flex-direction: column-reverse;
    justify-content: space-between;
    padding: 1rem;
    border-inline-end: 1px solid var(--token-border-strong);
    border-bottom: 1px solid var(--token-border-strong);
  }

  .scorecard dt {
    color: var(--token-ink-muted);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .scorecard dd {
    margin: 0;
    font: 600 1.8rem/1 "IBM Plex Mono", monospace;
  }

  .panel-nav {
    position: sticky;
    top: 2.75rem;
    z-index: 20;
    display: flex;
    min-width: 0;
    padding: 0 clamp(1.5rem, 5vw, 5rem);
    border-bottom: 1px solid var(--token-border-strong);
    background: color-mix(in srgb, var(--token-surface-veil) 96%, transparent);
    backdrop-filter: blur(14px);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .panel-nav::-webkit-scrollbar {
    display: none;
  }

  .nav-group {
    display: flex;
    flex: 1 0 auto;
    align-items: stretch;
    border-inline-start: 1px solid var(--token-border-subtle);
  }

  .nav-group:last-child {
    border-inline-end: 1px solid var(--token-border-subtle);
  }

  .nav-group > span {
    display: flex;
    align-items: center;
    padding: 0 0.85rem;
    background: var(--token-surface-panel);
    writing-mode: vertical-rl;
    transform: rotate(180deg);
  }

  .nav-group > div {
    display: flex;
    flex: 1;
  }

  .panel-nav button {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: 1fr 1fr;
    min-width: 8.5rem;
    flex: 1;
    gap: 0 0.55rem;
    padding: 0.8rem 1rem;
    border-inline-start: 1px solid var(--token-border-subtle);
    color: var(--token-ink-secondary);
    text-align: left;
  }

  .panel-nav button:hover {
    background: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  .panel-nav button.active {
    box-shadow: inset 0 -3px 0 var(--token-color-active-border);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .panel-nav button i {
    grid-row: 1 / 3;
    color: var(--token-ink-muted);
    font: 500 0.55rem/1.5 "IBM Plex Mono", monospace;
    font-style: normal;
  }

  .panel-nav button strong {
    align-self: end;
    font-size: 0.75rem;
  }

  .panel-nav button small {
    color: var(--token-ink-muted);
    font-size: 0.6rem;
  }

  .workbench {
    display: grid;
    grid-template-columns: minmax(28rem, 0.88fr) minmax(30rem, 1.12fr);
    border-bottom: 1px solid var(--token-border-strong);
  }

  .preview-column,
  .contract-column {
    min-width: 0;
  }

  .preview-column {
    border-inline-end: 1px solid var(--token-border-strong);
  }

  .column-head {
    display: flex;
    min-height: 5.4rem;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem clamp(1.5rem, 4vw, 3.5rem);
    border-bottom: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel);
  }

  .column-head h2 {
    margin: 0.25rem 0 0;
    font-size: 1.15rem;
  }

  .implementation {
    padding: 0.3rem 0.45rem;
    border: 1px dashed var(--token-color-attention-border);
    border-radius: var(--token-radius-control);
    color: var(--token-color-attention-text) !important;
    letter-spacing: 0.04em !important;
    white-space: nowrap;
  }

  .preview-tools {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .stress-toggle {
    padding: 0.3rem 0.45rem;
    border: 1px solid var(--token-border-strong);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .stress-toggle:hover,
  .stress-toggle.active {
    border-color: var(--token-color-active-border);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .implementation.live {
    border-style: solid;
    border-color: var(--token-color-success-border);
    color: var(--token-color-success-text) !important;
  }

  .stage {
    position: relative;
    display: grid;
    min-height: 49rem;
    place-items: center;
    padding: 3rem 2rem 4rem;
    background: var(--token-surface-work);
    overflow: hidden;
  }

  .stage-grid {
    position: absolute;
    inset: 0;
    opacity: 0.55;
    background:
      linear-gradient(var(--token-border-subtle) 1px, transparent 1px),
      linear-gradient(90deg, var(--token-border-subtle) 1px, transparent 1px);
    background-size: 1rem 1rem;
    pointer-events: none;
  }

  .flank {
    position: relative;
    z-index: 1;
    width: 20rem;
    height: 42rem;
    border: 1px solid var(--token-border-strong);
    background: var(--token-surface-panel);
    box-shadow: var(--token-shadow-panel);
    overflow: hidden;
  }

  .width-mark {
    position: absolute;
    bottom: 1.65rem;
    left: 50%;
    z-index: 1;
    width: 20rem;
    border-top: 1px solid var(--token-color-active-border);
    color: var(--token-color-active-text);
    text-align: center;
  }

  .width-mark::before,
  .width-mark::after {
    position: absolute;
    top: -0.25rem;
    width: 1px;
    height: 0.5rem;
    background: var(--token-color-active-border);
    content: "";
  }

  .width-mark::before { left: 0; }
  .width-mark::after { right: 0; }

  .width-mark span {
    position: relative;
    top: -0.45rem;
    padding: 0 0.5rem;
    background: var(--token-surface-work);
    font: 600 0.55rem/1 "IBM Plex Mono", monospace;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .identity-card {
    display: grid;
    grid-template-columns: 0.72fr 1fr;
    border-top: 1px solid var(--token-border-strong);
    background: var(--token-surface-elevated);
  }

  .identity-card > div {
    min-width: 0;
    padding: 1rem 1.2rem;
    border-inline-end: 1px solid var(--token-border-subtle);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .identity-card > div:last-child {
    grid-column: 1 / -1;
    border-bottom: 0;
  }

  .identity-card code {
    display: block;
    margin-top: 0.4rem;
    color: var(--token-ink-secondary);
    font-size: 0.65rem;
    overflow-wrap: anywhere;
  }

  .contract-column {
    background: color-mix(in srgb, var(--token-surface-canvas) 96%, transparent);
  }

  .contract-head {
    padding-inline: clamp(1.5rem, 4vw, 3.5rem);
  }

  .purpose {
    max-width: 68ch;
    margin: 0;
    padding: 1.5rem clamp(1.5rem, 4vw, 3.5rem);
    color: var(--token-ink-secondary);
    font-size: 0.85rem;
    line-height: 1.6;
  }

  .readiness-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin: 0 clamp(1.5rem, 4vw, 3.5rem) 1.5rem;
    border: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel);
  }

  .readiness-summary > span {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.75rem;
    border-inline-end: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
    font-size: 0.56rem;
    line-height: 1.35;
    text-transform: uppercase;
  }

  .readiness-summary > span:last-child { border-inline-end: 0; }
  .readiness-summary b { color: var(--token-ink-primary); font: 600 1.1rem/1 "IBM Plex Mono", monospace; }
  .readiness-summary .available b { color: var(--token-color-success-text); }
  .readiness-summary .capability b { color: var(--token-color-attention-text); }
  .readiness-summary .missing b { color: var(--token-color-danger-text); }

  .source-list {
    display: flex;
    flex-direction: column;
    margin: 0 clamp(1.5rem, 4vw, 3.5rem);
    border: 1px solid var(--token-border-strong);
    background: var(--token-surface-elevated);
  }

  .source-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(13rem, 0.62fr);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .source-card:last-child { border-bottom: 0; }

  .source-card header {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: 0.6rem;
    align-items: start;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel);
  }

  .source-number {
    color: var(--token-color-active-text);
    font: 600 0.56rem/1.6 "IBM Plex Mono", monospace;
  }

  .source-card h3 {
    display: inline;
    margin: 0;
    font-size: 0.75rem;
  }

  .status {
    display: inline-block;
    margin-inline-start: 0.5rem;
    padding: 0.14rem 0.35rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    color: var(--token-ink-muted);
    font-size: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .status.available {
    border-color: var(--token-color-success-border);
    background: var(--token-color-success-surface);
    color: var(--token-color-success-text);
  }

  .status.join {
    border-color: var(--token-color-active-border);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .status.capability {
    border-color: var(--token-color-attention-border);
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
  }

  .status.missing {
    border-color: var(--token-color-danger-border);
    background: var(--token-color-danger-surface);
    color: var(--token-color-danger-text);
  }

  .source-card .read {
    display: flex;
    align-items: center;
    min-width: 0;
    padding: 0.8rem 1rem;
    border-inline-end: 1px solid var(--token-border-subtle);
    color: var(--token-color-interactive-text);
    font-size: 0.62rem;
    overflow-wrap: anywhere;
  }

  .source-card dl {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.65rem;
    margin: 0;
    padding: 0.8rem 1rem;
  }

  .source-card dt {
    color: var(--token-ink-muted);
    font-size: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .source-card dd {
    margin: 0.2rem 0 0;
    color: var(--token-ink-secondary);
    font-size: 0.65rem;
  }

  .source-card > p {
    grid-column: 1 / -1;
    margin: 0;
    padding: 0.7rem 1rem;
    border-top: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
    font-size: 0.63rem;
    line-height: 1.55;
  }

  .decisions {
    margin: 2rem clamp(1.5rem, 4vw, 3.5rem) 3rem;
    padding-top: 1.2rem;
    border-top: 3px solid var(--token-border-strong);
  }

  .decisions h3 {
    margin: 0.3rem 0 1rem;
    font-size: 1rem;
  }

  .decisions ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .decisions li {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: 0.6rem;
    padding: 0.7rem 0;
    border-top: 1px solid var(--token-border-subtle);
  }

  .decisions li > span {
    color: var(--token-color-active-text);
    font: 600 0.55rem/1.6 "IBM Plex Mono", monospace;
  }

  .decisions li p {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: 0.7rem;
    line-height: 1.55;
  }

  .architecture {
    display: grid;
    grid-template-columns: minmax(18rem, 0.45fr) minmax(0, 1fr);
    gap: 4rem;
    padding: 4rem clamp(1.5rem, 5vw, 5rem);
    background: var(--token-surface-inverted);
    color: var(--token-ink-on-inverted);
  }

  .architecture h2 {
    max-width: 15ch;
    margin: 0.7rem 0 0;
    font-size: clamp(2rem, 4vw, 3.5rem);
    line-height: 0.98;
    letter-spacing: -0.045em;
  }

  .architecture header p {
    max-width: 52ch;
    margin: 1.2rem 0 0;
    opacity: 0.66;
    font-size: 0.78rem;
    line-height: 1.6;
  }

  .flow {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-self: end;
    margin: 0;
    padding: 0;
    border-top: 1px solid color-mix(in srgb, currentColor 28%, transparent);
    list-style: none;
  }

  .flow li {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 11rem;
    flex-direction: column;
    gap: 0.65rem;
    padding: 1rem;
    border-inline-end: 1px solid color-mix(in srgb, currentColor 28%, transparent);
  }

  .flow li::after {
    position: absolute;
    top: 50%;
    right: -0.45rem;
    z-index: 1;
    display: grid;
    width: 0.9rem;
    height: 0.9rem;
    place-items: center;
    background: var(--token-surface-inverted);
    content: "→";
    font-size: 0.7rem;
  }

  .flow li:last-child::after { display: none; }
  .flow li > span { opacity: 0.45; font: 500 0.55rem/1 "IBM Plex Mono", monospace; }
  .flow strong { margin-top: auto; font-size: 0.7rem; }
  .flow code { opacity: 0.55; font-size: 0.55rem; line-height: 1.45; overflow-wrap: anywhere; }

  .reference-footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 1rem 2rem;
    padding: 1rem clamp(1.5rem, 5vw, 5rem);
    border-top: 1px solid var(--token-border-strong);
    background: var(--token-surface-panel);
    color: var(--token-ink-muted);
    font-size: 0.6rem;
  }

  .reference-footer code {
    color: var(--token-ink-secondary);
  }

  .reference-footer a {
    color: var(--token-color-interactive-text);
    font-weight: 650;
  }

  @media (max-width: 72rem) {
    .masthead { grid-template-columns: 1fr; gap: 2.5rem; }
    .scorecard { max-width: 36rem; }
    .workbench { grid-template-columns: 1fr; }
    .preview-column { border-inline-end: 0; border-bottom: 1px solid var(--token-border-strong); }
    .architecture { grid-template-columns: 1fr; gap: 2.5rem; }
  }

  @media (max-width: 48rem) {
    .masthead { padding-top: 2.5rem; }
    .mast-copy h1 { font-size: clamp(2.6rem, 15vw, 4.5rem); }
    .panel-nav { padding-inline: 0; }
    .nav-group > span { display: none; }
    .panel-nav button { min-width: 7.5rem; }
    .column-head { align-items: flex-start; flex-direction: column; }
    .stage { min-height: 47rem; padding-inline: 1rem; }
    .flank, .width-mark { width: min(20rem, calc(100vw - 2rem)); }
    .identity-card { grid-template-columns: 1fr; }
    .identity-card > div:last-child { grid-column: auto; }
    .readiness-summary { grid-template-columns: repeat(2, 1fr); }
    .readiness-summary > span:nth-child(2) { border-inline-end: 0; }
    .readiness-summary > span:nth-child(-n + 2) { border-bottom: 1px solid var(--token-border-subtle); }
    .source-card { grid-template-columns: 1fr; }
    .source-card .read { border-inline-end: 0; border-bottom: 1px solid var(--token-border-subtle); }
    .flow { grid-template-columns: 1fr; }
    .flow li { min-height: auto; border-bottom: 1px solid color-mix(in srgb, currentColor 28%, transparent); }
    .flow li::after { top: auto; right: 50%; bottom: -0.45rem; content: "↓"; }
  }

  @media (max-width: 44rem) {
    .panel-nav { top: 5.95rem; }
  }
</style>
