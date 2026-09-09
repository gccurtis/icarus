<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import Bot from "@lucide/svelte/icons/bot";
  import Braces from "@lucide/svelte/icons/braces";
  import Download from "@lucide/svelte/icons/download";
  import FileImage from "@lucide/svelte/icons/file-image";
  import FileText from "@lucide/svelte/icons/file-text";
  import Files from "@lucide/svelte/icons/files";
  import FolderUp from "@lucide/svelte/icons/folder-up";
  import House from "@lucide/svelte/icons/house";
  import Info from "@lucide/svelte/icons/info";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import LockKeyhole from "@lucide/svelte/icons/lock-keyhole";
  import PanelRight from "@lucide/svelte/icons/panel-right";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Search from "@lucide/svelte/icons/search";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Table2 from "@lucide/svelte/icons/table-2";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Upload from "@lucide/svelte/icons/upload";

  type ContextView = "overview" | "activity" | "policy";
  type SemanticFilter = "all" | "current" | "queued" | "limited";

  const FILES = [
    {
      id: "externalFiles:quarterly-revenue",
      originalName: "quarterly-revenue.csv",
      path: "imports/finance/quarterly-revenue.csv",
      media: "text/csv",
      type: "CSV",
      size: "84.2 KB",
      hash: "b473c8…9e12",
      updated: "12 min ago",
      semantic: "Summary ready",
      semanticTone: "current" as const,
      summary: "Quarterly revenue by region. West leads at $1.42M and shows the strongest quarter-over-quarter growth; South is the only region below plan.",
      provenance: "Generated from a sampled CSV profile · 5 rows / 4 columns",
      uncertainty: "Complete profile for this small file; monetary units inferred from cell formatting.",
      usage: "2 project references",
      icon: Table2
    },
    {
      id: "externalFiles:pricing-engine",
      originalName: "pricing-engine.ts",
      path: "imports/source/pricing-engine.ts",
      media: "text/typescript",
      type: "TypeScript",
      size: "12.8 KB",
      hash: "20d9f1…a07c",
      updated: "38 min ago",
      semantic: "Exact + summary",
      semanticTone: "current" as const,
      summary: "Pricing utilities calculate plan rates, apply seat-volume discounts, and round the resulting currency amount.",
      provenance: "Generated from exact text and a bounded code profile · 6 symbols",
      uncertainty: "Imports are identified syntactically; no runtime behavior was executed.",
      usage: "1 project reference",
      icon: Braces
    },
    {
      id: "externalFiles:vendor-contract",
      originalName: "vendor-contract.pdf",
      path: "legal/vendors/vendor-contract.pdf",
      media: "application/pdf",
      type: "PDF",
      size: "2.4 MB",
      hash: "892a4d…197e",
      updated: "Yesterday",
      semantic: "Not extracted",
      semanticTone: "limited" as const,
      summary: "No semantic summary is available because PDF extraction is not part of the current supported pipeline.",
      provenance: "Stored source only · no eligible exact or material lane",
      uncertainty: "The file can be downloaded, but its contents have not been interpreted.",
      usage: "No project references",
      icon: FileText
    },
    {
      id: "externalFiles:station-installation",
      originalName: "station-installation.png",
      path: "research/site/station-installation.png",
      media: "image/png",
      type: "Image",
      size: "1.7 MB",
      hash: "f06c32…732b",
      updated: "2 days ago",
      semantic: "Summary queued",
      semanticTone: "queued" as const,
      summary: "The image profile is current; its generated visual description is still queued.",
      provenance: "Deterministic image facets ready · native visual description pending",
      uncertainty: "No OCR or region-level interpretation has been produced.",
      usage: "2 project references",
      icon: FileImage
    }
  ] as const;

  const CONTEXTS = [
    { id: "overview" as const, label: "Overview", icon: Info },
    { id: "activity" as const, label: "Activity", icon: Activity },
    { id: "policy" as const, label: "Policy", icon: LockKeyhole }
  ] as const;

  let contextView = $state<ContextView>("overview");
  let selectedId = $state<string>(FILES[0].id);
  let query = $state("");
  let semanticFilter = $state<SemanticFilter>("all");
  let displayNames = $state<Record<string, string>>({});
  let deletedIds = $state<string[]>([]);
  let editingName = $state(false);
  let nameDraft = $state("");
  let confirmingDelete = $state(false);
  let summaryOpen = $state(true);
  let notice = $state<string>();

  const nameOf = (file: (typeof FILES)[number]): string =>
    displayNames[file.id] ?? file.originalName;

  const available = $derived(FILES.filter((file) => !deletedIds.includes(file.id)));
  const selected = $derived(available.find((file) => file.id === selectedId));
  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const visible = $derived(
    available.filter((file) => {
      if (semanticFilter !== "all" && file.semanticTone !== semanticFilter) return false;
      return normalizedQuery === "" ||
        `${nameOf(file)} ${file.path} ${file.type} ${file.semantic}`.toLocaleLowerCase().includes(normalizedQuery);
    })
  );

  const chooseFile = (id: string) => {
    selectedId = id;
    editingName = false;
    confirmingDelete = false;
    summaryOpen = true;
    notice = undefined;
  };

  const startRename = () => {
    if (selected === undefined) return;
    nameDraft = nameOf(selected);
    editingName = true;
    confirmingDelete = false;
    notice = undefined;
  };

  const saveRename = () => {
    if (selected === undefined) return;
    const next = nameDraft.trim();
    if (next === "") return;
    displayNames = { ...displayNames, [selected.id]: next };
    editingName = false;
    notice = "Display name updated; original filename and bytes are unchanged.";
  };

  const removeSelected = () => {
    if (selected === undefined) return;
    const removed = nameOf(selected);
    deletedIds = [...deletedIds, selected.id];
    const next = FILES.find((file) => !deletedIds.includes(file.id));
    selectedId = next?.id ?? "";
    confirmingDelete = false;
    editingName = false;
    notice = `${removed} removed from the project library.`;
  };
</script>

<section class="workspace-specimen" aria-label="Interactive External singleton manager mock">
  <header class="specimen-label">
    <div><span>INTERACTIVE WORKSPACE SPECIMEN</span><strong>Select a resource; manage it in Inspector</strong></div>
    <span>singleton library · no file editors</span>
  </header>

  <div class="mock-topbar">
    <strong>ICARUS</strong><span>Atlas planning</span><small>External · project library</small>
  </div>

  <div class="mock-tabs" role="tablist" aria-label="Open mock tabs">
    <button type="button" role="tab" aria-selected="false" aria-label="Overview"><House size={13} aria-hidden="true" /></button>
    <button type="button" role="tab" aria-selected="false" aria-label="Agents"><Bot size={13} aria-hidden="true" /></button>
    <button type="button" role="tab" aria-selected="false" aria-label="Templates"><LayoutTemplate size={13} aria-hidden="true" /></button>
    <button class="singleton active" type="button" role="tab" aria-selected="true"><Files size={13} aria-hidden="true" /> External</button>
    <span class="tab-divider" aria-hidden="true"></span>
    <button class="named-tab" type="button" role="tab" aria-selected="false"><FileText size={12} aria-hidden="true" /> Q3 filing <span aria-hidden="true">×</span></button>
    <button class="new-tab" type="button" aria-label="New tab"><Plus size={13} aria-hidden="true" /></button>
  </div>

  <div class="mock-frame">
    <aside class="context-panel" aria-label="Mock External-library Context panel">
      <nav aria-label="Mock External-library context views">
        {#each CONTEXTS as context}
          {@const ContextIcon = context.icon}
          <button
            type="button"
            class:active={contextView === context.id}
            aria-label={context.label}
            aria-pressed={contextView === context.id}
            onclick={() => (contextView = context.id)}
          >
            <ContextIcon size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        {/each}
      </nav>
      <div class="context-body">
        <header><span>CONTEXT</span><strong>{CONTEXTS.find((context) => context.id === contextView)?.label}</strong></header>
        {#if contextView === "overview"}
          <section><small>LIBRARY</small><dl><div><dt>External files</dt><dd>{available.length}</dd></div><div><dt>Findings</dt><dd>Later</dd></div><div><dt>Storage</dt><dd>4.2 MB</dd></div></dl></section>
          <section><small>SEMANTIC COVERAGE</small><dl><div><dt>Current</dt><dd>2</dd></div><div><dt>In progress</dt><dd>1</dd></div><div><dt>Unsupported</dt><dd>1</dd></div></dl></section>
          <section class="kind-stack"><small>MANAGED HERE</small><article><Files size={14} aria-hidden="true" /><div><strong>Files</strong><span>Available now</span></div></article><article class="future"><Sparkles size={14} aria-hidden="true" /><div><strong>Findings</strong><span>Future resource adapter</span></div></article></section>
        {:else if contextView === "activity"}
          <section><small>RECENT ROWS</small><div class="activity-list"><article><span>12 min</span><strong>Uploaded quarterly-revenue.csv</strong><small>Maya Chen · imports/finance</small></article><article><span>38 min</span><strong>Updated pricing-engine.ts</strong><small>Maya Chen · src/services</small></article><article><span>2 days</span><strong>Uploaded station-installation.png</strong><small>Maya Chen · research/site</small></article></div></section>
          <section class="context-note"><strong>Current-row projection</strong><p>Selection does not change this view. It is not a durable event journal, so removed files and historical transitions are absent.</p></section>
        {:else}
          <section><small>DISPLAY METADATA</small><p>Rename changes the name shown inside Icarus. Original filename, relative path, hash, and bytes remain immutable provenance.</p></section>
          <section><small>DELETION</small><p>Refuse represented usage, retire semantic products, hard-delete the row, then immediately remove only a blob whose hash is no longer shared.</p></section>
          <section><small>SUPPORTED MEANING</small><p>Text/code, CSV, and images have current semantic paths. PDF, Office, and media remain manageable without pretending extraction exists.</p></section>
        {/if}
      </div>
    </aside>

    <main class="content-panel" aria-label="Mock External library Content surface">
      <header class="library-header">
        <div><span>EXTERNAL LIBRARY</span><h3>External</h3><p>Files now; findings join this library later.</p></div>
        <div class="upload-actions"><button type="button"><Upload size={13} aria-hidden="true" /> Upload files</button><button type="button"><FolderUp size={13} aria-hidden="true" /> Upload folder</button></div>
      </header>

      <div class="kind-tabs" role="group" aria-label="Resource kind">
        <button type="button" class="active" aria-pressed="true">All <span>{available.length}</span></button>
        <button type="button" aria-pressed="false">Files <span>{available.length}</span></button>
        <button type="button" disabled aria-pressed="false">Findings <span>later</span></button>
      </div>

      <div class="library-tools">
        <label><Search size={13} aria-hidden="true" /><span class="sr-only">Search resources</span><input bind:value={query} placeholder="Search resources" /></label>
        <select bind:value={semanticFilter} aria-label="Semantic status"><option value="all">All semantic states</option><option value="current">Summary current</option><option value="queued">In progress</option><option value="limited">Unsupported</option></select>
        <span>{visible.length} shown</span>
      </div>

      {#if notice}<div class="notice" role="status">{notice}</div>{/if}

      <div class="resource-table-wrap">
        {#if visible.length === 0}
          <div class="empty"><strong>No resource matches.</strong><span>Clear search or semantic filters.</span></div>
        {:else}
          <table class="resource-table">
            <thead><tr><th>Name</th><th>Type</th><th>Location</th><th>Semantics</th><th>Size</th><th>Updated</th></tr></thead>
            <tbody>
              {#each visible as file (file.id)}
                {@const FileIcon = file.icon}
                <tr class:selected={selected?.id === file.id}>
                  <td><button type="button" aria-label={`Inspect ${nameOf(file)}`} onclick={() => chooseFile(file.id)}><FileIcon size={14} strokeWidth={1.8} aria-hidden="true" /><span>{nameOf(file)}</span></button></td>
                  <td>{file.type}</td>
                  <td><span class="path">{file.path.split("/").slice(0, -1).join("/")}</span></td>
                  <td><span class="semantic-badge {file.semanticTone}">{file.semantic}</span></td>
                  <td class="number">{file.size}</td>
                  <td class="number">{file.updated}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
      <footer class="library-foot"><span>Single click selects and inspects</span><span>No file opens an editor tab</span></footer>
    </main>

    <aside class="inspector-panel" aria-label="Mock file management Inspector">
      <header><div><PanelRight size={14} aria-hidden="true" /><span>INSPECTOR</span></div><button type="button" aria-label="Close inspector">×</button></header>
      {#if selected === undefined}
        <div class="inspector-empty"><strong>Select a resource</strong><p>File details and management actions appear here.</p></div>
      {:else}
        <section class="identity">
          <small>FILE</small>
          {#if editingName}
            <label for="mock-file-name">Name in Icarus</label>
            <input id="mock-file-name" bind:value={nameDraft} onkeydown={(event) => { if (event.key === "Enter") saveRename(); if (event.key === "Escape") editingName = false; }} />
            <div class="inline-actions"><button type="button" onclick={saveRename}>Save</button><button type="button" onclick={() => (editingName = false)}>Cancel</button></div>
          {:else}
            <div class="name-line"><h3>{nameOf(selected)}</h3><button type="button" aria-label="Rename in Icarus" onclick={startRename}><Pencil size={12} aria-hidden="true" /></button></div>
          {/if}
          <p class="inspector-path">{selected.path}</p>
        </section>

        <section><small>IDENTITY &amp; PROVENANCE</small><dl><div><dt>Original name</dt><dd>{selected.originalName}</dd></div><div><dt>Type</dt><dd>{selected.media}</dd></div><div><dt>Size</dt><dd>{selected.size}</dd></div><div><dt>SHA-256</dt><dd class="mono">{selected.hash}</dd></div><div><dt>Uploaded by</dt><dd>Maya Chen</dd></div></dl></section>

        <section class="summary-section">
          <div class="summary-head"><div><small>SEMANTIC SUMMARY</small><span class="semantic-badge {selected.semanticTone}">{selected.semantic}</span></div><button type="button" aria-expanded={summaryOpen} onclick={() => (summaryOpen = !summaryOpen)}>{summaryOpen ? "Hide" : "Review"}</button></div>
          {#if summaryOpen}
            <p class="summary">{selected.summary}</p>
            <dl class="summary-meta"><div><dt>Provenance</dt><dd>{selected.provenance}</dd></div><div><dt>Uncertainty</dt><dd>{selected.uncertainty}</dd></div></dl>
            <button class="refresh" type="button" disabled={selected.semanticTone === "limited"}><Sparkles size={12} aria-hidden="true" /> {selected.semanticTone === "queued" ? "Processing queued" : selected.semanticTone === "limited" ? "No supported extractor" : "Refresh semantics"}</button>
          {/if}
        </section>

        <section><small>USAGE</small><dl><div><dt>Referenced by</dt><dd>{selected.usage}</dd></div><div><dt>Replacement</dt><dd>None</dd></div></dl></section>

        {#if confirmingDelete}
          <section class="delete-confirm" role="alert"><strong>Delete {nameOf(selected)}?</strong><p>The resource leaves this project. Shared source bytes are reclaimed only when no row references them.</p><div class="inline-actions"><button class="danger" type="button" onclick={removeSelected}>Delete file</button><button type="button" onclick={() => (confirmingDelete = false)}>Cancel</button></div></section>
        {:else}
          <div class="inspector-actions"><button type="button"><Download size={13} aria-hidden="true" /> Download original</button><button class="danger-outline" type="button" onclick={() => { confirmingDelete = true; editingName = false; }}><Trash2 size={13} aria-hidden="true" /> Delete from project</button></div>
        {/if}
      {/if}
    </aside>
  </div>

  <footer class="mock-status"><span>Atlas planning</span><span>External</span><span>{selected === undefined ? "Nothing selected" : nameOf(selected)}</span><strong>Singleton workspace state saved</strong></footer>
</section>

<style>
  button { border: 0; background: none; color: inherit; cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .48; }
  .workspace-specimen { margin-top: 1.2rem; border: 1px solid var(--rule-strong); border-radius: var(--token-radius-panel); background: var(--raised); box-shadow: var(--token-shadow-elevated); overflow: hidden; }
  .specimen-label { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .75rem 1rem; border-bottom: 1px solid var(--rule-strong); background: var(--ink); color: var(--token-ink-on-fill); }
  .specimen-label div { display: flex; align-items: baseline; gap: .65rem; }
  .specimen-label span { opacity: .72; font: 650 7.5px/1 var(--token-font-mono); letter-spacing: .09em; text-transform: uppercase; }
  .specimen-label strong { font-size: 10px; }
  .mock-topbar { display: flex; align-items: center; gap: .8rem; height: 2.2rem; padding: 0 .75rem; border-bottom: 1px solid var(--rule); background: var(--panel); font-size: 8.5px; }
  .mock-topbar strong { letter-spacing: .08em; }
  .mock-topbar span { color: var(--ink-2); }
  .mock-topbar small { margin-left: auto; color: var(--ink-3); }
  .mock-tabs { display: flex; min-width: 0; height: 2.35rem; align-items: stretch; border-bottom: 1px solid var(--rule); overflow-x: auto; }
  .mock-tabs button { display: flex; flex: none; align-items: center; justify-content: center; gap: .4rem; min-width: 2.5rem; padding: 0 .7rem; border-right: 1px solid var(--rule); color: var(--ink-3); font-size: 8.5px; white-space: nowrap; }
  .mock-tabs button[aria-selected="true"] { box-shadow: inset 0 -2px 0 var(--active); background: var(--active-soft); color: var(--active); }
  .mock-tabs .named-tab span { margin-left: .45rem; opacity: .5; }
  .tab-divider { width: 1px; margin: .45rem .2rem; background: var(--rule-strong); }
  .mock-frame { display: grid; grid-template-columns: 14rem minmax(30rem, 1fr) 18rem; min-height: 40rem; }
  .context-panel { display: grid; grid-template-columns: 2.5rem minmax(0, 1fr); border-right: 1px solid var(--rule); background: var(--panel); }
  .context-panel > nav { display: flex; flex-direction: column; align-items: stretch; border-right: 1px solid var(--rule); background: var(--raised); }
  .context-panel > nav button { display: grid; width: 100%; height: 2.55rem; place-items: center; border-bottom: 1px solid var(--rule); color: var(--ink-3); }
  .context-panel > nav button.active { box-shadow: inset 3px 0 0 var(--active); background: var(--active-soft); color: var(--active); }
  .context-body { min-width: 0; }
  .context-body > header, .inspector-panel > header { display: flex; min-height: 2.55rem; align-items: center; justify-content: space-between; gap: .4rem; padding: .55rem .65rem; border-bottom: 1px solid var(--rule); }
  .context-body > header span, .inspector-panel > header span { color: var(--ink-3); font: 650 7px/1 var(--token-font-mono); letter-spacing: .1em; }
  .context-body > header strong { font-size: 9px; }
  .context-body section, .inspector-panel section { padding: .8rem; border-bottom: 1px solid var(--rule); }
  .context-body section > small, .inspector-panel section > small, .summary-head small { display: block; margin-bottom: .55rem; color: var(--ink-3); font: 700 7px/1 var(--token-font-mono); letter-spacing: .08em; }
  dl { display: grid; gap: .4rem; margin: 0; }
  dl div { display: flex; justify-content: space-between; gap: .5rem; font-size: 8px; }
  dt { color: var(--ink-3); }
  dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
  .kind-stack { display: grid; gap: .45rem; }
  .kind-stack > small { margin-bottom: .1rem !important; }
  .kind-stack article { display: flex; align-items: center; gap: .5rem; padding: .55rem; border: 1px solid var(--rule); background: var(--raised); color: var(--active); }
  .kind-stack article div { display: grid; }
  .kind-stack article strong { color: var(--ink); font-size: 8px; }
  .kind-stack article span { color: var(--ink-3); font-size: 7px; }
  .kind-stack article.future { color: var(--ink-3); border-style: dashed; }
  .activity-list { display: grid; gap: .45rem; }
  .activity-list article { padding: .55rem; border: 1px solid var(--rule); background: var(--raised); }
  .activity-list span, .activity-list small { display: block; color: var(--ink-3); font-size: 7px; }
  .activity-list strong { display: block; margin: .15rem 0; font-size: 8px; }
  .context-note { background: var(--active-soft); }
  .context-note strong { color: var(--active); font-size: 8px; }
  .context-body section p, .context-note p { margin: .3rem 0 0; color: var(--ink-2); font-size: 8px; }
  .content-panel { display: grid; min-width: 0; grid-template-rows: auto auto auto auto minmax(0, 1fr) auto; background: var(--work); }
  .library-header { display: flex; min-width: 0; min-height: 5rem; align-items: center; justify-content: space-between; gap: .8rem; padding: .8rem 1rem; border-bottom: 1px solid var(--rule); background: var(--raised); }
  .library-header > div:first-child { min-width: 0; }
  .library-header span { color: var(--active); font: 700 7px/1 var(--token-font-mono); letter-spacing: .08em; }
  .library-header h3 { margin: .25rem 0 .1rem; font-size: 15px; }
  .library-header p { margin: 0; color: var(--ink-3); font-size: 8px; }
  .upload-actions { display: flex; gap: .4rem; }
  .upload-actions button, .inspector-actions button, .inline-actions button, .refresh { display: flex; align-items: center; justify-content: center; gap: .35rem; padding: .45rem .6rem; border: 1px solid var(--rule-strong); border-radius: var(--token-radius-control); background: var(--raised); font-size: 8px; }
  .upload-actions button:first-child { background: var(--active); color: var(--token-ink-on-fill); border-color: var(--active); }
  .kind-tabs { display: flex; gap: .25rem; padding: .55rem 1rem 0; background: var(--raised); }
  .kind-tabs button { padding: .4rem .55rem; border-bottom: 2px solid transparent; color: var(--ink-3); font-size: 8px; }
  .kind-tabs button.active { border-color: var(--active); color: var(--active); font-weight: 650; }
  .kind-tabs span { margin-left: .25rem; color: inherit; opacity: .7; }
  .library-tools { display: flex; align-items: center; gap: .45rem; padding: .6rem 1rem; border-bottom: 1px solid var(--rule); background: var(--raised); }
  .library-tools label { display: flex; min-width: 10rem; flex: 1; align-items: center; gap: .35rem; padding: .4rem .5rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--panel); color: var(--ink-3); }
  .library-tools input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: 8px; }
  .library-tools select { max-width: 9.5rem; padding: .4rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--panel); color: var(--ink-2); font-size: 8px; }
  .library-tools > span { color: var(--ink-3); font-size: 7.5px; white-space: nowrap; }
  .notice { padding: .45rem 1rem; border-bottom: 1px solid var(--rule); background: var(--success-soft); color: var(--success); font-size: 8px; }
  .resource-table-wrap { min-width: 0; min-height: 0; overflow: auto; padding: .75rem 1rem; }
  .resource-table { width: 100%; min-width: 46rem; border-collapse: collapse; border: 1px solid var(--rule); background: var(--raised); font-size: 8px; }
  .resource-table th { padding: .55rem .6rem; border-bottom: 1px solid var(--rule-strong); background: var(--panel); color: var(--ink-3); font-size: 7px; text-align: left; }
  .resource-table td { max-width: 13rem; padding: .65rem .6rem; border-bottom: 1px solid var(--rule); color: var(--ink-2); }
  .resource-table tr:hover, .resource-table tr.selected { background: var(--active-soft); }
  .resource-table tr.selected { box-shadow: inset 3px 0 0 var(--active); }
  .resource-table td:first-child button { display: flex; max-width: 14rem; align-items: center; gap: .45rem; color: var(--ink); text-align: left; }
  .resource-table td:first-child button span, .path { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .path { max-width: 10rem; color: var(--ink-3); font-family: var(--token-font-mono); }
  .number { white-space: nowrap; text-align: right; }
  .semantic-badge { display: inline-flex; padding: .25rem .35rem; border-radius: 999px; font: 650 6.5px/1 var(--token-font-mono); white-space: nowrap; }
  .semantic-badge.current { background: var(--success-soft); color: var(--success); }
  .semantic-badge.queued { background: var(--attention-soft); color: var(--attention); }
  .semantic-badge.limited { background: var(--panel); color: var(--ink-3); }
  .empty { display: grid; min-height: 12rem; place-content: center; text-align: center; }
  .empty strong { font-size: 10px; }
  .empty span { margin-top: .25rem; color: var(--ink-3); font-size: 8px; }
  .library-foot, .mock-status { display: flex; justify-content: space-between; gap: 1rem; padding: .45rem .7rem; border-top: 1px solid var(--rule); background: var(--panel); color: var(--ink-3); font: 500 7px/1 var(--token-font-mono); }
  .inspector-panel { min-width: 0; overflow-y: auto; border-left: 1px solid var(--rule); background: var(--panel); }
  .inspector-panel > header div { display: flex; align-items: center; gap: .35rem; }
  .inspector-empty { padding: .9rem; }
  .inspector-empty strong { font-size: 10px; }
  .inspector-empty p { margin: .25rem 0 0; color: var(--ink-3); font-size: 8px; }
  .identity label { display: block; margin-bottom: .25rem; color: var(--ink-3); font-size: 7px; }
  .identity input { width: 100%; padding: .4rem; border: 1px solid var(--active); border-radius: var(--token-radius-control); background: var(--raised); color: var(--ink); font-size: 9px; }
  .name-line { display: flex; align-items: flex-start; justify-content: space-between; gap: .4rem; }
  .name-line h3 { margin: 0; font-size: 11px; overflow-wrap: anywhere; }
  .name-line button { display: grid; flex: none; width: 1.6rem; height: 1.6rem; place-items: center; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--raised); }
  .inspector-path { margin: .45rem 0 0; color: var(--ink-3); font: 500 7.5px/1.5 var(--token-font-mono); overflow-wrap: anywhere; }
  .summary-head { display: flex; align-items: flex-start; justify-content: space-between; gap: .4rem; }
  .summary-head small { margin-bottom: .35rem; }
  .summary-head button { padding: .25rem; color: var(--active); font-size: 7px; }
  .summary { margin: .7rem 0; color: var(--ink); font: 400 9px/1.5 var(--token-font-serif); }
  .summary-meta { padding-top: .55rem; border-top: 1px solid var(--rule); }
  .summary-meta div { display: grid; gap: .2rem; }
  .summary-meta dd { color: var(--ink-2); text-align: left; line-height: 1.4; }
  .refresh { width: 100%; margin-top: .65rem; }
  .inspector-actions { display: grid; gap: .4rem; padding: .8rem; }
  .inline-actions { display: flex; gap: .35rem; margin-top: .45rem; }
  .inline-actions button:first-child { background: var(--active); color: var(--token-ink-on-fill); border-color: var(--active); }
  .inline-actions button.danger { background: var(--danger); border-color: var(--danger); }
  .danger-outline { color: var(--danger) !important; border-color: var(--danger) !important; }
  .delete-confirm { background: var(--danger-soft); }
  .delete-confirm strong { color: var(--danger); font-size: 9px; }
  .delete-confirm p { margin: .35rem 0 0; color: var(--ink-2); font-size: 8px; }
  .mock-status { border-top-color: var(--rule-strong); }
  .mock-status strong { margin-left: auto; color: var(--success); font-weight: 600; }
  @media (max-width: 82rem) { .mock-frame { grid-template-columns: 13rem minmax(28rem, 1fr) 16rem; } }
  @media (max-width: 60rem) { .mock-frame { grid-template-columns: 12rem minmax(27rem, 1fr); } .inspector-panel { grid-column: 1 / -1; min-height: 22rem; border-top: 1px solid var(--rule); border-left: 0; } }
  @media (max-width: 48rem) { .specimen-label > span, .mock-topbar small, .named-tab, .tab-divider { display: none; } .mock-frame { display: block; } .context-panel { min-height: 18rem; border-right: 0; border-bottom: 1px solid var(--rule); } .content-panel { min-height: 34rem; } .library-header { align-items: flex-start; flex-direction: column; } .library-tools { align-items: stretch; flex-direction: column; } .library-tools select { max-width: none; } .resource-table-wrap { overflow-x: auto; } .inspector-panel { min-height: auto; } .mock-status span:nth-child(3) { display: none; } }
</style>
