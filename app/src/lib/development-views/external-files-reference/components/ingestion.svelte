<script lang="ts">
  import AlertTriangle from "@lucide/svelte/icons/triangle-alert";
  import CheckCircle2 from "@lucide/svelte/icons/circle-check-big";
  import FileWarning from "@lucide/svelte/icons/file-warning";
  import LockKeyhole from "@lucide/svelte/icons/lock-keyhole";

  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceHeader from "$development-views/external-files-reference/components/reference-header.svelte";
  import { FORMAT_CONTRACTS, INGESTION_STEPS } from "$development-views/external-files-reference/procedures/contracts";
  import "$development-views/external-files-reference/components/reference.css";

  const uploadSequence = `sequenceDiagram
    autonumber
    actor Person
    participant View as Upload view
    participant Cap as external-files capability
    participant Bytes as materialContent model
    participant Store as representation store
    participant Sem as semantic-overlay queue
    participant Library as External singleton

    Person->>View: choose files or directory
    View->>View: preview names, paths, sizes
    View->>Cap: uploadExternalFiles remote form
    activate Cap
    Cap->>Cap: requireScope then validate batch
    loop each accepted candidate
      Cap->>Bytes: put complete bounded Uint8Array
      Bytes-->>Cap: storageId, hash, size, reused
      Cap->>Store: compare project path and hash
      alt same path and hash
        Store-->>Cap: reuse admitted row
      else new path
        Cap->>Store: create externalFiles row at revision 1
        Store-->>Cap: externalFileId
      end
      Cap->>Sem: enqueue eligible exact and/or material lane
      Sem-->>Cap: queued, unsupported, or recoverable failure
    end
    Cap-->>View: successes plus per-file rejections
    deactivate Cap
    View->>Library: activate external with uploaded file focused
    Library-->>Person: reuse singleton and inspect selected file`;

  const routingDiagram = `flowchart TD
    classDef yes fill:#e8f0ef,stroke:#347f78,color:#172232
    classDef warn fill:#fff1df,stroke:#d06b32,color:#492c17
    classDef stop fill:#f5e5e5,stroke:#b74e4e,color:#491f1f
    classDef base fill:#fffdf8,stroke:#315a72,color:#172232

    A["Verified bytes + canonical name"]:::base --> B{"Server-sniffed family"}:::base
    B -->|plain text| T["externalFile::text"]:::yes
    B -->|recognized + classified code| C["externalFile::text<br/>exact + code material"]:::yes
    B -->|CSV / TSV| D["externalFile::data"]:::yes
    B -->|image| I["externalFile::image"]:::yes
    B -->|PDF / Office| P["managed + download<br/>no extraction claim"]:::warn
    B -->|audio / video| AV["managed + download<br/>no transcript claim"]:::warn
    B -->|unknown or active| R["manage + force attachment<br/>no inline execution"]:::stop

    T --> TE["exact lane<br/>UTF-8 spans"]:::yes
    C --> CE["exact lane when text"]:::yes
    C --> CM["material lane<br/>code profile"]:::yes
    D --> DM["material lane<br/>CSV profile"]:::yes
    I --> IM["material lane<br/>image facets + optional pixels"]:::yes
    P -. future .-> EX["versioned extraction artifact"]:::warn
    AV -. future .-> EX`;

  const consistencyDiagram = `stateDiagram-v2
    [*] --> Selected
    Selected --> Rejected: validation fails
    Selected --> Receiving: accepted candidate
    Receiving --> Rejected: byte read or storage failure
    Receiving --> BytesPublished: complete hash and atomic rename
    BytesPublished --> ResourceCommitted: metadata row created
    BytesPublished --> OrphanedBytes: metadata write fails
    OrphanedBytes --> Reclaimed: best-effort immediate compensation
    OrphanedBytes --> SafeOrphan: compensation also fails
    ResourceCommitted --> SemanticQueued: enqueue succeeds
    ResourceCommitted --> SemanticNotApplicable: no eligible lane
    ResourceCommitted --> SemanticPending: enqueue fails
    SemanticPending --> SemanticQueued: rename, refresh, or external worker retry
    SemanticQueued --> SemanticCurrent: worker publishes
    SemanticQueued --> SemanticFailed: provider or adapter failure
    SemanticFailed --> SemanticQueued: explicit retry
    ResourceCommitted --> Manageable
    SemanticNotApplicable --> Manageable
    SemanticQueued --> Manageable
    SemanticCurrent --> Manageable
    Manageable --> [*]`;

  const limits = [
    ["File count", "100 / batch", "Stops accidental tree-scale uploads before reading all content."],
    ["Single file", "50,000,000 bytes", "The implemented remote-form path buffers each File before bounded native publication."],
    ["Whole batch", "250,000,000 bytes", "Bounds declared multipart memory and request work; every received file is re-counted."],
    ["Download response", "50,000,000 bytes", "The authorized route refuses a native response beyond the configured ceiling."],
    ["Text semantics", "5,000,000 bytes", "The exact worker fails the semantic lane—not upload—when UTF-8 source exceeds its bound."],
    ["Image pixels", "5,000,000 bytes", "Larger images retain deterministic metadata but skip native visual input."],
    ["CSV profile", "20k rows / 200k cells", "Matches the bounded existing CSV parser, including a 256-column ceiling."],
    ["Path length", "512 UTF-8 bytes", "Enforced after NFC and slash normalization; there is no separate leaf-name filesystem operation."]
  ] as const;

  const failureRows = [
    ["Batch validation", "No bytes written", "Return field/file errors", "Choose again"],
    ["File.arrayBuffer", "No row; no blob", "Return read-failed for that candidate", "Retry candidate"],
    ["Native put", "No row; temporary sibling is removed", "Return storage-failed for that candidate", "Retry candidate"],
    ["Metadata create", "Verified orphan may exist", "Return store-failed and remove the unclaimed blob best-effort", "Retry safely; same hash can reuse an orphan"],
    ["Semantic enqueue", "File row and native bytes are usable", "Return enqueue-failed on the successful receipt", "Rename, Inspector refresh, or an external worker can requeue"],
    ["Semantic worker", "File row is usable", "Durable failed job with sanitized reason", "Explicit retry after correction"],
    ["Download response", "Source remains manageable", "Missing/corrupt/oversized bytes fail explicitly; invalid Range returns 416", "Repair native storage or retry a valid attachment range"]
  ] as const;

  const security = [
    ["Scope before input", "Call requireScope() before validation and never accept browser-authored projectId, createdBy, storageId, hash, or subkind."],
    ["Path normalization", "Convert backslashes, normalize NFC, preserve folder display, and reject dot/empty segments, absolute roots, drive prefixes, NUL, traversal, and duplicate canonical paths."],
    ["Byte authority", "Recount received bytes and calculate SHA-256 server-side. File.size is checked twice; extension and browser MIME remain classification hints."],
    ["Format policy", "Sniff PNG, JPEG, GIF, PDF, and ZIP signatures. Other admitted types use declared MIME then extension fallback; all bytes remain attachment-only."],
    ["Safe serving", "Authorize every read. Use nosniff, sandbox CSP, escaped dual filenames, bounded single ranges, a SHA-256 ETag, private/no-cache, and Content-Disposition attachment."],
    ["Operational bounds", "Cap candidates, bytes, paths, parser work, and concurrent uploads. If archives arrive later, add entry/decompression/ratio limits before extraction."]
  ] as const;
</script>

<div class="external-files-reference">
  <ReferenceHeader current="ingestion" />

  <main class="reference-page">
    <header class="hero">
      <div>
        <a class="back" href="/demo/external-files">← External-files system</a>
        <span class="kicker">01 · ingestion and interpretation</span>
        <h1>Commit bytes before meaning.</h1>
        <p class="hero-copy">
          Upload is a short authoritative path: scope, validate, store verified bytes, reuse or create one
          project resource row, then enqueue only supported derived products. Folder selection changes the batch and
          relative-path metadata—it does not create a second storage model.
        </p>
      </div>
      <aside class="hero-aside">
        <header><span>Implemented v1</span><span>bounded multipart form</span></header>
        <div>
          <h2>Partial batch success is explicit.</h2>
          <p>Every candidate returns uploaded, reused, or rejected. Successful records appear in the External library even when a sibling file or semantic enqueue fails.</p>
          <div class="status-pills"><span class="status-pill exists">live capability</span><span class="status-pill extend">bounded buffering</span></div>
        </div>
      </aside>
    </header>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Authoritative sequence</span><h2>Seven hand-offs, one committed identity</h2></div>
        <p>
          The remote form is transport only. The capability owns orchestration; materialContent owns byte I/O;
          the store owns resource metadata; the semantic capability owns derived jobs; workspace state owns library focus and inspection.
        </p>
      </div>
      <div class="diagram-frame">
        <MermaidDiagram source={uploadSequence} label="External file upload sequence" caption="The semantic enqueue is deliberately after the externalFiles row exists and is safe to retry." minHeight="39rem" />
      </div>
      <ol class="number-list steps">
        {#each INGESTION_STEPS as step}
          <li>
            <span>{step.id}</span>
            <div><h3>{step.owner}</h3><code>{step.call}</code></div>
            <div><p><b>{step.input}</b> → {step.output}</p><p>{step.rule}</p></div>
          </li>
        {/each}
      </ol>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Upload contract</span><h2>The browser sends candidates, not authority</h2></div>
        <p>This is the actual remote-form boundary. Relative paths travel alongside File values because directory information is browser-only metadata.</p>
      </div>
      <div class="contract-pair">
        <article>
          <header><span>INPUT</span><strong>remote form</strong></header>
          <pre><code>{`id: "files" | "folder"
files: File[]
relativePaths: string[] // same indexes

// browser hints only
File.name
File.type
File.size
File.webkitRelativePath`}</code></pre>
        </article>
        <article>
          <header><span>OUTPUT</span><strong>per-file outcomes</strong></header>
          <pre><code>{`{
  outcomes: [{
    status: "uploaded" | "reused",
    externalFileId, name, relativePath,
    mediaType, subkind, size, revision,
    semantic: "queued" | "unsupported" | "enqueue-failed"
  } | {
    status: "rejected", name, relativePath?,
    reason, detail
  }],
  uploaded: number,
  reused: number,
  rejected: number
}`}</code></pre>
        </article>
      </div>
      <div class="callout danger">
        <FileWarning size={18} strokeWidth={1.8} aria-hidden="true" />
        <div><h3>Do not accept an uploaded hash, storage path, actor, project, or classification.</h3><p>The server derives all five from authenticated scope and received bytes. A declared MIME type only helps choose what to sniff first.</p></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Format routing</span><h2>Management, exact text, and materials are separate promises</h2></div>
        <p>Every accepted format gets a manageable library row. Classification decides safe Inspector actions and eligible semantic lanes; it does not require a dedicated editor or imply that a parser succeeded.</p>
      </div>
      <div class="diagram-frame">
        <MermaidDiagram source={routingDiagram} label="Format classification and semantic routing" caption="The current useful semantic adapters are text, code, CSV, and image. PDF/Office/media extraction is intentionally deferred." minHeight="38rem" />
      </div>
      <div class="table-wrap formats">
        <table class="reference-table">
          <thead><tr><th>Family</th><th>Class</th><th>Library / Inspector treatment</th><th>Exact lane</th><th>Material lane</th><th>v1</th><th>Constraint</th></tr></thead>
          <tbody>
            {#each FORMAT_CONTRACTS as format}
              <tr>
                <td><strong>{format.family}</strong><p>{format.examples}</p></td>
                <td><code>{format.classification}</code></td>
                <td>{format.content}</td>
                <td>{format.exactLane}</td>
                <td>{format.materialLane}</td>
                <td><span class="coverage {format.v1}">{format.v1}</span></td>
                <td>{format.caution}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="callout">
        <AlertTriangle size={18} strokeWidth={1.8} aria-hidden="true" />
        <div><h3>Classifier breadth remains an explicit implementation limit.</h3><p>The upload classifier covers the common code extensions listed in representation behavior, while codeLanguage recognizes a broader set. A blank-MIME file outside the first set can remain managed-only even if the profiler understands its extension; the UI makes that limitation visible instead of scheduling a doomed job.</p></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Consistency and recovery</span><h2>No distributed transaction is assumed</h2></div>
        <p>The byte directory and JSON-backed table store do not share a transaction. Ordering makes every intermediate condition understandable and repairable.</p>
      </div>
      <div class="diagram-frame">
        <MermaidDiagram source={consistencyDiagram} label="Upload and semantic lifecycle state machine" caption="Manageability begins at ResourceCommitted. Semantic states enrich the selected Inspector subject but do not redefine upload success." minHeight="36rem" />
      </div>
      <div class="table-wrap">
        <table class="reference-table">
          <thead><tr><th>Failure point</th><th>Durable state</th><th>Immediate behavior</th><th>Repair</th></tr></thead>
          <tbody>{#each failureRows as row}<tr>{#each row as cell}<td>{cell}</td>{/each}</tr>{/each}</tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Operational envelope</span><h2>Bounds are product behavior</h2></div>
        <p>These are the implemented runtime and semantic ceilings. Upload/download values live in <code>configuration/external-files.yaml</code>; semantic adapter ceilings remain owned by their readers.</p>
      </div>
      <div class="limit-grid">
        {#each limits as limit}
          <article><span>{limit[0]}</span><strong>{limit[1]}</strong><p>{limit[2]}</p></article>
        {/each}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Threat boundary</span><h2>Treat every uploaded byte as hostile</h2></div>
        <p>A project membership check is necessary but not sufficient. Paths, content claims, browser rendering, parser resource use, and response headers each form a separate boundary.</p>
      </div>
      <div class="security-list">
        {#each security as item, index}
          <article><div><LockKeyhole size={17} strokeWidth={1.7} aria-hidden="true" /><span>{String(index + 1).padStart(2, "0")}</span></div><h3>{item[0]}</h3><p>{item[1]}</p></article>
        {/each}
      </div>
      <div class="callout success">
        <CheckCircle2 size={18} strokeWidth={1.8} aria-hidden="true" />
        <div><h3>Unimplemented parsing is not implied by storage.</h3><p>PDF text, workbook cells, OCR, and transcripts are absent. If added later, the architecture requires them to remain derived artifacts with source-hash and extractor provenance—not mutable source-row claims.</p></div>
      </div>
    </section>
  </main>

  <footer class="footer"><div><a href="/demo/external-files">System</a><a href="/demo/external-files/stable-tab">Next: External library</a><a href="/demo/external-files/implementation">Implementation learnings</a></div><span>Source bytes remain authoritative · semantics remain reproducible</span></footer>
</div>

<style>
  .steps li > div:nth-child(2) code { display: inline-block; margin-top: .25rem; color: var(--interactive); font-size: 8px; overflow-wrap: anywhere; }
  .steps li > div:last-child p + p { margin-top: .3rem; color: var(--ink-3); }
  .contract-pair { display: grid; grid-template-columns: repeat(2, 1fr); gap: .9rem; margin-top: 1.2rem; }
  .contract-pair article { border: 1px solid var(--rule-strong); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .contract-pair header { display: flex; justify-content: space-between; padding: .65rem .85rem; border-bottom: 1px solid var(--rule); background: var(--panel); font-size: 9px; }
  .contract-pair header span { color: var(--active); font: 700 8px/1 var(--token-font-mono); }
  .contract-pair pre { min-height: 15rem; margin: 0; padding: 1rem; overflow: auto; color: var(--ink-2); font: 500 10.5px/1.65 var(--token-font-mono); }
  .formats { max-height: 38rem; }
  .formats table { min-width: 82rem; }
  .coverage { display: inline-block; padding: .25rem .4rem; border-radius: 999px; font: 700 7px/1 var(--token-font-mono); text-transform: uppercase; }
  .coverage.complete { background: var(--success-soft); color: var(--success); }
  .coverage.partial { background: var(--attention-soft); color: var(--attention); }
  .coverage.stored { background: var(--panel); color: var(--ink-3); }
  .limit-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; margin-top: 1.2rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--rule); overflow: hidden; }
  .limit-grid article { min-height: 9rem; padding: 1rem; background: var(--raised); }
  .limit-grid span { display: block; color: var(--ink-3); font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .limit-grid strong { display: block; margin-top: .6rem; color: var(--active); font: 650 1.05rem/1.2 var(--token-font-mono); }
  .limit-grid p { margin: .6rem 0 0; color: var(--ink-2); font-size: 10px; }
  .security-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: .9rem; margin-top: 1.2rem; }
  .security-list article { padding: 1rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); }
  .security-list article > div { display: flex; justify-content: space-between; color: var(--active); }
  .security-list article > div span { font: 650 8px/1 var(--token-font-mono); }
  .security-list h3 { margin: 1.6rem 0 .4rem; font-size: 11px; }
  .security-list p { margin: 0; color: var(--ink-2); font-size: 10.5px; }
  @media (max-width: 70rem) { .limit-grid { grid-template-columns: repeat(2, 1fr); } .security-list { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 54rem) { .contract-pair { grid-template-columns: 1fr; } .number-list li { grid-template-columns: 2rem 1fr; } .number-list li > div:last-child { grid-column: 2; } }
  @media (max-width: 38rem) { .limit-grid, .security-list { grid-template-columns: 1fr; } }
</style>
