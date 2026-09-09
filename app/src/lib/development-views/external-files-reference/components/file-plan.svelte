<script lang="ts">
  import CheckCircle2 from "@lucide/svelte/icons/circle-check-big";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import Filter from "@lucide/svelte/icons/list-filter";

  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceHeader from "$development-views/external-files-reference/components/reference-header.svelte";
  import {
    IMPLEMENTATION_FILES,
    IMPLEMENTATION_LAYERS
  } from "$development-views/external-files-reference/procedures/file-plan";
  import type { ImplementationFile } from "$development-views/external-files-reference/types";
  import "$development-views/external-files-reference/components/reference.css";

  type LayerFilter = "all" | ImplementationFile["layer"];
  type ActionFilter = "all" | ImplementationFile["action"];

  const dependencyDiagram = `flowchart LR
    classDef source fill:#fffdf8,stroke:#315a72,color:#172232
    classDef owner fill:#e8f0ef,stroke:#347f78,color:#172232
    classDef generated fill:#fff1df,stroke:#d06b32,color:#492c17
    classDef proof fill:#201f35,stroke:#806fa9,color:#f6ebe2

    CFG["external-files.yaml<br/>actual runtime bounds"]:::source
    NATIVE["External native admission<br/>derive descriptor"]:::owner
    STORAGE["externalFileStorage<br/>verify · publish · read · remove"]:::owner
    REP["externalFiles row<br/>path + provenance + CAS"]:::owner
    CAP["external-files capability<br/>lifecycle + paths + History"]:::owner
    SEM["semantic-overlay<br/>material enqueue · status · retire"]:::owner
    ROUTE["authorized attachment route<br/>ranges + ETag"]:::source
    GEN["category-keys output<br/>external.library"]:::generated
    VIEW["External singleton<br/>Content · Context · Inspector"]:::source
    INDEX["project resource index<br/>file launcher"]:::source
    UNIT["unit tests<br/>bytes + capability + semantics"]:::proof
    BROWSER["Chromium system test<br/>upload → download → rename → delete"]:::proof
    REF["five reference pages<br/>implementation truth"]:::proof

    CFG --> CAP
    NATIVE --> STORAGE
    STORAGE --> CAP
    REP --> CAP
    CAP --> SEM
    CAP --> ROUTE
    CAP --> VIEW
    GEN --> VIEW
    INDEX --> VIEW
    STORAGE --> UNIT
    CAP --> UNIT
    SEM --> UNIT
    ROUTE --> BROWSER
    VIEW --> BROWSER
    UNIT --> REF
    BROWSER --> REF`;

  const verification = [
    ["Native content", "External descriptor derivation plus storage verification, reuse, legacy lookup, bounds, removal, and hash/size/id mismatch rejection", "Vitest filesystem integration", "passing"],
    ["Representation", "relative-path traversal, roots, separators, signatures, and fallback media types", "Vitest unit", "passing"],
    ["External capability", "upload/reuse/conflict, re-upload identity, file/directory moves, History, dataset context, scope, CAS, reference-safe delete and blob reclaim", "Vitest capability integration", "passing"],
    ["Semantic overlay", "no External exact lane, code/data material profiles, direct original-image vector, status, retirement and backfill", "Vitest integration", "passing"],
    ["Real workspace", "code lifecycle, same-URL re-upload, durable History, a copied 33-file source directory, atomic folder rename, and exact 8 MiB download", "Playwright Chromium", "passing"],
    ["Reference suite", "Mermaid rendering, interactive specimen, file filtering, compact viewport, implementation lessons", "Playwright Chromium", "covered in final validation"]
  ] as const;

  const settled = [
    ["Identity", "A file row is the project resource; SHA-256 is the shared immutable native-blob identity."],
    ["Replacement", "Upload rejects a different hash at an occupied path. Explicit Re-upload updates the same file id, keeps references, replaces its native receipt, and advances revision."],
    ["Deletion", "Deletion is a revision-aware hard delete after usage refusal and semantic retirement, followed by immediate unshared-blob reclamation."],
    ["Serving", "Every supported format is attachment-only. The route never provides an inline viewer and never serializes bytes through a remote query."],
    ["Workers", "External mutations enqueue supported material work. There is no manual Inspector refresh and no always-on worker host is deployed by this branch."],
    ["Compatibility", "New metadata fields are optional in the table shape; strict read admission supplies safe fallbacks for pre-feature rows."],
    ["Findings", "Deferred. The External category is shaped to accept another manager adapter later, but no Findings UI or mutation was implemented."]
  ] as const;

  let layer = $state<LayerFilter>("all");
  let action = $state<ActionFilter>("all");
  let query = $state("");
  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const visibleFiles = $derived(
    IMPLEMENTATION_FILES.filter((file) => {
      if (layer !== "all" && file.layer !== layer) return false;
      if (action !== "all" && file.action !== action) return false;
      return normalizedQuery === "" ||
        `${file.path} ${file.layer} ${file.owner} ${file.reason}`.toLocaleLowerCase().includes(normalizedQuery);
    })
  );
  const count = (value: ImplementationFile["action"]) =>
    IMPLEMENTATION_FILES.filter((file) => file.action === value).length;
</script>

<div class="external-files-reference">
  <ReferenceHeader current="file-plan" />

  <main class="reference-page">
    <header class="hero">
      <div>
        <a class="back" href="/demo/external-files">← External-files system</a>
        <span class="kicker">03 · exact implementation footprint</span>
        <h1>These are the files that changed.</h1>
        <p class="hero-copy">
          This is an implementation ledger, not a proposal. Every path is relative to the repository,
          every entry names its owner and responsibility, and generated registry output is distinguished
          from authored source. Findings and future extraction files are intentionally absent.
        </p>
      </div>
      <aside class="hero-aside">
        <header><span>Branch footprint</span><span>{IMPLEMENTATION_FILES.length} entries</span></header>
        <div>
          <h2>{count("created")} created · {count("modified")} modified · {count("removed")} removed · {count("generated")} generated</h2>
          <p>The ledger includes production, tests, live routes, browser isolation, and the reference suite itself.</p>
          <div class="status-pills"><span class="status-pill create">created</span><span class="status-pill extend">modified</span><span class="status-pill defer">removed</span><span class="status-pill exists">generated</span></div>
        </div>
      </aside>
    </header>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Dependency map</span><h2>Ownership flows from bytes to proof</h2></div>
        <p>The file count is large because this architecture keeps storage, representation, capability authority, semantic derivation, workspace state, and serving transport separate.</p>
      </div>
      <div class="diagram-frame"><MermaidDiagram source={dependencyDiagram} label="Implemented External file dependency graph" caption="Green owns durable state, white composes or presents it, amber is generated vocabulary, and dark nodes are executable proof and reference output." minHeight="36rem" /></div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Review ledger</span><h2>Every create, modify, remove, and generate</h2></div>
        <p>Filter by architectural layer, git action, path, owner, or purpose. This list is the concrete review surface for <code>work/external-files</code>.</p>
      </div>
      <div class="ledger-tools">
        <label><Filter size={14} aria-hidden="true" /><span class="sr-only">Search implementation files</span><input bind:value={query} placeholder="Filter path, owner, or reason" /></label>
        <select bind:value={layer} aria-label="Filter by architectural layer"><option value="all">All layers</option>{#each IMPLEMENTATION_LAYERS as value}<option value={value}>{value}</option>{/each}</select>
        <select bind:value={action} aria-label="Filter by change action"><option value="all">All actions</option><option value="created">Created</option><option value="modified">Modified</option><option value="removed">Removed</option><option value="generated">Generated</option></select>
        <strong>{visibleFiles.length} entries</strong>
      </div>
      <div class="file-ledger">
        {#each visibleFiles as file, index (file.path)}
          <article>
            <div class="file-marker"><span class="action {file.action}">{file.action === "created" ? "A" : file.action === "modified" ? "M" : file.action === "removed" ? "D" : "G"}</span><span>{file.layer}</span></div>
            <div class="file-path"><code>{file.path}</code><small>{file.owner}</small></div>
            <p>{file.reason}</p>
            <span class="obligation">{String(index + 1).padStart(2, "0")}</span>
          </article>
        {:else}
          <div class="empty-ledger">No implementation file matches these filters.</div>
        {/each}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Executable evidence</span><h2>What each validation layer proves</h2></div>
        <p>The browser test is not a mock: it starts the application against disposable row and byte stores and drives the real remote forms and response route.</p>
      </div>
      <div class="table-wrap"><table class="reference-table"><thead><tr><th>Layer</th><th>Behavior proved</th><th>Harness</th><th>Status</th></tr></thead><tbody>{#each verification as row}<tr>{#each row as cell}<td>{cell}</td>{/each}</tr>{/each}</tbody></table></div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Implemented policy</span><h2>Questions the code has now answered</h2></div>
        <p>These replace the earlier “decide before implementation” list. They describe current behavior and identify the one explicitly deferred adjacent resource kind.</p>
      </div>
      <ol class="acceptance-list">
        {#each settled as item, index}<li><span class="acceptance-icon"><CheckCircle2 size={17} strokeWidth={1.7} aria-hidden="true" /></span><span>{String(index + 1).padStart(2, "0")}</span><p><strong>{item[0]}.</strong> {item[1]}</p></li>{/each}
      </ol>
    </section>
  </main>

  <footer class="footer"><div><a href="/demo/external-files/implementation">Implementation learnings</a><a href="/demo/external-files/stable-tab">External library</a><a href="/demo/external-files">System overview</a></div><span><FileCode2 size={12} aria-hidden="true" /> Actual diff ledger on <code>work/external-files</code></span></footer>
</div>

<style>
  .ledger-tools { display: grid; grid-template-columns: minmax(15rem, 1fr) auto auto auto; gap: .7rem; align-items: center; margin-top: 1.2rem; padding: .75rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel) var(--token-radius-panel) 0 0; background: var(--panel); }
  .ledger-tools label { display: flex; min-width: 0; align-items: center; gap: .45rem; padding: .4rem .55rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--raised); color: var(--ink-3); }
  .ledger-tools input { width: 100%; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: 9px; }
  .ledger-tools select { min-height: 1.9rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--raised); color: var(--ink-2); font-size: 8.5px; text-transform: capitalize; }
  .ledger-tools > strong { color: var(--ink-3); font: 600 8px/1 var(--token-font-mono); white-space: nowrap; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
  .file-ledger { max-height: 60rem; border: 1px solid var(--rule); border-top: 0; background: var(--raised); overflow: auto; }
  .file-ledger article { display: grid; grid-template-columns: 8rem minmax(18rem, .9fr) minmax(20rem, 1fr) auto; gap: .8rem; align-items: start; padding: .75rem; border-top: 1px solid var(--rule); }
  .file-ledger article:first-child { border-top: 0; }
  .file-marker { display: flex; align-items: center; gap: .4rem; color: var(--ink-3); font: 600 7px/1 var(--token-font-mono); text-transform: uppercase; }
  .action { display: grid; width: 1.3rem; height: 1.3rem; place-items: center; border-radius: 3px; font-weight: 750; }
  .action.created { background: var(--success-soft); color: var(--success); }.action.modified { background: var(--attention-soft); color: var(--attention); }.action.removed { background: var(--danger-soft); color: var(--danger); }.action.generated { background: var(--interactive-soft); color: var(--interactive); }
  .file-path { display: grid; min-width: 0; gap: .25rem; }
  .file-path code { color: var(--ink); font-size: 8px; overflow-wrap: anywhere; }
  .file-path small { color: var(--ink-3); font-size: 7px; }
  .file-ledger article > p { margin: 0; color: var(--ink-2); font-size: 9px; }
  .obligation { color: var(--ink-3); font: 650 7px/1 var(--token-font-mono); }
  .empty-ledger { padding: 3rem; color: var(--ink-3); font-size: 10px; text-align: center; }
  .acceptance-list { margin: 1.2rem 0 0; padding: 0; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); list-style: none; overflow: hidden; }
  .acceptance-list li { display: grid; grid-template-columns: 1.5rem 2.5rem 1fr; gap: .5rem; align-items: start; padding: .8rem 1rem; border-bottom: 1px solid var(--rule); }
  .acceptance-list li:last-child { border-bottom: 0; }.acceptance-icon { color: var(--success); }.acceptance-list > li > span { color: var(--active); font: 600 8px/1.5 var(--token-font-mono); }.acceptance-list p { margin: 0; color: var(--ink-2); font-size: 10px; }.acceptance-list strong { color: var(--ink); }
  .footer > span { display: flex; align-items: center; gap: .35rem; }
  @media (max-width: 76rem) { .ledger-tools { grid-template-columns: 1fr 1fr; }.file-ledger article { grid-template-columns: 7rem minmax(14rem, .8fr) minmax(16rem, 1fr); }.obligation { display: none; } }
  @media (max-width: 52rem) { .ledger-tools { grid-template-columns: 1fr; }.file-ledger article { grid-template-columns: 1fr; }.file-marker { justify-content: space-between; } }
</style>
