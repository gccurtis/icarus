<script lang="ts">
  import { FILES } from "$development-views/template-reference/procedures/inventory";
  import type { Area, FileRecord } from "$development-views/template-reference/types";

  const AREAS: { area: Area; label: string }[] = [
    { area: "vocabulary", label: "Vocabulary" },
    { area: "templates", label: "Templates capability" },
    { area: "sets", label: "Resource sets" },
    { area: "neighbours", label: "Neighbouring capabilities" },
    { area: "editors", label: "Editor panels" },
    { area: "library", label: "Library and inspector" },
    { area: "contexts", label: "Retired Contexts panel" },
    { area: "evidence", label: "Seed and browser evidence" },
    { area: "reference", label: "These pages" },
    { area: "documentation", label: "Written documentation" },
    { area: "cross-cutting", label: "Tooling" }
  ];

  let area = $state<Area | "all">("all");

  const inApp = (file: FileRecord) => file.path.startsWith("app/");
  const app = FILES.filter(inApp);
  const shown = $derived(area === "all" ? FILES : FILES.filter((file) => file.area === area));
  const widest = $derived(Math.max(1, ...shown.map((file) => file.added + file.deleted)));

  const counts = (rows: FileRecord[]) => ({
    files: rows.length,
    made: rows.filter((row) => row.status === "A").length,
    changed: rows.filter((row) => row.status === "M").length,
    added: rows.reduce((sum, row) => sum + row.added, 0),
    deleted: rows.reduce((sum, row) => sum + row.deleted, 0)
  });

  const total = counts(app);
  const here = $derived(counts(shown));
</script>

<div class="ledger">
  <div class="summary">
    <div><dt>Files under app/</dt><dd>{total.files}</dd></div>
    <div><dt>Created</dt><dd>{total.made}</dd></div>
    <div><dt>Changed</dt><dd>{total.changed}</dd></div>
    <div><dt>Lines added</dt><dd>+{total.added.toLocaleString()}</dd></div>
    <div><dt>Lines removed</dt><dd>−{total.deleted.toLocaleString()}</dd></div>
  </div>

  <div class="filters" role="group" aria-label="Filter the ledger by area">
    <button type="button" class:on={area === "all"} onclick={() => (area = "all")}>
      Everything <span>{FILES.length}</span>
    </button>
    {#each AREAS as entry (entry.area)}
      {@const rows = FILES.filter((file) => file.area === entry.area)}
      {#if rows.length > 0}
        <button type="button" class:on={area === entry.area} onclick={() => (area = entry.area)}>
          {entry.label} <span>{rows.length}</span>
        </button>
      {/if}
    {/each}
  </div>

  <p class="showing">
    Showing {here.files} of {FILES.length} — {here.made} created, {here.changed} changed,
    <b class="add">+{here.added.toLocaleString()}</b> / <b class="del">−{here.deleted.toLocaleString()}</b> lines.
  </p>

  <div class="scroll">
    <table>
      <thead>
        <tr><th>File</th><th>Area</th><th>Kind</th><th class="num">Lines</th><th class="num">+</th><th class="num">−</th><th>Change</th></tr>
      </thead>
      <tbody>
        {#each shown as file (file.path)}
          <tr>
            <td class="path">{file.path.replace(/^app\//, "")}</td>
            <td class="muted">{AREAS.find((entry) => entry.area === file.area)?.label ?? file.area}</td>
            <td class="muted">{file.kind}</td>
            <td class="num">{file.current.toLocaleString()}</td>
            <td class="num add">{file.added > 0 ? `+${file.added}` : "—"}</td>
            <td class="num del">{file.deleted > 0 ? `−${file.deleted}` : "—"}</td>
            <td>
              <span class="bar">
                <i class="add" style={`width: ${Math.max(2, (file.added / widest) * 120)}px`}></i>
                <i class="del" style={`width: ${Math.max(file.deleted === 0 ? 0 : 2, (file.deleted / widest) * 120)}px`}></i>
                <em>{file.status === "A" ? "new" : "changed"}</em>
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .ledger { display: grid; gap: 1.2rem; margin-top: 2rem; }

  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 1px; border: 1px solid var(--token-border-subtle); background: var(--token-border-subtle); }
  .summary div { display: grid; gap: .2rem; padding: .8rem 1rem; background: var(--token-surface-panel); }
  .summary dt { color: var(--token-ink-muted); font-size: 9.5px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
  .summary dd { margin: 0; font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 20px; font-weight: 600; letter-spacing: -.02em; }

  .filters { display: flex; flex-wrap: wrap; gap: .35rem; }

  .filters button {
    padding: .25rem .6rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 999px;
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    font-size: 11px;
    font-weight: 650;
    cursor: pointer;
  }

  .filters button span { color: var(--token-ink-muted); font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 10px; }
  .filters button:hover { border-color: var(--token-border-strong); color: var(--token-ink-primary); }
  .filters button.on { border-color: var(--token-color-active-text); background: var(--token-color-active-surface); color: var(--token-color-active-text); }
  .filters button.on span { color: inherit; }

  .showing { margin: 0; color: var(--token-ink-secondary); font-size: 12.5px; }

  .scroll { overflow-x: auto; }

  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: .45rem .7rem; border-bottom: 1px solid var(--token-border-subtle); text-align: left; white-space: nowrap; }
  th { color: var(--token-ink-muted); font-size: 9.5px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
  .path { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11px; }
  .muted { color: var(--token-ink-muted); }
  .num { font-family: "IBM Plex Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; text-align: right; }
  .add { color: var(--token-color-success-text); }
  .del { color: var(--token-color-danger-text); }

  .bar { display: flex; align-items: center; gap: .25rem; }
  .bar i { display: block; height: 7px; border-radius: 2px; }
  .bar i.add { background: var(--token-color-success-text); }
  .bar i.del { background: var(--token-color-danger-text); }
  .bar em { color: var(--token-ink-muted); font-size: 10px; font-style: normal; }
</style>
