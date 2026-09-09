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
    CAP["external-files capability<br/>list · read · rename · remove · download"]:::state
    SEM["semantic-overlay capability<br/>status · descriptor · refresh"]:::state

    subgraph Frame["App frame — sibling manager surfaces"]
      CTX["Context host<br/>library-wide state"]:::host
      CON["Content host<br/>resource inventory"]:::host
      INS["Inspector host<br/>selected subject"]:::host
    end

    C1["external.overview<br/>activity · policy"]:::view
    C2["external.library<br/>upload · search · filter · sort"]:::view
    C3["external.file<br/>rename · delete · summary · provenance"]:::view
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

  const panelContracts = [
    {
      panel: "Content surface",
      question: "Which non-editor resources are in this project?",
      owns: "File/folder upload entry points, latest mixed receipt, search, kind/semantic filters, sorting, library rows, quarantine notice, and empty/error states.",
      mustNot: "Render a file editor, decode arbitrary source bodies, put management actions inside every row, or create a tab for a selected item.",
      keys: "external.library"
    },
    {
      panel: "Context panel",
      question: "What is true of this library as a whole?",
      owns: "Inventory counts, current-row activity projection, storage/semantic coverage, configured limits, and project-wide management policy.",
      mustNot: "Follow every selected row, duplicate file controls, or present a generated summary as a library-wide fact.",
      keys: "external.overview · .activity · .policy"
    },
    {
      panel: "Inspector panel",
      question: "What is this selected file, and what can I do to it?",
      owns: "Local display rename, delete, original provenance, byte identity, download, semantic coverage, generated-summary review, and retry actions.",
      mustNot: "Edit source bytes, become a format-specific editor, erase the original filename on rename, or imply unsupported extraction exists.",
      keys: "external.file (Findings adapter deferred)"
    }
  ] as const;

  const stateOwnership = [
    ["Source bytes", "materialContent model", "content-addressed by SHA-256; immutable internal storage", "Yes"],
    ["ExternalFile row", "representation store", "original name/path + mutable display name + revision + actors + trusted byte receipt", "Yes"],
    ["Tab identity", "workspace TabRecord", "id external, category external, no resourceId", "Yes"],
    ["Selected subject", "workspace TabView", "focus externalFileId + external.file selection + active Context lens", "Yes"],
    ["Library query", "external-files capability cache", "all admitted project rows plus unavailable entries and live limits", "No — refetch"],
    ["Inspector edit draft", "external.file component", "rename draft, confirmation, pending action, recoverable error", "Never"],
    ["Semantic products", "semantic overlay", "eligibility, jobs, profile, generated descriptor, provenance, generation", "Yes, but derived"],
    ["Deletion cleanup", "external-files + semantic capabilities", "usage refusal, semantic retirement, hard row removal, immediate shared-hash check and unshared-byte removal", "Ordered workflow"]
  ] as const;

  const managerStates = [
    ["Resolving", "Library query pending", "Keep the stable External frame and show a neutral inventory skeleton."],
    ["Ready", "Rows available", "Search, filter, select, upload, and inspect without decoding source bytes in Content."],
    ["Nothing yet", "No managed resources", "Explain the library and offer file or directory upload; reserve Findings as a later kind."],
    ["No matches", "Filters hide all rows", "Keep the library count, expose Clear filters, and do not pretend the project is empty."],
    ["Unavailable row", "Stored metadata is corrupt", "Report a bounded unavailable count while valid rows remain manageable."],
    ["Selected file missing", "Row was deleted or access changed", "Clear stale selection, keep the singleton open, and return focus to the inventory."],
    ["Bytes unavailable", "Verified read fails", "Inspector preserves trusted metadata, disables download, and exposes report/recovery state."],
    ["Semantic limited", "Queued, failed, or unsupported", "Inspector says exactly which lane is pending or unavailable and offers retry only when meaningful."]
  ] as const;

  const interactionRules = [
    ["Open the manager", "Top-bar External and every file launcher call workspace.open({ category: external, focus? }). The singleton target key is external."],
    ["Select a row", "Single click aligns durable focus with { kind: external-file, id } and opens external.file. Selection changes the Inspector, never the tab list."],
    ["Upload", "Files and directories enter through the library action. Successful rows appear immediately; a chosen receipt may become the inspected subject."],
    ["Rename locally", "Inspector updates only the project display name with a base revision. Original name, relative path, hash, and bytes remain provenance."],
    ["Delete", "Inspector requires confirmation and zero represented usage; it retires semantics, rechecks revision/usage, hard-deletes the row, then removes only an unshared blob."],
    ["Review semantics", "Inspector shows exact/material eligibility, generation, generated-summary provenance, uncertainty, failure, and refresh—not an editor for the summary."],
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
          Context explains the library; selecting a row drives a file Inspector where people rename, delete,
          download, and review semantic products. Files do not become workspace tabs of their own.
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
          Select any file row, switch the library-wide Context rail, edit a local display name, inspect the
          generated semantic summary, or exercise the delete confirmation. This specimen communicates the
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
        <div><span class="kicker">Stable identity</span><h2>The category persists; the selected resource changes</h2></div>
        <p>The implementation special-cases singleton categories: their key and tab ID are the category. External uses that existing mechanism, and workspace adoption adds its missing landing to older snapshots.</p>
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
