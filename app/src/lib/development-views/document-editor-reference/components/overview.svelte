<script lang="ts">
  import { FILES } from "$development-views/document-editor-reference/procedures/inventory";
  import { AREA_LABELS, REFERENCE_NAV } from "$development-views/document-editor-reference/procedures/navigation";
  import { backendReference } from "$development-views/document-editor-reference/procedures/backend";
  import { contentReference } from "$development-views/document-editor-reference/procedures/content";
  import { contextReference } from "$development-views/document-editor-reference/procedures/context";
  import { inspectorReference } from "$development-views/document-editor-reference/procedures/inspector";
  import { runtimeReference } from "$development-views/document-editor-reference/procedures/runtime";
  import ReferenceHeader from "$development-views/document-editor-reference/components/reference-header.svelte";
  import "$development-views/document-editor-reference/components/reference.css";

  const areas = [contextReference, inspectorReference, contentReference, runtimeReference, backendReference];
  const formatter = new Intl.NumberFormat("en-US");
  const totals = {
    files: FILES.length,
    created: FILES.filter((file) => file.status === "A").length,
    modified: FILES.filter((file) => file.status === "M").length,
    deleted: FILES.filter((file) => file.status === "D").length,
    current: FILES.reduce((sum, file) => sum + file.current, 0),
    added: FILES.reduce((sum, file) => sum + file.added, 0),
    removed: FILES.reduce((sum, file) => sum + file.deleted, 0),
    hotspots: FILES.filter((file) => file.kind === "production" && file.current >= 300).length
  };

  const principles = [
    ["01", "One live body", "Context, Inspector, and Content share one per-resource runtime body."],
    ["02", "Projection is not storage", "ProseMirror JSON, page geometry, and zoom never become persisted document data."],
    ["03", "One operation language", "Optimistic client apply and canonical server acceptance use the same immutable applier."],
    ["04", "Structural identity", "Selections, marks, links, comments, and furniture refer to stable IDs and offsets."],
    ["05", "Gesture history", "Undo follows user intent; wire coalescing is only a transport concern."],
    ["06", "Visible failure", "Refused or offline work remains present with retry and explicit discard paths."],
    ["07", "Shared instruments", "Inspector lenses compose responsive controls instead of owning private variants."],
    ["08", "Derived layout", "Pagination, repeated furniture, annotation pins, and fit zoom are recalculable projections."]
  ] as const;

  const systemFlow = [
    { index: "A", name: "Context", role: "Document-wide intent", detail: "Navigate, find, styles, layout, comments" },
    { index: "B", name: "Inspector", role: "Subject-specific intent", detail: "Marks, body style, links, threads, objects" },
    { index: "C", name: "Content", role: "Editing adapter", detail: "Projection, gestures, translation, selection" },
    { index: "D", name: "Runtime", role: "Live client authority", detail: "Optimism, history, buffer, rebase, recovery" },
    { index: "E", name: "Backend", role: "Canonical authority", detail: "Scope, validate, apply, shift anchors, persist" }
  ] as const;

  const reviewOrder = [
    ["Start here", "Read the contracts and eight invariants before looking at individual files."],
    ["Review surfaces", "Context → Inspector → Content explains intent, controls, and editing projection."],
    ["Trace execution", "Runtime → Backend follows one change from optimistic application through canonical acceptance."],
    ["Audit locality", "Use the ledger filters to isolate production, tests, ownership, status, and ≥300 LOC hotspots."],
    ["Verify behavior", "Open the live Winter readiness brief and use the linked audit, plan, and control reference as acceptance context."]
  ] as const;
</script>

<div class="reference-artifact">
  <ReferenceHeader current="overview" />
  <main class="reference-page">
    <header class="mast">
      <div>
        <a class="back" href="/demo">← All demos</a>
        <span class="reference-kicker">Document editor · implemented system</span>
        <h1>Architecture you can inspect.</h1>
        <p>
          A complete reference to the integrated editor: ownership, behavior, state machines,
          execution paths, source topology, and a measured <code>main</code>-to-branch file ledger.
        </p>
      </div>
      <aside class="snapshot">
        <span>Review snapshot</span>
        <strong>Integrated</strong>
        <p>Branch rebuilt from <code>main</code>; donor behavior was selectively adopted, repaired, recomposed, or replaced.</p>
        <dl>
          <div><dt>Changed files</dt><dd>{totals.files}</dd></div>
          <div><dt>Created / modified</dt><dd>{totals.created} / {totals.modified}</dd></div>
          <div><dt>Deleted</dt><dd>{totals.deleted}</dd></div>
          <div><dt>Changed-file LOC</dt><dd>{formatter.format(totals.current)}</dd></div>
          <div><dt>Line delta</dt><dd><b>+{formatter.format(totals.added)}</b> / <i>−{formatter.format(totals.removed)}</i></dd></div>
          <div><dt>Production hotspots</dt><dd>{totals.hotspots}</dd></div>
        </dl>
      </aside>
    </header>

    <section class="orientation">
      <div>
        <span class="reference-kicker">What this suite answers</span>
        <h2>Five bounded systems. One editing path.</h2>
      </div>
      <p>
        Each page is both functional documentation and a change review. It distinguishes durable domain
        state from ephemeral UI state, names every procedure boundary, records failure behavior, and ends
        with the exact files and physical line counts primarily owned by that area.
      </p>
    </section>

    <section class="area-grid" aria-label="Subsystem reference pages">
      {#each areas as area}
        {@const href = REFERENCE_NAV.find((item) => item.slug === area.slug)?.href}
        {@const files = FILES.filter((file) => file.area === area.slug)}
        {@const loc = files.filter((file) => file.kind === "production").reduce((sum, file) => sum + file.current, 0)}
        {@const hotspots = files.filter((file) => file.kind === "production" && file.current >= 300).length}
        <a href={href}>
          <header><span>{area.index}</span><em>{area.eyebrow}</em></header>
          <h2>{area.title}</h2>
          <p>{area.summary}</p>
          <dl>
            <div><dt>Flows</dt><dd>{area.flows.length}</dd></div>
            <div><dt>Domains</dt><dd>{area.domains.length}</dd></div>
            <div><dt>Primary files</dt><dd>{files.length}</dd></div>
            <div><dt>Production LOC</dt><dd>{formatter.format(loc)}</dd></div>
          </dl>
          <footer><span>{hotspots} production hotspot{hotspots === 1 ? "" : "s"}</span><b>Open reference →</b></footer>
        </a>
      {/each}
    </section>

    <section class="reference-section">
      <div class="reference-section-head">
        <div><span class="reference-kicker">System flow</span><h2>From intent to canonical state</h2></div>
        <p>Context and Inspector originate commands; Content also originates direct editing transactions. All durable document paths converge at Runtime and the same shared representation before the Backend advances revision.</p>
      </div>
      <div class="system-map" aria-label="Document editor system flow">
        <div class="intent-pair">
          {#each systemFlow.slice(0, 2) as node}
            <article><span>{node.index}</span><small>{node.role}</small><h3>{node.name}</h3><p>{node.detail}</p></article>
          {/each}
        </div>
        <i aria-hidden="true">↘<br />↗</i>
        {#each systemFlow.slice(2) as node, index}
          <article class:authority={node.name === "Runtime" || node.name === "Backend"}>
            <span>{node.index}</span><small>{node.role}</small><h3>{node.name}</h3><p>{node.detail}</p>
          </article>
          {#if index < 2}<i aria-hidden="true">→</i>{/if}
        {/each}
      </div>
      <div class="return-path"><span>Canonical return path</span><p>Backend acceptance/catch-up → Runtime body and revision → Content projection → structural selection → Context and Inspector projections</p></div>
    </section>

    <section class="reference-section">
      <div class="reference-section-head">
        <div><span class="reference-kicker">Architecture guardrails</span><h2>Rules the implementation preserves</h2></div>
        <p>These are cross-area invariants. A future change that violates one needs an explicit architecture decision, not an incidental convenience.</p>
      </div>
      <div class="principle-grid">
        {#each principles as principle}
          <article><span>{principle[0]}</span><div><h3>{principle[1]}</h3><p>{principle[2]}</p></div></article>
        {/each}
      </div>
    </section>

    <section class="reference-section">
      <div class="reference-section-head">
        <div><span class="reference-kicker">Review route</span><h2>How to inspect the change</h2></div>
        <p>The suite is ordered from contract to evidence. You can review behavior first, then use the final ledger to challenge locality and complexity.</p>
      </div>
      <ol class="review-order">
        {#each reviewOrder as item, index}
          <li><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item[0]}</h3><p>{item[1]}</p></div></li>
        {/each}
      </ol>
      <div class="ledger-callout">
        <div><span class="reference-kicker">Measured, not estimated</span><h2>Every file. Base LOC. Current LOC. Delta.</h2><p>The master ledger is generated from the actual worktree comparison with <code>main</code>. New, modified, and deleted files are explicit; primary ownership prevents double-counting.</p></div>
        <a href="/demo/document-editor-reference/ledger">Open the file ledger <span aria-hidden="true">→</span></a>
      </div>
    </section>
  </main>

  <footer class="reference-footer">
    <div><a href="/demo/document-editor-review">Original audit</a><a href="/demo/document-editor-implementation-plan">Implementation plan</a><a href="/demo/document-editor-controls">Control reference</a><a href="/app/dev-project">Live editor</a></div>
    <span>Branch: <code>work/document-editor-integration</code> · comparison: <code>main</code></span>
  </footer>
</div>

<style>
  .mast { display: grid; grid-template-columns: minmax(0, 1fr) 25rem; gap: 5rem; align-items: end; }
  .back { display: inline-block; margin-bottom: 2.5rem; color: var(--interactive); font-size: 10px; font-weight: 700; text-decoration: none; }
  .back:hover { text-decoration: underline; }
  .mast h1 { max-width: 12ch; margin: 0; font-size: clamp(4rem, 8vw, 7.7rem); line-height: .85; letter-spacing: -.065em; }
  .mast > div > p { max-width: 63ch; margin: 1.65rem 0 0; color: var(--ink-2); font-size: 1.08rem; }
  code { padding: .1rem .3rem; border: 1px solid var(--rule); border-radius: 4px; background: var(--panel); font: 500 .84em/1.2 "IBM Plex Mono", monospace; }
  .snapshot { border: 1px solid var(--rule-strong); border-top: 4px solid var(--success); border-radius: 0 0 var(--token-radius-panel) var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .snapshot > span { display: block; padding: .65rem 1rem; background: var(--success-soft); color: var(--success); font-size: 9px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
  .snapshot > strong { display: block; padding: 1rem 1rem 0; font-size: 2rem; line-height: 1; }
  .snapshot > p { margin: 0; padding: .55rem 1rem 1rem; color: var(--ink-2); font-size: 11px; }
  .snapshot dl { display: grid; grid-template-columns: repeat(2, 1fr); margin: 0; border-top: 1px solid var(--rule); }
  .snapshot dl div { padding: .7rem 1rem; border-right: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
  .snapshot dl div:nth-child(even) { border-right: 0; }
  .snapshot dl div:nth-last-child(-n+2) { border-bottom: 0; }
  .snapshot dt { color: var(--ink-3); font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .snapshot dd { margin: .25rem 0 0; font: 650 11px/1.2 "IBM Plex Mono", monospace; }
  .snapshot dd b { color: var(--success); font-weight: inherit; }
  .snapshot dd i { color: var(--danger); font-style: normal; }
  .orientation { display: grid; grid-template-columns: minmax(20rem, .72fr) minmax(24rem, 1fr); gap: 4rem; align-items: end; margin-top: 6rem; padding-bottom: 1.2rem; border-bottom: 2px solid var(--ink); }
  .orientation h2 { max-width: 17ch; margin: 0; font-size: clamp(2.1rem, 4vw, 3.6rem); line-height: .95; letter-spacing: -.045em; }
  .orientation > p { margin: 0; color: var(--ink-2); font-size: 13px; }
  .area-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; margin-top: 1.25rem; }
  .area-grid > a { display: flex; min-height: 24rem; flex-direction: column; grid-column: span 2; padding: 1.2rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); color: inherit; text-decoration: none; transition: border-color .15s ease, transform .15s ease; }
  .area-grid > a:nth-child(4) { grid-column: 2 / span 2; }
  .area-grid > a:hover { border-color: var(--token-color-interactive-border); transform: translateY(-2px); }
  .area-grid header { display: flex; justify-content: space-between; gap: 1rem; color: var(--ink-3); }
  .area-grid header span { color: var(--active); font: 600 9px/1.3 "IBM Plex Mono", monospace; }
  .area-grid header em { font-size: 8px; font-style: normal; font-weight: 700; letter-spacing: .07em; text-align: right; text-transform: uppercase; }
  .area-grid h2 { margin: 1.5rem 0 .6rem; font-size: 1.7rem; letter-spacing: -.035em; }
  .area-grid > a > p { margin: 0; color: var(--ink-2); font-size: 11.5px; }
  .area-grid dl { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; margin: auto 0 0; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--rule); overflow: hidden; }
  .area-grid dl div { padding: .55rem; background: var(--panel); }
  .area-grid dt { color: var(--ink-3); font-size: 7.5px; font-weight: 700; text-transform: uppercase; }
  .area-grid dd { margin: .15rem 0 0; font: 600 10px/1 "IBM Plex Mono", monospace; }
  .area-grid footer { display: flex; justify-content: space-between; gap: .5rem; margin-top: .7rem; color: var(--ink-3); font-size: 8.5px; }
  .area-grid footer b { color: var(--interactive); }
  .system-map { display: grid; grid-template-columns: 1.15fr auto 1fr auto 1fr auto 1fr; gap: .7rem; align-items: stretch; margin-top: 1.25rem; padding: 1rem; border: 1px solid var(--rule-strong); border-radius: var(--token-radius-panel); background: var(--work); }
  .system-map article { min-width: 0; padding: 1rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--raised); }
  .system-map article.authority { border-color: var(--token-color-active-border); background: var(--active-soft); }
  .system-map .intent-pair { display: grid; gap: .6rem; }
  .system-map article > span { float: right; color: var(--active); font: 600 9px/1 "IBM Plex Mono", monospace; }
  .system-map small { color: var(--ink-3); font-size: 7.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
  .system-map h3 { margin: .55rem 0 .35rem; font-size: 1rem; }
  .system-map p { margin: 0; color: var(--ink-2); font-size: 9.5px; }
  .system-map > i { align-self: center; color: var(--active); font-style: normal; text-align: center; }
  .return-path { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; margin-top: .6rem; padding: .7rem 1rem; border: 1px solid var(--token-color-success-border); border-radius: var(--token-radius-control); background: var(--success-soft); }
  .return-path span { color: var(--success); font-size: 8px; font-weight: 750; letter-spacing: .1em; text-transform: uppercase; }
  .return-path p { margin: 0; color: var(--ink-2); font-size: 10px; }
  .principle-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; margin-top: 1.25rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--rule); overflow: hidden; }
  .principle-grid article { display: grid; grid-template-columns: 2.5rem 1fr; gap: .7rem; min-height: 7rem; padding: 1rem; background: var(--raised); }
  .principle-grid article > span { color: var(--active); font: 600 9px/1.4 "IBM Plex Mono", monospace; }
  .principle-grid h3 { margin: 0 0 .35rem; font-size: 1rem; }
  .principle-grid p { margin: 0; color: var(--ink-2); font-size: 11px; }
  .review-order { margin: 1.25rem 0 0; padding: 0; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); list-style: none; overflow: hidden; }
  .review-order li { display: grid; grid-template-columns: 3rem 13rem 1fr; gap: .7rem; align-items: baseline; padding: .9rem 1rem; border-bottom: 1px solid var(--rule); }
  .review-order li:last-child { border-bottom: 0; }
  .review-order li > span { color: var(--active); font: 600 9px/1 "IBM Plex Mono", monospace; }
  .review-order h3 { display: inline; margin: 0; font-size: 11px; }
  .review-order p { display: inline; margin: 0; color: var(--ink-2); font-size: 11px; }
  .ledger-callout { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3rem; align-items: end; margin-top: 1rem; padding: 1.5rem; border-radius: var(--token-radius-panel); background: var(--ink); color: var(--token-ink-on-fill); }
  .ledger-callout h2 { margin: 0; font-size: 1.7rem; letter-spacing: -.03em; }
  .ledger-callout p { max-width: 75ch; margin: .6rem 0 0; color: var(--token-ink-on-fill); font-size: 11px; }
  .ledger-callout .reference-kicker { color: var(--token-color-accent-1-on-fill); }
  .ledger-callout code { border-color: color-mix(in srgb, var(--token-ink-on-fill) 25%, transparent); background: transparent; }
  .ledger-callout a { display: flex; gap: 1rem; padding: .75rem 1rem; border: 1px solid color-mix(in srgb, var(--token-ink-on-fill) 30%, transparent); border-radius: var(--token-radius-control); color: var(--token-color-interactive-on-fill); font-size: 11px; font-weight: 700; text-decoration: none; white-space: nowrap; }
  .ledger-callout a:hover { background: color-mix(in srgb, var(--token-ink-on-fill) 10%, transparent); }
  @media (max-width: 72rem) {
    .mast { grid-template-columns: 1fr; gap: 2rem; }
    .snapshot { max-width: 35rem; }
    .area-grid { grid-template-columns: repeat(2, 1fr); }
    .area-grid > a, .area-grid > a:nth-child(4) { grid-column: auto; }
    .area-grid > a:last-child { grid-column: 1 / -1; min-height: 18rem; }
    .system-map { grid-template-columns: 1fr; }
    .system-map .intent-pair { grid-template-columns: repeat(2, 1fr); }
    .system-map > i { transform: rotate(90deg); }
  }
  @media (max-width: 60rem) {
    .orientation { grid-template-columns: 1fr; gap: 1rem; }
    .ledger-callout { grid-template-columns: 1fr; gap: 1.5rem; }
    .ledger-callout a { justify-self: start; }
  }
  @media (max-width: 44rem) {
    .mast h1 { font-size: 4rem; }
    .area-grid, .principle-grid { grid-template-columns: 1fr; }
    .area-grid > a:last-child { grid-column: auto; }
    .review-order li { grid-template-columns: 2rem 1fr; }
    .review-order li div { display: grid; gap: .2rem; }
    .system-map .intent-pair { grid-template-columns: 1fr; }
    .return-path { grid-template-columns: 1fr; gap: .35rem; }
  }
</style>
