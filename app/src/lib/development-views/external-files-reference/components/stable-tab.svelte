<script lang="ts">
  import AlertTriangle from "@lucide/svelte/icons/triangle-alert";
  import CheckCircle2 from "@lucide/svelte/icons/circle-check-big";
  import Eye from "@lucide/svelte/icons/eye";
  import Layers3 from "@lucide/svelte/icons/layers-3";
  import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";

  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceHeader from "$development-views/external-files-reference/components/reference-header.svelte";
  import StableTabMock from "$development-views/external-files-reference/components/stable-tab-mock.svelte";
  import "$development-views/external-files-reference/components/reference.css";

  const identityDiagram = `flowchart LR
    classDef persisted fill:#e8f0ef,stroke:#347f78,color:#172232
    classDef calculated fill:#fff1df,stroke:#d06b32,color:#492c17
    classDef view fill:#fffdf8,stroke:#315a72,color:#172232

    A["top bar, upload receipt,<br/>or project resource row"]:::view
    O["workspace.open<br/>category: external<br/>focus: externalFiles:42"]:::view
    K["targetKey<br/>external"]:::calculated
    T["singleton TabRecord<br/>id: external<br/>no resourceId"]:::persisted
    V["TabView<br/>content: external.library<br/>focus: externalFiles:42<br/>inspected: external.file<br/>selection: external-file / 42"]:::persisted
    S[("workspace snapshot")]:::persisted
    N["select externalFiles:77<br/>same tab, new subject"]:::view
    R["restored External library<br/>and selected file"]:::view

    A --> O --> K --> T --> V --> S
    N --> V
    S -->|next session| R
    R --> K`;

  const compositionDiagram = `flowchart TB
    classDef host fill:#201f35,stroke:#806fa9,color:#f6ebe2
    classDef registry fill:#fff1df,stroke:#d06b32,color:#492c17
    classDef view fill:#fffdf8,stroke:#315a72,color:#172232
    classDef state fill:#e8f0ef,stroke:#347f78,color:#172232

    WS["Workspace state<br/>External singleton + TabView"]:::state
    OPEN["OPENING external<br/>library + overview rail"]:::registry
    START["SINGLETONS + permanent<br/>tab-bar control"]:::registry
    CAP["external-files capability<br/>ingest · replace · move · history · delete"]:::state
    SEM["semantic-overlay capability<br/>exact/material status · atomic outbox"]:::state

    subgraph Frame["App frame — sibling manager surfaces"]
      CTX["Context host<br/>library-wide state"]:::host
      CON["Content host<br/>resource inventory"]:::host
      INS["Inspector host<br/>selected subject"]:::host
    end

    C1["external.overview · external.history<br/>aggregate + durable events"]:::view
    C2["external.library<br/>table/directory · upload · search · sort"]:::view
    C3["external.file · external.directory<br/>compact manager Inspectors"]:::view
    FUT["external.finding<br/>future subject adapter"]:::view

    START --> WS
    OPEN --> WS
    WS --> CTX
    WS --> CON
    WS --> INS
    CAP --> C1
    CAP --> C2
    CAP --> C3
    SEM --> C1
    SEM --> C3
    CTX --> C1
    CON --> C2
    INS --> C3
    C2 -->|focus + file selection| WS
    WS -->|inspected key + selection| C3
    FUT -. later .-> INS`;

  const directoryDiagram = `flowchart TB
    classDef row fill:#e8f0ef,stroke:#347f78,color:#172232
    classDef projection fill:#fffdf8,stroke:#315a72,color:#172232
    classDef mutation fill:#fff1df,stroke:#d06b32,color:#492c17
    classDef guard fill:#201f35,stroke:#806fa9,color:#f6ebe2

    R1["externalFiles:A<br/>research/site/photo.png · rev 2"]:::row
    R2["externalFiles:B<br/>research/site/notes.csv · rev 4"]:::row
    R3["externalFiles:C<br/>research/readme.txt · rev 1"]:::row
    P["directory projection<br/>root / research / research/site"]:::projection
    T["revision token<br/>hash of descendant id + revision + path"]:::guard
    I["Directory Inspector<br/>rename or move research/site"]:::mutation
    C{"collision and self-descendant checks"}:::guard
    A["Store.transaction<br/>all descendant rows + History<br/>+ semantic outbox"]:::mutation

    R1 --> P
    R2 --> P
    R3 --> P
    P --> T --> I --> C
    C -->|accepted| A
    A --> R1
    A --> R2`;

  const panelContracts = [
    {
      panel: "Content surface",
      question: "Which non-editor resources are in this project?",
      owns: "File/folder upload entry points, latest mixed receipt, Table/Directory toggle, breadcrumbs, search, kind/semantic filters, sorting, virtual folders, file rows, quarantine notice, and empty/error states.",
      mustNot: "Render a file editor, decode arbitrary source bodies, put management actions inside every row, or create a tab for a selected item.",
      keys: "external.library"
    },
    {
      panel: "Context panel",
      question: "What is true of this library as a whole?",
      owns: "Overview for inventory/storage/material coverage and History for durable upload, re-upload, rename, move, context-update, and delete events.",
      mustNot: "Follow every selected row, duplicate file controls, or present a generated summary as a library-wide fact.",
      keys: "external.overview · external.history"
    },
    {
      panel: "Inspector panel",
      question: "What is this selected file, and what can I do to it?",
      owns: "A compact top action row (Rename, Re-upload, Download, Move, Delete), double-click name/path edits, availability and Details, reference count/list, dataset context, semantic status, and generated descriptions only when present. A directory Inspector manages a projected subtree.",
      mustNot: "Edit source bodies, become a format-specific editor, expose internal hash/storage fields, show summary UI for unsupported files, or imply unsupported extraction exists.",
      keys: "external.file · external.directory (Findings deferred)"
    }
  ] as const;

  const stateOwnership = [
    ["Native descriptor", "external-files capability", "server-derived hash + size + storage id + MIME + subkind", "Re-derived on re-upload"],
    ["Source bytes", "externalFileStorage model", "verified content-addressed native value, publication recovery copy, and represented-row claim", "Yes; replaced explicitly"],
    ["ExternalFile row", "representation store", "original upload name + mutable local name/path + optional dataset context + revision + actors + native receipt", "Yes"],
    ["Virtual directory", "external-files projection", "path, parent, direct/descendant counts, byte totals, opaque descendant revision token", "No row — refetch"],
    ["Tab identity", "workspace TabRecord", "id external, category external, no resourceId", "Yes"],
    ["Selected subject", "workspace TabView", "focus externalFileId + external.file selection + active Context lens", "Yes"],
    ["Library query", "external-files capability cache", "all admitted project rows plus unavailable entries and live limits", "No — refetch"],
    ["Inspector edit draft", "instance-owned file/directory state", "rename/move/context drafts, confirmation, pending action, recoverable error", "Never"],
    ["Semantic products", "semantic overlay", "material eligibility, job, profile/native visual facet, optional generated descriptor, generation", "Yes, but derived"],
    ["History event", "activity table via external-files", "immutable project-scoped lifecycle event independent of the current row", "Yes; last 200 read"],
    ["Deletion cleanup", "external-files capability", "typed usage refusal plus one Store transaction for forget/outbox/row/history, then claim release and unshared-byte collection", "Atomic metadata + idempotent cleanup"]
  ] as const;

  const managerStates = [
    ["Resolving", "Library query pending", "Keep the stable External frame and show a neutral inventory skeleton."],
    ["Ready", "Rows available", "Search, filter, select, upload, and inspect without decoding source bytes in Content."],
    ["Nothing yet", "No managed resources", "Explain the library and offer file or directory upload; reserve Findings as a later kind."],
    ["No matches", "Filters hide all rows", "Keep the library count, expose Clear filters, and do not pretend the project is empty."],
    ["Unavailable row", "Stored metadata is corrupt", "Report a bounded unavailable count while valid rows remain manageable."],
    ["Selected file missing", "Row was deleted or access changed", "Clear stale selection, keep the singleton open, and return focus to the inventory."],
    ["Bytes unavailable", "Verified read fails", "Inspector preserves trusted metadata, disables download, and exposes report/recovery state."],
    ["Semantic limited", "Queued, failed, or unsupported", "Inspector describes exact-text state for prose, material state for code/data/image, and has no manual refresh or misleading generated-summary block."],
    ["Selected directory changed", "A descendant revision token is stale", "Reject the subtree move, refetch, and keep the current directory selected."]
  ] as const;

  const interactionRules = [
    ["Open the manager", "Top-bar External and every file launcher call workspace.open({ category: external, focus? }). The singleton target key is external."],
    ["Find from New Tab", "Search retains every file and opens External with that file focused. Recent collapses the manager-only file family to its newest entry so folder ingestion cannot crowd out editor work."],
    ["Select a row", "Single click aligns durable focus with { kind: external-file, id } and opens external.file. Selection changes the Inspector, never the tab list."],
    ["Upload", "Files and directories enter through the library action. Successful rows appear immediately; a chosen receipt may become the inspected subject."],
    ["Rename locally", "Rename or double-click Name performs file CAS, updates the name and path leaf, preserves original upload name and bytes, and advances revision."],
    ["Move a file", "Move or double-click Path changes the destination directory while retaining the leaf name; file CAS, canonical path admission, and path uniqueness commit with History and semantic outbox."],
    ["Move a directory", "Select a projected folder and rename/move it in external.directory. A descendant-set token rejects stale work; every affected path commits atomically."],
    ["Re-upload", "The top action chooses replacement bytes for the same row. Name/path/id and existing references remain; byte receipt and material revision change."],
    ["Delete", "Inspector requires confirmation and zero live represented usage. One Store transaction forgets semantics, records deletion intent and History, and removes the row; native cleanup then releases its claim and removes only an unshared blob."],
    ["Review semantics", "Prose exposes exact-text status without a generated summary. Code/data can expose a generated description only when one exists; standalone images explain direct visual embedding; managed-only formats stay explicit."],
    ["Add dataset context", "CSV/TSV exposes authored context in the Inspector. Saving or clearing it advances revision while semantic forget and revised outbox intent commit in the same Store transaction."],
    ["Download", "Inspector uses the authorized attachment response with range and integrity headers. No inline quick look and no format-specific Icarus editor is implemented."],
    ["Add Findings later", "The library gains a finding adapter and external.finding lens; singleton identity, Content shell, Context, selection, and routing stay unchanged."]
  ] as const;
</script>

<div class="external-files-reference">
  <ReferenceHeader current="stable-tab" />

  <main class="reference-page wide-page">
    <header class="hero">
      <div>
        <a class="back" href="/demo/external-files">← External-files system</a>
        <span class="kicker">02 · singleton resource management</span>
        <h1>One library. No file editors.</h1>
        <p class="hero-copy">
          External is a project-level stable tab like Overview and Templates. Content is an inventory;
          Context provides Overview and durable History; selecting a row drives a compact file or directory
          Inspector for lifecycle management. Files do not become workspace tabs of their own.
        </p>
      </div>
      <aside class="hero-aside">
        <header><span>Singleton identity</span><span>implemented workspace pattern</span></header>
        <div>
          <h2><code>external</code></h2>
          <p>The category is in SINGLETONS. The selected externalFileId belongs in focus/selection, not TabRecord.resourceId.</p>
          <div class="status-pills"><span class="status-pill exists">live permanent tab</span><span class="status-pill extend">selected subject</span></div>
        </div>
      </aside>
    </header>

    <section class="section mock-section">
      <div class="section-head">
        <div><span class="kicker">Interactive reference specimen</span><h2>Library in Content, management in Inspector</h2></div>
        <p>
          Select a file or projected folder, switch between Table and Directory views, open durable History,
          edit local name/path, exercise re-upload, or inspect the conditional material section. This specimen communicates the
          panel contract; the same lifecycle is executable in the production surface at <code>/app/dev-project</code>.
        </p>
      </div>
      <StableTabMock />
      <div class="callout">
        <AlertTriangle size={18} strokeWidth={1.8} aria-hidden="true" />
        <div><h3>The file ID is the selected subject—not the tab target.</h3><p>Opening External from the top bar may inspect nothing. A launcher or upload receipt may focus a real row; stale or deleted focus must resolve back to the empty Inspector safely.</p></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Directory view</span><h2>A folder is a view that can still be managed safely</h2></div>
        <p>There is no second directory entity to synchronize. The capability projects folders from file paths, gives each projection an opaque descendant-set token, and rewrites a subtree only after stale and collision checks.</p>
      </div>
      <div class="diagram-frame">
        <MermaidDiagram source={directoryDiagram} label="Virtual External directory projection and atomic move" caption="The folder Inspector changes every descendant path in one externalFiles-table persistence boundary; the native bytes never move." minHeight="34rem" />
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Stable identity</span><h2>The category persists; the selected resource changes</h2></div>
        <p>The implementation special-cases singleton categories: their key and tab ID are the category. External uses that current mechanism and persists its landing, focus, and selection in the current workspace schema.</p>
      </div>
      <div class="diagram-frame">
        <MermaidDiagram source={identityDiagram} label="External singleton identity, file selection, and restoration" caption="The stable identity is external. An externalFiles id is restorable focus and Inspector selection, never a per-file TabRecord.resourceId." minHeight="32rem" />
      </div>
      <div class="callout success">
        <CheckCircle2 size={18} strokeWidth={1.8} aria-hidden="true" />
        <div><h3>“Stable” describes the manager, not every managed row.</h3><p>Moving from one file to another updates the subject inside the same External tab. Overview, Templates, and External remain predictable project landmarks.</p></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Composition</span><h2>Three existing hosts, one management concern</h2></div>
        <p>The filesystem view system supplies Content, Context, and Inspector components. Content and Context are category-level; only Inspector resolves the selected resource in detail.</p>
      </div>
      <div class="diagram-frame">
        <MermaidDiagram source={compositionDiagram} label="External singleton panel and capability composition" caption="The external-files capability owns file mutations; workspace state owns selected subject; semantic products remain derived. Findings can later add an adapter without another stable tab." minHeight="40rem" />
      </div>
      <div class="panel-grid">
        {#each panelContracts as panel, index}
          <article>
            <header><span>{String(index + 1).padStart(2, "0")}</span><strong>{panel.panel}</strong></header>
            <h3>{panel.question}</h3>
            <dl><div><dt>Owns</dt><dd>{panel.owns}</dd></div><div><dt>Must not</dt><dd>{panel.mustNot}</dd></div><div><dt>View keys</dt><dd><code>{panel.keys}</code></dd></div></dl>
          </article>
        {/each}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">State topology</span><h2>Persist identity and intent, refetch projections</h2></div>
        <p>The selected row can survive restoration, but library results, privileged byte URLs, pending drafts, and confirmation state cannot. Mutations remain revision-aware capability calls.</p>
      </div>
      <div class="table-wrap">
        <table class="reference-table state-table">
          <thead><tr><th>State</th><th>Owner</th><th>Shape</th><th>Persist?</th></tr></thead>
          <tbody>{#each stateOwnership as row}<tr>{#each row as cell}<td>{cell}</td>{/each}</tr>{/each}</tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Manager state machine</span><h2>Failure does not turn the library into an editor</h2></div>
        <p>Inventory, metadata, byte availability, and semantic readiness fail independently. Every state preserves a useful project-level manager and a truthful Inspector.</p>
      </div>
      <div class="state-grid">
        {#each managerStates as state, index}
          <article><span>{String(index + 1).padStart(2, "0")}</span><div><small>{state[1]}</small><h3>{state[0]}</h3><p>{state[2]}</p></div></article>
        {/each}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Interaction contract</span><h2>Every gesture has one owner</h2></div>
        <p>The Templates library remains the behavioral precedent: the library selects; workspace state remembers; the Inspector reads and mutates through scoped capabilities.</p>
      </div>
      <div class="rule-grid">
        {#each interactionRules as rule}
          <article><span class="rule-icon"><MousePointer2 size={16} strokeWidth={1.7} aria-hidden="true" /></span><div><h3>{rule[0]}</h3><p>{rule[1]}</p></div></article>
        {/each}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Accessibility and scale</span><h2>A dense manager remains navigable</h2></div>
        <p>Resource count, keyboard row selection, destructive-action confirmation, and an independently scrollable Inspector matter more here than format rendering.</p>
      </div>
      <div class="card-grid">
        <article class="card"><span class="card-icon"><Eye size={18} strokeWidth={1.7} aria-hidden="true" /></span><h3>Selection is explicit</h3><p>The table exposes row selection independently from buttons. Inspector headings name the selected file, and removal announces where focus returns.</p></article>
        <article class="card"><span class="card-icon"><MousePointer2 size={18} strokeWidth={1.7} aria-hidden="true" /></span><h3>Mutations are deliberate</h3><p>Rename has Save/Cancel and keyboard semantics. Delete requires a named confirmation, preserves focus on cancellation, and reports pending/error state.</p></article>
        <article class="card"><span class="card-icon"><Layers3 size={18} strokeWidth={1.7} aria-hidden="true" /></span><h3>Inventory is projected</h3><p>The capability returns all strictly admitted project rows; search, sort, and filters are local. Detail, usage, integrity, and semantic review are resolved only for the selected row.</p></article>
      </div>
    </section>
  </main>

  <footer class="footer"><div><a href="/demo/external-files/ingestion">Ingestion</a><a href="/demo/external-files/file-plan">Exact file map</a><a href="/demo/external-files/implementation">Implementation learnings</a></div><span>One External singleton · files now · Findings deferred</span></footer>
</div>

<style>
  .wide-page { width: min(100%, 104rem); }
  .mock-section { margin-top: 6rem; }
  .panel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .9rem; margin-top: 1.2rem; }
  .panel-grid article { padding: 1rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); }
  .panel-grid header { display: flex; align-items: center; gap: .5rem; color: var(--ink-3); font-size: 9px; }
  .panel-grid header span { color: var(--active); font: 650 8px/1 var(--token-font-mono); }
  .panel-grid h3 { margin: 1.1rem 0 .8rem; font-size: 1.05rem; }
  .panel-grid dl { display: grid; gap: .7rem; margin: 0; }
  .panel-grid dl div { display: grid; gap: .2rem; }
  .panel-grid dt { color: var(--ink-3); font-size: 7px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .panel-grid dd { margin: 0; color: var(--ink-2); font-size: 9.5px; }
  .panel-grid code { overflow-wrap: anywhere; }
  .state-table { min-width: 69rem; }
  .state-table td:first-child { font-weight: 650; }
  .state-table td:last-child { white-space: nowrap; }
  .state-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; margin-top: 1.2rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--rule); overflow: hidden; }
  .state-grid article { display: grid; grid-template-columns: 2.5rem 1fr; gap: .7rem; min-height: 8.5rem; padding: 1rem; background: var(--raised); }
  .state-grid article > span { color: var(--active); font: 650 8px/1.4 var(--token-font-mono); }
  .state-grid small { color: var(--ink-3); font: 600 7px/1 var(--token-font-mono); letter-spacing: .06em; text-transform: uppercase; }
  .state-grid h3 { margin: .4rem 0 .3rem; font-size: 1rem; }
  .state-grid p { margin: 0; color: var(--ink-2); font-size: 10px; }
  .rule-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem; margin-top: 1.2rem; }
  .rule-grid article { display: grid; grid-template-columns: 1.8rem minmax(0, 1fr); gap: .5rem; padding: .85rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--raised); }
  .rule-icon { color: var(--active); }
  .rule-grid h3 { margin: 0; font-size: 10px; }
  .rule-grid p { margin: .25rem 0 0; color: var(--ink-2); font-size: 9.5px; }
  .card-icon { display: block; margin-bottom: 1.1rem; color: var(--active); }
  @media (max-width: 72rem) { .panel-grid { grid-template-columns: 1fr; } }
  @media (max-width: 52rem) { .state-grid, .rule-grid { grid-template-columns: 1fr; } }
</style>
