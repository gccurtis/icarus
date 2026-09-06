<script lang="ts">
  import FileLedger from "$development-views/document-editor-reference/components/file-ledger.svelte";
  import ReferenceHeader from "$development-views/document-editor-reference/components/reference-header.svelte";
  import { FILES } from "$development-views/document-editor-reference/procedures/inventory";
  import { AREA_LABELS } from "$development-views/document-editor-reference/procedures/navigation";
  import type { FileRecord } from "$development-views/document-editor-reference/types";
  import "$development-views/document-editor-reference/components/reference.css";

  const formatter = new Intl.NumberFormat("en-US");
  const ownership = Object.entries(AREA_LABELS).map(([slug, label]) => {
    const files = FILES.filter((file) => file.area === slug);
    return {
      slug,
      label,
      files: files.length,
      created: files.filter((file) => file.status === "A").length,
      modified: files.filter((file) => file.status === "M").length,
      deleted: files.filter((file) => file.status === "D").length,
      production: files.filter((file) => file.kind === "production").reduce((sum, file) => sum + file.current, 0),
      total: files.reduce((sum, file) => sum + file.current, 0),
      hotspots: files.filter((file) => file.kind === "production" && file.current >= 300).length
    };
  }).filter((group) => group.files > 0);

  const hotspots = FILES
    .filter((file) => file.kind === "production" && file.current >= 300)
    .sort((a, b) => b.current - a.current);

  const largest = (files: FileRecord[]) => files.slice().sort((a, b) => b.current - a.current)[0];
</script>

<div class="reference-artifact">
  <ReferenceHeader current="ledger" />
  <main class="reference-page">
    <header class="mast">
      <div>
        <a href="/demo/document-editor-reference">← System overview</a>
        <span class="reference-kicker">06 · Locality and bounded complexity</span>
        <h1>File change ledger</h1>
        <p>Every file in the final <code>main</code>-to-worktree delta, classified once by primary ownership and measured with physical line counts.</p>
      </div>
      <aside>
        <span>Measurement contract</span>
        <p>Status and line delta come from Git’s text diff. Current/base LOC are physical newline counts. New files have base 0; deleted files have current 0. Binary files are labeled and excluded from meaningful LOC interpretation.</p>
      </aside>
    </header>

    <section class="reference-section">
      <div class="reference-section-head">
        <div><span class="reference-kicker">Primary ownership</span><h2>Locality by subsystem</h2></div>
        <p>A file is assigned once for totals, even when several systems call it. Cross-references on each subsystem page still name every supporting source used by a procedure.</p>
      </div>
      <div class="ownership-grid">
        {#each ownership as group}
          {@const groupFiles = FILES.filter((file) => file.area === group.slug)}
          {@const largestFile = largest(groupFiles)}
          <article>
            <header><span>{group.label}</span><strong>{group.files} files</strong></header>
            <dl>
              <div><dt>Created</dt><dd>{group.created}</dd></div>
              <div><dt>Modified</dt><dd>{group.modified}</dd></div>
              <div><dt>Deleted</dt><dd>{group.deleted}</dd></div>
              <div><dt>Production LOC</dt><dd>{formatter.format(group.production)}</dd></div>
              <div><dt>All current LOC</dt><dd>{formatter.format(group.total)}</dd></div>
              <div><dt>Hotspots</dt><dd>{group.hotspots}</dd></div>
            </dl>
            {#if largestFile}<footer><span>Largest changed file</span><code>{largestFile.path}</code><b>{formatter.format(largestFile.current)} LOC</b></footer>{/if}
          </article>
        {/each}
      </div>
    </section>

    <section class="reference-section">
      <div class="reference-section-head">
        <div><span class="reference-kicker">Complexity review</span><h2>Production hotspots</h2></div>
        <p>Size is a signal for review, not proof of poor design. The list separates production source from test fixtures and these reference pages, then names the clearest extraction seam.</p>
      </div>
      <div class="hotspot-list">
        {#each hotspots as file, index}
          <article>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><code>{file.path}</code><small>{AREA_LABELS[file.area]}</small></div>
            <strong>{formatter.format(file.current)} LOC</strong>
            <p>
              {file.path.endsWith("document.svelte")
                ? "Composition coordinator; clearest split is editor bridge/controller versus surface presentation."
                : file.path.endsWith("projection.ts")
                  ? "Bidirectional structural projection; split by root/block family while retaining one public mapping contract."
                  : file.path.endsWith("marks.ts")
                    ? "Multi-range mark algebra; candidate split between state summarization and operation construction."
                    : file.path.endsWith("apply-ops.ts")
                      ? "Shared operation engine; split by operation family only behind the one apply/invert facade."
                      : "Review for a cohesive child module before adding more responsibility."}
            </p>
          </article>
        {:else}
          <p class="none">No current production files meet the 300 LOC threshold.</p>
        {/each}
      </div>
    </section>

    <FileLedger
      files={FILES}
      controls={true}
      title="Complete main-to-branch ledger"
      description="Filter by path, change status, file kind, or production hotspot. Totals always describe the full unfiltered delta."
    />

    <section class="method">
      <article><span>01</span><h3>Status</h3><p><b>A</b> means absent on main and present here; <b>M</b> exists on both and differs; <b>D</b> existed on main and is now absent.</p></article>
      <article><span>02</span><h3>Physical LOC</h3><p>Counts newline-delimited physical lines, including comments and whitespace. It is a transparent size measure, not semantic complexity.</p></article>
      <article><span>03</span><h3>Line delta</h3><p>Git numstat additions/deletions describe changed lines, while Base and Now show the whole file size on each side.</p></article>
      <article><span>04</span><h3>Ownership</h3><p>Each path has one primary domain for locality totals. Procedure catalogs name cross-domain dependencies without duplicating counts.</p></article>
      <article><span>05</span><h3>Hotspot</h3><p>A production file at or above 300 physical lines. Tests, fixtures, documentation, and reference artifacts do not trigger this flag.</p></article>
      <article><span>06</span><h3>Refresh point</h3><p>This checked-in snapshot describes the integration branch at review time. Regenerate it whenever implementation files change before merge.</p></article>
    </section>
  </main>
  <footer class="reference-footer">
    <div><a href="/demo/document-editor-reference">System overview</a><a href="/demo/document-editor-review">Original audit</a><a href="/demo/document-editor-implementation-plan">Implementation plan</a><a href="/app/dev-project">Live editor</a></div>
    <span>Branch: <code>work/document-editor-integration</code> · comparison: <code>main</code></span>
  </footer>
</div>

<style>
  code { font-family: "IBM Plex Mono", ui-monospace, monospace; }
  .mast { display: grid; grid-template-columns: minmax(0, 1fr) 25rem; gap: 5rem; align-items: end; }
  .mast a { display: inline-block; margin-bottom: 2.5rem; color: var(--interactive); font-size: 10px; font-weight: 700; text-decoration: none; }
  .mast a:hover { text-decoration: underline; }
  .mast h1 { max-width: 10ch; margin: 0; font-size: clamp(3.5rem, 7vw, 6.7rem); line-height: .88; letter-spacing: -.06em; }
  .mast > div > p { max-width: 65ch; margin: 1.5rem 0 0; color: var(--ink-2); font-size: 1.05rem; }
  .mast > div code { padding: .1rem .3rem; border: 1px solid var(--rule); border-radius: 4px; background: var(--panel); font-size: .85em; }
  .mast aside { padding: 1.2rem; border: 1px solid var(--rule-strong); border-left: 4px solid var(--active); border-radius: 0 var(--token-radius-panel) var(--token-radius-panel) 0; background: var(--raised); }
  .mast aside span { color: var(--active); font-size: 9px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
  .mast aside p { margin: .65rem 0 0; color: var(--ink-2); font-size: 11px; }
  .ownership-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-top: 1.25rem; }
  .ownership-grid article { border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .ownership-grid article > header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding: .9rem 1rem; border-bottom: 1px solid var(--rule); background: var(--panel); }
  .ownership-grid header span { font-size: 12px; font-weight: 700; }
  .ownership-grid header strong { color: var(--active); font: 600 9px/1 "IBM Plex Mono", monospace; }
  .ownership-grid dl { display: grid; grid-template-columns: repeat(3, 1fr); margin: 0; border-bottom: 1px solid var(--rule); }
  .ownership-grid dl div { padding: .65rem 1rem; border-right: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
  .ownership-grid dl div:nth-child(3n) { border-right: 0; }
  .ownership-grid dl div:nth-last-child(-n+3) { border-bottom: 0; }
  .ownership-grid dt { color: var(--ink-3); font-size: 7.5px; font-weight: 700; text-transform: uppercase; }
  .ownership-grid dd { margin: .15rem 0 0; font: 600 10px/1 "IBM Plex Mono", monospace; }
  .ownership-grid footer { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: .6rem; align-items: center; padding: .65rem 1rem; }
  .ownership-grid footer span { color: var(--ink-3); font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .ownership-grid footer code { overflow: hidden; color: var(--ink-2); font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
  .ownership-grid footer b { color: var(--ink-3); font: 600 8px/1 "IBM Plex Mono", monospace; }
  .hotspot-list { margin-top: 1.25rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .hotspot-list article { display: grid; grid-template-columns: 2.5rem minmax(20rem, .8fr) 7rem minmax(20rem, 1fr); gap: 1rem; align-items: center; padding: 1rem; border-bottom: 1px solid var(--rule); }
  .hotspot-list article:last-child { border-bottom: 0; }
  .hotspot-list article > span { color: var(--attention); font: 600 9px/1 "IBM Plex Mono", monospace; }
  .hotspot-list code { display: block; color: var(--ink); font-size: 9px; overflow-wrap: anywhere; }
  .hotspot-list small { display: block; margin-top: .25rem; color: var(--ink-3); font-size: 8px; }
  .hotspot-list strong { padding: .35rem .5rem; border-radius: 4px; background: var(--attention-soft); color: var(--attention); font: 650 10px/1 "IBM Plex Mono", monospace; text-align: center; }
  .hotspot-list p, .none { margin: 0; color: var(--ink-2); font-size: 10.5px; }
  .none { padding: 2rem; text-align: center; }
  .method { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin-top: 4rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--rule); overflow: hidden; }
  .method article { min-height: 10rem; padding: 1rem; background: var(--raised); }
  .method article > span { color: var(--active); font: 600 9px/1 "IBM Plex Mono", monospace; }
  .method h3 { margin: 1rem 0 .4rem; font-size: 1rem; }
  .method p { margin: 0; color: var(--ink-2); font-size: 10.5px; }
  @media (max-width: 72rem) {
    .mast { grid-template-columns: 1fr; gap: 2rem; }
    .mast aside { max-width: 35rem; }
    .hotspot-list article { grid-template-columns: 2rem 1fr 6rem; }
    .hotspot-list article p { grid-column: 2 / -1; }
  }
  @media (max-width: 56rem) {
    .ownership-grid { grid-template-columns: 1fr; }
    .method { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 40rem) {
    .mast h1 { font-size: 3.5rem; }
    .hotspot-list article { grid-template-columns: 2rem 1fr; }
    .hotspot-list article > strong, .hotspot-list article p { grid-column: 2; justify-self: start; }
    .method { grid-template-columns: 1fr; }
  }
</style>
