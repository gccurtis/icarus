<script lang="ts">
  import AlertTriangle from "@lucide/svelte/icons/triangle-alert";
  import CheckCircle2 from "@lucide/svelte/icons/circle-check-big";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";

  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceHeader from "$development-views/external-files-reference/components/reference-header.svelte";
  import "$development-views/external-files-reference/components/reference.css";

  const commitTopology = `sequenceDiagram
    autonumber
    actor User
    participant UI as External content
    participant Cap as external-files
    participant Blob as externalFileStorage
    participant Tx as Store.transaction
    participant Sem as semantic outbox

    User->>UI: select files or browser directory
    UI->>Cap: multipart File[] + indexed relativePaths[]
    Cap->>Cap: scope, limits, canonical path, bounded bytes
    Cap->>Cap: signature-first descriptor
    Cap->>Blob: put descriptor + bytes
    Blob-->>Cap: canonical blob + recovery token
    Cap->>Tx: uniqueness + row + History + forget + outbox
    Tx->>Sem: durable exact/material/no-op intent
    alt Store rolls back
      Cap->>Blob: discard publication + collect orphan
    else Store commits
      Cap->>Blob: claim publication for row id
    else Store result unavailable after commit
      Cap->>Blob: leave recovery token for restart
    end
    Cap-->>UI: per-file uploaded / reused / rejected
    UI->>UI: refresh singleton and focus success`;

  const lifecycle = `stateDiagram-v2
    [*] --> Candidate
    Candidate --> Rejected: scope, path, size, read, or storage failure
    Candidate --> Published: verified canonical bytes + recovery copy
    Published --> RolledBack: Store transaction rejects
    Published --> Represented: row + History + semantic intent commit
    RolledBack --> Collected: discard unclaimed publication
    Represented --> Claimed: native row claim finalized
    Represented --> RestartRecoverable: interrupted after Store commit
    RestartRecoverable --> Claimed: Store recovery then reconcile
    Claimed --> ExactQueued: text
    Claimed --> MaterialQueued: code, CSV/TSV, or image
    Claimed --> ManagedOnly: other formats
    ExactQueued --> Current: queue worker publishes
    MaterialQueued --> Current: queue worker publishes
    ExactQueued --> Failed: worker/provider failure
    MaterialQueued --> Failed: worker/provider failure
    Claimed --> Mutating: rename, move, context, or re-upload
    Current --> Mutating
    Mutating --> Claimed: atomic revision + History + outbox
    Claimed --> DeleteRefused: stale revision or live typed reference
    Current --> DeleteRefused: stale revision or live typed reference
    Claimed --> Removed: atomic forget + outbox + History + row delete
    Current --> Removed: atomic forget + outbox + History + row delete
    Removed --> BlobRetained: another claim shares hash
    Removed --> BlobRemoved: no claimant after quarantine recheck`;

  const workspace = `flowchart TB
    classDef permanent fill:#201f35,stroke:#806fa9,color:#f6ebe2
    classDef surface fill:#fffdf8,stroke:#315a72,color:#172232
    classDef state fill:#e8f0ef,stroke:#347f78,color:#172232
    classDef later fill:#fff1df,stroke:#d06b32,color:#492c17,stroke-dasharray:5 4

    OPEN["open({ category: external, focus? })"]:::state
    TAB["Permanent External tab<br/>category/id = external<br/>no resourceId"]:::permanent
    CONTENT["Content · external.library<br/>Table / Directory · upload · search"]:::surface
    CONTEXT["Context<br/>Overview · durable History"]:::surface
    SELECT["Selection<br/>external-file id<br/>or external-directory path"]:::state
    INSPECT["Inspector manager<br/>file or directory"]:::surface
    STATUS["Status bar<br/>name via owning capability"]:::surface
    SNAP["current workspace snapshot<br/>focus + selection"]:::state
    FIND["Findings adapter<br/>deferred"]:::later

    OPEN --> TAB --> CONTENT
    TAB --> CONTEXT
    CONTENT --> SELECT --> INSPECT
    SELECT --> STATUS
    TAB --> SNAP --> TAB
    FIND -. later .-> CONTENT
    FIND -. later .-> INSPECT`;

  const semantic = `flowchart LR
    classDef source fill:#fffdf8,stroke:#315a72,color:#172232
    classDef exact fill:#e8f0ef,stroke:#347f78,color:#172232
    classDef material fill:#fff1df,stroke:#d06b32,color:#492c17
    classDef off fill:#f1efe9,stroke:#aaa194,color:#615b54

    FILE["Committed External row<br/>revision + content hash"]:::source
    KIND{"current subkind"}:::source
    TEXT["text / Markdown<br/>verified UTF-8"]:::exact
    EXACT["exact semantic source<br/>quoteable locators"]:::exact
    CODE["programming source<br/>code profile"]:::material
    DATA["CSV / TSV<br/>profile + authored context"]:::material
    IMAGE["image<br/>original pixels"]:::material
    MAT["material facets<br/>optional description"]:::material
    NONE["PDF / Office / audio / video / unknown<br/>managed only"]:::off
    REVIEW["Inspector<br/>status always truthful<br/>description only when present"]:::source

    FILE --> KIND
    KIND -->|text| TEXT --> EXACT --> REVIEW
    KIND -->|code| CODE --> MAT --> REVIEW
    KIND -->|data| DATA --> MAT
    KIND -->|image| IMAGE --> MAT
    KIND -->|other| NONE --> REVIEW`;

  const discoveries = [
    {
      stage: "Browser transport",
      assumption: "Remote-form bindings alone would serialize File values and folder metadata.",
      observed: "Enhanced submission requires multipart/form-data, and webkitRelativePath is not a successful form control.",
      change: "Both upload forms declare multipart encoding and render indexed hidden relativePaths controls aligned with File inputs.",
      effect: "Chromium preserves nested directory paths through upload and reload."
    },
    {
      stage: "Reactive receipts",
      assumption: "Remote form result object identity could identify a newly completed submission.",
      observed: "Reactive proxy snapshots can have fresh identities, producing repeat consumption and an update loop.",
      change: "The library consumes one stable serialized receipt signature and stores immutable result data.",
      effect: "One submission creates one focus transition and one persistent mixed-result notice."
    },
    {
      stage: "Directory selection",
      assumption: "File-focus restoration could always run after a library refresh.",
      observed: "It immediately replaced a deliberate virtual-directory selection.",
      change: "Restoration yields while the selected subject is an external directory.",
      effect: "Directory inspection, rename, and move remain stable."
    },
    {
      stage: "Native ownership",
      assumption: "A material model could continue serving as a general uploaded-byte service.",
      observed: "That made a downstream interpretation layer own hashing, publication, removal, and file lifecycle.",
      change: "External derives descriptors; externalFileStorage became the only native-I/O owner; all current consumers were ported and material-content was removed.",
      effect: "Byte lifecycle and semantic interpretation now have explicit, testable boundaries."
    },
    {
      stage: "Crash boundary",
      assumption: "Publish-first plus best-effort cleanup and a process mutex were sufficient.",
      observed: "A process can stop after either Store or filesystem commitment, and another process can publish while GC scans rows.",
      change: "Fsynced publication copies, per-row claims, quarantine/recheck removal, ambiguous-commit settlement, and startup reconciliation now bridge the stores.",
      effect: "The mutex is only an optimization; committed rows win and true orphans converge away."
    },
    {
      stage: "Store atomicity",
      assumption: "History and semantic retirement/enqueue could follow the row write.",
      observed: "Every follow-up creates a crash point where lifecycle truth diverges.",
      change: "Row/CAS, path uniqueness, History, semantic forget, and outbox now share one Store.transaction for every mutation.",
      effect: "Failpoint tests prove rollback and restart recovery preserve one revision/history/outbox decision."
    },
    {
      stage: "Text classification",
      assumption: "Prose and source code could share a convenient textual material family.",
      observed: "Prose needs exact quoteability while source code needs structural profiling; one family weakens both contracts.",
      change: "Text/Markdown is current subkind text in the exact lane; programming source is current subkind code in the material lane.",
      effect: "There are no aliases or canonicalization fallbacks, and each semantic lane receives the right source shape."
    },
    {
      stage: "Signature authority",
      assumption: "Canonical file extensions could precede all other hints.",
      observed: "A PDF can be named .txt and declared text/plain, which would otherwise enter exact processing.",
      change: "Recognized byte signatures take precedence over caller MIME and filename classification.",
      effect: "Mislabelled active/binary content remains attachment-only and cannot poison a text lane."
    },
    {
      stage: "Directory mutation",
      assumption: "A directory view could rename descendants one file at a time.",
      observed: "Partial relocation is not a coherent directory operation and concurrent descendants make a single-row revision insufficient.",
      change: "A token covers the complete descendant id/revision/path set; all destinations validate, then all row/history/outbox changes commit together.",
      effect: "A folder is still a projection, but directory relocation is atomic."
    },
    {
      stage: "Deletion references",
      assumption: "A short list of likely resource tables could protect common uses.",
      observed: "References also live in leaders, nested content, scopes, jobs, research, comments, and formula values, while historical copies must not block.",
      change: "An exhaustive table policy and typed traversal cover every current identity-bearing location and distinguish by-value history/caches.",
      effect: "New tables require an explicit policy at compile time and deletion never relies on recursive string matching."
    },
    {
      stage: "Inspector truth",
      assumption: "Every semantically eligible file could reserve a summary section.",
      observed: "Exact text has no generated summary, images intentionally keep a pure visual vector, and descriptor generation can be disabled or fail.",
      change: "Semantic status is shown for the applicable lane; generated descriptions render only when data exists.",
      effect: "The manager never invents a summary or implies unsupported parsing."
    },
    {
      stage: "UI architecture",
      assumption: "One large library procedure module and inline async handlers were acceptable for a single surface.",
      observed: "State lifetime, queries, formatting, and effect chains became coupled and violated current architecture checks.",
      change: "Library/file/directory state is instance-owned; pure query modules and named procedures/effects split each entry chain.",
      effect: "External is live with zero architecture findings and no new baseline debt."
    },
    {
      stage: "Fixture admission",
      assumption: "Every development leader already used the represented current schema declared by its TypeScript type.",
      observed: "Two seeded presentation leaders still placed blocks directly on elements and omitted layout ids, which a typed reference walk exposed at runtime.",
      change: "The fixtures were reset to content-based slide elements and explicit layout ids; no fallback shape was added to External's traversal.",
      effect: "Browser data and production types now agree, and complete reference safety stays typed without preserving a legacy reader."
    }
  ] as const;

  const boundaries = [
    ["Buffered upload", "Remote forms materialize each File. Limits of 50 MB/file, 250 MB/batch, and 100 files bound the work; upload is not resumable or streaming."],
    ["Provider-dependent meaning", "Outbox/queue/lease intent is durable, but embeddings and generated descriptions require configured providers and a worker host. Ingestion does not wait for either."],
    ["Managed, not viewed", "There is no PDF/Office parser, archive extraction, OCR, preview, media playback, transcription, code editor, or image editor. Download is the native-content action."],
    ["No version browser", "Re-upload retains the External identity and durable History, but the UI cannot browse or restore predecessor bytes after an unshared blob is collected."],
    ["Filesystem backend", "The current publication/claim/quarantine protocol is safe for processes sharing this repository. A future object-store implementation must preserve equivalent conditional claims."],
    ["Findings deferred", "Findings are not part of this implementation. They can later add an External-managed adapter without changing singleton identity or making files into editors."]
  ] as const;

  const actualContract = [
    ["Schema", "one strict required External row; no migration, alias, synthesized default, or fallback reader"],
    ["Upload", "100 files · 50,000,000 bytes/file · 250,000,000 bytes/batch · 512 UTF-8 path bytes"],
    ["Path", "NFC, relative, slash-normalized, no control/empty/dot/dot-dot/drive-root segment; same rule for every move/rename"],
    ["Native identity", "_storage:<lowercase SHA-256>; hash and actual size derived from received bytes"],
    ["Publication", "fsynced recovery copy + immutable canonical link + durable row claim; startup reconciles after Store recovery"],
    ["Mutation", "one Store.transaction for row/CAS/uniqueness/History/forget/outbox; cleanup only after commit"],
    ["Directory move", "one descendant-set token and one transaction for every affected row"],
    ["References", "typed exhaustive live traversal; historical by-value records and transient focus do not block"],
    ["Semantics", "prose exact; source code material; CSV/TSV material with optional context; image native visual; remaining formats managed only"],
    ["Download", "authorized attachment, safe dual filename, max response, single range, SHA-256 ETag, nosniff, sandbox CSP"],
    ["Selection", "external-file id or external-directory path inside the singleton; never a file tab"],
    ["Inspector", "top actions, availability/details/references/context/status; generated description only when present; no hash/editor"]
  ] as const;
</script>

<div class="external-files-reference">
  <ReferenceHeader current="implementation" />

  <main class="reference-page">
    <header class="hero">
      <div>
        <a class="back" href="/demo/external-files">← External-files system</a>
        <span class="kicker">04 · implementation findings and final contract</span>
        <h1>What the system became in code.</h1>
        <p class="hero-copy">This is the feedback loop from implementation and live testing: the actual commit protocol, recovery boundary, singleton identity, semantic split, architecture shape, and deliberate v1 limits.</p>
      </div>
      <aside class="hero-aside">
        <header><span>Truth source</span><span>implementation + executable contracts</span></header>
        <div><h2>No compatibility layer.</h2><p>Current main infrastructure wins. External uses the current Store journal, atomic semantic outbox, queue leases, operationFlights, and split resource readers.</p><div class="status-pills"><span class="status-pill exists">implemented</span><span class="status-pill extend">hardened</span></div></div>
      </aside>
    </header>

    <section class="section">
      <div class="section-head"><div><span class="kicker">Commit topology</span><h2>A row revision is one lifecycle decision</h2></div><p>Immutable bytes publish first. Everything represented commits once. Native claim finalization and collection are idempotent after the Store decision.</p></div>
      <div class="diagram-frame"><MermaidDiagram source={commitTopology} label="Implemented External commit topology" caption="The durable publication token bridges process interruption after either side has made progress." minHeight="42rem" /></div>
    </section>

    <section class="section">
      <div class="section-head"><div><span class="kicker">State and recovery</span><h2>Every crash boundary has an owner</h2></div><p>Store rollback preserves old row/history/semantic state. Store recovery establishes committed ownership before native reconciliation restores or collects bytes.</p></div>
      <div class="diagram-frame"><MermaidDiagram source={lifecycle} label="External lifecycle and recovery states" caption="A provider failure is downstream from a usable file; a reference or stale revision refuses deletion before the atomic decision." minHeight="44rem" /></div>
    </section>

    <section class="section">
      <div class="section-head"><div><span class="kicker">Surface and meaning</span><h2>Stable manager, explicit semantic lanes</h2></div><p>Workspace identity and semantic identity are separate. The manager remains one tab while each current classification delegates only the meaning it supports.</p></div>
      <div class="two-diagrams">
        <div class="diagram-frame"><MermaidDiagram source={workspace} label="External singleton workspace topology" caption="Focus and selection are state inside External, not file tabs." minHeight="36rem" /></div>
        <div class="diagram-frame"><MermaidDiagram source={semantic} label="Current External semantic routing" caption="Text and code remain distinct; managed-only bytes do not create poison jobs." minHeight="36rem" /></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><div><span class="kicker">Implementation discoveries</span><h2>Changes forced by running the real system</h2></div><p>Each item names the assumption, observed behavior, implementation change, and resulting contract.</p></div>
      <div class="learning-grid">
        {#each discoveries as item, index}
          <article><header><FlaskConical size={16} aria-hidden="true" /><span>L{String(index + 1).padStart(2, "0")}</span><strong>{item.stage}</strong></header><dl><dt>Assumption</dt><dd>{item.assumption}</dd><dt>Observed</dt><dd>{item.observed}</dd><dt>Change</dt><dd>{item.change}</dd><dt>Effect</dt><dd>{item.effect}</dd></dl></article>
        {/each}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><div><span class="kicker">Deliberate boundaries</span><h2>What v1 truthfully does not promise</h2></div><p>These limits are product and deployment boundaries, not legacy support or partial transactional behavior.</p></div>
      <div class="concession-grid">
        {#each boundaries as item, index}<article><div><AlertTriangle size={15} aria-hidden="true" /><span>B{index + 1}</span></div><h3>{item[0]}</h3><p>{item[1]}</p></article>{/each}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><div><span class="kicker">Final contract</span><h2>The implemented system at a glance</h2></div><p>This table replaces the pre-rebase build contract.</p></div>
      <div class="table-wrap"><table class="reference-table"><thead><tr><th>Boundary</th><th>Implemented behavior</th></tr></thead><tbody>{#each actualContract as row}<tr><td><strong>{row[0]}</strong></td><td>{row[1]}</td></tr>{/each}</tbody></table></div>
    </section>

    <section class="section">
      <div class="section-head"><div><span class="kicker">Durable invariants</span><h2>What refinement must preserve</h2></div><p>Visual design and future managed kinds can change without weakening these truths.</p></div>
      <ul class="invariants">
        <li><CheckCircle2 aria-hidden="true" /><span>The name shown to the user is External; Resources is not the category label.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>A file is manageable and downloadable with zero semantic products.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Row, History, semantic forget, and outbox are atomic for every revision.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Committed Store ownership wins over apparent native garbage after restart.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Equal hashes remain safe until every represented row claim is released.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Every read/mutation is project scoped and every live typed reference blocks deletion.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Prose and source code stay distinct current classifications and semantic lanes.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Generated descriptions appear only when actually produced.</span></li>
      </ul>
      <div class="callout"><Lightbulb size={18} aria-hidden="true" /><div><h3>Refine against the production surface.</h3><p>The live route supports ingestion, directory navigation, rename, move, atomic directory move, re-upload, dataset context, download, History, deletion, reload, and truthful failure states. Findings remains deferred.</p></div></div>
    </section>
  </main>

  <footer class="footer"><div><a href="/demo/external-files/file-plan">Exact file map</a><a href="/demo/external-files/ingestion">Ingestion</a><a href="/demo/external-files/stable-tab">External library</a></div><span>Implemented on <code>work/external-files</code></span></footer>
</div>

<style>
  .two-diagrams { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .two-diagrams > div { min-width: 0; }
  .learning-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin-top: 1.2rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--rule); overflow: hidden; }
  .learning-grid article { padding: 1rem; background: var(--raised); }
  .learning-grid header { display: flex; align-items: center; gap: .6rem; }
  .learning-grid header span { color: var(--active); font: 650 8px/1 var(--token-font-mono); }
  .learning-grid header strong { font-size: 11px; }
  .learning-grid dl { display: grid; grid-template-columns: 5.5rem 1fr; gap: .55rem .75rem; margin: 1rem 0 0; }
  .learning-grid dt { color: var(--ink-3); font: 650 7px/1.45 var(--token-font-mono); text-transform: uppercase; }
  .learning-grid dd { margin: 0; color: var(--ink-2); font-size: 9.5px; }
  .concession-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .8rem; margin-top: 1.2rem; }
  .concession-grid article { padding: 1rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); }
  .concession-grid article > div { display: flex; align-items: center; justify-content: space-between; color: var(--attention); }
  .concession-grid article > div span { font: 650 7px/1 var(--token-font-mono); }
  .concession-grid h3 { margin: 1rem 0 .4rem; font-size: 10px; }
  .concession-grid p { margin: 0; color: var(--ink-2); font-size: 9.5px; }
  .invariants { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin: 1.2rem 0 0; padding: 1px; border-radius: var(--token-radius-panel); background: var(--rule); list-style: none; overflow: hidden; }
  .invariants li { display: grid; grid-template-columns: 1.4rem 1fr; gap: .65rem; padding: .85rem; background: var(--raised); color: var(--ink-2); font-size: 10px; }
  .invariants :global(svg) { width: 15px; color: var(--success); }
  @media (max-width: 78rem) { .concession-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .two-diagrams { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 52rem) { .learning-grid, .concession-grid, .invariants { grid-template-columns: 1fr; } .learning-grid dl { grid-template-columns: 1fr; } .learning-grid dt { margin-top: .35rem; } }
</style>
