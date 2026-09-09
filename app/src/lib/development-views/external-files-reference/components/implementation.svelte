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
    participant Blob as materialContent
    participant Rows as representation store
    participant Sem as semantic-overlay
    participant Cache as remote query caches

    User->>UI: select files or browser directory
    UI->>Cap: multipart File[] + relativePaths[]
    Cap->>Cap: scope, limits, path admission, byte read, media sniff
    loop each candidate
      Cap->>Blob: put complete bounded Uint8Array
      Blob-->>Cap: hash + storageId + size + reused
      alt project path already exists
        Cap->>Rows: compare existing hash and admit row
        Rows-->>Cap: reuse or path conflict
      else new project path
        Cap->>Rows: create externalFiles row at revision 1
        Rows-->>Cap: externalFileId
      end
      opt exact or material lane eligible
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
    Candidate --> BlobReady: verified SHA-256 receipt
    BlobReady --> Rejected: same path, different hash
    BlobReady --> ExistingRow: same path, same hash
    BlobReady --> Represented: new externalFiles row
    ExistingRow --> SemanticQueued: supported lane
    ExistingRow --> ManagedOnly: no supported lane
    Represented --> SemanticQueued: supported lane
    Represented --> ManagedOnly: no supported lane
    SemanticQueued --> SemanticCurrent: worker or Inspector refresh publishes
    SemanticQueued --> SemanticFailed: adapter or provider failure
    SemanticFailed --> SemanticQueued: explicit refresh
    SemanticCurrent --> Stale: local display rename changes updatedAt
    Stale --> SemanticQueued: rename enqueue or refresh
    Represented --> DeleteRefused: represented usage exists or revision changed
    ManagedOnly --> DeleteRefused: represented usage exists or revision changed
    SemanticCurrent --> DeleteRefused: represented usage exists or revision changed
    Represented --> Retiring: confirmed and unused
    ManagedOnly --> Retiring: confirmed and unused
    SemanticCurrent --> Retiring: confirmed and unused
    Retiring --> Removed: semantic retirement + row removal
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
    CONTENT["Content · external.library<br/>upload + searchable inventory"]:::surface
    CONTEXT["Context<br/>overview · activity · policy"]:::surface
    SELECT["Selection<br/>kind = external-file<br/>id = externalFileId"]:::state
    INSPECT["Inspector · external.file<br/>rename · download · delete<br/>provenance · usage · semantics"]:::surface
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

    FILE["Committed external file<br/>immutable bytes at revision 0"]:::source
    TEXT{"subkind = text?"}:::exact
    PROFILE{"image, CSV/TSV,<br/>or recognized code?"}:::material
    EJOB["semanticSyncJob<br/>exact spans"]:::exact
    MJOB["semanticMaterialJob<br/>profile + description"]:::material
    NONE["unsupported<br/>no poison job"]:::off
    STATUS["readSemanticStatus<br/>not-started · queued · running<br/>failed · stale · current"]:::source
    REVIEW["File Inspector<br/>review facts, warnings,<br/>summary + provenance"]:::source
    RETIRE["retireSemanticResource<br/>archive + remove + reindex"]:::source

    FILE --> TEXT
    FILE --> PROFILE
    TEXT -->|yes| EJOB --> STATUS
    TEXT -->|no| NONE
    PROFILE -->|yes| MJOB --> STATUS
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
      stage: "Receipt handling",
      assumption: "A remote form result could be consumed once by comparing object identity in a Svelte effect.",
      observed: "Reactive result snapshots can be proxies with fresh identity; equality produced warnings and an effect update-depth loop.",
      change: "The view compares a serializable receipt signature and keeps the latest result as raw immutable state.",
      effect: "One submission causes one focus transition and the most recent file/folder receipt stays visible."
    },
    {
      stage: "Status bar",
      assumption: "Adding externalFiles to the generic name table would make selected-file labels work.",
      observed: "The generic store reader intentionally rejects externalFiles because subject data must pass through its owning capability.",
      change: "Status-bar name resolution now calls readExternalFile, mirroring the existing Template special case.",
      effect: "The status bar displays the local file name without weakening the generic store allowlist."
    },
    {
      stage: "Browser isolation",
      assumption: "Copying the represented seed into a temporary directory isolated browser mutations.",
      observed: "Native material bytes use a separate configured directory and would survive the disposable row store.",
      change: "Runtime accepts ICARUS_MATERIAL_DIRECTORY; browser-server provisions and removes a second temporary directory.",
      effect: "System tests can upload and delete real bytes without polluting development data or leaving rows and blobs out of sync."
    },
    {
      stage: "Semantic eligibility",
      assumption: "Every external file should receive both semantic jobs and let the worker decide support.",
      observed: "That creates durable failures for Office, PDF, audio, video, and arbitrary data with no adapter.",
      change: "Exact and material targets are independent; material eligibility is image, true CSV/TSV, or recognized code only.",
      effect: "Unsupported types say Managed only and create no poison work, while Markdown can be exact-only."
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
      stage: "Activity context",
      assumption: "An Activity panel implied a durable upload/rename/delete event feed.",
      observed: "The representation has no external-file event journal and manufacturing audit history would be misleading.",
      change: "Activity is explicitly a projection of current rows, using revision and updated actor/time; deletions cannot appear after the row is gone.",
      effect: "The UI is useful without claiming an audit trail. A real journal is a separate future capability."
    },
    {
      stage: "Blob reclamation race",
      assumption: "Scanning externalFiles for a shared hash immediately before removal was enough to protect an in-flight upload.",
      observed: "An upload can publish a hash before creating its row; deletion could see no claimant in that interval and remove the just-published bytes.",
      change: "Upload publication/row creation and delete row removal/blob reclamation now share the material-content model’s process-level mutation lease.",
      effect: "The process-local represented store cannot create a successful row whose native blob was concurrently reclaimed."
    }
  ] as const;

  const concessions = [
    ["Buffered request", "Remote forms materialize each File as an ArrayBuffer before materialContent.put. The enforced 50 MB/file and 250 MB/batch limits make that bounded, but this is not a streaming upload architecture."],
    ["No cross-store transaction", "Native filesystem publication, represented JSON tables, and semantic tables cannot commit atomically. Ordering, compensation, and a process-level storage mutation lock prevent dangling rows; a rare cleanup failure can retain an orphaned content-addressed blob."],
    ["Immediate physical GC", "There is no tombstone, retention window, or deletion audit journal. The row is hard-deleted and a global externalFiles hash scan protects shared content before physical removal."],
    ["Explicit worker gap", "Jobs are durable and coalesced, but no always-on queue host ships here. Upload success means queued, not semantically current; Inspector Refresh performs bounded processing on demand."],
    ["Partial media sniffing", "PNG, JPEG, GIF, PDF, and ZIP signatures override weak claims. Other types use declared MIME then filename fallback; serving remains attachment-only, and invalid text fails semantic processing safely."],
    ["No inline media experiences", "External manages files. It does not preview PDF/image/audio/video, render spreadsheets, or edit code. Native download is the content action."],
    ["No replacement lineage", "A project-relative path is unique. Identical retries reuse; different bytes at that path reject. There is no supersedes relation or replace button."],
    ["Findings excluded", "Findings are not implemented in this slice. The category can gain a second managed-kind adapter later without changing the stable-tab identity."]
  ] as const;

  const actualContract = [
    ["Upload limit", "100 files · 50,000,000 bytes each · 250,000,000 bytes total · 512 UTF-8 path bytes"],
    ["Path", "NFC; slash-normalized; relative; no empty, dot, dot-dot, NUL, or drive-root segment"],
    ["Project identity", "externalFiles:<UUID>; row revision begins at 1 for new uploads"],
    ["Native identity", "_storage:<lowercase SHA-256>; actual size comes from received bytes"],
    ["Retry", "same normalized path + same hash → reused row; same path + different hash → per-file path-conflict"],
    ["Rename", "compare baseRevision; update name/updatedBy/updatedAt/revision only; enqueue supported semantic lanes"],
    ["Delete", "compare revision; refuse usage; retire semantics; recheck; hard-delete; scan all rows by hash; remove only when unshared"],
    ["Download", "project-authorized GET; max 50,000,000-byte response; attachment; private/no-cache; ranges; SHA-256 ETag; nosniff; CSP sandbox"],
    ["Exact semantics", "externalFile::text; immutable semantic revision 0; strict UTF-8; 5 MB worker ceiling"],
    ["Material semantics", "recognized code, CSV/TSV, or image; deterministic profile plus optional generated descriptor"],
    ["Selection", "workspace Selection { kind: external-file, id }; target remains category external"],
    ["Context", "Overview = aggregate; Activity = current-row projection; Policy = live configuration and behavior"]
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
        <p>Bytes publish first so a row never intentionally points at absent native content. Semantic enqueue happens after the row and is recoverable; every candidate retains its own outcome.</p>
      </div>
      <div class="diagram-frame"><MermaidDiagram source={commitTopology} label="Implemented external file upload sequence" caption="The operation is an ordered workflow across filesystem, represented store, and semantic store—not a cross-system transaction." minHeight="43rem" /></div>
    </section>

    <section class="section two-diagrams">
      <div>
        <div class="section-head compact"><div><span class="kicker">Lifecycle</span><h2>Every durable and recoverable state</h2></div></div>
        <div class="diagram-frame"><MermaidDiagram source={lifecycle} label="Implemented external file lifecycle" caption="In-use or stale deletion returns to management. A removed row may safely leave a shared or cleanup-failed blob." minHeight="49rem" /></div>
      </div>
      <div>
        <div class="section-head compact"><div><span class="kicker">Meaning</span><h2>Two independent semantic lanes</h2></div></div>
        <div class="diagram-frame"><MermaidDiagram source={semantic} label="Implemented external semantic routing" caption="Unsupported is a status, not a failed job. Generated descriptions never replace exact source or deterministic profiles." minHeight="49rem" /></div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div><span class="kicker">Workspace identity</span><h2>External is the stable thing; files are subjects</h2></div>
        <p>The category carries no resourceId. Focus restores a row, Selection drives external.file, and older snapshots are adopted forward without erasing their existing landings.</p>
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
        <li><CheckCircle2 aria-hidden="true" /><span>Local rename never changes originalName, relativePath, storageId, hash, size, origin, creator, or native bytes.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Corrupt metadata is quarantined; corrupt or missing native bytes are explicit Inspector states.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Every external-file read is project-scoped through the owning capability.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Unsupported semantic types do not create durable failing jobs.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Deletion cannot silently break represented references or remove a hash shared by another file row.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>Generated summaries are reviewable derivative output with model, prompt, coverage, and uncertainty—not source authority.</span></li>
        <li><CheckCircle2 aria-hidden="true" /><span>The name shown to the user is External. Resources is not the category or stable-tab label.</span></li>
      </ul>
      <div class="callout"><Lightbulb size={18} strokeWidth={1.8} aria-hidden="true" /><div><h3>Next design work can happen against the real surface.</h3><p>The live route supports upload, inspection, filtering, context switching, semantic review, rename, download, and delete. Findings remains the only named manager-kind omission.</p></div></div>
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
