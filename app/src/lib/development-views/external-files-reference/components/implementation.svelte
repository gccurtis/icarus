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
    participant Cap as external-files capability
    participant Admit as External native admission
    participant Blob as externalFileStorage
    participant Rows as representation store
    participant Sem as semantic-overlay
    participant Cache as remote query caches

    User->>UI: select files or browser directory
    UI->>Cap: multipart File[] + relativePaths[]
    Cap->>Cap: scope, limits, path admission and bounded byte read
    loop each candidate
      Cap->>Admit: derive hash, size, storageId, MIME and subkind
      Admit-->>Cap: authoritative descriptor
      Cap->>Blob: put verified descriptor plus complete bytes
      Blob-->>Cap: hash + storageId + size + reused
      alt project path already exists
        Cap->>Rows: compare existing hash and admit row
        Rows-->>Cap: reuse or path conflict
      else new project path
        Cap->>Rows: create externalFiles row at revision 1
        Rows-->>Cap: externalFileId
      end
      Cap->>Rows: append uploaded History event
      opt code, CSV/TSV or image material is eligible
        Cap->>Sem: enqueue committed resource reference
        Sem-->>Cap: queued ids or recoverable error
      end
    end
    Cap-->>UI: mixed uploaded / reused / rejected receipt
    UI->>Cache: refresh library + project resource index
    UI->>UI: focus first successful row and inspect file`;

  const lifecycle = `stateDiagram-v2
    [*] --> Candidate
    Candidate --> Rejected: invalid form, limit, path, read, or storage
    Candidate --> DescriptorReady: External derives native descriptor
    DescriptorReady --> BlobReady: storage verifies and publishes receipt
    BlobReady --> Rejected: same path, different hash
    BlobReady --> ExistingRow: same path, same hash
    BlobReady --> Represented: new externalFiles row
    ExistingRow --> SemanticQueued: supported lane
    ExistingRow --> ManagedOnly: no supported lane
    Represented --> SemanticQueued: supported lane
    Represented --> ManagedOnly: no supported lane
    SemanticQueued --> SemanticCurrent: queue host publishes
    SemanticQueued --> SemanticFailed: adapter or provider failure
    SemanticFailed --> SemanticQueued: backfill after correction
    SemanticCurrent --> Replacing: user selects Re-upload
    Replacing --> SemanticQueued: same row id, new receipt and revision
    Replacing --> SemanticCurrent: replacement rejected; original row remains
    SemanticCurrent --> SemanticQueued: local rename changes semantic name
    Represented --> DeleteRefused: represented usage exists or revision changed
    ManagedOnly --> DeleteRefused: represented usage exists or revision changed
    SemanticCurrent --> DeleteRefused: represented usage exists or revision changed
    Represented --> Retiring: confirmed and unused
    ManagedOnly --> Retiring: confirmed and unused
    SemanticCurrent --> Retiring: confirmed and unused
    Retiring --> Removed: semantic retirement + row removal + History
    Removed --> BlobRetained: another row shares hash or removal fails safely
    Removed --> BlobRemoved: no row shares hash and remove succeeds
    BlobRetained --> [*]
    BlobRemoved --> [*]
    Rejected --> [*]
    DeleteRefused --> Represented`;

  const workspace = `flowchart TB
    classDef permanent fill:#201f35,stroke:#806fa9,color:#f6ebe2
    classDef surface fill:#fffdf8,stroke:#315a72,color:#172232
    classDef state fill:#e8f0ef,stroke:#347f78,color:#172232
    classDef later fill:#fff1df,stroke:#d06b32,color:#492c17,stroke-dasharray:5 4

    TAB["Permanent tab<br/>category = external<br/>no resourceId"]:::permanent
    OPEN["open({ category: external, focus? })"]:::state
    CONTENT["Content · external.library<br/>Table / Directory · upload · search"]:::surface
    CONTEXT["Context<br/>Overview · durable History"]:::surface
    SELECT["Selection<br/>external-file id<br/>or external-directory path"]:::state
    INSPECT["Inspector<br/>external.file · external.directory<br/>rename · re-upload · move · delete"]:::surface
    STATUS["Status bar<br/>subject-capability name read"]:::surface
    OLD["Older workspace snapshot"]:::state
    ADOPT["adopt missing singleton<br/>preserve existing landings"]:::state
    FIND["Findings manager adapter<br/>explicitly deferred"]:::later

    OLD --> ADOPT --> TAB
    OPEN --> TAB --> CONTENT
    TAB --> CONTEXT
    CONTENT --> SELECT --> INSPECT
    SELECT --> STATUS
    FIND -. later .-> CONTENT
    FIND -. later .-> INSPECT`;

  const semantic = `flowchart LR
    classDef source fill:#fffdf8,stroke:#315a72,color:#172232
    classDef exact fill:#e8f0ef,stroke:#347f78,color:#172232
    classDef material fill:#fff1df,stroke:#d06b32,color:#492c17
    classDef off fill:#f1efe9,stroke:#aaa194,color:#615b54

    FILE["Committed external file<br/>External-owned bytes + row revision"]:::source
    PROFILE{"text/code,<br/>CSV/TSV, or image?"}:::material
    MJOB["semanticMaterialJob<br/>one resource material"]:::material
    CODE["plain text / source code<br/>code profile + bounded source descriptor"]:::material
    DATA["CSV/TSV<br/>profile + authored context<br/>+ optional descriptor"]:::material
    IMAGE["image<br/>direct original visual vector<br/>no descriptor"]:::material
    NONE["unsupported<br/>no poison job"]:::off
    STATUS["readSemanticStatus<br/>not-started · queued · running<br/>failed · stale · current"]:::source
    REVIEW["File Inspector<br/>conditional status, profile<br/>and summary review"]:::source
    RETIRE["retireSemanticResource<br/>archive + remove + reindex"]:::source

    FILE --> PROFILE
    PROFILE -->|code| CODE --> MJOB --> STATUS
    PROFILE -->|CSV / TSV| DATA --> MJOB
    PROFILE -->|image| IMAGE --> MJOB
    PROFILE -->|no| NONE
    NONE --> STATUS
    STATUS --> REVIEW
    FILE -->|delete| RETIRE`;

  const discoveries = [
    {
      stage: "Browser upload",
      assumption: "Spreading the SvelteKit remote form attributes was enough for File inputs.",
      observed: "The enhanced form rejects file fields unless the HTML form explicitly declares multipart/form-data.",
      change: "Both file and folder forms now set enctype=\"multipart/form-data\". The browser test locks the real transport boundary.",
      effect: "Upload works in enhanced and native form paths without browser-dependent serialization."
    },
    {
      stage: "Folder path serialization",
      assumption: "Assigning an aligned relativePaths array through the remote-form fields object would make directory paths part of the request.",
      observed: "The browser serialized only successful DOM controls. Files arrived, but nested webkitRelativePath values silently collapsed to leaf names.",
      change: "The Content view snapshots every browser relative path and renders one indexed hidden relativePaths control beside each selected File.",
      effect: "A real directory tree reaches the capability with stable File/path index alignment; Chromium proves nested paths survive upload and reload."
    },
    {
      stage: "Receipt handling",
      assumption: "A remote form result could be consumed once by comparing object identity in a Svelte effect.",
      observed: "Reactive result snapshots can be proxies with fresh identity; equality produced warnings and an effect update-depth loop.",
      change: "The view compares a serializable receipt signature and keeps the latest result as raw immutable state.",
      effect: "One submission causes one focus transition and the most recent file/folder receipt stays visible."
    },
    {
      stage: "Directory selection",
      assumption: "A focus-restoration effect could always realign Inspector selection with the tab's file focus.",
      observed: "Selecting a virtual directory was immediately overwritten by the older selected-file focus, so the directory Inspector flashed and vanished.",
      change: "Restoration now yields while selection.kind is external-directory; file focus is used only when no directory subject is active.",
      effect: "Folder selection is stable, restorable library focus remains useful, and directory rename/move can be tested in the real surface."
    },
    {
      stage: "Launcher integration",
      assumption: "Adding every External row to the shared resource index was sufficient for New Tab search and Recent.",
      observed: "File cards had no opening target, and one directory upload filled all eight Recent slots with manager-only files, hiding ordinary editor work.",
      change: "New Tab file results now open the External singleton with file focus. Search keeps every file, while Recent keeps only the newest file entry for the manager-only family.",
      effect: "A file launcher reaches the real manager without creating an editor tab, and one batch cannot monopolize the project recency shelf."
    },
    {
      stage: "Status bar",
      assumption: "Adding externalFiles to the generic name table would make selected-file labels work.",
      observed: "The generic store reader intentionally rejects externalFiles because subject data must pass through its owning capability.",
      change: "Status-bar name resolution now calls readExternalFile, mirroring the existing Template special case.",
      effect: "The status bar displays the local file name without weakening the generic store allowlist."
    },
    {
      stage: "Native-byte ownership",
      assumption: "The existing materialContent object could remain a general blob service and calculate native identity for External.",
      observed: "That made the downstream interpretation layer own hashing, storage, deletion, and concurrency for an unrelated source-resource lifecycle.",
      change: "material-content was removed. External now derives its complete native descriptor, while a narrow externalFileStorage model only verifies, publishes, reads, and removes that descriptor.",
      effect: "The semantic material lane receives an admitted resource reference and can focus on profiles, summaries, and embeddings instead of byte management."
    },
    {
      stage: "Browser isolation",
      assumption: "A disposable represented row directory was sufficient to isolate end-to-end upload tests.",
      observed: "External native bytes have an independent lifecycle and would otherwise survive browser runs.",
      change: "Runtime accepts ICARUS_EXTERNAL_FILE_DIRECTORY; browser-server provisions a second disposable directory while configured legacy storage remains read-compatible.",
      effect: "System tests upload, replace, download, and delete real bytes without polluting development storage."
    },
    {
      stage: "Semantic eligibility",
      assumption: "Plain text needed a separate managed-only subkind while source code had a material profile, and External text/code might also enter the exact lane.",
      observed: "That split the same textual byte boundary into two policies, denied useful summaries to ordinary text, and duplicated source files across semantic concepts the product does not promise.",
      change: "External exact ingestion was removed. Plain text and source code now canonicalize to externalFile::code and one bounded code-profile material; a 64 KB source excerpt feeds its descriptor. CSV/TSV remains data with authored context, and standalone images use only their original visual vector.",
      effect: "There is one textual delegation path, legacy text rows migrate on read, summary text is separately embedded from deterministic profile facets, and image meaning is not diluted by generated text."
    },
    {
      stage: "Re-upload identity",
      assumption: "A same-path different-hash conflict was enough; replacement lineage could remain future work.",
      observed: "Users need to update referenced content without deleting the object or changing every reference.",
      change: "The file Inspector now has an explicit Re-upload form. It CAS-checks the row, publishes candidate bytes, retires old semantics, updates the same id/revision, queues supported meaning, and reclaims the previous unshared blob.",
      effect: "Upload remains collision-safe, while re-upload is a deliberate same-object content update with a stable URL and references."
    },
    {
      stage: "Directory management",
      assumption: "Relative paths could be displayed as folder groupings without needing a mutation contract.",
      observed: "A useful directory view needs rename/move, but creating durable folder rows would introduce a second hierarchy to synchronize.",
      change: "Directories are projected from canonical paths and carry an opaque token over descendant id/revision/path. A collision-checked store.replaceRows commit rewrites every descendant atomically.",
      effect: "People can manage a mock directory hierarchy while native blobs remain content-addressed and no folder entity can drift."
    },
    {
      stage: "Deletion",
      assumption: "The reference originally proposed tombstones, a grace period, and later garbage collection.",
      observed: "No tombstone/audit scheduler exists in this architecture, but the store can scan every external row by hash synchronously.",
      change: "Deletion refuses represented usage, retires semantics, rechecks revision/usage, hard-deletes the row, then immediately removes only an unshared blob.",
      effect: "The behavior is complete and testable now; a failed byte removal leaves a safe orphan and is reported as retained-after-error."
    },
    {
      stage: "Legacy rows",
      assumption: "New provenance and revision fields could become required immediately.",
      observed: "The represented seed and existing installations can contain the earlier externalFiles shape.",
      change: "Table additions are optional; strict capability admission derives originalName/path/subkind, size=null, updater=creator, and revision=0 fallbacks.",
      effect: "Old valid files remain readable while every new upload writes the complete shape."
    },
    {
      stage: "History context",
      assumption: "A current-row Activity projection was sufficient for recency.",
      observed: "It erased deletions and could not distinguish initial upload, re-upload, rename, move, and dataset-context changes.",
      change: "The Policy view was removed and Activity became History, backed by scoped activity rows appended by each lifecycle procedure and retained after file deletion.",
      effect: "Context stays library-wide and gives a truthful durable lifecycle record instead of reconstructing history from surviving rows."
    },
    {
      stage: "Blob reclamation race",
      assumption: "Scanning externalFiles for a shared hash immediately before removal was enough to protect an in-flight upload.",
      observed: "An upload can publish a hash before creating its row; deletion could see no claimant in that interval and remove the just-published bytes.",
      change: "Upload/re-upload publication and row claims, plus delete/reclamation, share externalFileStorage's process-level mutation lease.",
      effect: "The process-local represented store cannot create a successful row whose native blob was concurrently reclaimed."
    }
  ] as const;

  const concessions = [
    ["Buffered request", "Remote forms materialize each File as an ArrayBuffer before External admission. The enforced 50 MB/file and 250 MB/batch limits make this finite, but it is not resumable or streaming upload."],
    ["No cross-store transaction", "External native storage, represented JSON tables, semantic tables, and History rows cannot commit together. Ordering and compensation prevent dangling resource rows; rare cleanup or event-append failure can leave safe recoverable state."],
    ["Process-local lease", "The storage mutation lease closes upload/delete races inside one server process. A multi-process deployment would need a shared lock, transactional object-store claim system, or durable claim record."],
    ["Immediate physical GC", "There is no tombstone or retention window. After durable History is appended, the file row is hard-deleted and a global externalFiles hash scan protects shared bytes before physical removal."],
    ["Explicit worker-host gap", "Jobs and backfill procedures are durable and coalesced, but this branch does not deploy an always-on queue host. The Inspector intentionally has no manual refresh button; queued status remains honest until an operational host runs."],
    ["Partial media sniffing", "PNG, JPEG, GIF, WebP, PDF, and ZIP signatures override weak claims; known textual/code and data extensions override arbitrary browser MIME. Other families retain a sanitized declared type and remain attachment-only."],
    ["No inline media experiences", "External manages files. It does not preview PDF/image/audio/video, render spreadsheets, or edit code. Native download is the content action."],
    ["Re-upload, not version browser", "Re-upload advances the same row and preserves History, but there is no UI to browse or restore prior byte revisions. An unshared predecessor blob is reclaimed immediately."],
    ["Legacy storage compatibility", "New bytes publish under data/external-files. Reads and removal also address the prior data/materials directory so pre-boundary rows remain usable; there is no eager migration job."],
    ["Findings excluded", "Findings are not implemented in this slice. The category can gain a second managed-kind adapter later without changing the stable-tab identity."]
  ] as const;

  const actualContract = [
    ["Upload limit", "100 files · 50,000,000 bytes each · 250,000,000 bytes total · 512 UTF-8 path bytes"],
    ["Path", "NFC; slash-normalized; relative; no empty, dot, dot-dot, NUL, or drive-root segment"],
    ["Project identity", "externalFiles:<UUID>; row revision begins at 1 for new uploads"],
    ["Native identity", "_storage:<lowercase SHA-256>; actual size comes from received bytes"],
    ["Descriptor owner", "External derives SHA-256, actual size, _storage:<hash>, canonical media type, and subkind before storage I/O"],
    ["Retry", "same normalized path + same hash → reused row; same path + different hash → path conflict and explicit Re-upload guidance"],
    ["Rename", "compare baseRevision; update local name and path leaf; preserve original upload name/bytes; revision + 1; retire/requeue supported material"],
    ["Move file", "compare baseRevision; normalize full destination; reject collisions; update name/path and revision"],
    ["Move directory", "compare opaque descendant token; reject self/descendant/collision destinations; replace all member rows in one table commit"],
    ["Re-upload", "compare baseRevision; preserve id/name/path/original name; replace native receipt; revision + 1; retire/requeue material; reclaim old unshared hash"],
    ["Delete", "compare revision; refuse references; retire semantics; recheck; hard-delete; append History; scan hashes; remove only when unshared"],
    ["Download", "project-authorized GET; max 50,000,000-byte response; attachment; private/no-cache; ranges; SHA-256 ETag; nosniff; CSP sandbox"],
    ["Exact semantics", "unsupported for every External file kind; legacy external exact sources are always stale"],
    ["Material semantics", "plain text/source → externalFile::code, bounded code profile and 64 KB source-backed descriptor; CSV/TSV → bounded profile/authored context/optional descriptor; image → direct original visual vector only"],
    ["Selection", "workspace Selection is external-file id or external-directory path; tab target remains category external"],
    ["Context", "Overview = aggregate; History = durable project lifecycle events; there is no Policy view"],
    ["Inspector", "top actions Rename/Re-upload/Download/Move/Delete; double-click name/path; Details; References; conditional dataset context and material review; no hash"]
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
        <p class="hero-copy">
          This page is the feedback loop from implementation and live testing. It records the actual commit
          ordering, state transitions, UI identity, semantic coverage, concessions, and defects discovered only
          by exercising the production feature—not the earlier aspirational design.
        </p>
      </div>
      <aside class="hero-aside">
        <header><span>Truth source</span><span>implementation + tests</span></header>
        <div>
          <h2>The build contract has been retired.</h2>
          <p>All five pages now describe <code>work/external-files</code> as implemented. Anything not present is labeled limitation or deferred work.</p>
          <div class="status-pills"><span class="status-pill exists">implemented</span><span class="status-pill extend">concession</span><span class="status-pill defer">deferred</span></div>
        </div>
      </aside>
    </header>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Commit topology</span><h2>The row is the usability boundary</h2></div>
        <p>External derives identity before its storage model is called. Bytes publish first so a row never intentionally points at absent native content; material enqueue happens after the row and is recoverable.</p>
      </div>
      <div class="diagram-frame"><MermaidDiagram source={commitTopology} label="Implemented external file upload sequence" caption="The operation is an ordered workflow across filesystem, represented store, and semantic store—not a cross-system transaction." minHeight="43rem" /></div>
    </section>

    <section class="section two-diagrams">
      <div>
        <div class="section-head compact"><div><span class="kicker">Lifecycle</span><h2>Every durable and recoverable state</h2></div></div>
        <div class="diagram-frame"><MermaidDiagram source={lifecycle} label="Implemented external file lifecycle" caption="In-use or stale deletion returns to management. A removed row may safely leave a shared or cleanup-failed blob." minHeight="49rem" /></div>
      </div>
      <div>
        <div class="section-head compact"><div><span class="kicker">Meaning</span><h2>One delegated material lane</h2></div></div>
        <div class="diagram-frame"><MermaidDiagram source={semantic} label="Implemented external semantic routing" caption="Unsupported is a status, not a failed job. Code/data profiles and native image vectors remain derived from the External-owned source." minHeight="49rem" /></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Workspace identity</span><h2>External is the stable thing; files are subjects</h2></div>
        <p>The category carries no resourceId. Focus restores a file; Selection drives external.file or external.directory; older snapshots are adopted forward without erasing their existing landings.</p>
      </div>
      <div class="diagram-frame"><MermaidDiagram source={workspace} label="Implemented External workspace surface architecture" caption="There is one permanent External tab and one file manager Inspector. No MIME family mints an editor tab." minHeight="37rem" /></div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Live-test discoveries</span><h2>Where implementation changed the design</h2></div>
        <p>Each item names the original assumption, what executable behavior revealed, the resulting code change, and the product effect.</p>
      </div>
      <div class="learning-grid">
        {#each discoveries as item, index}
          <article>
            <header><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.stage}</strong></header>
            <dl><dt>Assumption</dt><dd>{item.assumption}</dd><dt>Observed</dt><dd>{item.observed}</dd><dt>Implemented</dt><dd>{item.change}</dd><dt>User effect</dt><dd>{item.effect}</dd></dl>
          </article>
        {/each}
      </div>
      <div class="callout success"><FlaskConical size={18} strokeWidth={1.8} aria-hidden="true" /><div><h3>The production browser path is part of the architecture proof.</h3><p>It caught transport, reactivity, capability ownership, and storage-isolation issues that type checks and capability tests could not expose.</p></div></div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Final contract</span><h2>Concrete values and mutation rules</h2></div>
        <p>These values are read directly from runtime configuration and implemented procedures. They are not recommendations.</p>
      </div>
      <div class="table-wrap"><table class="reference-table"><thead><tr><th>Concern</th><th>Implemented behavior</th></tr></thead><tbody>{#each actualContract as row}<tr><td><strong>{row[0]}</strong></td><td>{row[1]}</td></tr>{/each}</tbody></table></div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Concessions and limits</span><h2>What this implementation deliberately does not hide</h2></div>
        <p>These are current architectural facts. Changing one requires coordinated model, capability, UI, test, and reference updates.</p>
      </div>
      <div class="concession-grid">
        {#each concessions as item, index}<article><div><AlertTriangle size={16} strokeWidth={1.7} aria-hidden="true" /><span>C{index + 1}</span></div><h3>{item[0]}</h3><p>{item[1]}</p></article>{/each}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Durable invariants</span><h2>What must stay true during refinement</h2></div>
        <p>Visual refinement and future adapters are free to evolve around these boundaries.</p>
      </div>
      <ul class="invariants">
        <li><CheckCircle2 aria-hidden="true" /><span>A file can be useful and downloadable with zero semantic products.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Local rename changes the name and relative-path leaf but never originalName, storage receipt, origin, creator, or native bytes.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Re-upload is the only content replacement gesture and preserves the External row id, local name/path, and represented references.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Corrupt metadata is quarantined; corrupt or missing native bytes are explicit Inspector states.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Every external-file read is project-scoped through the owning capability.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>External never delegates to exact semantics; unsupported material types do not create durable failing jobs.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Deletion cannot silently break represented references or remove a hash shared by another file row.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Generated summaries appear only for material types that produced one; standalone images remain a pure native visual vector.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>The name shown to the user is External. Resources is not the category or stable-tab label.</span></li>
      </ul>
      <div class="callout"><Lightbulb size={18} strokeWidth={1.8} aria-hidden="true" /><div><h3>Next design work can happen against the real surface.</h3><p>The live route supports file/folder upload, Table/Directory navigation, file and folder inspection, durable History, name/path edits, re-upload, dataset context, conditional semantic review, download, and reference-safe delete. Findings remains deferred.</p></div></div>
    </section>
  </main>

  <footer class="footer"><div><a href="/demo/external-files/file-plan">Exact file map</a><a href="/demo/external-files/ingestion">Ingestion</a><a href="/demo/external-files/stable-tab">External library</a></div><span>Implemented on <code>work/external-files</code></span></footer>
</div>

<style>
  .two-diagrams { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }.two-diagrams > div { min-width: 0; }.section-head.compact { display: block; }.section-head.compact h2 { margin-bottom: .9rem; }
  .learning-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin-top: 1.2rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--rule); overflow: hidden; }
  .learning-grid article { padding: 1rem; background: var(--raised); }.learning-grid header { display: flex; align-items: center; gap: .6rem; }.learning-grid header span { color: var(--active); font: 650 8px/1 var(--token-font-mono); }.learning-grid header strong { font-size: 11px; }
  .learning-grid dl { display: grid; grid-template-columns: 5.5rem 1fr; gap: .55rem .75rem; margin: 1rem 0 0; }.learning-grid dt { color: var(--ink-3); font: 650 7px/1.45 var(--token-font-mono); text-transform: uppercase; }.learning-grid dd { margin: 0; color: var(--ink-2); font-size: 9.5px; }
  .concession-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .8rem; margin-top: 1.2rem; }.concession-grid article { padding: 1rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); }.concession-grid article > div { display: flex; align-items: center; justify-content: space-between; color: var(--attention); }.concession-grid article > div span { font: 650 7px/1 var(--token-font-mono); }.concession-grid h3 { margin: 1rem 0 .4rem; font-size: 10px; }.concession-grid p { margin: 0; color: var(--ink-2); font-size: 9.5px; }
  .invariants { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin: 1.2rem 0 0; padding: 1px; border-radius: var(--token-radius-panel); background: var(--rule); list-style: none; overflow: hidden; }.invariants li { display: grid; grid-template-columns: 1.4rem 1fr; gap: .65rem; padding: .85rem; background: var(--raised); color: var(--ink-2); font-size: 10px; }.invariants :global(svg) { width: 15px; color: var(--success); }
  @media (max-width: 78rem) { .concession-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.two-diagrams { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 52rem) { .learning-grid, .concession-grid, .invariants { grid-template-columns: 1fr; }.learning-grid dl { grid-template-columns: 1fr; }.learning-grid dt { margin-top: .35rem; } }
</style>
