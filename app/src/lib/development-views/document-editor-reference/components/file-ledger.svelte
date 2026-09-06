<script lang="ts">
  import { AREA_LABELS } from "$development-views/document-editor-reference/procedures/navigation";
  import type { FileKind, FileRecord } from "$development-views/document-editor-reference/types";

  let {
    files,
    title = "Change ledger",
    description = "Measured against main. Primary ownership prevents cross-cutting files from being counted twice.",
    controls = false
  }: {
    files: FileRecord[];
    title?: string;
    description?: string;
    controls?: boolean;
  } = $props();

  let query = $state("");
  let status = $state<"all" | "A" | "M" | "D">("all");
  let kind = $state<"all" | FileKind>("all");
  let hotspotsOnly = $state(false);

  const shown = $derived(
    files.filter((file) => {
      const matchesQuery = file.path.toLowerCase().includes(query.trim().toLowerCase());
      const matchesStatus = status === "all" || file.status === status;
      const matchesKind = kind === "all" || file.kind === kind;
      const matchesHotspot = !hotspotsOnly || (file.kind === "production" && file.current >= 300);
      return matchesQuery && matchesStatus && matchesKind && matchesHotspot;
    })
  );

  const totals = $derived({
    files: files.length,
    added: files.filter((file) => file.status === "A").length,
    modified: files.filter((file) => file.status === "M").length,
    deleted: files.filter((file) => file.status === "D").length,
    current: files.reduce((sum, file) => sum + file.current, 0),
    insertions: files.reduce((sum, file) => sum + file.added, 0),
    deletions: files.reduce((sum, file) => sum + file.deleted, 0),
    hotspots: files.filter((file) => file.kind === "production" && file.current >= 300).length
  });

  const compact = new Intl.NumberFormat("en-US");
</script>

<section class="ledger" aria-labelledby="ledger-title">
  <header>
    <div>
      <span class="kicker">Measured evidence</span>
      <h2 id="ledger-title">{title}</h2>
      <p>{description}</p>
    </div>
    <dl>
      <div><dt>Files</dt><dd>{totals.files}</dd></div>
      <div><dt>Created</dt><dd>{totals.added}</dd></div>
      <div><dt>Modified</dt><dd>{totals.modified}</dd></div>
      <div><dt>Deleted</dt><dd>{totals.deleted}</dd></div>
      <div><dt>Current LOC</dt><dd>{compact.format(totals.current)}</dd></div>
      <div class:attention={totals.hotspots > 0}><dt>≥300 LOC</dt><dd>{totals.hotspots}</dd></div>
    </dl>
  </header>

  {#if controls}
    <div class="filters" aria-label="File filters">
      <label>
        <span>Find a path</span>
        <input bind:value={query} type="search" placeholder="e.g. projection or comments" />
      </label>
      <label>
        <span>Status</span>
        <select bind:value={status}>
          <option value="all">All statuses</option>
          <option value="A">Created</option>
          <option value="M">Modified</option>
          <option value="D">Deleted</option>
        </select>
      </label>
      <label>
        <span>Kind</span>
        <select bind:value={kind}>
          <option value="all">All kinds</option>
          <option value="production">Production</option>
          <option value="test">Test</option>
          <option value="fixture">Fixture</option>
          <option value="documentation">Documentation</option>
          <option value="reference">Reference</option>
          <option value="configuration">Configuration</option>
        </select>
      </label>
      <label class="check"><input bind:checked={hotspotsOnly} type="checkbox" /><span>Production hotspots only</span></label>
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_tabindex (keyboard scrolling for a deliberately overflowed data table) -->
  <div class="table-wrap" role="region" tabindex="0" aria-label="Scrollable file change table">
    <table>
      <thead>
        <tr>
          <th scope="col">Δ</th>
          <th scope="col">File</th>
          <th scope="col">Owner</th>
          <th scope="col">Kind</th>
          <th scope="col" class="number">Base</th>
          <th scope="col" class="number">Now</th>
          <th scope="col" class="number">+ / −</th>
        </tr>
      </thead>
      <tbody>
        {#each shown as file (file.path)}
          <tr class:hotspot={file.kind === "production" && file.current >= 300}>
            <td><span class:added={file.status === "A"} class:modified={file.status === "M"} class:removed={file.status === "D"} class="status">{file.status}</span></td>
            <td class="path"><code>{file.path}</code>{#if file.binary}<small>binary</small>{/if}</td>
            <td>{AREA_LABELS[file.area]}</td>
            <td><span class="kind">{file.kind}</span></td>
            <td class="number">{compact.format(file.base)}</td>
            <td class="number"><strong>{compact.format(file.current)}</strong></td>
            <td class="number delta"><span>+{compact.format(file.added)}</span> <i>−{compact.format(file.deleted)}</i></td>
          </tr>
        {:else}
          <tr><td colspan="7" class="empty">No files match these filters.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  <footer>
    <span>Showing {shown.length} of {files.length} files</span>
    <span><b>+{compact.format(totals.insertions)}</b> / <i>−{compact.format(totals.deletions)}</i> changed lines</span>
    <span>Hotspot means a current production file at or above 300 physical lines—not a defect by itself.</span>
  </footer>
</section>

<style>
  .ledger { margin-top: 5rem; }
  .ledger > header { display: grid; grid-template-columns: minmax(20rem, .8fr) minmax(32rem, 1.2fr); gap: 3rem; align-items: end; padding-bottom: 1rem; border-bottom: 2px solid var(--token-ink-primary); }
  .kicker { display: block; margin-bottom: .55rem; color: var(--token-color-accent-1-text); font-size: 9px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }
  h2 { margin: 0; font-size: clamp(1.8rem, 3vw, 2.8rem); line-height: 1; letter-spacing: -.035em; }
  header p { max-width: 62ch; margin: .65rem 0 0; color: var(--token-ink-secondary); font-size: 12px; }
  dl { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); margin: 0; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-border-subtle); gap: 1px; overflow: hidden; }
  dl div { min-width: 0; padding: .65rem .55rem; background: var(--token-surface-elevated); }
  dl div.attention { box-shadow: inset 0 3px 0 var(--token-color-attention-text); background: var(--token-color-attention-surface); }
  dt { overflow: hidden; color: var(--token-ink-muted); font-size: 8px; font-weight: 700; letter-spacing: .07em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
  dd { margin: .18rem 0 0; font: 650 1rem/1 "IBM Plex Mono", ui-monospace, monospace; }
  .filters { display: grid; grid-template-columns: minmax(14rem, 1fr) 10rem 11rem auto; gap: .65rem; align-items: end; margin-top: 1rem; padding: .8rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .filters label { display: grid; gap: .25rem; min-width: 0; }
  .filters label > span { color: var(--token-ink-muted); font-size: 9px; font-weight: 700; }
  input, select { width: 100%; min-width: 0; height: 2rem; padding: 0 .55rem; border: 1px solid var(--token-border-strong); border-radius: var(--token-radius-control); background: var(--token-surface-elevated); color: var(--token-ink-primary); font: inherit; font-size: 11px; }
  .filters .check { display: flex; min-height: 2rem; align-items: center; gap: .45rem; padding: 0 .55rem; border: 1px solid var(--token-border-strong); border-radius: var(--token-radius-control); background: var(--token-surface-elevated); }
  .check input { width: auto; height: auto; accent-color: var(--token-color-active-text); }
  .check span { color: var(--token-ink-secondary) !important; white-space: nowrap; }
  .table-wrap { margin-top: 1rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-elevated); overflow: auto; }
  .table-wrap:focus-visible { outline: 2px solid var(--token-color-active-text); outline-offset: 2px; }
  table { width: 100%; min-width: 63rem; border-collapse: collapse; font-size: 10.5px; }
  th { position: sticky; top: 0; z-index: 1; padding: .6rem .7rem; border-bottom: 1px solid var(--token-border-strong); background: var(--token-surface-panel); color: var(--token-ink-muted); font-size: 8px; letter-spacing: .09em; text-align: left; text-transform: uppercase; }
  td { padding: .58rem .7rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-ink-secondary); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: 0; }
  tbody tr:hover td { background: var(--token-surface-panel); }
  tr.hotspot td { background: color-mix(in srgb, var(--token-color-attention-surface) 50%, transparent); }
  .number { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .path { min-width: 23rem; }
  code { color: var(--token-ink-primary); font: 500 9.5px/1.35 "IBM Plex Mono", ui-monospace, monospace; overflow-wrap: anywhere; }
  .path small { margin-left: .4rem; color: var(--token-color-attention-text); font-size: 8px; text-transform: uppercase; }
  .status { display: inline-grid; width: 1.35rem; height: 1.35rem; place-items: center; border-radius: 4px; font: 750 9px/1 "IBM Plex Mono", monospace; }
  .status.added { background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .status.modified { background: var(--token-color-active-surface); color: var(--token-color-active-text); }
  .status.removed { background: var(--token-color-danger-surface); color: var(--token-color-danger-text); }
  .kind { display: inline-block; padding: .14rem .35rem; border: 1px solid var(--token-border-subtle); border-radius: 99px; color: var(--token-ink-muted); font-size: 8px; text-transform: uppercase; }
  .delta span, footer b { color: var(--token-color-success-text); font-style: normal; }
  .delta i, footer i { color: var(--token-color-danger-text); font-style: normal; }
  .empty { padding: 2rem; color: var(--token-ink-muted); text-align: center; }
  footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .8rem 1.5rem; padding: .7rem .1rem 0; color: var(--token-ink-muted); font-size: 9px; }
  footer b { font-weight: 650; }
  @media (max-width: 66rem) {
    .ledger > header { grid-template-columns: 1fr; gap: 1.2rem; }
    .filters { grid-template-columns: 1fr 1fr; }
    .filters label:first-child { grid-column: 1 / -1; }
  }
  @media (max-width: 40rem) {
    dl { grid-template-columns: repeat(3, 1fr); }
    .filters { grid-template-columns: 1fr; }
    .filters label:first-child { grid-column: auto; }
  }
</style>
