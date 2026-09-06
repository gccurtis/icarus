<script lang="ts">
  import { FILES } from "$development-views/document-editor-reference/procedures/inventory";
  import { REFERENCE_NAV } from "$development-views/document-editor-reference/procedures/navigation";
  import type { AreaReference } from "$development-views/document-editor-reference/types";
  import FileLedger from "$development-views/document-editor-reference/components/file-ledger.svelte";
  import ReferenceHeader from "$development-views/document-editor-reference/components/reference-header.svelte";
  import "$development-views/document-editor-reference/components/reference.css";

  let { area }: { area: AreaReference } = $props();
  let selectedFlow = $state<string>();
  const flow = $derived(area.flows.find((candidate) => candidate.id === selectedFlow) ?? area.flows[0]);
  const files = $derived(FILES.filter((file) => file.area === area.slug));
  const related = $derived(REFERENCE_NAV.filter((item) => area.related.includes(item.slug as never)));
  const sourceCount = $derived(new Set(area.structure.map((entry) => entry.path)).size);
  const productionLoc = $derived(files.filter((file) => file.kind === "production").reduce((sum, file) => sum + file.current, 0));
</script>

<div class="reference-artifact">
  <ReferenceHeader current={area.slug} />

  <main class="reference-page">
    <header class="mast">
      <div>
        <a class="back" href="/demo/document-editor-reference">← System overview</a>
        <span class="reference-kicker">{area.index} · {area.eyebrow}</span>
        <h1>{area.title}</h1>
        <p class="summary">{area.summary}</p>
      </div>
      <aside class="contract">
        <span>Boundary contract</span>
        <p>{area.contract}</p>
        <dl>
          <div><dt>Primary changed files</dt><dd>{files.length}</dd></div>
          <div><dt>Production LOC</dt><dd>{productionLoc.toLocaleString()}</dd></div>
          <div><dt>Flows</dt><dd>{area.flows.length}</dd></div>
          <div><dt>Source groups</dt><dd>{sourceCount}</dd></div>
        </dl>
      </aside>
    </header>

    <nav class="jumps" aria-label="On this page">
      <a href="#boundary">Boundary</a>
      <a href="#changes">What changed</a>
      <a href="#flows">Execution flows</a>
      <a href="#domains">Domains & states</a>
      <a href="#procedures">Procedures</a>
      <a href="#structure">Structure</a>
      <a href="#files">Files & LOC</a>
    </nav>

    <section class="reference-section" id="boundary">
      <div class="reference-section-head">
        <div><span class="reference-kicker">Ownership</span><h2>What belongs here</h2></div>
        <p>The boundary is deliberately narrow. The left column is this subsystem’s responsibility; the right column names adjacent responsibilities that must stay elsewhere.</p>
      </div>
      <div class="boundary-grid">
        <article class="owns">
          <span>Owns</span>
          <ul>{#each area.owns as item}<li>{item}</li>{/each}</ul>
        </article>
        <article>
          <span>Does not own</span>
          <ul>{#each area.doesNotOwn as item}<li>{item}</li>{/each}</ul>
        </article>
      </div>
    </section>

    <section class="reference-section" id="changes">
      <div class="reference-section-head">
        <div><span class="reference-kicker">Before → now</span><h2>What changed</h2></div>
        <p>Behavioral changes are recorded with their prior failure and design reason so this page remains useful after the visual implementation becomes familiar.</p>
      </div>
      <div class="change-list">
        {#each area.changes as change, index}
          <article>
            <span class="change-index">{String(index + 1).padStart(2, "0")}</span>
            <div class="change-main"><h3>{change.title}</h3><p>{change.why}</p></div>
            <div class="change-state old"><span>Before</span><p>{change.before}</p></div>
            <div class="change-state now"><span>Now</span><p>{change.now}</p></div>
          </article>
        {/each}
      </div>
    </section>

    <section class="reference-section" id="flows">
      <div class="reference-section-head">
        <div><span class="reference-kicker">Procedure flow</span><h2>End-to-end execution</h2></div>
        <p>Choose a flow to follow ownership from trigger to outcome. Labels name runtime artifacts and function boundaries rather than incidental UI elements.</p>
      </div>
      <div class="flow-layout">
        <div class="flow-rail" role="tablist" aria-label={`${area.title} flows`}>
          {#each area.flows as candidate, index (candidate.id)}
            <button
              type="button"
              role="tab"
              aria-selected={flow?.id === candidate.id}
              aria-controls={`flow-${candidate.id}`}
              class:active={flow?.id === candidate.id}
              onclick={() => (selectedFlow = candidate.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{candidate.title}</b>
            </button>
          {/each}
        </div>
        {#if flow}
          <div class="flow-detail" id={`flow-${flow.id}`} role="tabpanel">
            <header><span>Trigger</span><p>{flow.trigger}</p></header>
            <ol>
              {#each flow.steps as step, index}
                <li>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div><small>{step.actor}</small><p>{step.action}</p>{#if step.artifact}<code>{step.artifact}</code>{/if}</div>
                </li>
              {/each}
            </ol>
            <footer>
              <div class="outcome"><span>Outcome</span><p>{flow.outcome}</p></div>
              {#if flow.failure}<div class="failure"><span>Failure path</span><p>{flow.failure}</p></div>{/if}
            </footer>
          </div>
        {/if}
      </div>
    </section>

    <section class="reference-section" id="domains">
      <div class="reference-section-head">
        <div><span class="reference-kicker">Domain model</span><h2>State and invariants</h2></div>
        <p>These are the named pieces of state this subsystem reads or owns. Invariants are the review criteria that should remain true through future changes.</p>
      </div>
      <div class="domain-grid">
        {#each area.domains as domain, index}
          <article>
            <header><span>{String(index + 1).padStart(2, "0")}</span><div><small>{domain.owner}</small><h3>{domain.name}</h3></div></header>
            <div class="shape"><span>Shape</span><p>{domain.shape}</p></div>
            {#if domain.states}
              <div class="domain-part"><span>States</span><div class="chips">{#each domain.states as state}<em>{state}</em>{/each}</div></div>
            {/if}
            {#if domain.transitions}
              <div class="domain-part"><span>Transitions</span><ul>{#each domain.transitions as transition}<li>{transition}</li>{/each}</ul></div>
            {/if}
            <div class="domain-part"><span>Invariants</span><ul>{#each domain.invariants as invariant}<li>{invariant}</li>{/each}</ul></div>
            <footer>{#each domain.sources as source}<code>{source}</code>{/each}</footer>
          </article>
        {/each}
      </div>
    </section>

    <section class="reference-section" id="procedures">
      <div class="reference-section-head">
        <div><span class="reference-kicker">Call catalogue</span><h2>Procedures and effects</h2></div>
        <p>Each row states its reads, writes, and failure behavior. Expand a procedure to review the full contract and exact source locations.</p>
      </div>
      <div class="procedure-list">
        {#each area.procedures as procedure, index}
          <details open={index === 0}>
            <summary><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{procedure.name}</h3><p>{procedure.role}</p></div><i aria-hidden="true">+</i></summary>
            <div class="procedure-detail">
              <dl>
                <div><dt>Reads</dt><dd>{procedure.reads}</dd></div>
                <div><dt>Writes</dt><dd>{procedure.writes}</dd></div>
                <div><dt>Failure</dt><dd>{procedure.failure}</dd></div>
              </dl>
              <aside><span>Source</span>{#each procedure.sources as source}<code>{source}</code>{/each}</aside>
            </div>
          </details>
        {/each}
      </div>
    </section>

    <section class="reference-section" id="structure">
      <div class="reference-section-head">
        <div><span class="reference-kicker">Source topology</span><h2>Where it lives</h2></div>
        <p>This is the durable structure, not the full delta. The measured ledger below enumerates every changed file assigned to this subsystem.</p>
      </div>
      <div class="structure-list">
        {#each area.structure as entry}
          <article><code>{entry.path}</code><div><span>{entry.role}</span><p>{entry.note}</p></div></article>
        {/each}
      </div>
      <div class="review-notes">
        {#each area.review as note}
          <article class={note.tone}><span>{note.tone}</span><h3>{note.title}</h3><p>{note.detail}</p></article>
        {/each}
      </div>
    </section>

    <div id="files">
      <FileLedger
        {files}
        title={`${area.shortTitle} files and complexity`}
        description={`Every changed file primarily owned by ${area.title}, measured against main. Cross-cutting and evidence files remain visible in the master ledger.`}
      />
    </div>

    <section class="related-section">
      <span class="reference-kicker">Continue the review</span>
      <div>
        {#each related as item}<a href={item.href}><span>{item.index}</span>{item.label} <i aria-hidden="true">→</i></a>{/each}
        <a class="ledger-link" href="/demo/document-editor-reference/ledger"><span>06</span>Master file ledger <i aria-hidden="true">→</i></a>
      </div>
    </section>
  </main>

  <footer class="reference-footer">
    <div><a href="/demo/document-editor-review">Original audit</a><a href="/demo/document-editor-implementation-plan">Implementation plan</a><a href="/demo/document-editor-controls">Control reference</a></div>
    <span>Branch: <code>work/document-editor-integration</code> · comparison: <code>main</code></span>
  </footer>
</div>

<style>
  .mast { display: grid; grid-template-columns: minmax(0, 1fr) minmax(20rem, .58fr); gap: 5rem; align-items: end; }
  .back { display: inline-block; margin-bottom: 2.2rem; color: var(--interactive); font-size: 10px; font-weight: 700; text-decoration: none; }
  .back:hover { text-decoration: underline; }
  h1 { max-width: 12ch; margin: 0; font-size: clamp(3.4rem, 7vw, 6.5rem); line-height: .88; letter-spacing: -.06em; }
  .summary { max-width: 66ch; margin: 1.5rem 0 0; color: var(--ink-2); font-size: 1.08rem; }
  .contract { border: 1px solid var(--rule-strong); border-top: 4px solid var(--active); border-radius: 0 0 var(--token-radius-panel) var(--token-radius-panel); background: var(--raised); }
  .contract > span { display: block; padding: .7rem 1rem; border-bottom: 1px solid var(--rule); background: var(--active-soft); color: var(--active); font-size: 9px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
  .contract > p { margin: 0; padding: 1rem; color: var(--ink-2); font-size: 12px; }
  .contract dl { display: grid; grid-template-columns: repeat(2, 1fr); margin: 0; border-top: 1px solid var(--rule); }
  .contract dl div { padding: .7rem 1rem; border-right: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
  .contract dl div:nth-child(even) { border-right: 0; }
  .contract dl div:nth-last-child(-n+2) { border-bottom: 0; }
  .contract dt { color: var(--ink-3); font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .contract dd { margin: .2rem 0 0; font: 650 1.15rem/1 "IBM Plex Mono", monospace; }
  .jumps { position: sticky; top: 3.5rem; z-index: 35; display: flex; margin: 3.5rem -3.5rem 0; padding: 0 3.5rem; border-block: 1px solid var(--rule); background: color-mix(in srgb, var(--ground) 93%, transparent); backdrop-filter: blur(12px); overflow-x: auto; scrollbar-width: none; }
  .jumps::-webkit-scrollbar { display: none; }
  .jumps a { flex: 1 0 auto; padding: .7rem .75rem; border-right: 1px solid var(--rule); color: var(--ink-3); font-size: 9.5px; font-weight: 650; text-align: center; text-decoration: none; }
  .jumps a:first-child { border-left: 1px solid var(--rule); }
  .jumps a:hover { background: var(--panel); color: var(--active); }
  .boundary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-top: 1.25rem; }
  .boundary-grid article { min-height: 17rem; padding: 1.3rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); }
  .boundary-grid article.owns { border-top: 3px solid var(--success); }
  .boundary-grid article > span, .domain-part > span, .shape > span, .flow-detail span, .procedure-detail aside > span { color: var(--ink-3); font-size: 8.5px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
  .boundary-grid ul { display: grid; gap: .75rem; margin: 1.2rem 0 0; padding: 0; list-style: none; }
  .boundary-grid li { display: grid; grid-template-columns: 1rem 1fr; color: var(--ink-2); font-size: 12px; }
  .boundary-grid li::before { color: var(--success); content: "✓"; }
  .boundary-grid article:not(.owns) li::before { color: var(--ink-3); content: "—"; }
  .change-list { margin-top: 1.25rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .change-list article { display: grid; grid-template-columns: 2.5rem minmax(14rem, .8fr) repeat(2, minmax(14rem, 1fr)); gap: 1rem; padding: 1.15rem; border-bottom: 1px solid var(--rule); }
  .change-list article:last-child { border-bottom: 0; }
  .change-index { color: var(--active); font: 600 9px/1.4 "IBM Plex Mono", monospace; }
  .change-main h3 { margin: 0; font-size: 1rem; }
  .change-main p, .change-state p { margin: .4rem 0 0; color: var(--ink-2); font-size: 11px; }
  .change-state { padding-left: 1rem; border-left: 1px solid var(--rule); }
  .change-state > span { color: var(--ink-3); font-size: 8px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
  .change-state.now > span { color: var(--success); }
  .change-state.old p { color: var(--ink-3); }
  .flow-layout { display: grid; grid-template-columns: 17rem minmax(0, 1fr); gap: 1rem; margin-top: 1.25rem; }
  .flow-rail { display: flex; flex-direction: column; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .flow-rail button { display: grid; grid-template-columns: 2rem 1fr; gap: .4rem; min-height: 4rem; align-items: start; padding: .75rem; border: 0; border-bottom: 1px solid var(--rule); background: transparent; color: var(--ink-2); cursor: pointer; text-align: left; }
  .flow-rail button:last-child { border-bottom: 0; }
  .flow-rail button:hover { background: var(--panel); }
  .flow-rail button.active { box-shadow: inset 3px 0 0 var(--active); background: var(--active-soft); color: var(--active); }
  .flow-rail button span { font: 550 8px/1.4 "IBM Plex Mono", monospace; }
  .flow-rail button b { font-size: 11px; }
  .flow-detail { min-height: 31rem; border: 1px solid var(--rule-strong); border-radius: var(--token-radius-panel); background: var(--raised); box-shadow: var(--token-shadow-panel); overflow: hidden; }
  .flow-detail > header { display: grid; grid-template-columns: 6rem 1fr; gap: 1rem; padding: 1rem 1.2rem; border-bottom: 1px solid var(--rule); background: var(--panel); }
  .flow-detail > header p { margin: 0; font-weight: 600; }
  .flow-detail ol { margin: 0; padding: 0; list-style: none; }
  .flow-detail li { position: relative; display: grid; grid-template-columns: 3rem 1fr; gap: 1rem; min-height: 5rem; padding: 1rem 1.2rem; border-bottom: 1px solid var(--rule); }
  .flow-detail li > span { display: grid; width: 1.65rem; height: 1.65rem; place-items: center; border: 1px solid var(--token-color-active-border); border-radius: 50%; background: var(--active-soft); color: var(--active); font-family: "IBM Plex Mono", monospace; }
  .flow-detail li:not(:last-child)::after { position: absolute; bottom: -.55rem; left: 2rem; z-index: 2; color: var(--active); content: "↓"; font-size: 12px; }
  .flow-detail li small { color: var(--active); font-size: 8.5px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
  .flow-detail li p { margin: .2rem 0 .45rem; color: var(--ink-2); font-size: 12px; }
  .flow-detail code { display: inline-block; padding: .12rem .35rem; border: 1px solid var(--rule); border-radius: 4px; background: var(--panel); color: var(--ink-3); font-size: 8.5px; }
  .flow-detail > footer { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .flow-detail > footer > div { padding: 1rem 1.2rem; }
  .flow-detail > footer > div + div { border-left: 1px solid var(--rule); }
  .flow-detail footer p { margin: .3rem 0 0; color: var(--ink-2); font-size: 11px; }
  .flow-detail .outcome { background: var(--success-soft); }
  .flow-detail .outcome span { color: var(--success); }
  .flow-detail .failure { background: var(--attention-soft); }
  .flow-detail .failure span { color: var(--attention); }
  .domain-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 1.25rem; }
  .domain-grid > article { display: flex; min-height: 25rem; flex-direction: column; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .domain-grid > article > header { display: grid; grid-template-columns: 2rem 1fr; gap: .5rem; padding: 1rem; border-bottom: 1px solid var(--rule); background: var(--panel); }
  .domain-grid header > span { color: var(--active); font: 600 9px/1.4 "IBM Plex Mono", monospace; }
  .domain-grid header small { color: var(--ink-3); font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .domain-grid h3 { margin: .15rem 0 0; font-size: 1.15rem; }
  .shape, .domain-part { padding: .8rem 1rem; border-bottom: 1px solid var(--rule); }
  .shape p { margin: .35rem 0 0; color: var(--ink-2); font-size: 11px; }
  .chips { display: flex; flex-wrap: wrap; gap: .3rem; margin-top: .45rem; }
  .chips em { padding: .2rem .4rem; border: 1px solid var(--rule); border-radius: 99px; background: var(--work); color: var(--ink-2); font-size: 8.5px; font-style: normal; }
  .domain-part ul { display: grid; gap: .35rem; margin: .45rem 0 0; padding-left: 1rem; }
  .domain-part li { color: var(--ink-2); font-size: 10.5px; }
  .domain-grid article > footer { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: auto; padding: .7rem 1rem; }
  .domain-grid footer code { color: var(--ink-3); font-size: 7.5px; overflow-wrap: anywhere; }
  .procedure-list { margin-top: 1.25rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .procedure-list details { border-bottom: 1px solid var(--rule); }
  .procedure-list details:last-child { border-bottom: 0; }
  .procedure-list summary { display: grid; grid-template-columns: 2.5rem minmax(0, 1fr) 2rem; gap: .6rem; align-items: center; min-height: 4.5rem; padding: .8rem 1rem; cursor: pointer; list-style: none; }
  .procedure-list summary::-webkit-details-marker { display: none; }
  .procedure-list summary:hover { background: var(--panel); }
  .procedure-list summary > span { color: var(--active); font: 600 9px/1 "IBM Plex Mono", monospace; }
  .procedure-list h3 { margin: 0; font-size: 12px; }
  .procedure-list summary p { margin: .2rem 0 0; color: var(--ink-2); font-size: 10.5px; }
  .procedure-list summary i { color: var(--active); font-size: 1.2rem; font-style: normal; text-align: center; transition: transform .16s ease; }
  .procedure-list details[open] summary i { transform: rotate(45deg); }
  .procedure-detail { display: grid; grid-template-columns: minmax(0, 1fr) minmax(16rem, .42fr); gap: 1rem; padding: 0 1rem 1rem 4.1rem; }
  .procedure-detail dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; border: 1px solid var(--rule); border-radius: var(--token-radius-control); overflow: hidden; }
  .procedure-detail dl div { padding: .75rem; border-right: 1px solid var(--rule); }
  .procedure-detail dl div:last-child { border-right: 0; }
  .procedure-detail dt { color: var(--ink-3); font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .procedure-detail dd { margin: .3rem 0 0; color: var(--ink-2); font-size: 10px; }
  .procedure-detail aside { display: flex; flex-direction: column; gap: .3rem; padding: .7rem; border-left: 2px solid var(--rule-strong); background: var(--panel); }
  .procedure-detail aside code { color: var(--ink-2); font-size: 8px; overflow-wrap: anywhere; }
  .structure-list { margin-top: 1.25rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .structure-list article { display: grid; grid-template-columns: minmax(19rem, .8fr) minmax(0, 1fr); gap: 1.5rem; padding: 1rem 1.1rem; border-bottom: 1px solid var(--rule); }
  .structure-list article:last-child { border-bottom: 0; }
  .structure-list code { color: var(--active); font-size: 9px; overflow-wrap: anywhere; }
  .structure-list span { color: var(--ink); font-size: 10px; font-weight: 700; }
  .structure-list p { margin: .25rem 0 0; color: var(--ink-2); font-size: 10.5px; }
  .review-notes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .7rem; margin-top: 1rem; }
  .review-notes article { padding: 1rem; border: 1px solid var(--rule); border-left: 3px solid var(--success); border-radius: 0 var(--token-radius-control) var(--token-radius-control) 0; background: var(--raised); }
  .review-notes article.watch { border-left-color: var(--attention); background: color-mix(in srgb, var(--attention-soft) 45%, var(--raised)); }
  .review-notes article.deferred { border-left-color: var(--active); }
  .review-notes article > span { color: var(--success); font-size: 8px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
  .review-notes article.watch > span { color: var(--attention); }
  .review-notes article.deferred > span { color: var(--active); }
  .review-notes h3 { margin: .5rem 0 .25rem; font-size: 11.5px; }
  .review-notes p { margin: 0; color: var(--ink-2); font-size: 10.5px; }
  .related-section { margin-top: 5rem; padding-top: 1.3rem; border-top: 2px solid var(--ink); }
  .related-section > div { display: grid; grid-template-columns: repeat(5, 1fr); gap: .55rem; }
  .related-section a { display: flex; align-items: center; gap: .4rem; min-height: 3rem; padding: .65rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--raised); color: var(--ink-2); font-size: 10px; font-weight: 650; text-decoration: none; }
  .related-section a:hover { border-color: var(--token-color-interactive-border); background: var(--interactive-soft); color: var(--interactive); }
  .related-section a span { color: var(--ink-3); font: 500 8px/1 "IBM Plex Mono", monospace; }
  .related-section a i { margin-left: auto; color: var(--interactive); font-style: normal; }
  .related-section .ledger-link { border-color: var(--token-color-active-border); }
  @media (max-width: 72rem) {
    .mast { grid-template-columns: 1fr; gap: 2rem; }
    .contract { max-width: 37rem; }
    .change-list article { grid-template-columns: 2rem 1fr 1fr; }
    .change-state.old { grid-column: 2; }
    .change-state.now { grid-column: 3; }
    .change-main { grid-column: 2 / -1; }
    .related-section > div { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 60rem) {
    .flow-layout { grid-template-columns: 1fr; }
    .flow-rail { display: grid; grid-template-columns: repeat(3, 1fr); }
    .flow-rail button { border-right: 1px solid var(--rule); }
    .domain-grid { grid-template-columns: 1fr; }
    .procedure-detail { grid-template-columns: 1fr; }
  }
  @media (max-width: 44rem) {
    h1 { font-size: 3.5rem; }
    .jumps { top: 6.4rem; margin-right: -1rem; margin-left: -1rem; padding: 0 1rem; }
    .boundary-grid, .review-notes { grid-template-columns: 1fr; }
    .boundary-grid article { min-height: 0; }
    .change-list article { grid-template-columns: 2rem 1fr; }
    .change-main, .change-state.old, .change-state.now { grid-column: 2; }
    .flow-rail { grid-template-columns: repeat(2, 1fr); }
    .flow-detail > footer { grid-template-columns: 1fr; }
    .flow-detail > footer > div + div { border-top: 1px solid var(--rule); border-left: 0; }
    .procedure-detail { padding-left: 1rem; }
    .procedure-detail dl { grid-template-columns: 1fr; }
    .procedure-detail dl div { border-right: 0; border-bottom: 1px solid var(--rule); }
    .procedure-detail dl div:last-child { border-bottom: 0; }
    .structure-list article { grid-template-columns: 1fr; gap: .45rem; }
    .related-section > div { grid-template-columns: 1fr; }
  }
</style>
