<script lang="ts">
  import type { Component } from "svelte";
  import Archive from "@lucide/svelte/icons/archive";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Binary from "@lucide/svelte/icons/binary";
  import Bot from "@lucide/svelte/icons/bot";
  import Boxes from "@lucide/svelte/icons/boxes";
  import Braces from "@lucide/svelte/icons/braces";
  import Check from "@lucide/svelte/icons/check";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import FileInput from "@lucide/svelte/icons/file-input";
  import FileText from "@lucide/svelte/icons/file-text";
  import Gauge from "@lucide/svelte/icons/gauge";
  import Layers3 from "@lucide/svelte/icons/layers-3";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Network from "@lucide/svelte/icons/network";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Search from "@lucide/svelte/icons/search";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sigma from "@lucide/svelte/icons/sigma";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  type Icon = Component<{
    size?: number | string;
    strokeWidth?: number | string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;

  type Tone = "source" | "translation" | "overlay" | "index" | "output";

  type StructureRole = "input" | "message" | "output" | "state" | "configuration" | "value";
  type Persistence = "stored" | "transient" | "configured";

  type Structure = {
    label: string;
    role: StructureRole;
    persistence: Persistence;
    code: string;
    note: string;
  };

  type ProcedureStep = {
    number: string;
    title: string;
    contract: string;
  };

  type Stage = {
    id: string;
    label: string;
    title: string;
    owner: string;
    tone: Tone;
    icon: Icon;
    summary: string;
    detail: string[];
    procedure: ProcedureStep[];
    structures: Structure[];
    evidence: string;
  };

  const STAGES: Stage[] = [
    {
      id: "revision",
      label: "01",
      title: "Semantic source",
      owner: "Project-scoped contract",
      tone: "source",
      icon: FileInput,
      summary: "A project capability submits text under an existing resource identity and an explicit revision.",
      detail: [
        "ResourceRef supplies the ID and resource kind already used throughout representation.",
        "SemanticEncoding is a closed union; offsets always count code units in the named encoding, so no offsetUnit field is needed.",
        "The semanticSources row retains provenance and coordinate metadata, but never the entire source text."
      ],
      procedure: [
        { number: "1", title: "Receive", contract: "SemanticSourceInput" },
        { number: "2", title: "Validate", contract: "ref · revision · text · encoding" },
        { number: "3", title: "Admit", contract: "accepted source message" }
      ],
      structures: [
        {
          label: "capability input",
          role: "input",
          persistence: "transient",
          code: `type SemanticEncoding = "utf-8" | "utf-16";

type SemanticSourceInput = {
  ref: ResourceRef; // { kind: ResourceKind; id: string }
  revision: number;
  text: string;
  encoding: SemanticEncoding;
};`,
          note: "Project identity comes from capability scope. UTF-8 offsets count bytes; UTF-16 offsets count 16-bit code units."
        },
        {
          label: "representation · semanticSources",
          role: "state",
          persistence: "stored",
          code: `type SemanticSourceFields = {
  projectId: Id<"projects">;
  ref: ResourceRef;
  revision: number;
  encoding: SemanticEncoding;
  updatedAt: number;
};`,
          note: "A project-scoped provenance anchor. Identity remains stable as revision changes."
        }
      ],
      evidence: "The live representation defines ResourceRef as { kind, id }; ResourceKind remains intentionally open and prefix-matched."
    },
    {
      id: "translate",
      label: "02",
      title: "Text translation",
      owner: "Semantic Overlay capability",
      tone: "translation",
      icon: Sparkles,
      summary: "Jina supplies contextual token fields; deterministic code chooses exact source spans.",
      detail: [
        "Pass 1: Jina v4 returns contextual token vectors and token labels.",
        "Align tokens to the source exactly; fail instead of approximating a citation span.",
        "Distance-discounted attraction is the one segmentation procedure for this pass—there is no methodology abstraction yet."
      ],
      procedure: [
        { number: "1", title: "Embed tokens", contract: "source.text → TokenEmbeddingField" },
        { number: "2", title: "Align", contract: "TokenEmbeddingField → AlignedTokenField" },
        { number: "3", title: "Segment", contract: "AlignedTokenField → SegmentRange[]" },
        { number: "4", title: "Pool", contract: "segment texts → dense vectors" },
        { number: "5", title: "Materialize", contract: "spans + vectors → TranslationResult" }
      ],
      structures: [
        {
          label: "translation configuration",
          role: "configuration",
          persistence: "configured",
          code: `type TranslationConfiguration = {
  maxTokens: number;
  minTokens: number;
  changeThreshold: number;
  basinProminenceThreshold: number;
  basinMassFraction: number;
  attractionDecayTokens: number;
  attractionStationaryThreshold: number;
};`,
          note: "These tune one fixed distance-discounted-attraction implementation; there is no mode field or strategy interface."
        },
        {
          label: "procedure messages",
          role: "message",
          persistence: "transient",
          code: `type TokenEmbeddingField = {
  labels: string[];
  vectors: number[][];
};

type AlignedTokenField = {
  spans: { from: number; to: number; modelTokens: number }[];
  vectors: number[][];
};

type SegmentRange = {
  fromSpan: number;
  toSpan: number;
};`,
          note: "Alignment maps provider token labels onto source coordinates. SegmentRange indexes those aligned atoms; only materialization creates final SemanticSpan values."
        },
        {
          label: "translation result",
          role: "output",
          persistence: "transient",
          code: `type TranslationResult = {
  source: SemanticSourceInput;
  objects: SemanticObjectDraft[];
  usage: ProviderUsage[];
};

type SemanticObjectDraft = {
  span: SemanticSpan;
  vector: number[];
};`,
          note: "This is a procedure message, not domain state. Publication consumes it and assigns stored row IDs."
        }
      ],
      evidence: "The supplied pipeline already executes these five boundaries; its configurable segmentation modes are deliberately narrowed to one."
    },
    {
      id: "objects",
      label: "03",
      title: "Overlay publication",
      owner: "Representation mutation",
      tone: "overlay",
      icon: Boxes,
      summary: "One project overlay owns the generation and embedding space; objects stay minimal and generation-free.",
      detail: [
        "The overlay meta row is the single generation clock. A one-source update does not rewrite generation onto every object.",
        "A semantic object has no kind: text goes in, and a source-linked span plus its full vector comes out.",
        "History stores an object value snapshot rather than an active object ID, because replacement creates new active IDs."
      ],
      procedure: [
        { number: "1", title: "Consume", contract: "TranslationResult" },
        { number: "2", title: "Snapshot", contract: "current rows → history values" },
        { number: "3", title: "Replace", contract: "source + active semantic objects" },
        { number: "4", title: "Advance", contract: "SemanticOverlay.generation + 1" }
      ],
      structures: [
        {
          label: "representation · semanticOverlays",
          role: "state",
          persistence: "stored",
          code: `type SemanticOverlayFields = {
  projectId: Id<"projects">;
  generation: number;
  embedding: EmbeddingSpace;
  updatedAt: number;
};

type EmbeddingSpace = {
  provider: "jina";
  model: string;
  dimensions: number;
};`,
          note: "Exactly one overlay row per project. Embedding identity and generation are stored once."
        },
        {
          label: "representation · semanticObjects",
          role: "state",
          persistence: "stored",
          code: `type SemanticObjectFields = {
  projectId: Id<"projects">;
  semanticSourceId: Id<"semanticSources">;
  span: SemanticSpan;
  vector: number[];
};`,
          note: "Source revision and encoding resolve through semanticSourceId; generation and embedding resolve through the project overlay."
        },
        {
          label: "value · semantic span",
          role: "value",
          persistence: "stored",
          code: `type SemanticSpan = {
  from: number;
  to: number; // half-open [from, to)
  text: string;
};`,
          note: "Span text travels with its coordinates. The referenced source supplies the encoding that interprets from/to."
        },
        {
          label: "representation · semanticObjectHistory",
          role: "state",
          persistence: "stored",
          code: `type SemanticObjectHistoryFields = {
  projectId: Id<"projects">;
  retiredGeneration: number;
  object: {
    source: SemanticSourceSnapshot;
    span: SemanticSpan;
    vector: number[];
  };
  retiredAt: number;
};`,
          note: "The nested value is intentional: history must survive both source-row mutation and active object-ID replacement."
        }
      ],
      evidence: "This removes the code-only and inference fields from the reference object while preserving its useful span, vector, and source grounding."
    },
    {
      id: "index",
      label: "04",
      title: "Recursive index",
      owner: "Swappable index layer",
      tone: "index",
      icon: Network,
      summary: "A recursive cluster tree organizes millions of object vectors without becoming semantic truth.",
      detail: [
        "Cluster similar objects, then recursively cluster those clusters; query descends only through the nearest branches.",
        "A branch contains node IDs or object IDs, never parallel child collections.",
        "PCA can later choose candidate branches in fewer dimensions; final ranking returns to full vectors on semantic objects."
      ],
      procedure: [
        { number: "1", title: "Load", contract: "overlay meta + active objects" },
        { number: "2", title: "Cluster", contract: "object vectors → leaf centroids" },
        { number: "3", title: "Recurse", contract: "centroids → parent centroids" },
        { number: "4", title: "Materialize", contract: "index row + node rows" },
        { number: "5", title: "Swap", contract: "publish with overlay mutation" }
      ],
      structures: [
        {
          label: "representation · semanticIndexes",
          role: "state",
          persistence: "stored",
          code: `type SemanticIndexFields = {
  projectId: Id<"projects">;
  semanticOverlayId: Id<"semanticOverlays">;
  method: "recursiveClustering";
  rootNodeIds: Id<"semanticIndexNodes">[];
  configuration: {
    branchFactor: number;
    leafSize: number;
  };
  updatedAt: number;
};`,
          note: "Generation and embedding space come from semanticOverlayId instead of being duplicated here."
        },
        {
          label: "representation · semanticIndexNodes",
          role: "state",
          persistence: "stored",
          code: `type SemanticIndexNodeFields = {
  projectId: Id<"projects">;
  indexId: Id<"semanticIndexes">;
  parentNodeId?: Id<"semanticIndexNodes">;
  centroidVector: number[];
  children:
    | { kind: "nodes"; ids: Id<"semanticIndexNodes">[] }
    | { kind: "objects"; ids: Id<"semanticObjects">[] };
};`,
          note: "No level or source-membership copy: both can be derived by walking the tree and resolving leaf objects."
        }
      ],
      evidence: "The supplied index packages are seams, not implementations; recursive clustering is the first concrete choice."
    },
    {
      id: "retrieve",
      label: "05",
      title: "Query retrieval",
      owner: "Runtime capability",
      tone: "index",
      icon: Search,
      summary: "A scoped query beam-descends the current tree, scores leaves, then coalesces overlapping spans.",
      detail: [
        "Embed the query in retrieval.query mode with the same Jina model and dimensions.",
        "Resolve ResourceSet to eligible resources and apply that gate inside index traversal; omitted scope means the whole project.",
        "At each branch keep the top-k nearest children. Coalesce overlapping hits for one source revision before returning them."
      ],
      procedure: [
        { number: "1", title: "Resolve scope", contract: "ResourceSet → eligible ResourceRef set" },
        { number: "2", title: "Embed query", contract: "text → query vector" },
        { number: "3", title: "Beam descend", contract: "top-k centroids → expanded children" },
        { number: "4", title: "Score leaves", contract: "full object vectors → ranked objects" },
        { number: "5", title: "Coalesce", contract: "overlapping spans → SemanticHit[]" }
      ],
      structures: [
        {
          label: "query request",
          role: "input",
          persistence: "transient",
          code: `type SemanticQueryInput = {
  text: string;
  scope?: ResourceSet;
  topK: number;
};`,
          note: "Project scope is implicit. In current representation, omitted scope means all; ResourceSet with empty include means none."
        },
        {
          label: "query result",
          role: "output",
          persistence: "transient",
          code: `type SemanticHit = {
  semanticObjectIds: Id<"semanticObjects">[];
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  score: number;
  overlayGeneration: number;
};`,
          note: "Multiple IDs mean overlapping objects were unioned. Span text/from/to are copied; score is the maximum constituent similarity."
        }
      ],
      evidence: "The live ResourceSet is include/exclude terms over ResourceRef. Exact cosine remains the test oracle for tree recall."
    },
    {
      id: "output",
      label: "06",
      title: "Derived output",
      owner: "Derived Output capability",
      tone: "output",
      icon: FileText,
      summary: "A synthesis agent retrieves and reads; publication saves citation values, not generation-bound object IDs.",
      detail: [
        "Drop the planner for the first pass. Give one synthesis agent retrieve and read tools.",
        "SemanticHit IDs are useful during the run; the citation copies source revision, encoding, span text, and observed generation.",
        "Before publishing, recheck only cited source revisions; a newer unrelated overlay generation does not invalidate the answer."
      ],
      procedure: [
        { number: "1", title: "Pull", contract: "derivedOutputId → stored definition" },
        { number: "2", title: "Synthesize", contract: "agent + retrieve/read tools" },
        { number: "3", title: "Capture", contract: "SemanticHit → SemanticCitation value" },
        { number: "4", title: "Validate", contract: "citation revisions ↔ current sources" },
        { number: "5", title: "Publish", contract: "last response · revision · generation" }
      ],
      structures: [
        {
          label: "representation · derivedOutputs",
          role: "state",
          persistence: "stored",
          code: `type DerivedOutputFields = {
  projectId: Id<"projects">;
  prompt: string;
  scope?: ResourceSet;
  queries: string[];
  evidence: SemanticCitation[];
  lastResponse?: ContentBlock;
  lastRevision?: number;
  lastGeneration?: number;
  state: DerivedState;
  error?: string;
  refreshedAt?: number;
  createdBy: Actor;
  updatedAt: number;
};`,
          note: "There is no semantic-object ID list. lastRevision counts successful output publications; lastGeneration records the overlay observed by the latest one."
        },
        {
          label: "value · semantic citation",
          role: "value",
          persistence: "stored",
          code: `type SemanticCitation = {
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  overlayGeneration: number;
};

type SemanticSourceSnapshot = {
  ref: ResourceRef;
  revision: number;
  encoding: SemanticEncoding;
};`,
          note: "This stores an evidence value, not a foreign key. It remains intelligible after the active source and object rows change."
        }
      ],
      evidence: "Current DerivedEvidence already copies resource identity, span, and text specifically so citations survive source mutation."
    }
  ];

  const MIGRATION = [
    {
      action: "remove",
      icon: Trash2,
      current: "Project.lattice + knowledge/lattice.ts",
      target: "No lattice-shaped project state",
      note: "Delete these during the representation cutover; there are no live callers to preserve."
    },
    {
      action: "replace",
      icon: RefreshCw,
      current: "latticeSources / Nodes / Edges / Changes",
      target: "semanticOverlays / Sources / Objects / History / Indexes",
      note: "Overlay metadata owns generation and embedding; active objects stay minimal."
    },
    {
      action: "bridge",
      icon: Link2,
      current: "DerivedOutput.retrieved → latticeNodes",
      target: "Derived evidence → semantic citation values",
      note: "Runtime hits use object IDs; stored citations snapshot source, revision, encoding, span, and generation."
    },
    {
      action: "rename",
      icon: Braces,
      current: "Knowledge and lattice-node UI vocabulary",
      target: "Source context + semantic overlay status",
      note: "The implementation term should not leak into an end-user concept unless the product needs it."
    }
  ] as const;

  const STEPS = [
    {
      number: "1",
      title: "Translate + cut over",
      state: "first",
      body: "Now: delete Knowledge/Lattice, add semantic tables and exact alignment, port distance-discounted segmentation, and prove the provider-free translation seam."
    },
    {
      number: "2",
      title: "Provision Jina + index/query",
      state: "next",
      body: "Next: add Jina's own embedding API configuration, wire the two translation calls and query mode, then build recursive clustering with exhaustive cosine as the recall oracle."
    },
    {
      number: "3",
      title: "Bridge derived output",
      state: "last",
      body: "Give synthesis retrieve/read tools, persist citation value snapshots, and guard publication by rechecking only cited source revisions."
    }
  ] as const;

  const DECISIONS = [
    {
      status: "aligned",
      title: "Generic source contract",
      body: "The capability accepts ResourceRef, revision, text, and encoding. Project identity is runtime scope, while stored source rows retain projectId.",
      recommendation: "Reuse the live ResourceRef contract and keep full source text only at the translation boundary."
    },
    {
      status: "aligned",
      title: "Encoding defines coordinates",
      body: "Encoding alone is sufficient once the invariant says offsets count code units in that encoding: bytes for UTF-8 and 16-bit code units for UTF-16.",
      recommendation: "Use a closed utf-8 | utf-16 union now; extend it only alongside conversion and Unicode fixtures."
    },
    {
      status: "aligned",
      title: "Values versus row identities",
      body: "Active index traversal uses semantic-object IDs. History and Derived Output must survive replacement, so they store self-contained object/citation values instead.",
      recommendation: "Make the distinction visible in type names: Fields/Id for active rows, Snapshot or Citation for copied values."
    },
    {
      status: "shape",
      title: "Beam and coalescing policy",
      body: "The first recursive query keeps top-k branches at each level, then unions overlapping spans for the same source revision. Recall and merged scoring need fixtures.",
      recommendation: "Start with maximum constituent similarity as the merged score and compare every indexed result with exhaustive cosine."
    }
  ] as const;

  let selected = $state("objects");

  const active = $derived(STAGES.find((stage) => stage.id === selected) ?? STAGES[2]);
</script>

<svelte:head>
  <title>Semantic Overlay integration map — Icarus</title>
  <meta
    name="description"
    content="An implementation-grounded visual brief for replacing the Knowledge Lattice with the Semantic Overlay."
  />
</svelte:head>

<div class="brief-shell">
  <header class="topbar">
    <a class="wordmark" href="/demo" aria-label="Icarus development views">
      <span class="mark" aria-hidden="true"></span>
      <span>ICARUS</span>
      <span class="slash">/</span>
      <span class="muted">SYSTEM MAP</span>
    </a>

    <nav aria-label="On this page">
      <a href="#architecture">Architecture</a>
      <a href="#method">Method</a>
      <a href="#migration">Migration</a>
      <a href="#sequence">Sequence</a>
      <a href="#decisions">Decisions</a>
      <a class="implementation-link" href="/demo/semantic-overlay/implementation">Implementation ↗</a>
    </nav>

  </header>

  <main>
    <section class="hero" aria-labelledby="brief-title">
      <div class="hero-copy">
        <div class="eyebrow">
          <span class="live-dot" aria-hidden="true"></span>
          Contract locked · implementation active
        </div>
        <h1 id="brief-title">Replace the lattice.<br />Keep the grounding.</h1>
        <p class="lede">
          The Semantic Overlay becomes the project-scoped representation between semantic sources
          and derived work. Semantic objects own source-grounded spans and vectors; the semantic
          index organizes them for retrieval; Derived Output remains a separate consumer.
        </p>

        <div class="principles" aria-label="Core implementation principles">
          <span><Check size={13} aria-hidden="true" /> One TypeScript runtime</span>
          <span><Check size={13} aria-hidden="true" /> Exact source provenance</span>
          <span><Check size={13} aria-hidden="true" /> Pull-based derived work</span>
        </div>
      </div>

      <aside class="readout" aria-label="Code readout">
        <div class="readout-head">
          <span>CODE READOUT</span>
          <span class="readout-state">OBSERVED</span>
        </div>
        <dl>
          <div>
            <dt>Live lattice callers</dt>
            <dd>0</dd>
          </div>
          <div>
            <dt>Lattice tables removed</dt>
            <dd>4</dd>
          </div>
          <div>
            <dt>Semantic tables added</dt>
            <dd>6</dd>
          </div>
          <div>
            <dt>Translation tests</dt>
            <dd>8<span>passing</span></dd>
          </div>
        </dl>
        <p>
          The replacement is underway on work/semantic-overlay-cutover. Deterministic translation
          is executable; Jina transport and retrieval are the next seam.
        </p>
      </aside>
    </section>

    <section class="callout" aria-label="Primary architectural recommendation">
      <div class="callout-icon"><Layers3 size={20} aria-hidden="true" /></div>
      <div>
        <span class="kicker">PRIMARY RECOMMENDATION</span>
        <p>
          Port the supplied Python behavior into Icarus’s server-side TypeScript architecture. Treat
          the ignored package as an executable specification and fixture source—not as a second
          production process.
        </p>
      </div>
      <a class="callout-tag" href="/demo/semantic-overlay/implementation">view implementation →</a>
    </section>

    <section id="architecture" class="section architecture" aria-labelledby="architecture-title">
      <div class="section-heading">
        <div>
          <span class="kicker">TARGET FLOW</span>
          <h2 id="architecture-title">The overlay in the middle</h2>
        </div>
        <p>Select a stage to inspect the contract it owns.</p>
      </div>

      <div class="pipeline-wrap">
        <div class="pipeline" role="group" aria-label="Semantic Overlay pipeline">
          {#each STAGES as stage, index (stage.id)}
            {@const StageIcon = stage.icon}
            <button
              type="button"
              class:active={selected === stage.id}
              class="stage stage-{stage.tone}"
              aria-pressed={selected === stage.id}
              onclick={() => (selected = stage.id)}
            >
              <span class="stage-top">
                <span class="stage-icon"><StageIcon size={17} aria-hidden="true" /></span>
                <span class="stage-number">{stage.label}</span>
              </span>
              <strong>{stage.title}</strong>
              <small>{stage.owner}</small>
            </button>
            {#if index < STAGES.length - 1}
              <ArrowRight class="flow-arrow" size={17} aria-hidden="true" />
            {/if}
          {/each}
        </div>
      </div>

      <div class="stage-detail stage-detail-{active.tone}">
        <div class="detail-overview">
          <div class="detail-summary">
            <span class="detail-label">{active.label} / {active.owner}</span>
            <h3>{active.title}</h3>
            <p>{active.summary}</p>
          </div>
          <ul>
            {#each active.detail as item (item)}
              <li><span aria-hidden="true"></span>{item}</li>
            {/each}
          </ul>
        </div>

        <div class="procedure-map" aria-label="{active.title} execution flow">
          <div class="procedure-head">
            <span>PROCEDURE FLOW</span>
            <small>arrows carry transient messages; they are not stored state</small>
          </div>
          <ol>
            {#each active.procedure as step (step.number)}
              <li>
                <span class="procedure-number">{step.number}</span>
                <strong>{step.title}</strong>
                <code>{step.contract}</code>
              </li>
            {/each}
          </ol>
        </div>

        <div class="structure-grid">
          {#each active.structures as structure (structure.label)}
            <article class="structure-card">
              <div class="structure-head">
                <span>{structure.label}</span>
                <span class="structure-badges">
                  <strong class="role">{structure.role}</strong>
                  <strong class="persistence persistence-{structure.persistence}">{structure.persistence}</strong>
                </span>
              </div>
              <pre><code>{structure.code}</code></pre>
              <p>{structure.note}</p>
            </article>
          {/each}
        </div>

        <div class="evidence-note">
          <Binary size={15} aria-hidden="true" />
          <span><strong>Why this is here:</strong> {active.evidence}</span>
        </div>
      </div>

      <div class="boundary-map" aria-label="Representation and runtime boundary">
        <div class="boundary representation-boundary">
          <span class="boundary-label">DURABLE REPRESENTATION</span>
          <div>
            <span>semanticOverlay</span>
            <ArrowRight size={14} aria-hidden="true" />
            <span>semanticSources</span>
            <ArrowRight size={14} aria-hidden="true" />
            <span>semanticObjects</span>
          </div>
          <p>One generation/embedding row · current source revisions · active spans/vectors · value-snapshot history</p>
        </div>
        <div class="boundary index-boundary">
          <span class="boundary-label">INDEX REPRESENTATION</span>
          <div>
            <span>semanticIndexes</span>
            <ArrowRight size={14} aria-hidden="true" />
            <span>indexNodes</span>
          </div>
          <p>Recursive centroids · branch membership · leaf objects · overlay identity by reference</p>
        </div>
        <div class="boundary runtime-boundary">
          <span class="boundary-label">RUNTIME ONLY</span>
          <div>
            <span>procedure messages</span>
            <ArrowRight size={14} aria-hidden="true" />
            <span>semantic hits</span>
          </div>
          <p>Full input text · token/alignment/range messages · query vector · constituent object IDs</p>
        </div>
        <div class="boundary consumer-boundary">
          <span class="boundary-label">CONSUMER STATE</span>
          <div>
            <span>derivedOutputs</span>
            <ArrowRight size={14} aria-hidden="true" />
            <span>citation values</span>
          </div>
          <p>Prompt · ResourceSet · evidence snapshots · last response/revision/generation · PromptBlock link</p>
        </div>
      </div>
    </section>

    <section id="method" class="section method-section" aria-labelledby="method-title">
      <div class="section-heading">
        <div>
          <span class="kicker">SEGMENTATION METHOD</span>
          <h2 id="method-title">Distance-discounted attraction, exactly</h2>
        </div>
        <p>A boundary survives only when it is a meaningful peak with enough support and nearly balanced pull.</p>
      </div>

      <div class="method-grid">
        <article class="equation-card primary-equation">
          <div class="equation-head">
            <span><Sigma size={17} aria-hidden="true" /> ATTRACTION EQUATION</span>
            <small>for candidate boundary i</small>
          </div>
          <code class="equation">
            Pᵢ = Σⱼ:cⱼ&gt;cᵢ (cⱼ − cᵢ) · e<sup>−|xⱼ−xᵢ| / τ</sup> · sgn(xⱼ − xᵢ)
          </code>
          <p>
            Stronger semantic-change peaks pull weaker peaks toward themselves. Distance weakens that
            pull exponentially; left pull is negative and right pull is positive.
          </p>
        </article>

        <article class="equation-card gate-equation">
          <div class="equation-head">
            <span>THE SURVIVAL GATE</span>
            <small>all four must hold</small>
          </div>
          <code class="equation compact-equation">
            cᵢ ≥ θ<sub>change</sub> &nbsp;∧&nbsp; πᵢ ≥ θ<sub>prominence</sub>
            &nbsp;∧&nbsp; μᵢ ≥ θ<sub>mass</sub> &nbsp;∧&nbsp; |Pᵢ| ≤ ε<sub>stationary</sub>
          </code>
          <p>Then cuts closer than <code>minTokens</code> coalesce, and regions over <code>maxTokens</code> are forcibly split.</p>
        </article>
      </div>

      <div class="metric-grid">
        <article>
          <span>01 / CHANGE</span>
          <code>cᵢ = clamp(1 − cos(Lᵢ, Rᵢ), 0, 2)</code>
          <p>The discontinuity between the summed contextual vectors to the left and right of a possible cut.</p>
        </article>
        <article>
          <span>02 / BASIN</span>
          <code>Bᵢ = boundaries whose uphill walk ends at peak i</code>
          <p>A basin is a peak’s catchment area in the one-dimensional semantic-change field.</p>
        </article>
        <article>
          <span>03 / PROMINENCE</span>
          <code>πᵢ = cᵢ − sᵢ</code>
          <p>Peak height above the highest saddle that connects it toward any higher peak. It rejects shallow bumps.</p>
        </article>
        <article>
          <span>04 / MASS FRACTION</span>
          <code>μᵢ = mᵢ / Σₖmₖ</code>
          <p>Where <code>mᵢ = Σⱼ∈Bᵢ max(0, cⱼ − min(c))</code>. It rejects peaks supported by too little of the field.</p>
        </article>
        <article>
          <span>05 / DECAY</span>
          <code>e<sup>−distance / τ</sup></code>
          <p><code>τ</code> is the attraction reach in model-token units. Smaller values make influence more local.</p>
        </article>
        <article>
          <span>06 / STATIONARY</span>
          <code>|Pᵢ| ≤ ε</code>
          <p>A surviving peak is not being meaningfully pulled left or right by a stronger nearby peak.</p>
        </article>
      </div>

      <div class="defaults-strip" aria-label="Reference segmentation defaults">
        <span>REFERENCE DEFAULTS</span>
        <code>change .28</code>
        <code>prominence .02</code>
        <code>mass .04</code>
        <code>decay 2 tokens</code>
        <code>stationary .005</code>
        <code>min 6 / max 320 tokens</code>
      </div>
    </section>

    <section id="migration" class="section" aria-labelledby="migration-title">
      <div class="section-heading">
        <div>
          <span class="kicker">REPRESENTATION CUTOVER</span>
          <h2 id="migration-title">What changes shape</h2>
        </div>
        <p>The old lattice is type-only today, so deletion can happen inside the representation cutover.</p>
      </div>

      <div class="migration-list">
        {#each MIGRATION as row (row.current)}
          {@const RowIcon = row.icon}
          <article class="migration-row">
            <div class="action action-{row.action}">
              <RowIcon size={14} aria-hidden="true" />
              {row.action}
            </div>
            <div class="migration-value current-value">
              <span>CURRENT</span>
              <code>{row.current}</code>
            </div>
            <ArrowRight class="migration-arrow" size={18} aria-hidden="true" />
            <div class="migration-value target-value">
              <span>TARGET</span>
              <code>{row.target}</code>
              <p>{row.note}</p>
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="section lifecycle-section" aria-labelledby="bridge-title">
      <div class="section-heading">
        <div>
          <span class="kicker">TWO LIFECYCLES</span>
          <h2 id="bridge-title">Mutation and synthesis move independently</h2>
        </div>
        <p>Overlay generations describe publication. Derived Output freshness depends only on the sources it actually cited.</p>
      </div>

      <div class="lifecycle-grid">
        <article class="lifecycle-card overlay-lifecycle">
          <header class="lifecycle-head">
            <div class="lifecycle-icon"><Layers3 size={19} aria-hidden="true" /></div>
            <div>
              <span class="kicker">A / SEMANTIC OVERLAY</span>
              <h3>Add · update · delete</h3>
            </div>
            <span class="lifecycle-mode">push mutation</span>
          </header>

          <ol class="lifecycle-flow">
            <li>
              <span class="flow-number">01</span>
              <div class="flow-icon source-flow"><FileInput size={16} aria-hidden="true" /></div>
              <div><strong>Accept source input</strong><small>ResourceRef · revision · text · encoding</small></div>
            </li>
            <li>
              <span class="flow-number">02</span>
              <div class="flow-icon translation-flow"><Sparkles size={16} aria-hidden="true" /></div>
              <div><strong>Translate upsert</strong><small>Add/update produce object drafts; delete produces an empty replacement</small></div>
            </li>
            <li>
              <span class="flow-number">03</span>
              <div class="flow-icon history-flow"><Archive size={16} aria-hidden="true" /></div>
              <div><strong>Prepare history values</strong><small>Snapshot old source revision, spans, and vectors—not row IDs</small></div>
            </li>
            <li>
              <span class="flow-number">04</span>
              <div class="flow-icon object-flow"><Boxes size={16} aria-hidden="true" /></div>
              <div><strong>Replace active state</strong><small>Source row + new semantic-object rows + history rows</small></div>
            </li>
            <li>
              <span class="flow-number">05</span>
              <div class="flow-icon index-flow"><Network size={16} aria-hidden="true" /></div>
              <div><strong>Publish N + 1</strong><small>Swap rebuilt index and advance the one overlay generation</small></div>
            </li>
          </ol>

          <div class="lifecycle-foot">
            <Archive size={15} aria-hidden="true" />
            <p><strong>Undo path:</strong> materialize new active rows from archived values, rebuild the index, then publish another overlay generation.</p>
          </div>
        </article>

        <article class="lifecycle-card derived-lifecycle">
          <header class="lifecycle-head">
            <div class="lifecycle-icon"><Bot size={19} aria-hidden="true" /></div>
            <div>
              <span class="kicker">B / DERIVED OUTPUT</span>
              <h3>Pull · retrieve · verify</h3>
            </div>
            <span class="lifecycle-mode">pull refresh</span>
          </header>

          <ol class="lifecycle-flow">
            <li>
              <span class="flow-number">01</span>
              <div class="flow-icon output-flow"><RefreshCw size={16} aria-hidden="true" /></div>
              <div><strong>Pull output</strong><small>Refresh on demand or when a cited revision differs</small></div>
            </li>
            <li>
              <span class="flow-number">02</span>
              <div class="flow-icon agent-flow"><Bot size={16} aria-hidden="true" /></div>
              <div><strong>Start synthesis agent</strong><small>No planner in the first pass</small></div>
            </li>
            <li>
              <span class="flow-number">03</span>
              <div class="flow-icon query-flow"><Search size={16} aria-hidden="true" /></div>
              <div><strong>Retrieve + read</strong><small>Hits carry temporary object IDs and coalesced span values</small></div>
            </li>
            <li>
              <span class="flow-number">04</span>
              <div class="flow-icon verify-flow"><ShieldCheck size={16} aria-hidden="true" /></div>
              <div><strong>Recheck cited sources</strong><small>Compare each captured revision with current source state</small></div>
            </li>
            <li>
              <span class="flow-number">05</span>
              <div class="flow-icon publish-flow"><FileText size={16} aria-hidden="true" /></div>
              <div><strong>Publish or retry</strong><small>Persist citation values plus last response/revision/generation</small></div>
            </li>
          </ol>

          <div class="lifecycle-foot success-foot">
            <Check size={15} aria-hidden="true" />
            <p><strong>Settlement guard:</strong> publish when cited revisions still match. A generation change caused by an unrelated source is safe.</p>
          </div>
        </article>
      </div>
    </section>

    <section id="sequence" class="section" aria-labelledby="sequence-title">
      <div class="section-heading">
        <div>
          <span class="kicker">IMPLEMENTATION SEQUENCE</span>
          <h2 id="sequence-title">Proceed from invariants outward</h2>
        </div>
        <p>Each step leaves a testable seam and avoids coupling correctness to the first index choice.</p>
      </div>

      <ol class="sequence-list">
        {#each STEPS as step (step.number)}
          <li class="sequence-step sequence-{step.state}">
            <span class="sequence-number">{step.number}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        {/each}
      </ol>
    </section>

    <section id="decisions" class="section" aria-labelledby="decisions-title">
      <div class="section-heading">
        <div>
          <span class="kicker">CONTRACT STATUS</span>
          <h2 id="decisions-title">Three aligned, one policy to measure</h2>
        </div>
        <p>The remaining uncertainty is retrieval quality: beam width, top-k behavior, and the score assigned after span coalescence.</p>
      </div>

      <div class="question-grid">
        {#each DECISIONS as question (question.title)}
          <article class="question-card">
            <div class="question-head status-{question.status}">
              <span>{question.status}</span>
              {#if question.status === "aligned"}
                <Check size={16} aria-hidden="true" />
              {:else}
                <CircleAlert size={16} aria-hidden="true" />
              {/if}
            </div>
            <h3>{question.title}</h3>
            <p>{question.body}</p>
            <div class="recommendation">
              <strong>Initial recommendation</strong>
              <span>{question.recommendation}</span>
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="acceptance" aria-labelledby="acceptance-title">
      <div>
        <span class="kicker">FIRST VERTICAL SLICE</span>
        <h2 id="acceptance-title">One source. One query. Two visible lifecycles.</h2>
        <p>
          Add a generic text source, publish objects plus recursive index, synthesize a cited Prompt
          Content Block, update the same source revision, inspect history, and pull the output again.
        </p>
      </div>
      <div class="acceptance-path" aria-label="First vertical slice path">
        <span><FileInput size={15} aria-hidden="true" /> source</span>
        <ArrowRight size={14} aria-hidden="true" />
        <span><Layers3 size={15} aria-hidden="true" /> overlay</span>
        <ArrowRight size={14} aria-hidden="true" />
        <span><Gauge size={15} aria-hidden="true" /> query</span>
        <ArrowRight size={14} aria-hidden="true" />
        <span><FileText size={15} aria-hidden="true" /> prompt block</span>
      </div>
    </section>
  </main>

  <footer>
    <span>SEMANTIC OVERLAY / INTEGRATION BRIEF 01</span>
    <span>Code read: current app + supplied translator + frozen lifecycle</span>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .brief-shell {
    min-height: 100vh;
    background:
      radial-gradient(circle at 82% 5%, color-mix(in srgb, var(--token-color-intelligence-fill) 10%, transparent), transparent 24rem),
      linear-gradient(var(--token-surface-canvas), var(--token-surface-canvas));
    color: var(--token-ink-primary);
  }

  .topbar {
    position: sticky;
    z-index: 20;
    top: 0;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: "brand navigation";
    align-items: center;
    min-height: 3.5rem;
    padding: 0 2rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: color-mix(in srgb, var(--token-surface-canvas) 88%, transparent);
    backdrop-filter: blur(16px);
  }

  .wordmark {
    grid-area: brand;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: fit-content;
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-decoration: none;
  }

  .mark {
    width: 0.62rem;
    height: 0.62rem;
    border: 2px solid var(--token-color-active-text);
    transform: rotate(45deg);
  }

  .slash,
  .muted {
    color: var(--token-ink-muted);
  }

  nav {
    grid-area: navigation;
    display: flex;
    gap: 1.5rem;
  }

  nav a {
    color: var(--token-ink-secondary);
    font-size: 0.78rem;
    text-decoration: none;
  }

  nav a:hover {
    color: var(--token-color-interactive-text);
  }

  nav .implementation-link {
    color: var(--token-color-active-text);
  }

  main,
  footer {
    width: min(100% - 3rem, 78rem);
    margin-inline: auto;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(18rem, 0.75fr);
    gap: 5rem;
    align-items: end;
    padding: 6.5rem 0 4.5rem;
  }

  .eyebrow,
  .kicker,
  .detail-label,
  .boundary-label,
  .migration-value > span,
  footer {
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
    font-weight: 500;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.3rem;
    color: var(--token-color-active-text);
  }

  .live-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--token-color-active-fill);
    box-shadow: 0 0 0 4px var(--token-color-active-surface);
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  h1 {
    max-width: 13ch;
    font-size: clamp(3rem, 6vw, 5.6rem);
    font-weight: 500;
    letter-spacing: -0.065em;
    line-height: 0.94;
  }

  .lede {
    max-width: 49rem;
    margin-top: 1.75rem;
    color: var(--token-ink-secondary);
    font-size: clamp(1rem, 2vw, 1.18rem);
    line-height: 1.65;
  }

  .principles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1.8rem;
  }

  .principles span {
    display: inline-flex;
    align-items: center;
    gap: 0.38rem;
    padding: 0.32rem 0.62rem;
    border: 1px solid var(--token-color-success-border);
    border-radius: 999px;
    background: var(--token-color-success-surface);
    color: var(--token-color-success-text);
    font-size: 0.72rem;
    font-weight: 500;
  }

  .readout {
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
    box-shadow: var(--token-shadow-panel);
  }

  .readout-head {
    display: flex;
    justify-content: space-between;
    padding: 0.7rem 0.9rem;
    border-bottom: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.09em;
  }

  .readout-state {
    color: var(--token-color-success-text);
  }

  .readout dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin: 0;
  }

  .readout dl div {
    padding: 1rem;
    border-right: 1px solid var(--token-border-subtle);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .readout dl div:nth-child(even) {
    border-right: 0;
  }

  .readout dt {
    color: var(--token-ink-muted);
    font-size: 0.72rem;
  }

  .readout dd {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    margin: 0.25rem 0 0;
    font-family: var(--token-font-mono);
    font-size: 1.6rem;
    font-weight: 500;
  }

  .readout dd span {
    color: var(--token-ink-muted);
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .readout > p {
    padding: 0.9rem 1rem 1rem;
    color: var(--token-ink-muted);
    font-size: 0.74rem;
    line-height: 1.5;
  }

  .callout {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 1rem;
    align-items: center;
    padding: 1rem 1.1rem;
    border: 1px solid var(--token-color-intelligence-border);
    border-radius: var(--token-radius-panel);
    background: var(--token-color-intelligence-surface);
  }

  .callout-icon {
    display: grid;
    place-items: center;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: var(--token-radius-control);
    background: var(--token-color-intelligence-fill);
    color: var(--token-color-intelligence-on-fill);
  }

  .callout .kicker {
    color: var(--token-color-intelligence-text);
  }

  .callout p {
    margin-top: 0.2rem;
    color: var(--token-ink-primary);
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .callout-tag {
    padding: 0.35rem 0.55rem;
    border: 1px solid var(--token-color-intelligence-border);
    border-radius: 999px;
    color: var(--token-color-intelligence-text);
    font-family: var(--token-font-mono);
    font-size: 0.65rem;
    text-decoration: none;
    white-space: nowrap;
  }

  .section {
    padding: 6rem 0 1rem;
    scroll-margin-top: 4rem;
  }

  .section-heading {
    display: flex;
    justify-content: space-between;
    gap: 3rem;
    align-items: end;
    margin-bottom: 2rem;
  }

  .kicker {
    color: var(--token-color-active-text);
  }

  h2 {
    margin-top: 0.45rem;
    font-size: clamp(1.8rem, 3.5vw, 2.7rem);
    font-weight: 500;
    letter-spacing: -0.04em;
    line-height: 1.05;
  }

  .section-heading > p {
    max-width: 28rem;
    color: var(--token-ink-muted);
    font-size: 0.84rem;
    line-height: 1.55;
    text-align: right;
  }

  .pipeline-wrap {
    overflow-x: auto;
    padding: 0.3rem;
    scrollbar-width: thin;
  }

  .pipeline {
    display: flex;
    align-items: center;
    min-width: 70rem;
  }

  .stage {
    flex: 1 0 9.2rem;
    min-width: 0;
    min-height: 7.7rem;
    padding: 0.8rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
    color: var(--token-ink-primary);
    text-align: left;
    cursor: pointer;
    transition: border-color 140ms ease, transform 140ms ease, background 140ms ease;
  }

  .stage:hover {
    border-color: var(--token-color-interactive-border);
    transform: translateY(-2px);
  }

  .stage.active {
    border-color: var(--stage-color);
    background: var(--stage-surface);
    box-shadow: 0 0 0 1px var(--stage-color);
  }

  .stage-source,
  .stage-detail-source {
    --stage-color: var(--token-color-accent-2-border);
    --stage-text: var(--token-color-accent-2-text);
    --stage-surface: var(--token-color-accent-2-surface);
  }

  .stage-translation,
  .stage-detail-translation {
    --stage-color: var(--token-color-intelligence-border);
    --stage-text: var(--token-color-intelligence-text);
    --stage-surface: var(--token-color-intelligence-surface);
  }

  .stage-overlay,
  .stage-detail-overlay {
    --stage-color: var(--token-color-active-border);
    --stage-text: var(--token-color-active-text);
    --stage-surface: var(--token-color-active-surface);
  }

  .stage-index,
  .stage-detail-index {
    --stage-color: var(--token-color-interactive-border);
    --stage-text: var(--token-color-interactive-text);
    --stage-surface: var(--token-color-interactive-surface);
  }

  .stage-output,
  .stage-detail-output {
    --stage-color: var(--token-color-accent-1-border);
    --stage-text: var(--token-color-accent-1-text);
    --stage-surface: var(--token-color-accent-1-surface);
  }

  .stage-top {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 1.15rem;
  }

  .stage-icon {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--token-radius-control);
    background: var(--stage-surface);
    color: var(--stage-text);
  }

  .stage-number {
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.62rem;
  }

  .stage strong,
  .stage small {
    display: block;
  }

  .stage strong {
    font-size: 0.82rem;
    font-weight: 500;
  }

  .stage small {
    overflow: hidden;
    margin-top: 0.28rem;
    color: var(--token-ink-muted);
    font-size: 0.66rem;
    line-height: 1.35;
    text-overflow: ellipsis;
  }

  .flow-arrow {
    flex: 0 0 auto;
    margin: 0 0.3rem;
    color: var(--token-ink-muted);
  }

  .stage-detail {
    margin-top: 1rem;
    padding: 1.4rem;
    border: 1px solid var(--stage-color);
    border-radius: var(--token-radius-panel);
    background: linear-gradient(120deg, var(--stage-surface), var(--token-surface-panel) 58%);
  }

  .detail-overview {
    display: grid;
    grid-template-columns: 0.85fr 1.15fr;
    gap: 1.5rem 3rem;
  }

  .detail-label {
    color: var(--stage-text);
  }

  .stage-detail h3 {
    margin-top: 0.5rem;
    font-size: 1.35rem;
    font-weight: 500;
  }

  .detail-summary p {
    max-width: 31rem;
    margin-top: 0.55rem;
    color: var(--token-ink-secondary);
    font-size: 0.86rem;
    line-height: 1.55;
  }

  .detail-overview ul {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .detail-overview li {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.65rem;
    color: var(--token-ink-secondary);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .detail-overview li > span {
    width: 0.34rem;
    height: 0.34rem;
    margin-top: 0.4rem;
    border-radius: 50%;
    background: var(--stage-color);
  }

  .procedure-map {
    overflow: hidden;
    margin-top: 1.4rem;
    border: 1px solid color-mix(in srgb, var(--stage-color) 45%, var(--token-border-subtle));
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
  }

  .procedure-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.58rem 0.75rem;
    border-bottom: 1px solid var(--token-border-subtle);
    font-family: var(--token-font-mono);
  }

  .procedure-head span {
    color: var(--stage-text);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
  }

  .procedure-head small {
    color: var(--token-ink-muted);
    font-size: 0.6rem;
  }

  .procedure-map ol {
    display: flex;
    overflow-x: auto;
    margin: 0;
    padding: 0;
    list-style: none;
    scrollbar-width: thin;
  }

  .procedure-map li {
    position: relative;
    flex: 1 0 10rem;
    min-width: 0;
    padding: 0.78rem 0.9rem;
    border-right: 1px solid var(--token-border-subtle);
  }

  .procedure-map li:last-child {
    border-right: 0;
  }

  .procedure-map li:not(:last-child)::after {
    position: absolute;
    top: 50%;
    right: -0.29rem;
    z-index: 1;
    width: 0.5rem;
    height: 0.5rem;
    border-top: 1px solid var(--stage-color);
    border-right: 1px solid var(--stage-color);
    background: var(--token-surface-panel);
    content: "";
    transform: translateY(-50%) rotate(45deg);
  }

  .procedure-number,
  .procedure-map strong,
  .procedure-map code {
    display: block;
  }

  .procedure-number {
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.56rem;
  }

  .procedure-map strong {
    margin-top: 0.45rem;
    color: var(--token-ink-primary);
    font-size: 0.74rem;
    font-weight: 500;
  }

  .procedure-map code {
    margin-top: 0.3rem;
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.6rem;
    line-height: 1.4;
    white-space: normal;
  }

  .structure-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem;
    margin-top: 1.4rem;
  }

  .structure-card {
    min-width: 0;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--stage-color) 45%, var(--token-border-subtle));
    border-radius: var(--token-radius-control);
    background: var(--token-surface-work);
  }

  .structure-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding: 0.65rem 0.8rem;
    border-bottom: 1px solid var(--token-border-subtle);
    font-family: var(--token-font-mono);
    font-size: 0.65rem;
  }

  .structure-head > span:first-child {
    color: var(--stage-text);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .structure-badges {
    display: flex;
    flex: 0 0 auto;
    gap: 0.3rem;
  }

  .structure-head strong {
    padding: 0.16rem 0.36rem;
    border: 1px solid var(--token-color-attention-border);
    border-radius: 999px;
    color: var(--token-color-attention-text);
    font-size: 0.58rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .structure-head .role {
    border-color: var(--stage-color);
    color: var(--stage-text);
  }

  .structure-head .persistence-stored {
    border-color: var(--token-color-success-border);
    color: var(--token-color-success-text);
  }

  .structure-head .persistence-transient {
    border-color: var(--token-color-attention-border);
    color: var(--token-color-attention-text);
  }

  .structure-head .persistence-configured {
    border-color: var(--token-color-intelligence-border);
    color: var(--token-color-intelligence-text);
  }

  .structure-card pre {
    overflow-x: auto;
    margin: 0;
    padding: 0.9rem;
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: 0.66rem;
    line-height: 1.55;
    tab-size: 2;
  }

  .structure-card code {
    font: inherit;
  }

  .structure-card > p {
    padding: 0 0.9rem 0.85rem;
    color: var(--token-ink-muted);
    font-size: 0.67rem;
    line-height: 1.45;
  }

  .evidence-note {
    display: flex;
    gap: 0.55rem;
    align-items: start;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid color-mix(in srgb, var(--stage-color) 50%, var(--token-border-subtle));
    color: var(--token-ink-muted);
    font-size: 0.72rem;
    line-height: 1.45;
  }

  .evidence-note :global(svg) {
    flex: 0 0 auto;
    margin-top: 0.1rem;
    color: var(--stage-text);
  }

  .evidence-note strong {
    color: var(--token-ink-secondary);
    font-weight: 500;
  }

  .boundary-map {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.8rem;
    margin-top: 1rem;
  }

  .boundary {
    min-width: 0;
    padding: 1rem;
    border: 1px solid var(--token-border-subtle);
    border-top: 3px solid var(--boundary-color);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
  }

  .representation-boundary {
    --boundary-color: var(--token-color-active-border);
  }

  .index-boundary {
    --boundary-color: var(--token-color-interactive-border);
  }

  .runtime-boundary {
    --boundary-color: var(--token-color-attention-border);
  }

  .consumer-boundary {
    --boundary-color: var(--token-color-accent-1-border);
  }

  .boundary-label {
    color: var(--token-ink-muted);
  }

  .boundary > div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    align-items: center;
    margin-top: 0.75rem;
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: 0.74rem;
  }

  .boundary > div :global(svg) {
    color: var(--boundary-color);
  }

  .boundary p {
    margin-top: 0.45rem;
    color: var(--token-ink-muted);
    font-size: 0.68rem;
    line-height: 1.4;
  }

  .method-grid {
    display: grid;
    grid-template-columns: 1.25fr 1fr;
    gap: 0.9rem;
  }

  .equation-card {
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .primary-equation {
    border-color: var(--token-color-intelligence-border);
    background: linear-gradient(135deg, var(--token-color-intelligence-surface), var(--token-surface-panel) 70%);
  }

  .gate-equation {
    border-color: var(--token-color-active-border);
    background: linear-gradient(135deg, var(--token-color-active-surface), var(--token-surface-panel) 70%);
  }

  .equation-head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem 0.9rem;
    border-bottom: 1px solid var(--token-border-subtle);
    font-family: var(--token-font-mono);
  }

  .equation-head span {
    display: inline-flex;
    gap: 0.45rem;
    align-items: center;
    color: var(--token-color-intelligence-text);
    font-size: 0.64rem;
    letter-spacing: 0.08em;
  }

  .gate-equation .equation-head span {
    color: var(--token-color-active-text);
  }

  .equation-head small {
    color: var(--token-ink-muted);
    font-size: 0.61rem;
  }

  .equation {
    display: block;
    overflow-x: auto;
    padding: 1.5rem 1rem 1rem;
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: clamp(0.92rem, 1.7vw, 1.2rem);
    line-height: 1.6;
    text-align: center;
    white-space: nowrap;
  }

  .compact-equation {
    font-size: clamp(0.78rem, 1.4vw, 1rem);
  }

  .equation-card > p {
    padding: 0 1rem 1.2rem;
    color: var(--token-ink-secondary);
    font-size: 0.74rem;
    line-height: 1.55;
    text-align: center;
  }

  .equation-card > p code {
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px;
    overflow: hidden;
    margin-top: 0.9rem;
    padding: 1px;
    border-radius: var(--token-radius-panel);
    background: var(--token-border-subtle);
  }

  .metric-grid article {
    min-width: 0;
    padding: 1rem;
    background: var(--token-surface-panel);
  }

  .metric-grid span {
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: 0.59rem;
    letter-spacing: 0.08em;
  }

  .metric-grid code {
    display: block;
    overflow-wrap: anywhere;
    margin-top: 0.7rem;
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: 0.7rem;
    line-height: 1.45;
  }

  .metric-grid p {
    margin-top: 0.55rem;
    color: var(--token-ink-muted);
    font-size: 0.68rem;
    line-height: 1.5;
  }

  .metric-grid p code {
    display: inline;
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: inherit;
  }

  .defaults-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.9rem;
    padding: 0.75rem;
    border: 1px solid var(--token-color-attention-border);
    border-radius: var(--token-radius-control);
    background: var(--token-color-attention-surface);
  }

  .defaults-strip > span {
    margin-right: auto;
    color: var(--token-color-attention-text);
    font-family: var(--token-font-mono);
    font-size: 0.61rem;
    letter-spacing: 0.08em;
  }

  .defaults-strip code {
    padding: 0.22rem 0.4rem;
    border: 1px solid var(--token-color-attention-border);
    border-radius: 999px;
    color: var(--token-ink-secondary);
    font-family: var(--token-font-mono);
    font-size: 0.61rem;
  }

  .migration-list {
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .migration-row {
    display: grid;
    grid-template-columns: 6rem 1fr auto 1.25fr;
    gap: 1rem;
    align-items: center;
    min-height: 6.4rem;
    padding: 1rem 1.2rem;
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .migration-row:last-child {
    border-bottom: 0;
  }

  .action {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    width: fit-content;
    padding: 0.3rem 0.5rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-family: var(--token-font-mono);
    font-size: 0.63rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .action-remove {
    color: var(--token-color-danger-text);
  }

  .action-replace,
  .action-rename {
    color: var(--token-color-attention-text);
  }

  .action-bridge {
    color: var(--token-color-active-text);
  }

  .migration-value {
    min-width: 0;
  }

  .migration-value > span {
    display: block;
    margin-bottom: 0.35rem;
    color: var(--token-ink-muted);
  }

  .migration-value code {
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: 0.78rem;
    white-space: normal;
  }

  .current-value code {
    text-decoration-color: var(--token-color-danger-border);
    text-decoration-line: line-through;
    text-decoration-thickness: 1px;
  }

  .target-value p {
    margin-top: 0.4rem;
    color: var(--token-ink-muted);
    font-size: 0.7rem;
    line-height: 1.4;
  }

  .migration-arrow {
    color: var(--token-color-active-text);
  }

  .lifecycle-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .lifecycle-card {
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .lifecycle-head {
    display: flex;
    gap: 0.8rem;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .overlay-lifecycle .lifecycle-head {
    background: var(--token-color-active-surface);
  }

  .derived-lifecycle .lifecycle-head {
    background: var(--token-color-intelligence-surface);
  }

  .lifecycle-icon {
    display: grid;
    flex: 0 0 2.4rem;
    place-items: center;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: var(--token-radius-control);
  }

  .overlay-lifecycle .lifecycle-icon {
    background: var(--token-color-active-fill);
    color: var(--token-color-active-on-fill);
  }

  .derived-lifecycle .lifecycle-icon {
    background: var(--token-color-intelligence-fill);
    color: var(--token-color-intelligence-on-fill);
  }

  .lifecycle-head h3 {
    margin-top: 0.24rem;
    font-size: 1rem;
    font-weight: 500;
  }

  .lifecycle-mode {
    margin-left: auto;
    padding: 0.22rem 0.42rem;
    border: 1px solid var(--token-border-strong);
    border-radius: 999px;
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .lifecycle-flow {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .lifecycle-flow li {
    position: relative;
    display: grid;
    grid-template-columns: 1.6rem 2.1rem minmax(0, 1fr);
    gap: 0.65rem;
    align-items: center;
    min-height: 4.65rem;
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .lifecycle-flow li::after {
    position: absolute;
    bottom: -0.45rem;
    left: 3.64rem;
    z-index: 1;
    width: 0.7rem;
    height: 0.7rem;
    border-right: 1px solid var(--token-border-strong);
    border-bottom: 1px solid var(--token-border-strong);
    background: var(--token-surface-panel);
    content: "";
    transform: rotate(45deg);
  }

  .lifecycle-flow li:last-child::after {
    display: none;
  }

  .flow-number {
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.58rem;
  }

  .flow-icon {
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border-radius: 50%;
  }

  .source-flow {
    background: var(--token-color-accent-2-surface);
    color: var(--token-color-accent-2-text);
  }

  .history-flow {
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
  }

  .translation-flow,
  .agent-flow {
    background: var(--token-color-intelligence-surface);
    color: var(--token-color-intelligence-text);
  }

  .object-flow,
  .query-flow {
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  .index-flow,
  .verify-flow {
    background: var(--token-color-interactive-surface);
    color: var(--token-color-interactive-text);
  }

  .output-flow,
  .publish-flow {
    background: var(--token-color-accent-1-surface);
    color: var(--token-color-accent-1-text);
  }

  .lifecycle-flow strong,
  .lifecycle-flow small {
    display: block;
  }

  .lifecycle-flow strong {
    font-size: 0.77rem;
    font-weight: 500;
  }

  .lifecycle-flow small {
    margin-top: 0.2rem;
    color: var(--token-ink-muted);
    font-size: 0.66rem;
    line-height: 1.35;
  }

  .lifecycle-foot {
    display: flex;
    gap: 0.55rem;
    align-items: start;
    margin: 1rem;
    padding: 0.75rem;
    border: 1px solid var(--token-color-attention-border);
    border-radius: var(--token-radius-control);
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
  }

  .lifecycle-foot :global(svg) {
    flex: 0 0 auto;
    margin-top: 0.12rem;
  }

  .lifecycle-foot p {
    color: var(--token-ink-secondary);
    font-size: 0.68rem;
    line-height: 1.45;
  }

  .lifecycle-foot strong {
    color: var(--token-color-attention-text);
    font-weight: 500;
  }

  .success-foot {
    border-color: var(--token-color-success-border);
    background: var(--token-color-success-surface);
    color: var(--token-color-success-text);
  }

  .success-foot strong {
    color: var(--token-color-success-text);
  }

  .sequence-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    overflow: hidden;
    margin: 0;
    padding: 1px;
    border-radius: var(--token-radius-panel);
    background: var(--token-border-subtle);
    list-style: none;
  }

  .sequence-step {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.8rem;
    min-height: 10.5rem;
    padding: 1.15rem;
    background: var(--token-surface-panel);
  }

  .sequence-first {
    background: var(--token-color-active-surface);
  }

  .sequence-last {
    background: var(--token-color-success-surface);
  }

  .sequence-number {
    display: grid;
    place-items: center;
    width: 1.8rem;
    height: 1.8rem;
    border: 1px solid var(--token-border-strong);
    border-radius: 50%;
    color: var(--token-ink-secondary);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
  }

  .sequence-step h3 {
    margin-top: 0.25rem;
    font-size: 0.88rem;
    font-weight: 500;
  }

  .sequence-step p {
    margin-top: 0.65rem;
    color: var(--token-ink-muted);
    font-size: 0.72rem;
    line-height: 1.5;
  }

  .question-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.9rem;
  }

  .question-card {
    padding: 1.2rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .question-head {
    display: flex;
    justify-content: space-between;
    color: var(--token-color-attention-text);
  }

  .question-head span {
    padding: 0.2rem 0.42rem;
    border: 1px solid var(--token-color-attention-border);
    border-radius: 999px;
    background: var(--token-color-attention-surface);
    font-family: var(--token-font-mono);
    font-size: 0.62rem;
  }

  .question-card h3 {
    margin-top: 1rem;
    font-size: 1rem;
    font-weight: 500;
  }

  .question-card > p {
    margin-top: 0.55rem;
    color: var(--token-ink-muted);
    font-size: 0.76rem;
    line-height: 1.5;
  }

  .recommendation {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin-top: 1rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--token-border-subtle);
    color: var(--token-ink-secondary);
    font-size: 0.72rem;
    line-height: 1.45;
  }

  .recommendation strong {
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .question-head.status-aligned {
    color: var(--token-color-success-text);
  }

  .question-head.status-aligned span {
    border-color: var(--token-color-success-border);
    background: var(--token-color-success-surface);
  }

  .acceptance {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3rem;
    align-items: center;
    margin-top: 6rem;
    padding: 2rem;
    border: 1px solid var(--token-color-success-border);
    border-radius: var(--token-radius-panel);
    background: var(--token-color-success-surface);
  }

  .acceptance h2 {
    font-size: 1.8rem;
  }

  .acceptance p {
    max-width: 47rem;
    margin-top: 0.7rem;
    color: var(--token-ink-secondary);
    font-size: 0.82rem;
    line-height: 1.55;
  }

  .acceptance-path {
    display: flex;
    gap: 0.55rem;
    align-items: center;
    color: var(--token-color-success-text);
  }

  .acceptance-path span {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
    white-space: nowrap;
  }

  footer {
    display: flex;
    justify-content: space-between;
    gap: 2rem;
    margin-top: 6rem;
    padding: 1.5rem 0 2rem;
    border-top: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
  }

  @media (max-width: 62rem) {
    .topbar {
      grid-template-columns: 1fr;
      grid-template-areas: "brand";
    }

    nav {
      display: none;
    }

    .hero {
      grid-template-columns: 1fr;
      gap: 2.5rem;
      padding-top: 4.5rem;
    }

    .readout {
      max-width: 33rem;
    }

    .boundary-map,
    .sequence-list {
      grid-template-columns: 1fr 1fr;
    }

    .method-grid {
      grid-template-columns: 1fr;
    }

    .lifecycle-grid {
      grid-template-columns: 1fr;
    }

    .acceptance {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 43rem) {
    .topbar {
      padding: 0 1rem;
    }

    .wordmark .muted,
    .wordmark .slash {
      display: none;
    }

    main,
    footer {
      width: min(100% - 2rem, 78rem);
    }

    .hero {
      padding-top: 3.5rem;
    }

    h1 {
      font-size: clamp(2.9rem, 15vw, 4.2rem);
    }

    .callout {
      grid-template-columns: auto 1fr;
    }

    .callout-tag {
      display: none;
    }

    .section {
      padding-top: 4.5rem;
    }

    .section-heading {
      display: block;
    }

    .section-heading > p {
      margin-top: 0.8rem;
      text-align: left;
    }

    .detail-overview,
    .structure-grid,
    .boundary-map,
    .metric-grid,
    .sequence-list,
    .question-grid {
      grid-template-columns: 1fr;
    }

    .migration-row {
      grid-template-columns: 1fr;
      gap: 0.65rem;
    }

    .migration-arrow {
      transform: rotate(90deg);
    }

    .lifecycle-head {
      align-items: flex-start;
    }

    .lifecycle-mode {
      max-width: 5rem;
      text-align: center;
      white-space: normal;
    }

    .acceptance {
      padding: 1.3rem;
    }

    .acceptance-path {
      flex-wrap: wrap;
    }

    footer {
      flex-direction: column;
    }
  }
</style>
