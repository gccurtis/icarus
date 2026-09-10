<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import Braces from "@lucide/svelte/icons/braces";
  import ClockArrowLeft from "@lucide/svelte/icons/clock-arrow-left";
  import Download from "@lucide/svelte/icons/download";
  import FileImage from "@lucide/svelte/icons/file-image";
  import FileText from "@lucide/svelte/icons/file-text";
  import Files from "@lucide/svelte/icons/files";
  import Folder from "@lucide/svelte/icons/folder";
  import FolderInput from "@lucide/svelte/icons/folder-input";
  import FolderTree from "@lucide/svelte/icons/folder-tree";
  import FolderUp from "@lucide/svelte/icons/folder-up";
  import House from "@lucide/svelte/icons/house";
  import Info from "@lucide/svelte/icons/info";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import PanelRight from "@lucide/svelte/icons/panel-right";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Search from "@lucide/svelte/icons/search";
  import Table2 from "@lucide/svelte/icons/table-2";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Upload from "@lucide/svelte/icons/upload";

  type ContextView = "overview" | "history";
  type LibraryView = "table" | "directory";
  type SemanticFilter = "all" | "current" | "queued" | "limited";

  const FILES = [
    {
      id: "externalFiles:quarterly-revenue",
      originalName: "quarterly-revenue.csv",
      path: "imports/finance/quarterly-revenue.csv",
      media: "text/csv",
      type: "CSV",
      size: "84.2 KB",
      uploaded: "Sep 9, 2026 at 10:14 AM",
      updated: "12 min ago",
      semantic: "Summary ready",
      semanticTone: "current" as const,
      semanticMode: "descriptor" as const,
      summary: "This dataset compares quarterly revenue, plan, and year-over-year change across four operating regions. West contributes the largest reported total and the strongest growth; South is the only region below plan. Treat currency-looking columns as USD unless the authored dataset context says otherwise.",
      profile: "5 parsed rows · 4 columns · region, revenue, plan, yoy_change",
      context: "Quarterly operating review exported from Finance. Currency columns are USD.",
      references: ["Q3 filing", "Operating review"],
      icon: Table2
    },
    {
      id: "externalFiles:pricing-engine",
      originalName: "pricing-engine.ts",
      path: "imports/source/pricing-engine.ts",
      media: "text/typescript",
      type: "TypeScript",
      size: "12.8 KB",
      uploaded: "Sep 9, 2026 at 9:48 AM",
      updated: "38 min ago",
      semantic: "Summary ready",
      semanticTone: "current" as const,
      semanticMode: "descriptor" as const,
      summary: "Pricing utilities calculate plan rates, apply seat-volume discounts, and round the resulting currency amount. The profile identifies six exported symbols and three internal helpers; it describes syntax only and does not execute the module.",
      profile: "TypeScript · 214 lines · 3 imports · 6 exported symbols",
      context: "",
      references: ["Pricing proposal"],
      icon: Braces
    },
    {
      id: "externalFiles:vendor-contract",
      originalName: "vendor-contract.pdf",
      path: "legal/vendors/vendor-contract.pdf",
      media: "application/pdf",
      type: "PDF",
      size: "2.4 MB",
      uploaded: "Sep 8, 2026 at 3:20 PM",
      updated: "Yesterday",
      semantic: "Managed only",
      semanticTone: "limited" as const,
      semanticMode: "none" as const,
      summary: "",
      profile: "",
      context: "",
      references: [],
      icon: FileText
    },
    {
      id: "externalFiles:station-installation",
      originalName: "station-installation.png",
      path: "research/site/station-installation.png",
      media: "image/png",
      type: "Image",
      size: "1.7 MB",
      uploaded: "Sep 7, 2026 at 1:03 PM",
      updated: "2 days ago",
      semantic: "Visual ready",
      semanticTone: "current" as const,
      semanticMode: "visual" as const,
      summary: "",
      profile: "Original image embedded directly · no generated text summary",
      context: "",
      references: ["Site report", "Installation brief"],
      icon: FileImage
    }
  ] as const;

  const CONTEXTS = [
    { id: "overview" as const, label: "Overview", icon: Info },
    { id: "history" as const, label: "History", icon: ClockArrowLeft }
  ] as const;

  let contextView = $state<ContextView>("overview");
  let libraryView = $state<LibraryView>("table");
  let selectedId = $state<string>(FILES[0].id);
  let selectedDirectory = $state<string>();
  let query = $state("");
  let semanticFilter = $state<SemanticFilter>("all");
  let displayNames = $state<Record<string, string>>({});
  let displayPaths = $state<Record<string, string>>({});
  let deletedIds = $state<string[]>([]);
  let editing = $state<"name" | "path">();
  let editDraft = $state("");
  let confirmingDelete = $state(false);
  let notice = $state<string>();
  let history = $state([
    "Uploaded quarterly-revenue.csv · 12 min ago",
    "Re-uploaded pricing-engine.ts · 38 min ago",
    "Moved station-installation.png · 2 days ago"
  ]);

  const nameOf = (file: (typeof FILES)[number]): string =>
    displayNames[file.id] ?? file.originalName;
  const pathOf = (file: (typeof FILES)[number]): string =>
    displayPaths[file.id] ?? file.path;
  const available = $derived(FILES.filter((file) => !deletedIds.includes(file.id)));
  const selected = $derived(available.find((file) => file.id === selectedId));
  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const visible = $derived(
    available.filter((file) => {
      if (semanticFilter !== "all" && file.semanticTone !== semanticFilter) return false;
      return normalizedQuery === "" ||
        `${nameOf(file)} ${pathOf(file)} ${file.type} ${file.semantic}`
          .toLocaleLowerCase().includes(normalizedQuery);
    })
  );
  const directories = $derived([
    { path: "imports", files: available.filter((file) => pathOf(file).startsWith("imports/")).length },
    { path: "legal", files: available.filter((file) => pathOf(file).startsWith("legal/")).length },
    { path: "research", files: available.filter((file) => pathOf(file).startsWith("research/")).length }
  ].filter((directory) => directory.files > 0));

  const chooseFile = (id: string) => {
    selectedId = id;
    selectedDirectory = undefined;
    editing = undefined;
    confirmingDelete = false;
    notice = undefined;
  };

  const chooseDirectory = (path: string) => {
    selectedDirectory = path;
    selectedId = "";
    editing = undefined;
    confirmingDelete = false;
    notice = undefined;
  };

  const startEdit = (field: "name" | "path") => {
    if (selected === undefined) return;
    editing = field;
    editDraft = field === "name" ? nameOf(selected) : pathOf(selected);
    confirmingDelete = false;
  };

  const saveEdit = () => {
    if (selected === undefined || editing === undefined || editDraft.trim() === "") return;
    const next = editDraft.trim();
    if (editing === "name") {
      displayNames = { ...displayNames, [selected.id]: next };
      const segments = pathOf(selected).split("/");
      segments[segments.length - 1] = next;
      displayPaths = { ...displayPaths, [selected.id]: segments.join("/") };
      history = [`Renamed ${selected.originalName} · just now`, ...history];
      notice = "Local name and path leaf updated; original upload name and bytes are unchanged.";
    } else {
      displayPaths = { ...displayPaths, [selected.id]: next };
      displayNames = { ...displayNames, [selected.id]: next.split("/").at(-1) ?? nameOf(selected) };
      history = [`Moved ${nameOf(selected)} · just now`, ...history];
      notice = "Project path updated; native bytes stayed content-addressed.";
    }
    editing = undefined;
  };

  const mockReupload = () => {
    if (selected === undefined) return;
    history = [`Re-uploaded ${nameOf(selected)} · just now`, ...history];
    notice = "Replacement bytes accepted as the next revision of the same External file.";
  };

  const removeSelected = () => {
    if (selected === undefined) return;
    const removed = nameOf(selected);
    history = [`Deleted ${removed} · just now`, ...history];
    deletedIds = [...deletedIds, selected.id];
    const next = FILES.find((file) => !deletedIds.includes(file.id));
    selectedId = next?.id ?? "";
    confirmingDelete = false;
    notice = `${removed} removed; its History entry remains.`;
  };
</script>

<section class="workspace-specimen" aria-label="Interactive External singleton manager mock">
  <header class="specimen-label">
    <div><span>INTERACTIVE WORKSPACE SPECIMEN</span><strong>Select a file or folder; manage it in Inspector</strong></div>
    <span>singleton library · no file editors</span>
  </header>

  <div class="mock-topbar"><strong>ICARUS</strong><span>Atlas planning</span><small>External · project library</small></div>
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
          <button type="button" class:active={contextView === context.id} aria-label={context.label}
            aria-pressed={contextView === context.id} onclick={() => (contextView = context.id)}>
            <ContextIcon size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        {/each}
      </nav>
      <div class="context-body">
        <header><span>CONTEXT</span><strong>{CONTEXTS.find((context) => context.id === contextView)?.label}</strong></header>
        {#if contextView === "overview"}
          <section><small>LIBRARY</small><dl><div><dt>Files</dt><dd>{available.length}</dd></div><div><dt>Folders</dt><dd>{directories.length}</dd></div><div><dt>Known storage</dt><dd>4.2 MB</dd></div></dl></section>
          <section><small>MATERIAL COVERAGE</small><dl><div><dt>Current</dt><dd>3</dd></div><div><dt>In progress</dt><dd>0</dd></div><div><dt>Managed only</dt><dd>1</dd></div></dl></section>
          <section class="context-note"><strong>Library-wide only</strong><p>Selection does not change Overview. File-specific controls and meaning stay in Inspector.</p></section>
        {:else}
          <section><small>DURABLE FILE HISTORY</small><div class="history-list">{#each history as item}<article><strong>{item}</strong><small>Maya Chen · lifecycle event</small></article>{/each}</div></section>
          <section class="context-note"><strong>Survives deletion</strong><p>History is backed by project activity rows, not reconstructed from files that still exist.</p></section>
        {/if}
      </div>
    </aside>

    <main class="content-panel" aria-label="Mock External library Content surface">
      <header class="library-header">
        <div><span>EXTERNAL LIBRARY</span><h3>External</h3><p>Manage project files that do not have dedicated editors.</p></div>
        <div class="upload-actions"><button type="button"><Upload size={13} aria-hidden="true" /> Upload files</button><button type="button"><FolderUp size={13} aria-hidden="true" /> Upload folder</button></div>
      </header>

      <div class="view-switch" role="group" aria-label="Library view">
        <button type="button" class:active={libraryView === "table"} aria-pressed={libraryView === "table"} onclick={() => (libraryView = "table")}><Table2 size={12} aria-hidden="true" /> Table</button>
        <button type="button" class:active={libraryView === "directory"} aria-pressed={libraryView === "directory"} onclick={() => (libraryView = "directory")}><FolderTree size={12} aria-hidden="true" /> Directory</button>
      </div>

      <div class="library-tools">
        <label><Search size={13} aria-hidden="true" /><span class="sr-only">Search files</span><input bind:value={query} placeholder="Search files and paths" /></label>
        <select bind:value={semanticFilter} aria-label="Meaning status"><option value="all">All meaning states</option><option value="current">Current</option><option value="queued">In progress</option><option value="limited">Managed only</option></select>
        <span>{visible.length} files</span>
      </div>

      {#if notice}<div class="notice" role="status">{notice}</div>{/if}

      <div class="resource-table-wrap">
        {#if libraryView === "directory"}
          <div class="breadcrumbs"><strong>External</strong><span>/</span><span>Root</span></div>
          <table class="resource-table directory-table">
            <thead><tr><th>Name</th><th>Type</th><th>Contents</th><th>Location</th></tr></thead>
            <tbody>
              {#each directories as directory}
                <tr class:selected={selectedDirectory === directory.path}>
                  <td><button type="button" aria-label={`Inspect ${directory.path} folder`} onclick={() => chooseDirectory(directory.path)}><Folder size={14} aria-hidden="true" /><span>{directory.path}</span></button></td>
                  <td>Folder</td><td>{directory.files} descendant files</td><td>External/{directory.path}</td>
                </tr>
              {/each}
              {#each visible.filter((file) => !pathOf(file).includes("/")) as file (file.id)}
                <tr><td><button type="button" onclick={() => chooseFile(file.id)}>{nameOf(file)}</button></td><td>{file.type}</td><td>File</td><td>External</td></tr>
              {/each}
            </tbody>
          </table>
        {:else if visible.length === 0}
          <div class="empty"><strong>No file matches.</strong><span>Clear search or meaning filters.</span></div>
        {:else}
          <table class="resource-table">
            <thead><tr><th>Name</th><th>Type</th><th>Path</th><th>Meaning</th><th>Size</th><th>Updated</th></tr></thead>
            <tbody>
              {#each visible as file (file.id)}
                {@const FileIcon = file.icon}
                <tr class:selected={selected?.id === file.id && selectedDirectory === undefined}>
                  <td><button type="button" aria-label={`Inspect ${nameOf(file)}`} onclick={() => chooseFile(file.id)}><FileIcon size={14} strokeWidth={1.8} aria-hidden="true" /><span>{nameOf(file)}</span></button></td>
                  <td>{file.type}</td><td><span class="path">{pathOf(file)}</span></td>
                  <td><span class="semantic-badge {file.semanticTone}">{file.semantic}</span></td>
                  <td class="number">{file.size}</td><td class="number">{file.updated}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
      <footer class="library-foot"><span>Single click selects · double click opens a folder</span><span>No file opens an editor tab</span></footer>
    </main>

    <aside class="inspector-panel" aria-label="Mock file and directory management Inspector">
      <header><div><PanelRight size={14} aria-hidden="true" /><span>INSPECTOR</span></div><button type="button" aria-label="Close inspector">×</button></header>
      {#if selectedDirectory !== undefined}
        <section class="identity"><small>FOLDER VIEW</small><div class="name-line"><h3>{selectedDirectory}</h3></div><p class="inspector-path">External/{selectedDirectory}</p></section>
        <div class="manager-actions"><button type="button"><Pencil size={12} aria-hidden="true" /> Rename</button><button type="button"><FolderInput size={12} aria-hidden="true" /> Move</button></div>
        <section><small>DETAILS</small><dl><div><dt>Direct folders</dt><dd>2</dd></div><div><dt>Descendant files</dt><dd>{directories.find((entry) => entry.path === selectedDirectory)?.files ?? 0}</dd></div><div><dt>Storage</dt><dd>Projected total</dd></div></dl></section>
        <section class="context-note"><strong>Virtual directory</strong><p>Renaming or moving this view rewrites every descendant path atomically. It never moves native blobs.</p></section>
      {:else if selected === undefined}
        <div class="inspector-empty"><strong>Select a file or folder</strong><p>Details and management actions appear here.</p></div>
      {:else}
        <section class="identity">
          <div class="identity-kicker"><small>FILE</small><span>{selected.references.length} references</span></div>
          {#if editing !== undefined}
            <label for="mock-file-field">{editing === "name" ? "Name in Icarus" : "Project path"}</label>
            <input id="mock-file-field" bind:value={editDraft} onkeydown={(event) => { if (event.key === "Enter") saveEdit(); if (event.key === "Escape") editing = undefined; }} />
            <div class="inline-actions"><button type="button" onclick={saveEdit}>Save</button><button type="button" onclick={() => (editing = undefined)}>Cancel</button></div>
          {:else}
            <div class="name-line"><h3 ondblclick={() => startEdit("name")}>{nameOf(selected)}</h3></div>
            <p class="inspector-path" ondblclick={() => startEdit("path")}>{pathOf(selected)}</p>
            <small class="edit-hint">Double-click name or path to edit</small>
          {/if}
        </section>

        <div class="manager-actions">
          <button type="button" onclick={() => startEdit("name")}><Pencil size={12} aria-hidden="true" /> Rename</button>
          <button type="button" onclick={mockReupload}><RefreshCw size={12} aria-hidden="true" /> Re-upload</button>
          <button type="button"><Download size={12} aria-hidden="true" /> Download</button>
          <button type="button" onclick={() => startEdit("path")}><FolderInput size={12} aria-hidden="true" /> Move</button>
          <button class="danger-outline" type="button" onclick={() => (confirmingDelete = true)}><Trash2 size={12} aria-hidden="true" /> Delete</button>
        </div>

        <section><small>DETAILS</small><dl><div><dt>Original upload</dt><dd>{selected.originalName}</dd></div><div><dt>Type</dt><dd>{selected.media}</dd></div><div><dt>Size</dt><dd>{selected.size}</dd></div><div><dt>Uploaded</dt><dd>{selected.uploaded}</dd></div><div><dt>Uploaded by</dt><dd>Maya Chen</dd></div></dl></section>
        <section><small>REFERENCES</small>{#if selected.references.length}<ul class="references">{#each selected.references as reference}<li>{reference}</li>{/each}</ul>{:else}<p class="muted">No project references.</p>{/if}</section>

        {#if selected.type === "CSV"}
          <section><small>DATASET CONTEXT</small><textarea aria-label="Dataset context">{selected.context}</textarea><button class="save-context" type="button">Save context</button></section>
        {/if}

        {#if selected.semanticMode === "descriptor"}
          <section class="summary-section"><div class="summary-head"><small>MATERIAL SUMMARY</small><span class="semantic-badge {selected.semanticTone}">{selected.semantic}</span></div><p class="summary">{selected.summary}</p><p class="profile">{selected.profile}</p></section>
        {:else if selected.semanticMode === "visual"}
          <section class="summary-section"><div class="summary-head"><small>SEMANTIC REPRESENTATION</small><span class="semantic-badge current">Visual ready</span></div><p class="summary">The original image is embedded directly as one native visual object. No generated text summary is added.</p><p class="profile">{selected.profile}</p></section>
        {/if}

        {#if confirmingDelete}
          <section class="delete-confirm" role="alert"><strong>Delete {nameOf(selected)}?</strong><p>Deletion is refused while live references exist. Otherwise semantic forget/outbox, History, and row removal commit together before the row's native claim is released.</p><div class="inline-actions"><button class="danger" type="button" disabled={selected.references.length > 0} onclick={removeSelected}>Delete file</button><button type="button" onclick={() => (confirmingDelete = false)}>Cancel</button></div></section>
        {/if}
      {/if}
    </aside>
  </div>
  <footer class="mock-status"><span>Atlas planning</span><span>External</span><span>{selectedDirectory ?? (selected === undefined ? "Nothing selected" : nameOf(selected))}</span><strong>Singleton workspace state saved</strong></footer>
</section>

<style>
  button { border: 0; background: none; color: inherit; cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .48; }
  .workspace-specimen { margin-top: 1.2rem; border: 1px solid var(--rule-strong); border-radius: var(--token-radius-panel); background: var(--raised); box-shadow: var(--token-shadow-elevated); overflow: hidden; }
  .specimen-label { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .75rem 1rem; border-bottom: 1px solid var(--rule-strong); background: var(--ink); color: var(--token-ink-on-fill); }
  .specimen-label div { display: flex; align-items: baseline; gap: .65rem; }.specimen-label span { opacity: .72; font: 650 7.5px/1 var(--token-font-mono); letter-spacing: .09em; text-transform: uppercase; }.specimen-label strong { font-size: 10px; }
  .mock-topbar { display: flex; align-items: center; gap: .8rem; height: 2.2rem; padding: 0 .75rem; border-bottom: 1px solid var(--rule); background: var(--panel); font-size: 8.5px; }.mock-topbar strong { letter-spacing: .08em; }.mock-topbar span { color: var(--ink-2); }.mock-topbar small { margin-left: auto; color: var(--ink-3); }
  .mock-tabs { display: flex; min-width: 0; height: 2.35rem; align-items: stretch; border-bottom: 1px solid var(--rule); overflow-x: auto; }.mock-tabs button { display: flex; flex: none; align-items: center; justify-content: center; gap: .4rem; min-width: 2.5rem; padding: 0 .7rem; border-right: 1px solid var(--rule); color: var(--ink-3); font-size: 8.5px; white-space: nowrap; }.mock-tabs button[aria-selected="true"] { box-shadow: inset 0 -2px 0 var(--active); background: var(--active-soft); color: var(--active); }.mock-tabs .named-tab span { margin-left: .45rem; opacity: .5; }.tab-divider { width: 1px; margin: .45rem .2rem; background: var(--rule-strong); }
  .mock-frame { display: grid; grid-template-columns: 14rem minmax(30rem, 1fr) 20rem; min-height: 43rem; }.context-panel { display: grid; grid-template-columns: 2.5rem minmax(0, 1fr); border-right: 1px solid var(--rule); background: var(--panel); }.context-panel > nav { display: flex; flex-direction: column; border-right: 1px solid var(--rule); background: var(--raised); }.context-panel > nav button { display: grid; width: 100%; height: 2.55rem; place-items: center; border-bottom: 1px solid var(--rule); color: var(--ink-3); }.context-panel > nav button.active { box-shadow: inset 3px 0 0 var(--active); background: var(--active-soft); color: var(--active); }
  .context-body, .inspector-panel { min-width: 0; }.context-body > header, .inspector-panel > header { display: flex; min-height: 2.55rem; align-items: center; justify-content: space-between; gap: .4rem; padding: .55rem .65rem; border-bottom: 1px solid var(--rule); }.context-body > header span, .inspector-panel > header span { color: var(--ink-3); font: 650 7px/1 var(--token-font-mono); letter-spacing: .1em; }.context-body > header strong { font-size: 9px; }.context-body section, .inspector-panel section { padding: .8rem; border-bottom: 1px solid var(--rule); }.context-body section > small, .inspector-panel section > small, .summary-head small, .identity-kicker small { display: block; margin-bottom: .55rem; color: var(--ink-3); font: 700 7px/1 var(--token-font-mono); letter-spacing: .08em; }
  dl { display: grid; gap: .4rem; margin: 0; }dl div { display: flex; justify-content: space-between; gap: .5rem; font-size: 8px; }dt { color: var(--ink-3); }dd { margin: 0; text-align: right; overflow-wrap: anywhere; }.context-note { background: var(--active-soft); }.context-note strong { color: var(--active); font-size: 8px; }.context-body section p, .context-note p { margin: .3rem 0 0; color: var(--ink-2); font-size: 8px; }
  .history-list { display: grid; gap: .45rem; }.history-list article { padding: .55rem; border: 1px solid var(--rule); background: var(--raised); }.history-list strong, .history-list small { display: block; font-size: 7.5px; }.history-list small { margin-top: .2rem; color: var(--ink-3); }
  .content-panel { display: grid; min-width: 0; grid-template-rows: auto auto auto auto minmax(0, 1fr) auto; background: var(--work); }.library-header { display: flex; min-width: 0; min-height: 5rem; align-items: center; justify-content: space-between; gap: .8rem; padding: .8rem 1rem; border-bottom: 1px solid var(--rule); background: var(--raised); }.library-header span { color: var(--active); font: 700 7px/1 var(--token-font-mono); letter-spacing: .08em; }.library-header h3 { margin: .25rem 0 .1rem; font-size: 15px; }.library-header p { margin: 0; color: var(--ink-3); font-size: 8px; }
  .upload-actions, .view-switch, .manager-actions { display: flex; gap: .4rem; }.upload-actions button, .view-switch button, .manager-actions button, .inline-actions button, .save-context { display: flex; align-items: center; justify-content: center; gap: .3rem; padding: .42rem .55rem; border: 1px solid var(--rule-strong); border-radius: var(--token-radius-control); background: var(--raised); font-size: 7.5px; }.upload-actions button:first-child { background: var(--active); color: var(--token-ink-on-fill); border-color: var(--active); }.view-switch { padding: .5rem 1rem 0; background: var(--raised); }.view-switch button.active { background: var(--active-soft); border-color: var(--active); color: var(--active); }
  .library-tools { display: flex; align-items: center; gap: .45rem; padding: .6rem 1rem; border-bottom: 1px solid var(--rule); background: var(--raised); }.library-tools label { display: flex; min-width: 10rem; flex: 1; align-items: center; gap: .35rem; padding: .4rem .5rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--panel); color: var(--ink-3); }.library-tools input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: 8px; }.library-tools select { max-width: 9.5rem; padding: .4rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--panel); color: var(--ink-2); font-size: 8px; }.library-tools > span { color: var(--ink-3); font-size: 7.5px; white-space: nowrap; }.notice { padding: .45rem 1rem; border-bottom: 1px solid var(--rule); background: var(--success-soft); color: var(--success); font-size: 8px; }
  .resource-table-wrap { min-width: 0; min-height: 0; overflow: auto; padding: .75rem 1rem; }.breadcrumbs { display: flex; gap: .4rem; margin-bottom: .55rem; color: var(--ink-3); font-size: 8px; }.resource-table { width: 100%; min-width: 48rem; border-collapse: collapse; border: 1px solid var(--rule); background: var(--raised); font-size: 8px; }.directory-table { min-width: 36rem; }.resource-table th { padding: .55rem .6rem; border-bottom: 1px solid var(--rule-strong); background: var(--panel); color: var(--ink-3); font-size: 7px; text-align: left; }.resource-table td { max-width: 13rem; padding: .65rem .6rem; border-bottom: 1px solid var(--rule); color: var(--ink-2); }.resource-table tr:hover, .resource-table tr.selected { background: var(--active-soft); }.resource-table tr.selected { box-shadow: inset 3px 0 0 var(--active); }.resource-table td:first-child button { display: flex; max-width: 14rem; align-items: center; gap: .45rem; color: var(--ink); text-align: left; }.resource-table td:first-child button span, .path { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.path { max-width: 11rem; color: var(--ink-3); font-family: var(--token-font-mono); }.number { white-space: nowrap; text-align: right; }
  .semantic-badge { display: inline-flex; padding: .25rem .35rem; border-radius: 999px; font: 650 6.5px/1 var(--token-font-mono); white-space: nowrap; }.semantic-badge.current { background: var(--success-soft); color: var(--success); }.semantic-badge.queued { background: var(--attention-soft); color: var(--attention); }.semantic-badge.limited { background: var(--panel); color: var(--ink-3); }.empty { display: grid; min-height: 12rem; place-content: center; text-align: center; }.empty strong { font-size: 10px; }.empty span { margin-top: .25rem; color: var(--ink-3); font-size: 8px; }
  .library-foot, .mock-status { display: flex; justify-content: space-between; gap: 1rem; padding: .45rem .7rem; border-top: 1px solid var(--rule); background: var(--panel); color: var(--ink-3); font: 500 7px/1 var(--token-font-mono); }.inspector-panel { overflow-y: auto; border-left: 1px solid var(--rule); background: var(--panel); }.inspector-panel > header div { display: flex; align-items: center; gap: .35rem; }.inspector-empty { padding: .9rem; }.inspector-empty strong { font-size: 10px; }.inspector-empty p { margin: .25rem 0 0; color: var(--ink-3); font-size: 8px; }
  .identity-kicker { display: flex; justify-content: space-between; }.identity-kicker span { color: var(--active); font: 650 7px/1 var(--token-font-mono); }.identity label { display: block; margin-bottom: .25rem; color: var(--ink-3); font-size: 7px; }.identity input, textarea { box-sizing: border-box; width: 100%; padding: .4rem; border: 1px solid var(--active); border-radius: var(--token-radius-control); background: var(--raised); color: var(--ink); font-size: 8px; }.name-line h3 { margin: 0; font-size: 11px; overflow-wrap: anywhere; }.inspector-path { margin: .45rem 0 0; color: var(--ink-3); font: 500 7.5px/1.5 var(--token-font-mono); overflow-wrap: anywhere; }.edit-hint { display: block; margin-top: .25rem; color: var(--ink-3); font-size: 6.5px; }.manager-actions { flex-wrap: wrap; padding: .6rem .8rem; border-bottom: 1px solid var(--rule); }.manager-actions button { flex: 1 1 5rem; }.danger-outline { color: var(--danger) !important; border-color: var(--danger) !important; }
  .summary-head { display: flex; align-items: center; justify-content: space-between; gap: .4rem; }.summary-head small { margin: 0; }.summary { margin: .7rem 0; color: var(--ink); font: 400 9px/1.55 var(--token-font-serif); }.profile { margin: 0; padding-top: .55rem; border-top: 1px solid var(--rule); color: var(--ink-3); font-size: 7.5px; }.references { display: grid; gap: .25rem; margin: 0; padding-left: 1rem; color: var(--ink-2); font-size: 8px; }.muted { margin: 0; color: var(--ink-3); font-size: 8px; }textarea { min-height: 4.5rem; resize: vertical; }.save-context { margin-top: .45rem; }.delete-confirm { background: var(--danger-soft); }.delete-confirm strong { color: var(--danger); font-size: 9px; }.delete-confirm p { margin: .35rem 0 0; color: var(--ink-2); font-size: 8px; }.inline-actions { display: flex; gap: .35rem; margin-top: .45rem; }.inline-actions button:first-child { background: var(--active); color: var(--token-ink-on-fill); border-color: var(--active); }.inline-actions button.danger { background: var(--danger); border-color: var(--danger); }
  .mock-status { border-top-color: var(--rule-strong); }.mock-status strong { margin-left: auto; color: var(--success); font-weight: 600; }.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  @media (max-width: 82rem) { .mock-frame { grid-template-columns: 13rem minmax(28rem, 1fr) 18rem; } }
  @media (max-width: 60rem) { .mock-frame { grid-template-columns: 12rem minmax(27rem, 1fr); }.inspector-panel { grid-column: 1 / -1; min-height: 22rem; border-top: 1px solid var(--rule); border-left: 0; } }
  @media (max-width: 48rem) { .specimen-label > span, .mock-topbar small, .named-tab, .tab-divider { display: none; }.mock-frame { display: block; }.context-panel { min-height: 15rem; border-right: 0; border-bottom: 1px solid var(--rule); }.content-panel { min-height: 34rem; }.library-header { align-items: flex-start; flex-direction: column; }.library-tools { align-items: stretch; flex-direction: column; }.library-tools select { max-width: none; }.resource-table-wrap { overflow-x: auto; }.inspector-panel { min-height: auto; }.mock-status span:nth-child(3) { display: none; } }
</style>
