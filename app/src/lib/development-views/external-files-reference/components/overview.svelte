<script lang="ts">
  import AlertTriangle from "@lucide/svelte/icons/triangle-alert";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import CheckCircle2 from "@lucide/svelte/icons/circle-check-big";
  import Database from "@lucide/svelte/icons/database";
  import FileArchive from "@lucide/svelte/icons/file-archive";
  import PanelsTopLeft from "@lucide/svelte/icons/panels-top-left";
  import Workflow from "@lucide/svelte/icons/workflow";

  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceHeader from "$development-views/external-files-reference/components/reference-header.svelte";
  import { CURRENT_TRUTHS } from "$development-views/external-files-reference/procedures/contracts";
  import "$development-views/external-files-reference/components/reference.css";

  const architecture = `flowchart LR
    classDef existing fill:#e8f0ef,stroke:#347f78,color:#172232
    classDef extend fill:#fff1df,stroke:#d06b32,color:#492c17
    classDef new fill:#fffdf8,stroke:#315a72,color:#172232
    classDef async fill:#201f35,stroke:#806fa9,color:#f6ebe2

    U["File picker<br/>files or directory"]:::new
    subgraph EXT["External capability — authoritative umbrella"]
      F["admission<br/>scope · limits · hostile input"]:::new
      D["native descriptor<br/>hash · size · MIME · subkind"]:::new
      B["externalFileStorage<br/>verify · publish · read · remove"]:::existing
      R[("externalFiles row<br/>identity · path · provenance · revision")]:::existing
      H[("durable History<br/>upload · move · rename · replace · delete")]:::existing
      DIR["virtual directories<br/>projection + atomic descendant move"]:::existing
    end
    Q[("semantic material queue<br/>supported types only")]:::async
    W["External singleton<br/>one manager tab per project"]:::existing
    C["Content<br/>upload + searchable library"]:::existing
    X["Context<br/>overview + history"]:::existing
    I["Inspector<br/>file or directory manager"]:::existing
    G["Findings<br/>deferred managed kind"]:::extend
    M["material worker<br/>code profile · data profile<br/>or direct image vector"]:::existing

    U -->|multipart candidates| F -->|bounded bytes| D
    D -->|complete descriptor| B
    B -->|verified receipt| R
    R --> H
    R --> DIR
    R -. committed ref .-> Q
    R -->|open target| W
    W --> C
    W --> X
    W --> I
    G -. future adapter .-> C
    Q -. asynchronous .-> M`;

  const contracts = [
    {
      icon: FileArchive,
      title: "External owns native identity",
      text: "External derives hash, size, storage id, MIME family, and subkind. externalFileStorage only verifies and persists that descriptor; material processing never performs general byte management."
    },
    {
      icon: Database,
      title: "Folders are mutable projections",
      text: "A selected directory becomes a bounded batch. Each file owns a canonical relative path; folder rows are projected and an entire subtree moves through one collision-checked table commit."
    },
    {
      icon: PanelsTopLeft,
      title: "The tab is the library",
      text: "External is one category-keyed singleton like Overview and Templates. A selected row drives focus and the Inspector; it does not mint a file tab."
    },
    {
      icon: Workflow,
      title: "Material receives admitted meaning",
      text: "Plain text and source code share one code-profile material; CSV/TSV gets one data material; standalone images become one native visual vector. Other media stays managed without semantic rows."
    }
  ] as const;

  const pages = [
    {
      index: "01",
      href: "/demo/external-files/ingestion",
      title: "Ingestion",
      summary: "The browser-to-bytes-to-row transaction boundary, classification, semantic routing, security, and recovery behavior.",
      detail: "4 diagrams · 7 format contracts · re-upload"
    },
    {
      index: "02",
      href: "/demo/external-files/stable-tab",
      title: "External library",
      summary: "An interactive singleton manager specimen: table/directory inventory in Content, Overview/History in Context, and compact file or folder management in Inspector.",
      detail: "4 file rows · 2 views · 3 panels"
    },
    {
      index: "03",
      href: "/demo/external-files/file-plan",
      title: "File map",
      summary: "The exact implemented file footprint, ownership graph, authored/generated distinction, test matrix, and settled policy choices.",
      detail: "complete diff ledger"
    },
    {
      index: "04",
      href: "/demo/external-files/implementation",
      title: "Implementation learnings",
      summary: "What live implementation changed: multipart transport, proxy identity, capability ownership, cleanup, semantic eligibility, and explicit concessions.",
      detail: "4 diagrams · 15 discoveries"
    }
  ] as const;

  const decisions = [
    ["Category key", "external", "Names the project-level home for resources without dedicated editors."],
    ["Content key", "external.library", "One searchable manager surface can add resource-kind adapters over time."],
    ["Tab target", "category only", "external is in SINGLETONS and has the same permanent identity as Overview and Templates."],
    ["Selected item", "focus + Selection", "The selected externalFileId restores the row and drives external.file in Inspector without becoming the tab identity."],
    ["Managed kinds", "files now · findings later", "The category is intentionally broader than the first adapter and does not promise editors for either kind."],
    ["Byte owner", "External", "The capability derives hash, size, media type, and subkind; material receives a trusted reference rather than owning general bytes."],
    ["Byte repository", "externalFileStorage", "A narrowly named model verifies and persists External-owned descriptors; it also reads legacy material-directory blobs for compatibility."],
    ["Folder model", "relativePath projection", "Directories remain views over rows, but files and whole subtrees can move through revision-aware capability procedures."],
    ["Upload transport", "remote form", "SvelteKit remote forms carry File/File[]; command payloads are not a binary boundary."],
    ["Read transport", "authorized response route", "Verified/ranged bytes are never serialized through metadata queries; every format downloads as an attachment."],
    ["Launcher behavior", "search all · recent one", "Project Overview and New Tab search focus files in External. New Tab Recent keeps only the newest file card so a batch cannot monopolize the shelf."],
    ["Local rename", "name + path leaf", "Double-click or Rename updates the local name and path leaf, preserves original upload name/bytes, advances revision, and requeues eligible meaning."],
    ["Path change", "move", "Double-click Path or use Move; file CAS protects one row and directory tokens protect an atomic subtree replacement."],
    ["Delete", "usage-safe hard delete", "Retire semantic products, recheck revision and usage, remove the row, then immediately reclaim only an unshared hash."],
    ["Re-upload", "same resource identity", "Re-upload is the explicit update path: keep id/name/path, replace native receipt, increment revision, retire old meaning, queue supported new meaning, and reclaim an unshared predecessor blob."],
    ["Semantic routing", "material only", "External exact ingestion is disabled. Plain text and source code share externalFile::code; CSV/TSV uses a bounded data profile; images use their original visual embedding; all other types stay outside the overlay."],
    ["Dataset context", "optional authored text", "CSV/TSV Inspector context is revisioned input to material meaning because tabular values can be ambiguous without human framing."],
    ["Context views", "Overview + History", "There is no Policy page. History is a durable event projection and survives deletion of the managed file."],
    ["Worker timing", "post-commit durable jobs", "Semantic failure cannot roll back ingestion; queue processors and backfill are real seams, but this branch does not deploy an always-on worker or expose manual Inspector refresh."]
  ] as const;
</script>

<div class="external-files-reference">
  <ReferenceHeader current="overview" />

  <main class="reference-page">
    <header class="hero">
      <div>
        <a class="back" href="/demo">← All demos</a>
        <span class="kicker">External files · implemented architecture</span>
        <h1>External owns files; materials receive meaning.</h1>
        <p class="hero-copy">
          This suite explains the implemented path from a local file or browser directory to verified
          External-owned native storage, project metadata, recoverable material representations, and a
          persistent three-panel manager. Claims are grounded in production code and executable tests.
        </p>
      </div>

      <aside class="hero-aside">
        <header><span>Architecture status</span><span>implemented + tested</span></header>
        <div>
          <h2>The reference now describes the running system.</h2>
          <p>
            Upload, storage, scoped lifecycle operations, the External singleton, file Inspector,
            safe download route, semantic status/retirement, and browser proof all live on this branch.
          </p>
          <div class="status-pills" aria-label="Status legend">
            <span class="status-pill exists">implemented</span>
            <span class="status-pill extend">bounded</span>
            <span class="status-pill defer">Findings deferred</span>
          </div>
        </div>
      </aside>
    </header>

    <section class="section">
      <div class="section-head">
          <div><span class="kicker">Whole system</span><h2>One library, one byte owner, one eligible semantic lane</h2></div>
        <p>
          The capability turns untrusted browser input into a trusted native descriptor, byte receipt, and
          project row. The singleton library consumes that identity; the material lane receives only supported
          committed references.
          Solid edges are implemented ownership; dotted edges are queued or explicitly deferred.
        </p>
      </div>
      <div class="diagram-frame">
        <MermaidDiagram
          source={architecture}
          label="Implemented external-file system architecture"
          caption="Green nodes own durable behavior, white nodes present or coordinate it, amber marks the deferred Findings adapter, and dark nodes are asynchronous semantics."
          minHeight="31rem"
        />
      </div>
      <div class="callout success">
        <CheckCircle2 size={18} strokeWidth={1.8} aria-hidden="true" />
        <div>
          <h3>The usable-file boundary is a verified native receipt plus its External row.</h3>
          <p>Once both exist, the file can be managed and downloaded. Material work is downstream, may be late or fail safely, and can be recovered through queue processing or backfill.</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Code truth</span><h2>What the branch provides now</h2></div>
        <p>
          These claims were traced through implementation and tests. Older external-file documentation is
          not treated as authority where it describes the retired storage stack or pre-library behavior.
        </p>
      </div>
      <div class="truth-grid">
        {#each CURRENT_TRUTHS as truth}
          <article>
            <header>
              <span class:exists={truth.state === "exists"} class:partial={truth.state === "partial"}>{truth.state}</span>
              <strong>{truth.area}</strong>
            </header>
            <p>{truth.contract}</p>
            <code>{truth.evidence}</code>
          </article>
        {/each}
      </div>
      <div class="callout">
        <AlertTriangle size={18} strokeWidth={1.8} aria-hidden="true" />
        <div>
          <h3>A stored preview is not the same promise as parsed knowledge.</h3>
          <p>PDF, Office, audio, video, and unknown binaries can be safely stored and downloaded. They are not viewed, parsed, transcribed, or represented as searchable knowledge in this implementation. Plain text is intentionally part of the unified code-profile material family.</p>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Reference route</span><h2>Read from lifecycle to locality</h2></div>
        <p>Each page owns one decision layer and links back to the verified contracts summarized here.</p>
      </div>
      <div class="page-grid">
        {#each pages as page}
          <a href={page.href}>
            <header><span>{page.index}</span><small>{page.detail}</small></header>
            <h3>{page.title}</h3>
            <p>{page.summary}</p>
            <footer>Open reference <ArrowRight size={14} aria-hidden="true" /></footer>
          </a>
        {/each}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Durable decisions</span><h2>Names and boundaries in production</h2></div>
        <p>These implemented choices keep bytes, project identity, workspace state, and derived interpretation from collapsing into one layer.</p>
      </div>
      <div class="table-wrap">
        <table class="reference-table">
          <thead><tr><th>Decision</th><th>Contract</th><th>Why this shape</th></tr></thead>
          <tbody>
            {#each decisions as decision}
              <tr><td><strong>{decision[0]}</strong></td><td><code>{decision[1]}</code></td><td>{decision[2]}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Cross-layer invariants</span><h2>Rules that must survive refinement</h2></div>
        <p>A future change that breaks one of these rules needs an explicit architecture decision because its effects cross storage, workspace, and semantic ownership.</p>
      </div>
      <div class="card-grid contracts">
        {#each contracts as contract}
          {@const ContractIcon = contract.icon}
          <article class="card">
            <span class="contract-icon"><ContractIcon size={18} strokeWidth={1.7} aria-hidden="true" /></span>
            <h3>{contract.title}</h3>
            <p>{contract.text}</p>
          </article>
        {/each}
      </div>
    </section>
  </main>

  <footer class="footer">
    <div><a href="/demo/semantic-overlay">Semantic overlay</a><a href="/demo/workspace">Workspace</a><a href="/demo/document-editor-reference">Editor reference</a></div>
    <span>Implementation: <code>work/external-files</code> · parent architecture: <code>work/derived-output-architecture</code></span>
  </footer>
</div>

<style>
  .truth-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; margin-top: 1.2rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--rule); overflow: hidden; }
  .truth-grid article { display: flex; min-height: 12rem; flex-direction: column; padding: 1rem; background: var(--raised); }
  .truth-grid header { display: flex; align-items: center; gap: .55rem; }
  .truth-grid header span { padding: .22rem .38rem; border-radius: 999px; font: 700 7px/1 var(--token-font-mono); letter-spacing: .06em; text-transform: uppercase; }
  .truth-grid header span.exists { background: var(--success-soft); color: var(--success); }
  .truth-grid header span.partial { background: var(--attention-soft); color: var(--attention); }
  .truth-grid header strong { font-size: 10px; }
  .truth-grid p { margin: .75rem 0; color: var(--ink-2); font-size: 10.5px; }
  .truth-grid code { display: block; margin-top: auto; color: var(--ink-3); font-size: 8px; overflow-wrap: anywhere; }
  .page-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: .9rem; margin-top: 1.2rem; }
  .page-grid a { display: flex; min-height: 17rem; flex-direction: column; padding: 1.2rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); color: inherit; text-decoration: none; transition: border-color 140ms ease, transform 140ms ease; }
  .page-grid a:hover { border-color: var(--token-color-interactive-border); transform: translateY(-2px); }
  .page-grid header { display: flex; justify-content: space-between; gap: 1rem; color: var(--ink-3); font: 650 8px/1 var(--token-font-mono); text-transform: uppercase; }
  .page-grid header > span { color: var(--active); }
  .page-grid h3 { margin: 2.5rem 0 .6rem; font-size: 1.8rem; letter-spacing: -.04em; }
  .page-grid p { margin: 0; color: var(--ink-2); font-size: 11px; }
  .page-grid footer { display: flex; align-items: center; gap: .5rem; margin-top: auto; color: var(--interactive); font-size: 10px; font-weight: 700; }
  .contracts { grid-template-columns: repeat(4, 1fr); }
  .contract-icon { display: block; margin-bottom: 1.5rem; color: var(--active); }
  @media (max-width: 74rem) { .truth-grid, .page-grid { grid-template-columns: repeat(2, 1fr); } .contracts { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 54rem) { .page-grid { grid-template-columns: 1fr; } }
  @media (max-width: 38rem) { .truth-grid, .contracts { grid-template-columns: 1fr; } }
</style>
