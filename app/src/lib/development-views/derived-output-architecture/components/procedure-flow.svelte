<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Braces from "@lucide/svelte/icons/braces";
  import Boxes from "@lucide/svelte/icons/boxes";
  import Check from "@lucide/svelte/icons/check";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import Database from "@lucide/svelte/icons/database";
  import FileInput from "@lucide/svelte/icons/file-input";
  import FileText from "@lucide/svelte/icons/file-text";
  import Gauge from "@lucide/svelte/icons/gauge";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import Layers3 from "@lucide/svelte/icons/layers-3";
  import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
  import Network from "@lucide/svelte/icons/network";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Search from "@lucide/svelte/icons/search";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Workflow from "@lucide/svelte/icons/workflow";

  import MermaidDiagram from "$development-views/derived-output-architecture/components/mermaid-diagram.svelte";

  type FunctionStatus = "existing" | "extend" | "new" | "deferred";
  type FunctionGroup = "ingestion" | "generation" | "reading";

  type FunctionStep = {
    order: string;
    name: string;
    owner: string;
    status: FunctionStatus;
    input: string;
    output: string;
    note: string;
  };

  const INGESTION: FunctionStep[] = [
    {
      order: "01",
      name: "submitDocumentChanges / submitSlideDeckChanges",
      owner: "resource capability",
      status: "extend",
      input: "authoritative change set",
      output: "accepted revision N",
      note: "The normal entry point. Only an accepted leader revision can schedule semantic work."
    },
    {
      order: "02",
      name: "enqueueSemanticSyncFor",
      owner: "semantic-overlay capability",
      status: "new",
      input: "{ ref, revision: N }",
      output: "coalesced sync job",
      note: "Writes a persisted coalescing job immediately after the leader. Cross-table atomicity awaits a transactional store."
    },
    {
      order: "03",
      name: "backfillSemanticOverlay",
      owner: "development / operations",
      status: "new",
      input: "{ force?, limit? }",
      output: "discovery + bounded batch report",
      note: "Enumerates document and deck leaders, coalesces jobs, then runs one bounded batch through the same worker path."
    },
    {
      order: "04",
      name: "processSemanticSyncQueue",
      owner: "semantic worker entry",
      status: "new",
      input: "{ limit?, ref? }",
      output: "processed jobs + remaining count",
      note: "Claims one bounded project batch; an always-on deployment host will invoke this same procedure."
    },
    {
      order: "05",
      name: "syncSemanticResource",
      owner: "semantic worker",
      status: "new",
      input: "{ ref, force? } over latest leader",
      output: "published generation or no-op",
      note: "The idempotent orchestration boundary. It rechecks authoritative text after provider work and refuses stale publication."
    },
    {
      order: "06",
      name: "readSemanticResource",
      owner: "resource projection",
      status: "new",
      input: "{ ref }",
      output: "SemanticResourceProjection",
      note: "Documents and decks flatten to canonical UTF-16 text plus locator spans; prompt blocks are excluded to prevent evidence loops."
    },
    {
      order: "07",
      name: "EmbeddingModel.tokenField",
      owner: "embedding model",
      status: "existing",
      input: "source.text",
      output: "TokenEmbeddingField",
      note: "Jina returns contextual token labels and vectors for the complete source."
    },
    {
      order: "08",
      name: "prepareTranslation",
      owner: "semantic behavior",
      status: "existing",
      input: "source + token field + config",
      output: "PreparedTranslation",
      note: "Exact token alignment and distance-discounted segmentation produce source-coordinate spans."
    },
    {
      order: "09",
      name: "EmbeddingModel.windowedPassages",
      owner: "embedding model",
      status: "existing",
      input: "prepared span texts",
      output: "dense span vectors",
      note: "The final span texts are embedded together so their vectors remain source-contextual."
    },
    {
      order: "10",
      name: "completeTranslation",
      owner: "semantic behavior",
      status: "existing",
      input: "prepared + dense vectors",
      output: "TranslationResult",
      note: "Attaches vectors to exact spans without performing any persistence."
    },
    {
      order: "11",
      name: "publishSemanticTranslation",
      owner: "semantic-overlay capability",
      status: "new",
      input: "TranslationResult + force?",
      output: "source, objects, history, generation N+1",
      note: "One guarded synchronous publication turn replaces this source's active objects and snapshots the retired values."
    },
    {
      order: "12",
      name: "stageSemanticIndex",
      owner: "semantic index",
      status: "new",
      input: "next active object set",
      output: "complete replacement + commit / rollback",
      note: "This pass stages a full recursive replacement before source publication. Delta indexing remains the scale-up seam."
    }
  ];

  const GENERATION: FunctionStep[] = [
    {
      order: "01",
      name: "blockTypeOps → emptyPrompt",
      owner: "document editor",
      status: "new",
      input: "empty line + kind: prompt",
      output: "editable unlinked PromptBlock",
      note: "The ordinary Block selector performs the conversion and opens the Prompt inspector. The context rail only indexes blocks already in the document."
    },
    {
      order: "02",
      name: "createDerivedOutput / createTemplatedDerivedOutput",
      owner: "derived-output capability",
      status: "existing",
      input: "prompt + scope?",
      output: "idle DerivedOutput row",
      note: "The row is the durable definition, evidence record, and canonical generated value. The simple document inspector creates the direct-prompt variant today."
    },
    {
      order: "03",
      name: "linkPromptBlockOps",
      owner: "document editor",
      status: "new",
      input: "PromptBlock + derivedOutputId",
      output: "document set op + accepted revision",
      note: "Links the surface block before provider work. Optional example text is stored as ungrounded continuity, never evidence."
    },
    {
      order: "04",
      name: "enqueueDerivedRefresh",
      owner: "derived-output capability",
      status: "deferred",
      input: "derivedOutputId + definition revision",
      output: "idempotent refresh job",
      note: "Target scale-up seam. The current document path calls refresh in the creation request after draining one bounded semantic batch."
    },
    {
      order: "05",
      name: "refreshDerivedOutput",
      owner: "derived worker",
      status: "existing",
      input: "derivedOutputId",
      output: "published / failed / superseded",
      note: "Claims the output, snapshots its definition, bounds retries, and preserves the last good response on failure. The document rail invokes it directly today."
    },
    {
      order: "06",
      name: "buildDerivedRunContext",
      owner: "derived-output capability",
      status: "deferred",
      input: "definition + hasSelection + prior response",
      output: "system prompt + task envelope + budgets",
      note: "The envelope carries only a selection-presence flag. The target read_selection tool returns selected text as registered, untrusted evidence."
    },
    {
      order: "07",
      name: "synthesize",
      owner: "derived-output capability",
      status: "extend",
      input: "DerivedOutput + intelligence + retrieve",
      output: "SynthesisDecision + issued evidence",
      note: "Keep the bounded structured-output loop; add selection, discovery, interpreted material retrieval, traversal, contextual view, and typed evidentiary readers beside exact-text retrieve."
    },
    {
      order: "08",
      name: "querySemanticOverlay",
      owner: "semantic-overlay capability",
      status: "existing",
      input: "query + ResourceSet + topK",
      output: "SemanticHit[] + diagnostics",
      note: "The retrieve tool delegates here; overlapping or adjacent spans consolidate before top K, then each exact hit receives an attempt-local evidence ID."
    },
    {
      order: "09",
      name: "resource reading tool family",
      owner: "project-resource capability",
      status: "deferred",
      input: "scoped resource/content handles + bounded typed request",
      output: "navigation/context or typed evidence",
      note: "find/list/inspect/view orient without evidence; retrieve_materials issues interpreted descriptor evidence; read_text/read_table/read_chart/read_image/read_csv/read_code use direct project-resource paths and mint native evidence IDs."
    },
    {
      order: "10",
      name: "resolveEvidenceSelections",
      owner: "derived-output behavior",
      status: "new",
      input: "decision.evidence + run registry",
      output: "SemanticCitation[]",
      note: "Only application-issued IDs resolve. Touching citations across tool calls consolidate while retaining every evidence use; the model never authors provenance."
    },
    {
      order: "11",
      name: "changedSemanticSources",
      owner: "semantic behavior",
      status: "existing",
      input: "citations + active sources",
      output: "changed source snapshots",
      note: "Grounded answers watch selected sources; citation-free negative results instead watch the searched overlay generation."
    },
    {
      order: "12",
      name: "responseBlock + writeOutput",
      owner: "derived-output capability",
      status: "existing",
      input: "validated response + evidence + revision",
      output: "fresh canonical ContentBlock",
      note: "Publish response, citations, queries, and revision together. No separate artifact table is needed for the first pass."
    },
    {
      order: "13",
      name: "syncPromptBlockOps",
      owner: "document editor",
      status: "new",
      input: "PromptBlock + published DerivedOutput",
      output: "editable text + freshness mirror; mark ranges retained",
      note: "Copies only text from the Derived Output. The document adapter reapplies its own absolute mark ranges, clipped to a shorter response."
    }
  ];

  const READING: FunctionStep[] = [
    {
      order: "01",
      name: "readDerivedOutputValue",
      owner: "derived-output capability",
      status: "new",
      input: "{ derivedOutputId }",
      output: "render-safe response projection",
      note: "A narrow API keeps storage layout out of documents, decks, exports, and automation consumers."
    },
    {
      order: "02",
      name: "readDerivedOutput",
      owner: "derived-output capability",
      status: "existing",
      input: "project-scoped ID",
      output: "row + effective state + changed sources",
      note: "The lower-level read computes freshness on pull without fan-out writes after every source edit."
    },
    {
      order: "03",
      name: "syncPromptBlockOps",
      owner: "document editor",
      status: "new",
      input: "PromptBlock + DerivedOutput",
      output: "ordinary editable text ops",
      note: "Generated prose is copied into the Prompt Block's atoms/display and remains selectable, markable, and editable like normal document text."
    },
    {
      order: "04",
      name: "place (Prompt gutter projection)",
      owner: "document editor",
      status: "new",
      input: "laid-out Prompt Blocks + pasteboard origin",
      output: "pasteboard-gutter settings star",
      note: "A sibling of the comment pins opens settings. It is outside ProseMirror and outside the document's margin coordinate system."
    },
    {
      order: "05",
      name: "resolvePresentationSnapshot",
      owner: "export / deck adapter",
      status: "deferred",
      input: "DerivedOutputValue + target format",
      output: "frozen presentation value",
      note: "Exports and decks can resolve the canonical value by ID or deliberately freeze the current editable presentation, according to their own contract."
    }
  ];

  const GROUPS: { id: FunctionGroup; label: string; detail: string; icon: typeof Layers3 }[] = [
    { id: "ingestion", label: "Resource → overlay", detail: "12 calls", icon: Layers3 },
    { id: "generation", label: "Prompt → response", detail: "13 calls", icon: Sparkles },
    { id: "reading", label: "ID → rendered value", detail: "5 calls", icon: KeyRound }
  ];

  const functions: Record<FunctionGroup, FunctionStep[]> = {
    ingestion: INGESTION,
    generation: GENERATION,
    reading: READING
  };

  let activeGroup = $state<FunctionGroup>("ingestion");
  const activeFunctions = $derived(functions[activeGroup]);

  const INGEST_DIAGRAM = `flowchart TB
    subgraph ENTRY["TWO ENTRY POINTS"]
      direction LR
      edit["Document or deck edit"]:::surface --> commit["commit accepted<br/>revision N"]:::existing
      commit -. "respond now" .-> ui["UI is free"]:::quiet
      commit --> enqueue["enqueueSemanticSyncFor<br/>ref + revision N"]:::new
      seed["seed manifest /<br/>backfill command"]:::surface --> enumerate["backfillSemanticOverlay"]:::new
      enumerate --> enqueue
    end

    subgraph CLAIM["CLAIM + PROJECT AUTHORITATIVE TEXT"]
      direction LR
      claim["processSemanticSyncQueue<br/>claim coalesced job"]:::new --> sync["syncSemanticResource<br/>latest authoritative revision"]:::new
      sync --> project["readSemanticResource<br/>text + locator map"]:::new
      project --> token["EmbeddingModel<br/>.tokenField"]:::existing
    end

    subgraph CORE["DETERMINISTIC TRANSLATION"]
      direction LR
      prepare["prepareTranslation<br/>align + segment"]:::existing --> spans["EmbeddingModel<br/>.windowedPassages"]:::existing
      spans --> complete["completeTranslation<br/>spans + vectors"]:::existing
    end

    subgraph SETTLE["GUARDED PUBLICATION"]
      direction LR
      publish["publishSemanticTranslation<br/>source + objects + history"]:::new --> index["stageSemanticIndex<br/>full replacement tree"]:::new
      index --> ready["queryable generation<br/>N + 1"]:::done
    end

    enqueue --> claim
    token --> prepare
    complete --> publish

    classDef surface fill:#172232,color:#fff,stroke:#172232,stroke-width:2px;
    classDef existing fill:#e7f3ef,color:#17352f,stroke:#347f78,stroke-width:2px;
    classDef new fill:#fff0dd,color:#4b2d18,stroke:#d06b32,stroke-width:2px;
    classDef extend fill:#e8edf5,color:#263951,stroke:#5e7897,stroke-width:2px;
    classDef quiet fill:#f4f0e8,color:#687784,stroke:#a8a093,stroke-dasharray: 4 4;
    classDef done fill:#315a72,color:#fff,stroke:#315a72,stroke-width:2px;`;

  const DERIVED_SEQUENCE = `sequenceDiagram
    autonumber
    participant UI as Block menu + Prompt inspector
    participant DR as Document runtime
    participant DO as Derived Output capability
    participant SO as Semantic Overlay
    participant A as Agent runtime
    participant R as Representation

    UI->>DR: blockTypeOps(empty line, prompt)
    DR->>R: flush editable PromptBlock
    Note over UI,R: Context rail lists prompts—it does not create them
    UI->>DO: createDerivedOutput(prompt, optional scope)
    DO->>R: create derivedOutputs row
    R-->>DO: derivedOutputId
    DO-->>UI: idle output + ID
    UI->>DR: linkPromptBlockOps(block, derivedOutputId)
    DR->>R: flush accepted document revision
    Note over DR,R: Block owns editable presentation + ID, output owns canonical evidence

    UI->>SO: processSemanticSyncQueue(limit: 50)
    SO->>R: publish pending authoritative resource projections
    UI->>DO: refreshDerivedOutput(id)
    DO->>R: claim state + snapshot definition
    DO->>A: synthesize(run context, tools, schema)
    loop bounded tool rounds
      A->>SO: retrieve(query, scope, topK)
      SO-->>A: spans + attempt-local evidence IDs
    end
    A-->>DO: response + selected evidence IDs
    DO->>DO: resolve IDs + recheck cited revisions
    alt evidence remains current
      DO->>R: publish response + evidence + revision atomically
      DO-->>UI: fresh response projection
      UI->>DR: syncPromptBlockOps(block, output)
      DR->>R: flush text + state, preserve editor-owned mark ranges
      Note over UI,DR: Normal selectable text + settings star in the pasteboard gutter
    else cited source changed
      DO->>A: retry with a fresh evidence registry
    end`;

  const STATE_DIAGRAM = `stateDiagram-v2
    [*] --> idle: definition exists
    idle --> generating: refresh job claims
    stale --> generating: refresh requested
    error --> generating: retry requested
    generating --> fresh: stable evidence publishes
    generating --> error: bounded failure
    generating --> stale: definition superseded
    fresh --> stale: cited source revision changes
    fresh --> stale: no evidence + overlay advances
    fresh --> stale: prompt, scope, or response text edit
    fresh --> fresh: unrelated source advances overlay
    error --> error: last good response remains readable`;

  const READ_CONTRACT = `type DerivedOutputValue = {
  derivedOutputId: Id<"derivedOutputs">;
  value: string | null;
  block: ContentBlock | null;
  state: "idle" | "generating" | "fresh" | "stale" | "error";
  revision: number | null;
  variables: DerivedVariableResolution[];
  evidence: SemanticCitation[];
};

readDerivedOutputValue({ derivedOutputId })
  → DerivedOutputValue | null;`;

  const STORAGE = [
    {
      table: "semanticSources",
      key: "ResourceRef + current revision",
      owns: "the provenance anchor, coordinate encoding, and locator sidecar",
      never: "the full authoritative resource body"
    },
    {
      table: "semanticObjects",
      key: "semanticSourceId + exact span",
      owns: "active source text spans and dense vectors",
      never: "document- or slide-specific structure"
    },
    {
      table: "derivedOutputs",
      key: "derivedOutputId",
      owns: "prompt/template, scope, state, response, named values, and locator-bearing citations",
      never: "model-authored provenance or generation-local object IDs"
    },
    {
      table: "document / deck snapshot",
      key: "resourceId + leader revision",
      owns: "PromptBlock placement, editable text and marks, state mirror, and derivedOutputId",
      never: "the canonical generated definition or evidence record"
    }
  ];

  const FOOTPRINT = [
    {
      count: "06",
      label: "Resource entry + write triggers",
      path: "new-tab · project-resources · document · slide-deck",
      change: "Creation persists an editable first block; accepted leader revisions enqueue coalesced semantic work."
    },
    {
      count: "28",
      label: "Semantic capability",
      path: "projection · queue · publication · index",
      change: "The new orchestration spine owns text ingestion through queryable generation."
    },
    {
      count: "16",
      label: "Derived capability",
      path: "synthesis · templates · value read",
      change: "Named variables, strict evidence, freshness, and presentation reads land here."
    },
    {
      count: "14",
      label: "Representation + store",
      path: "contracts · tables · deterministic behavior",
      change: "Durable job, locator, template, and variable shapes remain model-independent."
    },
    {
      count: "11",
      label: "Demo surfaces + routes",
      path: "flow · runtime · executable proof",
      change: "Three purpose-built views explain, inspect, and execute the architecture."
    },
    {
      count: "16",
      label: "Document Prompt Block",
      path: "block menu · inspector · gutter · projection",
      change: "One ID-backed styled block creates, edits, formats, refreshes, and inspects the canonical output."
    },
    {
      count: "06",
      label: "Cross-cutting proof + docs",
      path: "browser · vertical integration · working notes",
      change: "The resource-to-value path is tested as one system, not only as isolated units."
    }
  ];

  const DECISIONS = [
    {
      number: "01",
      title: "One text projection boundary",
      body: "Every resource adapter emits SemanticSourceInput plus a locator map. The overlay receives text, revision and provenance—not editor JSON."
    },
    {
      number: "02",
      title: "One queue now, one next",
      body: "Semantic synchronization has a persisted, revision-coalesced queue. The document Prompt Block now invokes refresh explicitly; a durable derived-refresh queue remains the independent scale-up seam."
    },
    {
      number: "03",
      title: "Current artifact lives on the resource",
      body: "The first pass keeps one canonical ContentBlock on derivedOutputs. Add immutable revisions only when a real audit or rollback consumer appears."
    },
    {
      number: "04",
      title: "Freshness follows used evidence",
      body: "A grounded response goes stale when a cited source changes. A negative result has no source to watch, so it goes stale on the next overlay generation."
    }
  ];
</script>

<svelte:head>
  <title>Derived Output procedure flow — Icarus</title>
  <meta
    name="description"
    content="The implemented resource-ingestion and Derived Output path, with its explicit next integration seams."
  />
</svelte:head>

<div class="flow-page">
  <header class="local-nav">
    <a class="brand" href="/demo/semantic-overlay">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>SEMANTIC OVERLAY</span>
      <ChevronRight size={13} aria-hidden="true" />
      <strong>DERIVED OUTPUT FLOW</strong>
    </a>
    <nav aria-label="Derived Output flow sections">
      <a href="#entries">entry points</a>
      <a href="#ingestion">ingestion</a>
      <a href="#generation">generation</a>
      <a href="#functions">functions</a>
      <a href="#footprint">footprint</a>
      <a href="#read">read API</a>
      <a href="/demo/semantic-overlay/derived-output-live">live proof</a>
      <a class="runtime-link" href="/demo/semantic-overlay/agent-runtime">agent runtime <ArrowRight size={13} aria-hidden="true" /></a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow"><Workflow size={14} aria-hidden="true" /> EXECUTABLE ARCHITECTURE / CALL BY CALL</div>
        <h1>One text path in.<br /><em>One grounded block out.</em></h1>
        <p>
          This is the complete lifecycle: where normal authoring and seeded development enter,
          which functions own every hand-off, how the document Prompt Block runs now, what remains
          for queued generation and other editors, and how any surface resolves the response by ID.
        </p>
        <div class="hero-actions">
          <a href="#ingestion">Trace the first call <ArrowDown size={14} aria-hidden="true" /></a>
          <a class="secondary" href="/demo/semantic-overlay/derived-output-live">Run the live proof</a>
          <a class="secondary" href="/demo/semantic-overlay/agent-runtime">Inspect the agent design</a>
        </div>
      </div>

      <aside class="hero-rule" aria-label="Architecture invariant">
        <div class="rule-index">00</div>
        <span>THE LOAD-BEARING RULE</span>
        <strong>Commit first.<br />Derive second.</strong>
        <p>
          A stored resource revision is the only source of truth. Embedding and generation consume
          that revision asynchronously and must prove it is still current before publication.
        </p>
        <div class="rule-path">
          <span>authoritative write</span><ArrowRight size={14} aria-hidden="true" />
          <span>persisted job</span><ArrowRight size={14} aria-hidden="true" />
          <span>worker</span>
        </div>
      </aside>
    </section>

    <section class="legend" aria-label="Function status legend">
      <span class="legend-title">FUNCTION KEY</span>
      <span><i class="existing"></i> exists in the semantic work</span>
      <span><i class="extend"></i> extended here / more remains</span>
      <span><i class="new"></i> implemented on this branch</span>
      <span><i class="deferred"></i> explicit next slice</span>
      <small>The status key now reflects the running implementation.</small>
    </section>

    <section id="entries" class="section entry-section">
      <header class="section-heading">
        <div><span class="section-number">01</span><h2>Two entry points.<br />One shared worker.</h2></div>
        <p>
          Development is allowed to drive seeded content explicitly. It does not receive a second
          translation algorithm or a shortcut around publication invariants.
        </p>
      </header>

      <div class="entry-grid">
        <article class="entry-card production">
          <header><span>NORMAL / PRODUCT</span><CircleDot size={15} aria-hidden="true" /></header>
          <div class="entry-trigger">
            <MousePointer2 class="entry-icon" size={22} aria-hidden="true" />
            <div><small>KICKED OFF BY</small><strong>an accepted resource revision</strong></div>
          </div>
          <ol>
            <li><span>1</span><code>submitDocumentChanges</code> or <code>submitSlideDeckChanges</code></li>
            <li><span>2</span>persist leader revision <strong>N</strong></li>
            <li><span>3</span><code>enqueueSemanticSyncFor(ref, N)</code> in the persisted queue</li>
            <li><span>4</span>return success to the editor immediately</li>
          </ol>
          <footer>Also used by imports, connectors, templates, and any future text-bearing resource mutation.</footer>
        </article>

        <article class="entry-card development">
          <header><span>DEVELOPMENT / BACKFILL</span><GitBranch size={15} aria-hidden="true" /></header>
          <div class="entry-trigger">
            <FileInput class="entry-icon" size={22} aria-hidden="true" />
            <div><small>KICKED OFF BY</small><strong>a seed or project manifest</strong></div>
          </div>
          <ol>
            <li><span>1</span><code>{"backfillSemanticOverlay({ force?, limit? })"}</code></li>
            <li><span>2</span>enumerate authoritative resource refs and revisions</li>
            <li><span>3</span><code>enqueueSemanticSyncFor(ref, N)</code> for each item</li>
            <li><span>4</span>report discovered, queued, processed, and remaining work</li>
          </ol>
          <footer>Revision idempotency makes repeated seed runs safe; <code>force</code> intentionally rebuilds the same revision.</footer>
        </article>
      </div>

      <div class="merge-rail" aria-hidden="true">
        <span></span><strong>BOTH WRITE THE SAME COALESCED JOB</strong><span></span>
        <ArrowDown size={18} />
      </div>

      <div class="convergence-strip">
        <span><Network size={17} aria-hidden="true" /> SHARED NEXT CALL</span>
        <code>{"processSemanticSyncQueue({ ref?, limit? })"}</code>
        <p>claim latest → read authoritative snapshot → project exact text → translate → publish → index</p>
      </div>
    </section>

    <section id="ingestion" class="section diagram-section">
      <header class="section-heading">
        <div><span class="section-number">02</span><h2>The resource-to-overlay<br />call graph.</h2></div>
        <p>
          Dashed lines leave latency-sensitive work. Solid lines carry typed messages. The resource
          adapter is the only stage allowed to know whether exact text or a material seed came from a document block, slide shape, or external source.
        </p>
      </header>

      <div class="diagram-frame paper-frame">
        <div class="diagram-label"><span>FLOW / SO-INGEST-01</span><small>normal + development entry</small></div>
        <MermaidDiagram
          source={INGEST_DIAGRAM}
          label="Normal and development resource ingestion paths converging on the Semantic Overlay worker"
          caption="The editor receives success after enqueueSemanticSyncFor. Provider work begins when a worker invokes processSemanticSyncQueue."
          minHeight="34rem"
        />
      </div>

      <div class="projection-rule">
        <div class="projection-icon"><FileText size={21} aria-hidden="true" /></div>
        <div>
          <span>THE LIVE EXACT-TEXT CONTRACT</span>
          <h3>Narrative retrieval is text; location is a sidecar.</h3>
          <p>
            <code>readSemanticResource</code> returns one canonical string plus a locator map from
            text ranges back to blocks, slides, notes, and shapes. Translation consumes only the
            string. The target resource walk also emits first-class material seeds into a separate
            profiling and description pipeline; those generated descriptors never enter ordinary
            text retrieval. <a href="/demo/semantic-overlay/material-layer">Open the material-layer contract ↗</a>
          </p>
        </div>
        <pre><code>{`type SemanticResourceProjection = SemanticSourceInput & {
  encoding: "utf-16";
  locators: SemanticLocatorSpan[];
};`}</code></pre>
      </div>
    </section>

    <section id="generation" class="section sequence-section">
      <header class="section-heading">
        <div><span class="section-number">03</span><h2>The document block<br />works end to end.</h2></div>
        <p>
          An empty line becomes Prompt through the ordinary Block menu. Its inspector creates and
          links the Derived Output, drains one bounded semantic batch, publishes the response, then
          copies that response into normal editable document text.
        </p>
      </header>

      <div class="callout-band">
        <div><Boxes size={19} aria-hidden="true" /><span>EXECUTABLE NOW</span></div>
        <code>{`Prompt block → create + link → refresh → sync editable text`}</code>
        <p><a href="/demo/semantic-overlay/derived-output-live">Run direct prompt or named-variable generation ↗</a></p>
      </div>

      <div class="diagram-frame paper-frame sequence-frame">
        <div class="diagram-label"><span>SEQUENCE / DO-CREATE-01</span><small>create → generate → publish</small></div>
        <MermaidDiagram
          source={DERIVED_SEQUENCE}
          label="Implemented document Prompt Block creation and Derived Output generation sequence"
          caption="Implemented first pass: document creation waits for generation. A durable derived-refresh queue and deck placement adapter remain explicit follow-up seams."
          minHeight="46rem"
        />
      </div>

      <div class="atomicity-grid">
        <article>
          <span>WRITE A / DEFINITION</span>
          <strong>DerivedOutput row</strong>
          <p>Prompt, scope, focus locator, lifecycle state, current canonical response, evidence and response revision.</p>
        </article>
        <article>
          <span>WRITE B / PLACEMENT</span>
          <strong>PromptBlock in its resource</strong>
          <p>Block identity, editable text, mark ranges, format, freshness mirror, and <code>derivedOutputId</code>. Its surface alone owns marks, presentation, and placement.</p>
        </article>
        <article class="recommended">
          <span>ATOMICITY REQUIREMENT</span>
          <strong>Both—or neither</strong>
          <p>Use one server orchestration command when storage supports transactions; until then, use an idempotency key and compensating orphan cleanup.</p>
        </article>
      </div>
    </section>

    <section id="functions" class="section functions-section">
      <header class="section-heading">
        <div><span class="section-number">04</span><h2>The callable spine,<br />without hand-waving.</h2></div>
        <p>Select a lifecycle. Every row names the owner, input message, output message, and why the boundary exists.</p>
      </header>

      <div class="function-tabs" role="tablist" aria-label="Function lifecycle">
        {#each GROUPS as group (group.id)}
          {@const GroupIcon = group.icon}
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === group.id}
            class:active={activeGroup === group.id}
            onclick={() => (activeGroup = group.id)}
          >
            <GroupIcon size={17} aria-hidden="true" />
            <span><strong>{group.label}</strong><small>{group.detail}</small></span>
          </button>
        {/each}
      </div>

      <ol class="function-list">
        {#each activeFunctions as item (item.name)}
          <li>
            <div class="function-order">{item.order}</div>
            <div class="function-identity">
              <span class="status status-{item.status}">{item.status}</span>
              <code>{item.name}</code>
              <small>{item.owner}</small>
            </div>
            <div class="function-contract">
              <span>IN</span><code>{item.input}</code>
              <ArrowRight class="function-arrow" size={15} aria-hidden="true" />
              <span>OUT</span><code>{item.output}</code>
            </div>
            <p>{item.note}</p>
          </li>
        {/each}
      </ol>
    </section>

    <section id="footprint" class="section footprint-section">
      <header class="section-heading compact-heading">
        <div><span class="section-number">05</span><h2>The actual change<br />surface.</h2></div>
        <p>
          From the final semantic-architecture anchor, the resource-to-output implementation
          slice touches 97 files. The complete stacked branch—including the semantic foundation
          and these visual reviews—differs from current main in 152 files.
        </p>
      </header>

      <div class="footprint-summary" aria-label="Implementation change totals">
        <div><span>THIS IMPLEMENTATION SLICE</span><strong>97</strong><small>files</small></div>
        <div><span>FULL STACK FROM CURRENT MAIN</span><strong>152</strong><small>files</small></div>
        <p>Counts are grouped by architectural ownership below; generated build and local provider data are excluded.</p>
      </div>

      <div class="footprint-grid">
        {#each FOOTPRINT as item (item.label)}
          <article>
            <span class="footprint-count">{item.count}</span>
            <div><small>FILES · {item.path}</small><h3>{item.label}</h3><p>{item.change}</p></div>
          </article>
        {/each}
      </div>
    </section>

    <section class="section storage-section">
      <header class="section-heading compact-heading">
        <div><span class="section-number">06</span><h2>Four durable identities.</h2></div>
        <p>The overlay, generated value, and surface placement remain separate so each can change at its own rate.</p>
      </header>

      <div class="storage-grid">
        {#each STORAGE as item, index (item.table)}
          <article>
            <header><Database size={16} aria-hidden="true" /><span>0{index + 1}</span></header>
            <code>{item.table}</code>
            <dl>
              <div><dt>KEY</dt><dd>{item.key}</dd></div>
              <div><dt>OWNS</dt><dd>{item.owns}</dd></div>
              <div><dt>NEVER OWNS</dt><dd>{item.never}</dd></div>
            </dl>
          </article>
        {/each}
      </div>

      <div class="artifact-decision">
        <div><ShieldCheck size={20} aria-hidden="true" /></div>
        <p><strong>First-pass storage decision:</strong> the current generated artifact is
          <code>derivedOutputs.lastResponse: ContentBlock</code>. Do not add a revisions table yet.
          Response history becomes worthwhile only when an audit, rollback, or downstream snapshot consumer requires it.</p>
      </div>
    </section>

    <section id="read" class="section read-section">
      <header class="section-heading">
        <div><span class="section-number">07</span><h2>The ID is the API boundary.</h2></div>
        <p>
          Documents, decks, exports and automations should not read the storage row directly. They
          ask for one render-safe value and receive effective freshness with the current response.
        </p>
      </header>

      <div class="read-grid">
        <article class="contract-card">
          <header><KeyRound size={17} aria-hidden="true" /><span>IMPLEMENTED PUBLIC PROJECTION</span></header>
          <pre><code>{READ_CONTRACT}</code></pre>
        </article>

        <div class="read-path" aria-label="Derived Output response read path">
          <div><span>1</span><strong>PromptBlock</strong><code>derivedOutputId</code></div>
          <ArrowDown class="read-arrow" size={18} aria-hidden="true" />
          <div><span>2</span><strong>readDerivedOutputValue</strong><code>project-scoped query</code></div>
          <ArrowDown class="read-arrow" size={18} aria-hidden="true" />
          <div><span>3</span><strong>effective freshness</strong><code>changedSemanticSources</code></div>
          <ArrowDown class="read-arrow" size={18} aria-hidden="true" />
          <div><span>4</span><strong>syncPromptBlockOps</strong><code>ordinary editable text + marker</code></div>
        </div>
      </div>

      <div class="diagram-frame state-frame">
        <div class="diagram-label"><span>STATE / DO-LIFECYCLE-01</span><small>stored + effective state</small></div>
        <MermaidDiagram
          source={STATE_DIAGRAM}
          label="Derived Output lifecycle and freshness state transitions"
          caption="The document first pass calls refresh directly. When a durable queue lands, queued will be job state—not a sixth DerivedOutput state."
          minHeight="28rem"
        />
      </div>
    </section>

    <section class="section decisions-section">
      <header class="section-heading compact-heading">
        <div><span class="section-number">08</span><h2>Decisions this flow locks.</h2></div>
        <p>These are implementation constraints, not diagram decoration.</p>
      </header>
      <div class="decision-list">
        {#each DECISIONS as decision (decision.number)}
          <article><span>{decision.number}</span><div><h3>{decision.title}</h3><p>{decision.body}</p></div></article>
        {/each}
      </div>
    </section>

    <section class="next-page">
      <div>
        <span>NEXT REFERENCE / AGENT RUNTIME</span>
        <h2>The flow is fixed.<br />Now inspect the mind inside it.</h2>
        <p>Exact system prompt, selected-text tool, four tool contracts, evidence IDs, loop bounds, and the infrastructure that keeps it fast.</p>
      </div>
      <a href="/demo/semantic-overlay/agent-runtime">Open agent runtime <ArrowRight size={17} aria-hidden="true" /></a>
    </section>
  </main>

  <footer class="page-footer">
    <span>DERIVED OUTPUT / PROCEDURE FLOW</span>
    <span>implemented core · document Prompt Block live · explicit scale-up seams</span>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
  }

  :global(*) {
    box-sizing: border-box;
  }

  :global(html) {
    scroll-behavior: smooth;
  }

  .flow-page {
    --paper: #f4f0e8;
    --paper-raised: #fffdf8;
    --ink: #172232;
    --muted: #687784;
    --line: #cec7ba;
    --blue: #315a72;
    --teal: #347f78;
    --orange: #d06b32;
    --pale-orange: #fff0dd;
    min-height: 100vh;
    background:
      linear-gradient(90deg, transparent calc(50% - 0.5px), rgba(23, 34, 50, 0.035) 50%, transparent calc(50% + 0.5px)),
      var(--paper);
    color: var(--ink);
  }

  .local-nav {
    position: sticky;
    z-index: 30;
    top: 2.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 3.65rem;
    padding: 0 2rem;
    border-bottom: 1px solid rgba(23, 34, 50, 0.18);
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    backdrop-filter: blur(18px);
  }

  .brand,
  .local-nav nav,
  .runtime-link,
  .hero-actions,
  .legend,
  .rule-path,
  .entry-card header,
  .entry-trigger,
  .convergence-strip,
  .diagram-label,
  .callout-band,
  .function-tabs button,
  .function-contract,
  .storage-grid article header,
  .contract-card header,
  .next-page a,
  .page-footer {
    display: flex;
    align-items: center;
  }

  :global(html[data-appearance="selene"]) .flow-page {
    --paper: #08111c;
    --paper-raised: #0f1c2b;
    --ink: #eef7f3;
    --muted: #91a5b4;
    --line: #29445b;
    --blue: #77a9d4;
    --teal: #4ed9b1;
    --orange: #ec8f6b;
    --pale-orange: #3a231f;
    background:
      linear-gradient(90deg, transparent calc(50% - 0.5px), rgba(238, 247, 243, 0.035) 50%, transparent calc(50% + 0.5px)),
      var(--paper);
  }

  :global(html[data-appearance="selene"]) .local-nav {
    border-bottom-color: var(--line);
    background: color-mix(in srgb, var(--paper) 92%, transparent);
  }

  :global(html[data-appearance="selene"]) .hero-copy > p,
  :global(html[data-appearance="selene"]) .entry-card li,
  :global(html[data-appearance="selene"]) .function-contract code,
  :global(html[data-appearance="selene"]) .footprint-grid p,
  :global(html[data-appearance="selene"]) .storage-grid dd {
    color: #b8c5cd;
  }

  :global(html[data-appearance="selene"]) .hero-actions a,
  :global(html[data-appearance="selene"]) .entry-card > header,
  :global(html[data-appearance="selene"]) .convergence-strip,
  :global(html[data-appearance="selene"]) .atomicity-grid article.recommended,
  :global(html[data-appearance="selene"]) .function-tabs button.active,
  :global(html[data-appearance="selene"]) .footprint-summary,
  :global(html[data-appearance="selene"]) .artifact-decision,
  :global(html[data-appearance="selene"]) .contract-card,
  :global(html[data-appearance="selene"]) .next-page {
    background: #142538;
    color: #eef7f3;
  }

  :global(html[data-appearance="selene"]) .hero-actions .secondary {
    background: transparent;
    color: var(--ink);
  }

  :global(html[data-appearance="selene"]) .rule-path span,
  :global(html[data-appearance="selene"]) .diagram-label {
    background: #142538;
  }

  :global(html[data-appearance="selene"]) .projection-rule {
    background: #102a2a;
  }

  :global(html[data-appearance="selene"]) .projection-rule p {
    color: #b3c9c3;
  }

  :global(html[data-appearance="selene"]) .projection-rule pre {
    background: #0b2022;
    color: #d7e8e2;
  }

  :global(html[data-appearance="selene"]) .callout-band,
  :global(html[data-appearance="selene"]) .projection-icon {
    color: #071711;
  }

  :global(html[data-appearance="selene"]) .status-existing {
    background: #102a2a;
  }

  :global(html[data-appearance="selene"]) .status-extend {
    background: #142538;
    color: #9dbada;
  }

  :global(html[data-appearance="selene"]) .status-deferred {
    background: #242932;
    color: #b6bec7;
  }

  :global(html[data-appearance="selene"]) .convergence-strip > span,
  :global(html[data-appearance="selene"]) .footprint-summary span,
  :global(html[data-appearance="selene"]) .next-page span,
  :global(html[data-appearance="selene"]) .contract-card header {
    color: #9fd6c8;
  }

  :global(html[data-appearance="selene"]) .convergence-strip p,
  :global(html[data-appearance="selene"]) .atomicity-grid .recommended p,
  :global(html[data-appearance="selene"]) .artifact-decision p,
  :global(html[data-appearance="selene"]) .contract-card pre,
  :global(html[data-appearance="selene"]) .next-page p {
    color: #b8c5cd;
  }

  .brand {
    gap: 0.5rem;
    color: var(--ink);
    font-family: var(--token-font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-decoration: none;
  }

  .brand strong {
    color: var(--orange);
    font-weight: 500;
  }

  .brand-mark {
    width: 0.62rem;
    height: 0.62rem;
    border: 2px solid var(--orange);
    transform: rotate(45deg);
  }

  .local-nav nav {
    gap: 1.2rem;
  }

  .local-nav nav a {
    color: var(--muted);
    font-size: 0.73rem;
    text-decoration: none;
  }

  .local-nav nav a:hover {
    color: var(--ink);
  }

  .local-nav nav .runtime-link {
    gap: 0.35rem;
    color: var(--orange);
    font-weight: 600;
  }

  main,
  .page-footer {
    width: min(100% - 3rem, 86rem);
    margin-inline: auto;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(21rem, 0.55fr);
    gap: clamp(3rem, 8vw, 8rem);
    align-items: end;
    min-height: 42rem;
    padding: 7rem 0 5rem;
  }

  .eyebrow,
  .section-number,
  .legend-title,
  .entry-card header,
  .entry-trigger small,
  .diagram-label,
  .projection-rule span,
  .callout-band span,
  .atomicity-grid span,
  .status,
  .footprint-summary span,
  .footprint-summary small,
  .footprint-grid small,
  .storage-grid dt,
  .contract-card header,
  .next-page span,
  .page-footer {
    font-family: var(--token-font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .eyebrow {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    color: var(--orange);
    font-size: 0.7rem;
  }

  .hero h1 {
    max-width: 13ch;
    margin: 1.25rem 0 1.5rem;
    font-family: var(--token-font-serif);
    font-size: clamp(3.8rem, 7.5vw, 7rem);
    font-weight: 400;
    letter-spacing: -0.06em;
    line-height: 0.92;
  }

  .hero h1 em {
    color: var(--blue);
    font-weight: 400;
  }

  .hero-copy > p {
    max-width: 65ch;
    margin: 0;
    color: #465462;
    font-size: 1.08rem;
    line-height: 1.72;
  }

  .hero-actions {
    gap: 0.75rem;
    margin-top: 2rem;
  }

  .hero-actions a,
  .next-page a {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--ink);
    background: var(--ink);
    color: #fff;
    font-size: 0.78rem;
    text-decoration: none;
  }

  .hero-actions .secondary {
    background: transparent;
    color: var(--ink);
  }

  .hero-rule {
    position: relative;
    padding: 2.2rem;
    border: 1px solid var(--ink);
    background: var(--paper-raised);
    box-shadow: 0.7rem 0.7rem 0 var(--orange);
  }

  .rule-index {
    position: absolute;
    top: 1rem;
    right: 1rem;
    color: var(--line);
    font-family: var(--token-font-serif);
    font-size: 3rem;
  }

  .hero-rule > span {
    display: block;
    color: var(--orange);
    font-family: var(--token-font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.1em;
  }

  .hero-rule > strong {
    display: block;
    margin: 1.4rem 0 1rem;
    font-family: var(--token-font-serif);
    font-size: 2.1rem;
    font-weight: 400;
    line-height: 1.06;
  }

  .hero-rule p {
    margin: 0;
    color: var(--muted);
    line-height: 1.6;
  }

  .rule-path {
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 1.6rem;
    font-family: var(--token-font-mono);
    font-size: 0.64rem;
  }

  .rule-path span {
    padding: 0.35rem 0.45rem;
    background: #ece7dc;
  }

  .legend {
    flex-wrap: wrap;
    gap: 1.3rem;
    padding: 1rem 1.25rem;
    border-block: 1px solid var(--line);
    color: var(--muted);
    font-size: 0.72rem;
  }

  .legend-title {
    color: var(--ink);
    font-size: 0.63rem;
  }

  .legend span:not(.legend-title) {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
  }

  .legend i {
    width: 0.62rem;
    height: 0.62rem;
    border: 1px solid currentColor;
    border-radius: 50%;
  }

  .legend i.existing { background: #88c5b5; }
  .legend i.extend { background: #91a9c5; }
  .legend i.new { background: #ed9a66; }
  .legend i.deferred { background: #a4a09a; }
  .legend small { margin-left: auto; }

  .section {
    padding: 6.5rem 0;
    border-bottom: 1px solid var(--line);
    scroll-margin-top: 7rem;
  }

  .section-heading {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.6fr);
    gap: 5rem;
    align-items: end;
    margin-bottom: 3rem;
  }

  .section-heading > div {
    display: grid;
    grid-template-columns: 3.2rem 1fr;
    gap: 1rem;
    align-items: start;
  }

  .section-number {
    display: grid;
    width: 3.1rem;
    height: 3.1rem;
    place-items: center;
    border: 1px solid var(--ink);
    border-radius: 50%;
    color: var(--orange);
    font-size: 0.72rem;
  }

  .section-heading h2 {
    margin: -0.25rem 0 0;
    font-family: var(--token-font-serif);
    font-size: clamp(2.4rem, 5vw, 4.5rem);
    font-weight: 400;
    letter-spacing: -0.045em;
    line-height: 0.98;
  }

  .section-heading > p {
    margin: 0;
    color: var(--muted);
    font-size: 0.96rem;
    line-height: 1.65;
  }

  .compact-heading {
    margin-bottom: 2.2rem;
  }

  .entry-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem;
    align-items: stretch;
  }

  .entry-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    border: 1px solid var(--ink);
    background: var(--paper-raised);
  }

  .entry-card > header {
    justify-content: space-between;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--ink);
    background: var(--ink);
    color: #fff;
    font-size: 0.66rem;
  }

  .entry-card.development > header {
    background: var(--blue);
  }

  .entry-trigger {
    gap: 1rem;
    padding: 1.5rem;
    border-bottom: 1px solid var(--line);
  }

  .entry-trigger :global(.entry-icon) { color: var(--orange); }
  .entry-trigger div { display: grid; gap: 0.25rem; }
  .entry-trigger small { color: var(--muted); font-size: 0.61rem; }
  .entry-trigger strong { font-family: var(--token-font-serif); font-size: 1.4rem; font-weight: 400; }

  .entry-card ol {
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .entry-card li {
    display: grid;
    grid-template-columns: 1.5rem 1fr;
    gap: 0.7rem;
    align-items: center;
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid var(--line);
    color: #42505d;
    font-size: 0.82rem;
  }

  .entry-card li span {
    display: grid;
    width: 1.4rem;
    height: 1.4rem;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 50%;
    color: var(--orange);
    font-family: var(--token-font-mono);
    font-size: 0.58rem;
  }

  code {
    font-family: var(--token-font-mono);
  }

  .entry-card footer {
    margin-top: auto;
    padding: 1rem 1.25rem;
    color: var(--muted);
    font-size: 0.72rem;
    line-height: 1.5;
  }

  .merge-rail {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto;
    gap: 0.75rem;
    align-items: center;
    margin: 1rem 1.5rem 0;
    color: var(--orange);
  }

  .merge-rail span {
    height: 1px;
    background: var(--orange);
  }

  .merge-rail strong {
    font-family: var(--token-font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.14em;
  }

  .convergence-strip {
    display: grid;
    grid-template-columns: auto minmax(18rem, 0.8fr) 1fr;
    gap: 1.5rem;
    margin-top: 1rem;
    padding: 1rem 1.25rem;
    background: var(--ink);
    color: #fff;
  }

  .convergence-strip > span {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    color: #9fd6c8;
    font-family: var(--token-font-mono);
    font-size: 0.63rem;
    letter-spacing: 0.08em;
  }

  .convergence-strip code { color: #ffd0ad; font-size: 0.78rem; }
  .convergence-strip p { margin: 0; color: #b7c1ca; font-size: 0.75rem; }

  .diagram-frame {
    overflow: hidden;
    border: 1px solid var(--ink);
    background: var(--paper-raised);
    box-shadow: 0.5rem 0.5rem 0 rgba(49, 90, 114, 0.14);
  }

  .diagram-label {
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--ink);
    background: #ece7dc;
    font-size: 0.63rem;
  }

  .diagram-label small {
    color: var(--muted);
    font-family: var(--token-font-mono);
    letter-spacing: 0;
    text-transform: none;
  }

  .projection-rule {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) minmax(18rem, 0.62fr);
    gap: 1.5rem;
    align-items: center;
    margin-top: 1.5rem;
    padding: 1.5rem;
    border-left: 0.3rem solid var(--teal);
    background: #e7f3ef;
  }

  .projection-icon {
    display: grid;
    width: 3.2rem;
    height: 3.2rem;
    place-items: center;
    border-radius: 50%;
    background: var(--teal);
    color: #fff;
  }

  .projection-rule span { color: var(--teal); font-size: 0.61rem; }
  .projection-rule h3 { margin: 0.25rem 0 0.45rem; font-family: var(--token-font-serif); font-size: 1.55rem; font-weight: 400; }
  .projection-rule p { margin: 0; color: #455e59; font-size: 0.82rem; line-height: 1.6; }
  .projection-rule pre { margin: 0; padding: 1rem; overflow: auto; background: #d9ebe6; color: #17352f; font-size: 0.72rem; line-height: 1.55; }

  .callout-band {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 1.5rem;
    margin-bottom: 1rem;
    padding: 1rem 1.25rem;
    background: var(--orange);
    color: #fff;
  }

  .callout-band > div { display: flex; align-items: center; gap: 0.5rem; }
  .callout-band span { font-size: 0.61rem; }
  .callout-band code { padding: 0.3rem 0.45rem; background: rgba(255, 255, 255, 0.14); font-size: 0.74rem; }
  .callout-band p { margin: 0; font-size: 0.78rem; opacity: 0.84; }

  .atomicity-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    margin-top: 1.5rem;
    border: 1px solid var(--line);
    background: var(--line);
  }

  .atomicity-grid article {
    min-height: 12rem;
    padding: 1.4rem;
    background: var(--paper-raised);
  }

  .atomicity-grid article.recommended { background: var(--ink); color: #fff; }
  .atomicity-grid span { color: var(--orange); font-size: 0.61rem; }
  .atomicity-grid strong { display: block; margin: 0.8rem 0 0.55rem; font-family: var(--token-font-serif); font-size: 1.45rem; font-weight: 400; }
  .atomicity-grid p { margin: 0; color: var(--muted); font-size: 0.79rem; line-height: 1.55; }
  .atomicity-grid .recommended p { color: #b9c3cb; }

  .function-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: 1px solid var(--ink);
  }

  .function-tabs button {
    gap: 0.75rem;
    justify-content: center;
    min-height: 4.4rem;
    border: 0;
    border-right: 1px solid var(--ink);
    background: var(--paper-raised);
    color: var(--ink);
    cursor: pointer;
  }

  .function-tabs button:last-child { border-right: 0; }
  .function-tabs button.active { background: var(--ink); color: #fff; }
  .function-tabs button span { display: grid; gap: 0.12rem; text-align: left; }
  .function-tabs button strong { font-size: 0.8rem; }
  .function-tabs button small { color: inherit; font-family: var(--token-font-mono); font-size: 0.6rem; opacity: 0.65; }

  .function-list {
    margin: 1rem 0 0;
    padding: 0;
    border-top: 1px solid var(--ink);
    list-style: none;
  }

  .function-list li {
    display: grid;
    grid-template-columns: 3.2rem minmax(15rem, 0.8fr) minmax(21rem, 1.1fr) minmax(16rem, 0.85fr);
    min-height: 7.2rem;
    border-right: 1px solid var(--ink);
    border-bottom: 1px solid var(--ink);
    border-left: 1px solid var(--ink);
  }

  .function-order {
    display: grid;
    place-items: center;
    border-right: 1px solid var(--line);
    color: var(--orange);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
  }

  .function-identity,
  .function-contract,
  .function-list li > p {
    padding: 1rem;
    border-right: 1px solid var(--line);
  }

  .function-identity {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 0.34rem;
  }

  .status {
    padding: 0.18rem 0.35rem;
    border: 1px solid currentColor;
    font-size: 0.52rem;
  }

  .status-existing { color: var(--teal); background: #e7f3ef; }
  .status-extend { color: #536f8e; background: #e8edf5; }
  .status-new { color: var(--orange); background: var(--pale-orange); }
  .status-deferred { color: #716e69; background: #eceae6; }
  .function-identity > code { overflow-wrap: anywhere; color: var(--ink); font-size: 0.78rem; }
  .function-identity small { color: var(--muted); font-size: 0.65rem; }

  .function-contract {
    display: grid;
    grid-template-columns: auto 1fr auto auto 1fr;
    gap: 0.55rem;
    align-content: center;
  }

  .function-contract span { color: var(--orange); font-family: var(--token-font-mono); font-size: 0.56rem; }
  .function-contract code { color: #3f4d5a; font-size: 0.68rem; line-height: 1.45; }
  .function-contract :global(.function-arrow) { color: var(--line); }
  .function-list li > p { display: flex; align-items: center; margin: 0; border-right: 0; color: var(--muted); font-size: 0.75rem; line-height: 1.5; }

  .footprint-summary {
    display: grid;
    grid-template-columns: 0.7fr 0.7fr 1.6fr;
    border: 1px solid var(--ink);
    background: var(--ink);
    color: #fff;
  }

  .footprint-summary > div {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.1rem 0.7rem;
    align-items: baseline;
    padding: 1.25rem 1.4rem;
    border-right: 1px solid #4d5862;
  }

  .footprint-summary span { grid-column: 1 / -1; color: #9fd6c8; font-size: 0.57rem; }
  .footprint-summary strong { font-family: var(--token-font-serif); font-size: 3rem; font-weight: 400; line-height: 1; }
  .footprint-summary small { color: #aeb9c1; font-size: 0.57rem; }
  .footprint-summary > p { align-self: center; margin: 0; padding: 1.4rem; color: #bdc6cc; font-size: 0.75rem; line-height: 1.55; }

  .footprint-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    margin-top: 1px;
    border: 1px solid var(--ink);
    background: var(--ink);
  }

  .footprint-grid article {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1rem;
    min-width: 0;
    min-height: 11rem;
    padding: 1.25rem;
    background: var(--paper-raised);
  }

  .footprint-count { color: var(--orange); font-family: var(--token-font-serif); font-size: 2rem; line-height: 1; }
  .footprint-grid small { color: var(--muted); font-size: 0.53rem; line-height: 1.5; }
  .footprint-grid h3 { margin: 0.65rem 0 0.45rem; font-family: var(--token-font-serif); font-size: 1.25rem; font-weight: 400; }
  .footprint-grid p { margin: 0; color: #5b6670; font-size: 0.73rem; line-height: 1.55; }

  .storage-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    border: 1px solid var(--ink);
    background: var(--ink);
  }

  .storage-grid article { min-width: 0; padding: 1.2rem; background: var(--paper-raised); }
  .storage-grid article header { justify-content: space-between; color: var(--orange); }
  .storage-grid article header span { font-family: var(--token-font-serif); font-size: 1.8rem; }
  .storage-grid article > code { display: block; margin: 1.2rem 0; overflow-wrap: anywhere; color: var(--blue); font-size: 0.83rem; }
  .storage-grid dl { display: grid; gap: 1rem; margin: 0; }
  .storage-grid dl div { display: grid; gap: 0.25rem; }
  .storage-grid dt { color: var(--muted); font-size: 0.53rem; }
  .storage-grid dd { margin: 0; color: #4d5964; font-size: 0.72rem; line-height: 1.45; }

  .artifact-decision {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1rem;
    align-items: center;
    padding: 1.2rem 1.4rem;
    background: var(--blue);
    color: #fff;
  }

  .artifact-decision > div { display: grid; width: 2.7rem; height: 2.7rem; place-items: center; border: 1px solid rgba(255, 255, 255, 0.38); border-radius: 50%; }
  .artifact-decision p { margin: 0; color: #d9e2e7; font-size: 0.82rem; line-height: 1.55; }
  .artifact-decision strong, .artifact-decision code { color: #fff; }

  .read-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(18rem, 0.7fr);
    gap: 1.5rem;
    align-items: stretch;
  }

  .read-grid > *,
  .contract-card,
  .read-path {
    min-width: 0;
  }

  .contract-card { border: 1px solid var(--ink); background: var(--ink); color: #fff; }
  .contract-card header { gap: 0.5rem; padding: 0.8rem 1rem; border-bottom: 1px solid #52606b; color: #9fd6c8; font-size: 0.63rem; }
  .contract-card pre { margin: 0; padding: 1.5rem; overflow: auto; color: #dce8e8; font-size: 0.75rem; line-height: 1.65; }

  .read-path {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
  }

  .read-path > div {
    display: grid;
    grid-template-columns: 1.7rem 1fr;
    width: 100%;
    padding: 0.9rem;
    border: 1px solid var(--ink);
    background: var(--paper-raised);
  }

  .read-path > div span { grid-row: 1 / 3; display: grid; place-items: center; margin-right: 0.75rem; border-right: 1px solid var(--line); color: var(--orange); font-family: var(--token-font-mono); font-size: 0.62rem; }
  .read-path > div strong { font-family: var(--token-font-serif); font-size: 1.05rem; font-weight: 400; }
  .read-path > div code { margin-top: 0.25rem; color: var(--muted); font-size: 0.62rem; }
  .read-path > :global(.read-arrow) { color: var(--orange); }

  .state-frame { margin-top: 1.5rem; }

  .decision-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
    border: 1px solid var(--line);
    background: var(--line);
  }

  .decision-list article { display: grid; grid-template-columns: 3rem 1fr; gap: 1rem; min-height: 11rem; padding: 1.4rem; background: var(--paper-raised); }
  .decision-list article > span { color: var(--orange); font-family: var(--token-font-serif); font-size: 2rem; }
  .decision-list h3 { margin: 0 0 0.6rem; font-family: var(--token-font-serif); font-size: 1.35rem; font-weight: 400; }
  .decision-list p { margin: 0; color: var(--muted); font-size: 0.79rem; line-height: 1.6; }

  .next-page {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3rem;
    align-items: end;
    margin: 6rem 0 3rem;
    padding: 3rem;
    background: var(--ink);
    color: #fff;
  }

  .next-page span { color: #9fd6c8; font-size: 0.62rem; }
  .next-page h2 { margin: 0.7rem 0; font-family: var(--token-font-serif); font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 400; line-height: 1; }
  .next-page p { max-width: 60ch; margin: 0; color: #b8c2cb; line-height: 1.55; }
  .next-page a { border-color: var(--orange); background: var(--orange); white-space: nowrap; }

  .page-footer {
    justify-content: space-between;
    padding: 1.5rem 0 3rem;
    color: var(--muted);
    font-size: 0.58rem;
  }

  @media (max-width: 72rem) {
    .local-nav nav a:not(.runtime-link) { display: none; }
    .hero { grid-template-columns: 1fr; min-height: auto; padding-top: 5rem; }
    .hero-rule { max-width: 34rem; }
    .function-list li { grid-template-columns: 3rem minmax(13rem, 0.8fr) minmax(18rem, 1fr); }
    .function-list li > p { grid-column: 2 / -1; border-top: 1px solid var(--line); }
    .footprint-grid { grid-template-columns: repeat(2, 1fr); }
    .storage-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 50rem) {
    .local-nav { padding-inline: 1rem; }
    .brand > span:not(.brand-mark) { display: none; }
    main, .page-footer { width: min(100% - 1.5rem, 86rem); }
    .hero { padding: 4rem 0; }
    .hero h1 { font-size: clamp(3.2rem, 15vw, 5rem); }
    .legend small { width: 100%; margin: 0; }
    .section { padding: 4.5rem 0; }
    .section-heading { grid-template-columns: 1fr; gap: 1.5rem; }
    .entry-grid { grid-template-columns: 1fr; }
    .merge-rail { margin-inline: 0; }
    .convergence-strip, .projection-rule, .callout-band { grid-template-columns: 1fr; }
    .atomicity-grid, .function-tabs, .footprint-summary, .footprint-grid, .storage-grid, .read-grid, .decision-list { grid-template-columns: minmax(0, 1fr); }
    .footprint-summary > div { border-right: 0; border-bottom: 1px solid #4d5862; }
    .function-tabs button { border-right: 0; border-bottom: 1px solid var(--ink); }
    .function-tabs button:last-child { border-bottom: 0; }
    .function-list { overflow-x: auto; }
    .function-list li { min-width: 48rem; }
    .next-page { grid-template-columns: 1fr; padding: 2rem; }
    .page-footer { gap: 1rem; align-items: flex-start; flex-direction: column; }
  }
</style>
