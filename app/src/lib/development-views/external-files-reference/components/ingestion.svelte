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
    participant Native as External native admission
    participant Bytes as externalFileStorage
    participant Store as representation store
    participant UoW as Store transaction
    participant Sem as semantic outbox
    participant Library as External singleton

    Person->>View: choose files or directory
    View->>View: preview names, paths, sizes
    View->>Cap: uploadExternalFiles remote form
    activate Cap
    Cap->>Cap: requireScope, validate form and configured limits
    loop each accepted candidate
      Cap->>Cap: normalize path, buffer and recount bounded bytes
      Cap->>Native: derive hash, size, storageId, MIME and subkind
      Native-->>Cap: authoritative native descriptor
      Cap->>Bytes: put descriptor plus complete bytes
      Bytes->>Bytes: verify descriptor, hash and size
      Bytes-->>Cap: storageId, hash, size, reused
      Cap->>Store: compare project path and hash
      alt same path and hash
        Store-->>Cap: reuse admitted row
      else new path
        Cap->>UoW: row + History + forget + outbox
        UoW-->>Cap: one durable commit
      end
      Cap->>Bytes: claim publication for committed row id
      UoW->>Sem: exact text, material, or no work
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
    B -->|plain prose / Markdown| T["externalFile::text<br/>one exact-text target"]:::yes
    B -->|programming source| C["externalFile::code<br/>one material target"]:::yes
    B -->|CSV / TSV| D["externalFile::data"]:::yes
    B -->|image| I["externalFile::image"]:::yes
    B -->|PDF / Office| P["managed + download<br/>no extraction claim"]:::warn
    B -->|audio / video| AV["managed + download<br/>no transcript claim"]:::warn
    B -->|unknown or active| R["manage + force attachment<br/>no inline execution"]:::stop

    T --> TE["exact lane<br/>verified UTF-8 text<br/>one quoteable source"]:::yes
    C --> CM["material lane<br/>bounded code profile<br/>64 KB source excerpt to descriptor"]:::yes
    D --> DM["material lane<br/>bounded data profile<br/>+ optional authored context"]:::yes
    I --> IM["material lane<br/>direct original visual vector<br/>no generated summary"]:::yes
    P -. future .-> EX["versioned extraction artifact"]:::warn
    AV -. future .-> EX`;

  const reuploadSequence = `sequenceDiagram
    autonumber
    actor Person
    participant Inspector as File Inspector
    participant External as external-files capability
    participant Native as externalFileStorage
    participant Rows as externalFiles table
    participant UoW as Store transaction
    participant History as durable History

    Person->>Inspector: choose Re-upload and select bytes
    Inspector->>External: externalFileId + baseRevision + File
    External->>External: scope, bound, recount, derive descriptor
    External->>Native: publish and verify candidate bytes
    Native-->>External: new or reused receipt
    External->>UoW: CAS row + forget + outbox + History
    alt transaction rolls back
      External->>Native: discard candidate publication
      External-->>Inspector: rejected and original row and semantics remain
    else transaction commits
      UoW->>Rows: same id/name/path, new receipt, revision + 1
      UoW->>History: append re-uploaded event
      External->>Native: claim new bytes and release old row claim
      External->>Native: collect predecessor only when unclaimed
      External-->>Inspector: accepted with same URL and resource id
    end`;

  const consistencyDiagram = `stateDiagram-v2
    [*] --> Selected
    Selected --> Rejected: validation fails
    Selected --> Receiving: accepted candidate
    Receiving --> Rejected: byte read or storage failure
    Receiving --> BytesPublished: fsynced recovery copy + immutable canonical link
    BytesPublished --> AtomicCommit: begin Store transaction
    AtomicCommit --> RolledBack: failure before durable journal decision
    AtomicCommit --> ResourceCommitted: row + History + forget + outbox commit
    RolledBack --> Reclaimed: discard recovery copy; collect unclaimed canonical
    ResourceCommitted --> Claimed: row claim replaces publication recovery copy
    ResourceCommitted --> RestartRecoverable: claim finalization is interrupted
    RestartRecoverable --> Claimed: Store recovery then storage reconciliation
    Claimed --> SemanticQueued: outbox is eligible
    Claimed --> SemanticNotApplicable: no eligible lane
    SemanticQueued --> SemanticCurrent: worker publishes
    SemanticQueued --> SemanticFailed: provider or adapter failure
    SemanticFailed --> SemanticQueued: backfill after correction
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
    ["Exact text", "5,000,000 bytes", "Plain prose/Markdown becomes one verified UTF-8 exact source; source code is not collapsed into this lane."],
    ["Image input", "50,000,000 bytes", "Matches the upload ceiling; admitted standalone images pass their original pixels directly to visual embedding."],
    ["CSV profile", "20k rows / 200k cells", "Matches the bounded existing CSV parser, including a 256-column ceiling."],
    ["Code descriptor input", "64,000 bytes", "A deterministic head/tail excerpt gives the material summarizer verified UTF-8 without putting the full source file in a semantic row."],
    ["Path length", "512 UTF-8 bytes", "Enforced after NFC and slash normalization; there is no separate leaf-name filesystem operation."]
  ] as const;

  const failureRows = [
    ["Batch validation", "No bytes written", "Return field/file errors", "Choose again"],
    ["File.arrayBuffer", "No row; no blob", "Return read-failed for that candidate", "Retry candidate"],
    ["Native publication", "No row; a complete recovery copy may exist", "Return storage-failed or settle the ambiguous publication", "Startup removes interrupted unclaimed copies"],
    ["Store before journal commit", "All row, History, semantic-forget and outbox changes roll back", "Discard publication recovery state", "Original state remains exact"],
    ["Store after journal commit", "Committed row and outbox are recoverable even when the request fails", "Retain publication recovery state", "Store journal recovery runs before native reconciliation and claims the committed bytes"],
    ["Semantic worker", "File row is usable", "Durable failed job with sanitized reason", "Backfill after correcting provider, bytes, or adapter input"],
    ["Re-upload transaction rollback", "Original row, History and semantic products remain together", "Discard candidate publication", "Retry against the same base revision"],
    ["Download response", "Source remains manageable", "Missing/corrupt/oversized bytes fail explicitly; invalid Range returns 416", "Repair native storage or retry a valid attachment range"]
  ] as const;

  const security = [
    ["Scope before input", "Call requireScope() before validation and never accept browser-authored projectId, createdBy, storageId, hash, or subkind."],
    ["Path normalization", "Convert backslashes, normalize NFC, preserve folder display, and reject dot/empty segments, absolute roots, drive prefixes, NUL, traversal, and duplicate canonical paths."],
    ["Byte authority", "Recount received bytes and calculate SHA-256 server-side. File.size is checked twice; extension and browser MIME remain classification hints."],
    ["Format policy", "Sniff PNG, JPEG, GIF, WebP, PDF, ZIP, MP3, WAV, and MP4 signatures before caller MIME. Then use canonical extensions to distinguish prose, source code, and structured data. All bytes remain attachment-only."],
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
        <h1>External admits bytes before delegating meaning.</h1>
        <p class="hero-copy">
          Upload is a short authoritative path: scope, validate, store verified bytes, reuse or create one
          project resource row, then enqueue only supported material work. Folder selection changes the batch and
          relative-path metadata—it does not create a second native-storage model.
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
          The remote form is transport only. External owns native admission and lifecycle; externalFileStorage
          verifies and persists its descriptors; the represented store owns rows; the semantic capability owns
          downstream material work; workspace state owns library focus and inspection.
        </p>
      </div>
      <div class="diagram-frame">
        <MermaidDiagram source={uploadSequence} label="External file upload sequence" caption="Row identity, History, semantic forget, and semantic outbox commit together; native recovery copies bridge the filesystem/Store boundary." minHeight="39rem" />
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
        <div><span class="kicker">Format routing</span><h2>Management and material interpretation are separate promises</h2></div>
        <p>Every accepted format gets a manageable library row. Classification decides safe Inspector actions and eligible semantic lanes; it does not require a dedicated editor or imply that a parser succeeded.</p>
      </div>
      <div class="diagram-frame">
        <MermaidDiagram source={routingDiagram} label="Format classification and semantic routing" caption="Plain prose uses exact semantics. Source code, CSV/TSV, and images use distinct material adapters. Every other family is intentionally managed-only." minHeight="38rem" />
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
        <div><h3>Prose and source code are intentionally different current families.</h3><p>Plain text, Markdown, and comparable prose become <code>externalFile::text</code> and enter the exact lane. Recognized programming source becomes <code>externalFile::code</code> and enters the code/material lane. Structured data has its own <code>data</code> classification. No alias or read-time canonicalization changes a stored row.</p></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Explicit content update</span><h2>Re-upload changes bytes without changing the object</h2></div>
        <p>Ordinary upload never overwrites an occupied path. Re-upload is the deliberate update operation and is protected by the selected row's base revision.</p>
      </div>
      <div class="diagram-frame">
        <MermaidDiagram source={reuploadSequence} label="External file re-upload sequence" caption="The same externalFile id, local name, relative path, download URL, references, and original upload provenance survive; native and material identities advance." minHeight="38rem" />
      </div>
      <div class="callout success">
        <CheckCircle2 size={18} strokeWidth={1.8} aria-hidden="true" />
        <div><h3>Upload and re-upload intentionally mean different things.</h3><p>Uploading different bytes at an occupied path returns a path conflict. Re-upload from that file's Inspector atomically forgets the old semantic revision, records new outbox intent, and updates the same represented resource, so references remain intact.</p></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Consistency and recovery</span><h2>Atomic metadata, recoverable native publication</h2></div>
        <p>The filesystem and Store use an explicit publication protocol. The Store transaction is the authority for rows, History, semantic forget, and outbox intent; fsynced publication copies and row claims make every crash boundary recoverable.</p>
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
