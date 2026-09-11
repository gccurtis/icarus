<script lang="ts">
  import type { Component } from "svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Binary from "@lucide/svelte/icons/binary";
  import Braces from "@lucide/svelte/icons/braces";
  import ChartNoAxesColumn from "@lucide/svelte/icons/chart-no-axes-column";
  import Check from "@lucide/svelte/icons/check";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import Code2 from "@lucide/svelte/icons/code-2";
  import Database from "@lucide/svelte/icons/database";
  import Eye from "@lucide/svelte/icons/eye";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import FileSpreadsheet from "@lucide/svelte/icons/file-spreadsheet";
  import FileText from "@lucide/svelte/icons/file-text";
  import Fingerprint from "@lucide/svelte/icons/fingerprint";
  import Image from "@lucide/svelte/icons/image";
  import Layers3 from "@lucide/svelte/icons/layers-3";
  import Network from "@lucide/svelte/icons/network";
  import PackageSearch from "@lucide/svelte/icons/package-search";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import ScanSearch from "@lucide/svelte/icons/scan-search";
  import Search from "@lucide/svelte/icons/search";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Table2 from "@lucide/svelte/icons/table-2";
  import Tags from "@lucide/svelte/icons/tags";
  import UserRoundPen from "@lucide/svelte/icons/user-round-pen";

  type Icon = Component<{
    size?: number | string;
    strokeWidth?: number | string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;

  type MaterialKind = "csv" | "table" | "chart" | "image" | "code";
  type Material = {
    id: MaterialKind;
    label: string;
    name: string;
    icon: Icon;
    origin: string;
    profile: string[];
    context: string[];
    summary: string;
    facets: { name: string; provenance: string; state: "exact" | "authored" | "inferred" | "native" }[];
    reader: string;
    evidence: string;
    granularity: string;
  };

  const MATERIALS: Material[] = [
    {
      id: "csv",
      label: "RAW CSV",
      name: "Field incidents",
      icon: FileSpreadsheet,
      origin: "externalFile::data · sha256:82c…",
      profile: ["14,208 rows", "12 columns", "2022-01 → 2025-12", "region · severity · response_minutes"],
      context: ["uploaded as field-incidents.csv", "referenced by Operations review", "no user description yet"],
      summary:
        "Regional field-incident records tracking severity, response time, remediation status, and responsible team across four reporting years.",
      facets: [
        { name: "identity", provenance: "name + kind", state: "exact" },
        { name: "profile", provenance: "headers + typed statistics", state: "exact" },
        { name: "generated", provenance: "profile + bounded samples", state: "inferred" }
      ],
      reader: "read_csv",
      evidence: "native rows + column selection",
      granularity: "one dataset descriptor; partitions only when scale demands them"
    },
    {
      id: "table",
      label: "NATIVE TABLE",
      name: "Quarterly readiness",
      icon: Table2,
      origin: "slides:presentation-04 · slide-07 · table-02",
      profile: ["5 rows × 4 columns", "Q1 → Q4", "percent values", "header row preserved"],
      context: ["slide title: Quarterly readiness", "speaker notes mention retrofit", "adjacent text span 418–502"],
      summary:
        "Quarterly readiness comparison showing a sustained increase through Q4, presented alongside the field-retrofit explanation.",
      facets: [
        { name: "identity", provenance: "content handle", state: "exact" },
        { name: "profile", provenance: "native cells + structure", state: "exact" },
        { name: "generated", provenance: "cells + slide context", state: "inferred" }
      ],
      reader: "read_table",
      evidence: "native cell range + row/column structure",
      granularity: "one content item; never one descriptor per row"
    },
    {
      id: "image",
      label: "IMAGE ASSET",
      name: "North station installation",
      icon: Image,
      origin: "externalFiles:image-03 · sha256:9bf…",
      profile: ["2048 × 1365", "image/jpeg", "sha256:9bf…", "3 placements"],
      context: ["alt: field installation", "caption from document block", "slide-07 placement context"],
      summary:
        "Field photograph of a north-station equipment installation, with temporary barriers visible around the active work area.",
      facets: [
        { name: "identity", provenance: "asset name + kind", state: "exact" },
        { name: "profile", provenance: "hash + media metadata", state: "exact" },
        { name: "authored", provenance: "alt + caption · contributor-scoped", state: "authored" },
        { name: "generated", provenance: "pixels + context · contributor-scoped", state: "inferred" },
        { name: "native visual", provenance: "Jina v4 image vector", state: "native" }
      ],
      reader: "read_image",
      evidence: "content-addressed pixels + optional crop coordinates",
      granularity: "one asset identity by hash; contextual facets retain every contributing resource ref"
    },
    {
      id: "chart",
      label: "NATIVE CHART",
      name: "Quarterly readiness",
      icon: ChartNoAxesColumn,
      origin: "slides:presentation-04 · slide-07 · chart-02",
      profile: ["bar chart", "Revenue + Cost series", "native JSON spec", "60k read ceiling"],
      context: ["slide title and narrative", "speaker notes", "shape and slide placement"],
      summary:
        "Quarterly readiness chart comparing named native series in the context of the field-retrofit recommendation.",
      facets: [
        { name: "identity", provenance: "name + kind", state: "exact" },
        { name: "profile", provenance: "chart type + series + labels", state: "exact" },
        { name: "generated", provenance: "profile + slide context", state: "inferred" }
      ],
      reader: "read_chart",
      evidence: "selected native series and specification",
      granularity: "one chart material per native chart element"
    },
    {
      id: "code",
      label: "CODE FILE",
      name: "pricing-engine.ts",
      icon: FileCode2,
      origin: "externalFile::text · sha256:3ad…",
      profile: ["TypeScript", "18 exported symbols", "imports money + tax", "642 lines"],
      context: ["repository-relative name", "symbol outline", "incoming references are a future enrichment"],
      summary:
        "Pricing calculation module that applies account discounts before regional tax and exposes line-item and cart-total entry points.",
      facets: [
        { name: "identity", provenance: "name + language", state: "exact" },
        { name: "profile", provenance: "parser symbol graph", state: "exact" },
        { name: "generated", provenance: "outline + bounded source", state: "inferred" }
      ],
      reader: "read_code",
      evidence: "exact line or symbol range",
      granularity: "file descriptor first; symbol descriptors only for large files"
    }
  ];

  let activeMaterialId = $state<MaterialKind>("csv");
  const activeMaterial = $derived(
    MATERIALS.find((material) => material.id === activeMaterialId) ?? MATERIALS[0]
  );
  const ActiveMaterialIcon = $derived(activeMaterial.icon);

  const PIPELINE = [
    {
      number: "01",
      name: "readMaterialInventoryFor",
      status: "live",
      icon: PackageSearch,
      text: "projectResource and readMaterialInventoryFor enumerate tables, charts, images, datasets, and code without generating prose."
    },
    {
      number: "02",
      name: "profileTable / Csv / …",
      status: "live",
      icon: ChartNoAxesColumn,
      text: "profileTable, profileCsv, profileChart, profileImage, and profileCode derive bounded deterministic structure."
    },
    {
      number: "03",
      name: "normalizeMaterials",
      status: "live",
      icon: Layers3,
      text: "Bounded placement contexts merge for shared assets; contributor refs are sorted, hashed, and persisted on contextual facets."
    },
    {
      number: "04",
      name: "describeMaterial",
      status: "live",
      icon: Sparkles,
      text: "Structured intelligence records purpose, entities, measures, coverage, and uncertainty; image summaries require vision over original pixels."
    },
    {
      number: "05",
      name: "embedMaterialFacets",
      status: "live",
      icon: Binary,
      text: "Text facets use passage embeddings; unchanged facet hashes reuse vectors, including native image vectors in the same Jina space."
    },
    {
      number: "06",
      name: "publishSemanticMaterials",
      status: "live",
      icon: ShieldCheck,
      text: "Publish only if source revision or content hash still matches; stale work never replaces the current descriptor."
    }
  ] as const;

  type QueryScenario = {
    id: MaterialKind;
    label: string;
    question: string;
    match: string;
    facet: string;
    confidence: string;
    route: { tool: string; role: "text" | "material" | "native"; note: string }[];
    claim: string;
  };

  const QUERIES: QueryScenario[] = [
    {
      id: "csv",
      label: "RELEVANT DATA",
      question: "Do we have data that can explain regional response time?",
      match: "Field incidents",
      facet: "generated summary + deterministic profile",
      confidence: "INTERPRETED MATCH",
      route: [
        { tool: "retrieve_materials", role: "material", note: "find dataset meaning" },
        { tool: "inspect_dataset", role: "material", note: "choose columns / ranges" },
        { tool: "read_csv", role: "native", note: "read exact rows and values" }
      ],
      claim: "The dataset is relevant; exact response-time findings cite selected native rows."
    },
    {
      id: "table",
      label: "RELEVANT TABLE",
      question: "Is there a table comparing quarterly readiness?",
      match: "Quarterly readiness",
      facet: "generated summary + slide context",
      confidence: "INTERPRETED MATCH",
      route: [
        { tool: "retrieve_materials", role: "material", note: "find table meaning" },
        { tool: "inspect_slide", role: "material", note: "understand placement" },
        { tool: "read_table", role: "native", note: "read native cells" }
      ],
      claim: "The descriptor establishes relevance; the cell range establishes the comparison."
    },
    {
      id: "chart",
      label: "RELEVANT CHART",
      question: "Which chart contains the regional revenue series?",
      match: "Quarterly readiness",
      facet: "deterministic series profile + slide context",
      confidence: "INTERPRETED MATCH",
      route: [
        { tool: "retrieve_materials", role: "material", note: "find chart meaning" },
        { tool: "inspect_slide", role: "material", note: "understand placement" },
        { tool: "read_chart", role: "native", note: "isolate named series" }
      ],
      claim: "The profile routes the agent; the selected native chart series supports the value claim."
    },
    {
      id: "image",
      label: "RELEVANT IMAGE",
      question: "Is there a field image showing temporary safety barriers?",
      match: "North station installation",
      facet: "native visual vector + generated summary",
      confidence: "INTERPRETED MATCH",
      route: [
        { tool: "retrieve_materials", role: "material", note: "cross-modal search" },
        { tool: "view_slide", role: "material", note: "optional placement context" },
        { tool: "read_image", role: "native", note: "inspect original pixels" }
      ],
      claim: "The semantic hit proposes the image; the original pixels ground the description."
    },
    {
      id: "code",
      label: "RELEVANT CODE",
      question: "Where is discount-before-tax behavior implemented?",
      match: "pricing-engine.ts",
      facet: "symbol profile + generated summary",
      confidence: "INTERPRETED MATCH",
      route: [
        { tool: "retrieve_materials", role: "material", note: "find responsible module" },
        { tool: "inspect_code", role: "material", note: "choose exported symbol" },
        { tool: "read_code", role: "native", note: "read exact implementation" }
      ],
      claim: "The file summary routes the agent; exact code lines support the behavioral claim."
    }
  ];

  let activeQueryId = $state<MaterialKind>("csv");
  const activeQuery = $derived(QUERIES.find((query) => query.id === activeQueryId) ?? QUERIES[0]);

  const MATERIAL_SCHEMA = `type SemanticMaterialFields = {
  projectId: Id<"projects">;
  kind: "table" | "csv" | "chart" | "image" | "code";
  identityKey: string;
  name: string;
  source: MaterialSource;
  profile: MaterialProfile;
  profileHash: string;
  contextHash: string;
  revisionKey: string;
  userDescription?: string;
  descriptor?: GeneratedMaterialDescriptor;
  state: "ready"; // work-in-progress belongs to semanticMaterialJobs
  error?: string;
  updatedAt: number;
};`;

  const OBJECT_SCHEMA = `type SemanticObjectTarget =
  | {
      lane: "text";
      semanticSourceId: Id<"semanticSources">;
      span: SemanticSpan;
    }
  | {
      lane: "material";
      semanticMaterialId: Id<"semanticMaterials">;
      facet: "identity" | "profile" | "authored" |
             "generated" | "nativeVisual";
      facetText?: string;
      inputHash: string;
      scopeRefs?: ResourceRef[]; // authored/generated contributors
    };

// One embedding space, separate lane indexes.
// Text retrieval never accidentally returns a summary.`;

  const RETRIEVE_SCHEMA = `retrieve_materials({
  query: string;
  kinds?: MaterialKind[];
  topK?: number;
}) → {
  hits: [{
    evidenceId: string;
    evidenceKind: "interpreted";
    materialHandle: string;
    kind: MaterialKind;
    name: string;
    profile: MaterialProfileDigest;
    description?: MaterialDescription;
    matchedFacets: MaterialFacetKind[];
    source: MaterialSourceSnapshot;
    score: number;
  }];
}`;

  const LIVE_DIRECTORY = `representation/data/behavior/semantic/
├── projection/
│   ├── project-resource.ts
│   ├── writer.ts
│   └── resources/{document,presentation}.ts
└── materials/
    ├── profile.ts  csv.ts  code.ts
    ├── external-file.ts
    └── spreadsheet.ts

capabilities/semantic-overlay/api/
├── query-semantic-materials/
└── shared/
    ├── material-resource.ts
    ├── material-sync.ts
    ├── material-description.ts
    ├── material-facets.ts
    └── material-publication.ts`;

  const IMPLEMENTATION = [
    {
      status: "live",
      path: "representation/data/types/content/content-block.ts",
      symbols: "TableBlock · ImageBlock",
      note: "Documents and slides already share native tables and image references."
    },
    {
      status: "live",
      path: "representation/data/types/external/file.ts + store/tables.ts",
      symbols: "FileSubkind · ExternalFileFields",
      note: "Files persist name, media type, required subkind, storage ID, hash, and origin; readers consume that one current shape directly."
    },
    {
      status: "live",
      path: "model/server/embedding",
      symbols: "EmbeddingModel · jina-embeddings-v4",
      note: "Typed text, query, passage, batch-passage, token-field, and native image operations share one recorded vector space."
    },
    {
      status: "live",
      path: "representation/data/types/semantic/material.ts",
      symbols: "SemanticMaterial · MaterialProfile · SemanticMaterialFacet.scopeRefs",
      note: "Every material carries native authority and hashes; contextual facets also carry every contributing resource ref."
    },
    {
      status: "live",
      path: "capabilities/semantic-overlay/api/shared/material-*",
      symbols: "inventory · profile · describe · embed · publish",
      note: "A separately queued pipeline keeps native reads and expensive interpretation out of resource saves."
    },
    {
      status: "live",
      path: "capabilities/derived-output/api/shared/resource-reading.ts",
      symbols: "retrieve_materials · inspect_* · read_csv · read_code",
      note: "All sixteen discovery, traversal, context, and evidence tools are bounded and scope-injected."
    },
    {
      status: "deferred",
      path: "deployment adapters",
      symbols: "object store · slide renderer · streaming partitions",
      note: "These named seams are intentionally not presented as live production infrastructure."
    }
  ] as const;

  const DECISIONS = [
    ["One overlay, two lanes", "Keep project scope and embedding space shared; build separate text and material indexes so default retrieval stays exact."],
    ["Inventory broadly", "Register every first-class material cheaply. Generate deeper descriptors according to size, type, reuse, and demand."],
    ["Facets stay separate", "Name, deterministic profile, user description, generated summary, and native visual vector retain distinct provenance."],
    ["Hash once, place many", "Deduplicate an image or external file by content hash while retaining resource-specific placement context."],
    ["Context cannot widen scope", "Safe asset facets need one in-set source or placement; aggregate authored/generated facets require every contributor in-set."],
    ["Extraction is upstream", "Only call something a table after a deterministic extractor or user confirmation creates native structure."],
    ["Prompt output is excluded", "Generated Prompt Block responses never become source material or contextual input for this pipeline."]
  ] as const;
</script>

<svelte:head>
  <title>Semantic material layer — Icarus</title>
  <meta
    name="description"
    content="The implemented pipeline for discovering tables, CSV data, images, charts, and code through semantic material descriptors while retaining native evidence."
  />
</svelte:head>

<div class="material-page">
  <header class="local-nav">
    <a class="brand" href="/demo/semantic-overlay/resource-reading">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>SEMANTIC OVERLAY</span>
      <ArrowRight size={13} aria-hidden="true" />
      <strong>MATERIAL LAYER</strong>
    </a>
    <nav aria-label="Semantic material sections">
      <a href="#principle">principle</a>
      <a href="#materials">materials</a>
      <a href="#pipeline">pipeline</a>
      <a href="#lanes">lanes</a>
      <a href="#query">query</a>
      <a href="#evidence">evidence</a>
      <a href="#contract">contract</a>
      <a class="back-link" href="/demo/semantic-overlay/resource-reading">
        <ArrowLeft size={13} aria-hidden="true" /> resource reading
      </a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow"><Network size={15} aria-hidden="true" /> LIVE ARCHITECTURE / MULTIMODAL DISCOVERY</div>
        <h1>Search the <em>meaning.</em><br />Read the source.</h1>
        <p>
          Tables, CSV files, images, charts, and code need semantic handles before an agent knows
          they are relevant. Index their interpreted descriptions without pretending those
          descriptions are the native material.
        </p>
        <div class="hero-status">
          <span class="status-live">LIVE · exact text lane</span>
          <span class="status-live">LIVE · material lane</span>
        </div>
      </div>

      <div class="hero-machine" aria-label="Two semantic retrieval lanes">
        <div class="query-beam"><Search size={17} aria-hidden="true" /><span>QUESTION</span><strong>What in this project is relevant?</strong></div>
        <div class="machine-split"><i></i><span>ROUTE BY INTENT</span><i></i></div>
        <div class="machine-lanes">
          <article class="text-lane">
            <header><FileText size={19} aria-hidden="true" /><span>EXACT TEXT</span></header>
            <strong>retrieve</strong>
            <p>semantic spans with verbatim text</p>
            <small>DEFAULT · CITABLE</small>
          </article>
          <article class="material-lane">
            <header><Sparkles size={19} aria-hidden="true" /><span>SEMANTIC MATERIAL</span></header>
            <strong>retrieve_materials</strong>
            <p>meaning profiles for non-prose sources</p>
            <small>EXPLICIT · INTERPRETED</small>
          </article>
        </div>
        <div class="source-floor"><Database size={16} aria-hidden="true" /><span>SAME PROJECT SCOPE · SAME VECTOR DIMENSIONS · DIFFERENT INDEX ROOTS</span></div>
      </div>
    </section>

    <section id="principle" class="section principle-section">
      <header class="section-heading">
        <div><span>01 / LOAD-BEARING PRINCIPLE</span><h2>Interpretation is searchable.<br />Authority stays attached.</h2></div>
        <p>
          A summary is useful precisely because it says what raw rows or pixels cannot say cheaply.
          Its provenance and limits must therefore travel with every hit.
        </p>
      </header>

      <div class="principle-rule">
        <article>
          <span>INDEX</span><Sparkles size={25} aria-hidden="true" /><strong>semantic descriptor</strong>
          <p>Purpose, entities, measures, themes, and likely relevance.</p>
        </article>
        <div class="not-equal"><i></i><strong>≠</strong><small>DOES NOT REPLACE</small><i></i></div>
        <article>
          <span>RETAIN</span><Fingerprint size={25} aria-hidden="true" /><strong>native authority</strong>
          <p>Exact cells, bytes, code ranges, chart series, or original pixels.</p>
        </article>
      </div>

      <div class="claim-policy">
        <ShieldCheck size={20} aria-hidden="true" />
        <div><span>CLAIM POLICY</span><strong>A broad descriptor can ground a broad relevance claim. Exact claims require a native read.</strong></div>
        <code>interpreted → read_* → native</code>
      </div>
    </section>

    <section id="materials" class="section materials-section">
      <header class="section-heading compact-heading">
        <div><span>02 / MATERIAL ANATOMY</span><h2>One identity.<br />Several honest facets.</h2></div>
        <p>
          Select a material to inspect the same live contract across raw files and authored
          content. Facets remain separate so retrieval can report what actually matched.
        </p>
      </header>

      <div class="material-tabs" role="tablist" aria-label="Semantic material examples">
        {#each MATERIALS as material (material.id)}
          {@const MaterialIcon = material.icon}
          <button
            type="button"
            role="tab"
            aria-selected={activeMaterialId === material.id}
            aria-controls="material-specimen"
            class:active={activeMaterialId === material.id}
            onclick={() => (activeMaterialId = material.id)}
          >
            <MaterialIcon size={18} aria-hidden="true" />
            <span>{material.label}</span>
            <small>{material.name}</small>
          </button>
        {/each}
      </div>

      <div id="material-specimen" class="material-specimen" role="tabpanel">
        <aside class="identity-card">
          <div class="identity-icon"><ActiveMaterialIcon size={34} aria-hidden="true" /></div>
          <span>MATERIAL IDENTITY</span>
          <h3>{activeMaterial.name}</h3>
          <code>{activeMaterial.origin}</code>
          <dl>
            <div><dt>kind</dt><dd>{activeMaterial.id}</dd></div>
            <div><dt>name</dt><dd>{activeMaterial.name}</dd></div>
            <div><dt>native reader</dt><dd><code>{activeMaterial.reader}</code></dd></div>
          </dl>
        </aside>

        <div class="material-record">
          <div class="record-row profile-row">
            <header><ChartNoAxesColumn size={18} aria-hidden="true" /><span>DETERMINISTIC PROFILE</span><small>NO MODEL</small></header>
            <div>{#each activeMaterial.profile as item (item)}<code>{item}</code>{/each}</div>
          </div>
          <div class="record-row context-row">
            <header><Layers3 size={18} aria-hidden="true" /><span>CONTEXT ENVELOPE</span><small>BOUNDED</small></header>
            <ul>{#each activeMaterial.context as item (item)}<li><ChevronRight size={12} aria-hidden="true" />{item}</li>{/each}</ul>
          </div>
          <div class="record-row summary-row">
            <header><Sparkles size={18} aria-hidden="true" /><span>GENERATED SUMMARY</span><small>INTERPRETED</small></header>
            <blockquote>“{activeMaterial.summary}”</blockquote>
          </div>
        </div>

        <aside class="facet-stack">
          <header><Tags size={18} aria-hidden="true" /><span>SEARCHABLE FACETS</span></header>
          {#each activeMaterial.facets as facet (facet.name)}
            <article class="facet-{facet.state}">
              <span>{facet.state}</span><strong>{facet.name}</strong><small>{facet.provenance}</small>
            </article>
          {/each}
          <div class="native-exit"><ArrowRight size={15} aria-hidden="true" /><span>CONFIRM WITH</span><code>{activeMaterial.reader}</code></div>
        </aside>
      </div>

      <div class="granularity-note">
        <CircleDot size={16} aria-hidden="true" /><span>GRANULARITY</span><p>{activeMaterial.granularity}</p>
      </div>
    </section>

    <section id="pipeline" class="section pipeline-section">
      <header class="section-heading">
        <div><span>03 / MATERIAL PIPELINE</span><h2>Profile first.<br />Generate only what adds meaning.</h2></div>
        <p>
          Resource acceptance stays fast. Material work is content-addressed, queued, revision
          checked, and independently retryable. A failed summary never blocks exact text indexing.
        </p>
      </header>

      <div class="pipeline-track">
        {#each PIPELINE as step, index (step.name)}
          {@const StepIcon = step.icon}
          <article>
            <div class="step-top"><span>{step.number}</span><small class="status-{step.status}">{step.status}</small></div>
            <StepIcon size={23} aria-hidden="true" />
            <code>{step.name}</code>
            <p>{step.text}</p>
          </article>
          {#if index < PIPELINE.length - 1}<ArrowRight class="pipeline-arrow" size={17} aria-hidden="true" />{/if}
        {/each}
      </div>

      <div class="pipeline-rails">
        <article><RefreshCw size={18} aria-hidden="true" /><div><span>FRESHNESS KEY</span><strong>resource revision or immutable content hash</strong><small>late work is discarded before publication</small></div></article>
        <article><Fingerprint size={18} aria-hidden="true" /><div><span>REUSE KEY</span><strong>facet kind + input hash · descriptor policy identity</strong><small>unchanged text/native vectors survive placement-context updates</small></div></article>
        <article><ChartNoAxesColumn size={18} aria-hidden="true" /><div><span>COST POLICY</span><strong>inventory all · profile all · describe selectively</strong><small>no per-row, per-cell, or automatic per-slide summaries</small></div></article>
      </div>
    </section>

    <section id="lanes" class="section lanes-section">
      <header class="section-heading">
        <div><span>04 / OVERLAY TOPOLOGY</span><h2>Shared space.<br />Separate retrieval lanes.</h2></div>
        <p>
          Mixing every vector in one tree would let generated summaries alter exact-text recall.
          Separate roots preserve behavior while still using the same query vector and Resource Set.
        </p>
      </header>

      <div class="lane-map">
        <div class="lane-query"><Search size={21} aria-hidden="true" /><span>embedQuery(text)</span><small>one 512-dimensional query vector</small></div>
        <div class="lane-branch"><i></i><strong>INTENT</strong><i></i></div>
        <div class="lane-columns">
          <article class="exact-index">
            <header><FileText size={20} aria-hidden="true" /><div><span>INDEX LANE · TEXT</span><strong>exact semantic objects</strong></div><small>LIVE</small></header>
            <div class="index-nodes"><b></b><b></b><b></b><b></b><b></b><b></b><b></b></div>
            <dl><div><dt>objects</dt><dd>source spans</dd></div><div><dt>query</dt><dd><code>retrieve</code></dd></div><div><dt>result</dt><dd>verbatim evidence</dd></div></dl>
          </article>
          <article class="material-index">
            <header><Sparkles size={20} aria-hidden="true" /><div><span>INDEX LANE · MATERIAL</span><strong>grouped material facets</strong></div><small>LIVE</small></header>
            <div class="index-nodes"><b></b><b></b><b></b><b></b><b></b><b></b><b></b></div>
            <dl><div><dt>objects</dt><dd>profile / summary / visual facets</dd></div><div><dt>query</dt><dd><code>retrieve_materials</code></dd></div><div><dt>result</dt><dd>interpreted evidence</dd></div></dl>
          </article>
        </div>
        <div class="scope-floor"><ShieldCheck size={17} aria-hidden="true" /><span>Both lanes enforce the same project scope, Resource Set eligibility, vector dimensions, and attempt budget.</span></div>
        <div class="facet-scope-gate" aria-label="Shared material facet scope rules">
          <article class="safe-facets">
            <Fingerprint size={19} aria-hidden="true" />
            <div><span>SAFE ASSET FACETS</span><strong>identity · profile · native visual</strong><small>eligible through any in-set source or placement</small></div>
            <code>ANY(source, placement) ∈ set</code>
          </article>
          <div class="scope-divider"><span>ONE IDENTITY</span><i></i><strong>FACET GATE</strong><i></i></div>
          <article class="contextual-facets">
            <Layers3 size={19} aria-hidden="true" />
            <div><span>AGGREGATE CONTEXT</span><strong>authored · generated</strong><small>every contributing ref is persisted as scopeRefs</small></div>
            <code>ALL(scopeRefs) ∈ set</code>
          </article>
        </div>
      </div>
    </section>

    <section id="query" class="section query-section">
      <header class="section-heading compact-heading">
        <div><span>05 / RETRIEVAL WORKBENCH</span><h2>Find relevance.<br />Then resolve precision.</h2></div>
        <p>
          These routes show why material retrieval does not eliminate specialized readers. It gets
          the agent to the right native object with an honest statement of what matched.
        </p>
      </header>

      <div class="query-tabs" role="tablist" aria-label="Material retrieval questions">
        {#each QUERIES as query (query.id)}
          <button type="button" role="tab" aria-selected={activeQueryId === query.id} class:active={activeQueryId === query.id} onclick={() => (activeQueryId = query.id)}>
            <span>{query.label}</span><small>{query.question}</small>
          </button>
        {/each}
      </div>

      <div class="query-console" role="tabpanel">
        <div class="question-card"><span>QUESTION</span><blockquote>“{activeQuery.question}”</blockquote></div>
        <ArrowRight class="console-arrow" size={20} aria-hidden="true" />
        <div class="hit-card">
          <header><Sparkles size={18} aria-hidden="true" /><span>MATERIAL HIT</span><small>{activeQuery.confidence}</small></header>
          <strong>{activeQuery.match}</strong>
          <p>matched: {activeQuery.facet}</p>
          <code>evidenceKind: interpreted</code>
        </div>
      </div>

      <div class="query-route">
        {#each activeQuery.route as step, index (`${activeQuery.id}-${step.tool}`)}
          <article class="route-{step.role}"><span>0{index + 1}</span><code>{step.tool}</code><small>{step.note}</small></article>
          {#if index < activeQuery.route.length - 1}<ChevronRight size={17} aria-hidden="true" />{/if}
        {/each}
        <div class="route-claim"><Check size={16} aria-hidden="true" /><p>{activeQuery.claim}</p></div>
      </div>
    </section>

    <section id="evidence" class="section evidence-section">
      <header class="section-heading">
        <div><span>06 / EVIDENCE DISTANCE</span><h2>Show how far the claim<br />sits from the source.</h2></div>
        <p>
          “Inferred” should not be one vague badge. The evidence record states whether the model saw
          exact text, native structure, original pixels, or a generated descriptor.
        </p>
      </header>

      <div class="evidence-ruler">
        <article class="distance-zero"><span>00</span><FileText size={21} aria-hidden="true" /><strong>VERBATIM TEXT</strong><p>Exact source range; directly quotable.</p><code>retrieve · read_text · read_code</code></article>
        <article class="distance-one"><span>01</span><Table2 size={21} aria-hidden="true" /><strong>NATIVE MATERIAL</strong><p>Bounded cells, series, rows, or content-addressed pixels; the response interprets them.</p><code>read_table · read_csv · read_chart · read_image</code></article>
        <article class="distance-two"><span>02</span><Sparkles size={21} aria-hidden="true" /><strong>DERIVED DESCRIPTOR</strong><p>Model-generated meaning with source, inputs, model, and prompt version attached.</p><code>retrieve_materials</code></article>
        <article class="distance-three"><span>—</span><Eye size={21} aria-hidden="true" /><strong>SUPPORTING CONTEXT</strong><p>Placement, ordering, manifest, or composite rendering; never selectable as evidence.</p><code>list_* · inspect_* · view_*</code></article>
      </div>

      <div class="evidence-guidance">
        <div><span>ALLOWED</span><p>“The project contains a dataset about regional incident response.”</p><small>descriptor evidence is proportionate</small></div>
        <div><span>REQUIRES NATIVE READ</span><p>“Median response time in the Northeast was 18.4 minutes.”</p><small>read the exact CSV selection</small></div>
      </div>
    </section>

    <section id="contract" class="section contract-section">
      <header class="section-heading">
        <div><span>07 / STORAGE + API CONTRACT</span><h2>Make every future type<br />a narrow adapter.</h2></div>
        <p>
          The core contract does not care whether a material originated in a document, presentation,
          spreadsheet, upload, or connector. Origin-specific adapters only inventory and read it.
        </p>
      </header>

      <div class="schema-wall">
        <article><header><Database size={18} aria-hidden="true" /><span>MATERIAL RECORD</span></header><pre><code>{MATERIAL_SCHEMA}</code></pre></article>
        <article><header><Network size={18} aria-hidden="true" /><span>INDEX CONTRACT</span></header><pre><code>{OBJECT_SCHEMA}</code></pre></article>
        <article><header><Search size={18} aria-hidden="true" /><span>RETRIEVAL TOOL</span></header><pre><code>{RETRIEVE_SCHEMA}</code></pre></article>
        <article><header><Braces size={18} aria-hidden="true" /><span>LIVE DIRECTORY</span></header><pre><code>{LIVE_DIRECTORY}</code></pre></article>
      </div>

      <div class="implementation-ledger">
        <header><span>CHANGE SURFACE</span><strong>What runs and what remains adapter work</strong></header>
        {#each IMPLEMENTATION as item (item.path)}
          <article>
            <small class="status-{item.status}">{item.status}</small>
            <code>{item.path}</code>
            <strong>{item.symbols}</strong>
            <p>{item.note}</p>
          </article>
        {/each}
      </div>
    </section>

    <section class="decisions-section">
      <header><span>08 / ACCEPTANCE DECISIONS</span><h2>The plug-in rules.</h2></header>
      <div class="decision-grid">
        {#each DECISIONS as decision, index (decision[0])}
          <article><span>0{index + 1}</span><strong>{decision[0]}</strong><p>{decision[1]}</p></article>
        {/each}
      </div>
      <div class="final-call">
        <div><Check size={25} aria-hidden="true" /></div>
        <section><span>IMPLEMENTED ALIGNMENT</span><h2>Semantic descriptors make materials findable. Native readers keep answers honest.</h2><p>The full vertical slice now runs; the next work is deployment hardening, production rendering/uploads, and partitioned large-file adapters.</p></section>
        <a href="/demo/semantic-overlay/resource-reading">Return to resource reading <ArrowRight size={15} aria-hidden="true" /></a>
      </div>
    </section>
  </main>

  <footer class="page-footer">
    <span>SEMANTIC OVERLAY / MATERIAL LAYER</span>
    <span>live architecture · executable contracts with named deferred adapters</span>
  </footer>
</div>

<style>
  :global(body) { margin: 0; }
  :global(*) { box-sizing: border-box; }
  :global(html) { scroll-behavior: smooth; }

  .material-page {
    --ground: var(--token-surface-canvas);
    --raised: var(--token-surface-elevated);
    --panel: var(--token-surface-panel);
    --work: var(--token-surface-work);
    --ink: var(--token-ink-primary);
    --secondary: var(--token-ink-secondary);
    --muted: var(--token-ink-muted);
    --line: var(--token-border-subtle);
    --line-strong: var(--token-border-strong);
    --exact: var(--token-color-active-text);
    --exact-surface: var(--token-color-active-surface);
    --exact-border: var(--token-color-active-border);
    --material: var(--token-color-intelligence-text);
    --material-surface: var(--token-color-intelligence-surface);
    --material-border: var(--token-color-intelligence-border);
    --native: var(--token-color-success-text);
    --native-surface: var(--token-color-success-surface);
    --native-border: var(--token-color-success-border);
    --attention: var(--token-color-attention-text);
    --attention-surface: var(--token-color-attention-surface);
    --attention-border: var(--token-color-attention-border);
    min-height: 100vh;
    background:
      radial-gradient(circle at 78% 11%, color-mix(in srgb, var(--material) 9%, transparent), transparent 24rem),
      radial-gradient(circle at 17% 37%, color-mix(in srgb, var(--exact) 6%, transparent), transparent 30rem),
      var(--token-atmosphere), var(--ground);
    color: var(--ink);
  }

  .local-nav {
    position: sticky; z-index: 20; top: 2.75rem; display: flex; min-height: 3.6rem;
    align-items: center; justify-content: space-between; gap: 2rem; padding: 0 2rem;
    border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--ground) 90%, transparent);
    backdrop-filter: blur(18px);
  }
  .brand, .local-nav nav, .back-link, .eyebrow, .hero-status, .query-beam,
  .source-floor, .principle-rule article, .claim-policy, .material-tabs button,
  .record-row header, .facet-stack > header, .native-exit, .granularity-note,
  .pipeline-rails article, .lane-query, .lane-columns article > header, .scope-floor,
  .hit-card header, .route-claim, .schema-wall article > header, .implementation-ledger > header,
  .final-call, .final-call a, .page-footer { display: flex; align-items: center; }
  .brand { gap: 0.45rem; color: var(--secondary); font: 0.62rem var(--token-font-mono); letter-spacing: 0.1em; text-decoration: none; }
  .brand strong { color: var(--material); font-weight: 500; }
  .brand-mark { width: 0.65rem; height: 0.65rem; border: 2px solid var(--material); border-radius: 50%; }
  .local-nav nav { gap: 1.05rem; }
  .local-nav nav a { color: var(--muted); font-size: 0.7rem; text-decoration: none; }
  .local-nav nav a:hover { color: var(--ink); }
  .local-nav .back-link { gap: 0.35rem; color: var(--material); font-weight: 600; }

  main, .page-footer { width: min(100% - 3rem, 92rem); margin-inline: auto; }
  .hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(31rem, 0.9fr); gap: 5rem; align-items: center; min-height: 45rem; padding: 6rem 0; }
  .eyebrow { gap: 0.5rem; color: var(--material); font: 0.65rem var(--token-font-mono); letter-spacing: 0.11em; }
  .hero h1 { max-width: 12ch; margin: 1.25rem 0 1.5rem; font: 400 clamp(3.8rem, 7.4vw, 7.2rem)/0.9 var(--token-font-reading); letter-spacing: -0.06em; }
  .hero h1 em { color: var(--material); font-weight: 400; }
  .hero-copy > p { max-width: 62ch; margin: 0; color: var(--secondary); font-size: 1.02rem; line-height: 1.7; }
  .hero-status { gap: 0.6rem; margin-top: 2rem; }
  .hero-status span, [class^="status-"] { padding: 0.27rem 0.45rem; border: 1px solid; font: 0.51rem var(--token-font-mono); letter-spacing: 0.08em; text-transform: uppercase; }
  .status-live { border-color: var(--native-border) !important; background: var(--native-surface); color: var(--native); }
  .status-target { border-color: var(--material-border) !important; background: var(--material-surface); color: var(--material); }
  .status-extended { border-color: var(--attention-border) !important; background: var(--attention-surface); color: var(--attention); }
  .status-deferred { border-color: var(--attention-border) !important; background: var(--attention-surface); color: var(--attention); }

  .hero-machine { padding: 1rem; border: 1px solid var(--line-strong); background: color-mix(in srgb, var(--raised) 93%, transparent); box-shadow: 1rem 1rem 0 color-mix(in srgb, var(--material) 7%, transparent); }
  .query-beam { gap: 0.7rem; padding: 1rem; border: 1px solid var(--line); background: var(--panel); }
  .query-beam > :global(svg) { color: var(--material); }
  .query-beam span { color: var(--muted); font: 0.54rem var(--token-font-mono); letter-spacing: 0.1em; }
  .query-beam strong { margin-left: auto; font: 400 0.84rem var(--token-font-reading); }
  .machine-split, .lane-branch { display: flex; align-items: center; gap: 0.65rem; padding: 0.75rem 2.5rem; }
  .machine-split i, .lane-branch i { height: 1.5rem; flex: 1; border-bottom: 1px solid var(--line); }
  .machine-split i:first-child, .lane-branch i:first-child { border-right: 1px solid var(--line); transform: skewX(-35deg); }
  .machine-split i:last-child, .lane-branch i:last-child { border-left: 1px solid var(--line); transform: skewX(35deg); }
  .machine-split span, .lane-branch strong { color: var(--muted); font: 0.49rem var(--token-font-mono); letter-spacing: 0.1em; }
  .machine-lanes { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .machine-lanes article { min-height: 12rem; padding: 1.2rem; border: 1px solid; }
  .machine-lanes article header { display: flex; align-items: center; gap: 0.55rem; font: 0.55rem var(--token-font-mono); letter-spacing: 0.09em; }
  .machine-lanes article strong { display: block; margin: 2.4rem 0 0.45rem; font: 500 0.82rem var(--token-font-mono); }
  .machine-lanes article p { margin: 0; color: var(--secondary); font-size: 0.68rem; }
  .machine-lanes article small { display: block; margin-top: 1rem; font: 0.5rem var(--token-font-mono); letter-spacing: 0.08em; }
  .text-lane { border-color: var(--exact-border) !important; background: var(--exact-surface); }
  .text-lane header, .text-lane strong, .text-lane small { color: var(--exact); }
  .material-lane { border-color: var(--material-border) !important; background: var(--material-surface); }
  .material-lane header, .material-lane strong, .material-lane small { color: var(--material); }
  .source-floor { justify-content: center; gap: 0.55rem; margin-top: 0.75rem; padding: 0.7rem; border: 1px dashed var(--line-strong); color: var(--muted); font: 0.49rem var(--token-font-mono); letter-spacing: 0.07em; text-align: center; }

  .section { padding: 6.5rem 0; border-top: 1px solid var(--line); scroll-margin-top: 7rem; }
  .section-heading { display: grid; grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.58fr); gap: 5rem; align-items: end; margin-bottom: 3rem; }
  .section-heading > div > span, .identity-card > span, .record-row header span,
  .facet-stack > header span, .claim-policy span, .pipeline-rails span, .lane-query span,
  .lane-columns header span, .question-card > span, .hit-card header span,
  .schema-wall header span, .implementation-ledger > header span, .decisions-section > header span,
  .final-call section > span { font: 0.57rem var(--token-font-mono); letter-spacing: 0.1em; }
  .section-heading > div > span, .decisions-section > header span { color: var(--material); }
  .section-heading h2, .decisions-section h2 { margin: 0.7rem 0 0; font: 400 clamp(2.6rem, 5vw, 4.7rem)/0.94 var(--token-font-reading); letter-spacing: -0.045em; }
  .section-heading > p { margin: 0; color: var(--secondary); font-size: 0.88rem; line-height: 1.65; }

  .principle-rule { display: grid; grid-template-columns: 1fr 8rem 1fr; align-items: stretch; }
  .principle-rule article { display: grid; grid-template-columns: auto 1fr; gap: 0.45rem 1rem; min-height: 15rem; padding: 2rem; border: 1px solid var(--line-strong); background: var(--raised); }
  .principle-rule article > span { grid-column: 1 / -1; color: var(--muted); font: 0.54rem var(--token-font-mono); letter-spacing: 0.1em; }
  .principle-rule article > :global(svg) { color: var(--material); }
  .principle-rule article strong { align-self: center; font: 400 1.5rem var(--token-font-reading); }
  .principle-rule article p { grid-column: 1 / -1; align-self: end; margin: 0; color: var(--secondary); font-size: 0.77rem; line-height: 1.55; }
  .not-equal { display: grid; place-items: center; color: var(--material); }
  .not-equal i { width: 1px; height: 2.5rem; background: var(--line-strong); }
  .not-equal strong { font: 400 2rem var(--token-font-reading); }
  .not-equal small { writing-mode: vertical-rl; color: var(--muted); font: 0.48rem var(--token-font-mono); letter-spacing: 0.08em; }
  .claim-policy { gap: 1rem; margin-top: 1rem; padding: 1.1rem 1.3rem; border: 1px solid var(--material-border); background: var(--material-surface); }
  .claim-policy > :global(svg) { color: var(--material); }
  .claim-policy > div { flex: 1; }
  .claim-policy span { color: var(--material); }
  .claim-policy strong { display: block; margin-top: 0.3rem; font-size: 0.83rem; }
  .claim-policy > code { color: var(--material); font-size: 0.68rem; }

  .material-tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; border: 1px solid var(--line-strong); background: var(--line); }
  .material-tabs button { min-width: 0; gap: 0.65rem; min-height: 5rem; padding: 1rem; border: 0; background: var(--raised); color: var(--muted); text-align: left; cursor: pointer; }
  .material-tabs button span { color: var(--secondary); font: 0.56rem var(--token-font-mono); letter-spacing: 0.08em; }
  .material-tabs button small { min-width: 0; margin-left: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.59rem; }
  .material-tabs button.active { background: var(--material-surface); color: var(--material); box-shadow: inset 0 -2px var(--material); }
  .material-tabs button.active span { color: var(--material); }
  .material-specimen { display: grid; grid-template-columns: minmax(14rem, 0.65fr) minmax(24rem, 1.35fr) minmax(15rem, 0.7fr); gap: 1px; min-height: 31rem; margin-top: 1rem; border: 1px solid var(--line-strong); background: var(--line); }
  .material-specimen > * { background: color-mix(in srgb, var(--raised) 95%, transparent); }
  .identity-card { padding: 1.5rem; }
  .identity-icon { display: grid; width: 5rem; height: 5rem; place-items: center; margin-bottom: 3rem; border: 1px solid var(--material-border); background: var(--material-surface); color: var(--material); }
  .identity-card > span { color: var(--material); }
  .identity-card h3 { margin: 0.55rem 0 0.4rem; font: 400 1.65rem/1.05 var(--token-font-reading); }
  .identity-card > code { color: var(--muted); font-size: 0.58rem; }
  .identity-card dl { display: grid; gap: 0.7rem; margin: 3rem 0 0; }
  .identity-card dl div { display: grid; grid-template-columns: 6rem 1fr; gap: 0.5rem; padding-top: 0.65rem; border-top: 1px solid var(--line); }
  .identity-card dt { color: var(--muted); font: 0.52rem var(--token-font-mono); text-transform: uppercase; }
  .identity-card dd { margin: 0; color: var(--secondary); font-size: 0.67rem; overflow-wrap: anywhere; }
  .material-record { display: grid; grid-template-rows: auto auto 1fr; gap: 1px; background: var(--line); }
  .record-row { padding: 1.3rem; background: var(--panel); }
  .record-row header { gap: 0.5rem; color: var(--secondary); }
  .record-row header > :global(svg) { color: var(--material); }
  .record-row header small { margin-left: auto; color: var(--muted); font: 0.5rem var(--token-font-mono); }
  .profile-row > div { display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 1rem; }
  .profile-row code { padding: 0.4rem 0.55rem; border: 1px solid var(--exact-border); background: var(--exact-surface); color: var(--exact); font-size: 0.62rem; }
  .context-row ul { display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem 1.5rem; margin: 1rem 0 0; padding: 0; list-style: none; }
  .context-row li { display: flex; gap: 0.35rem; align-items: center; color: var(--secondary); font-size: 0.67rem; }
  .context-row li :global(svg) { color: var(--muted); }
  .summary-row { display: grid; align-content: start; background: var(--material-surface); }
  .summary-row blockquote { max-width: 38ch; margin: 2rem 0 0; color: var(--ink); font: italic 400 1.35rem/1.45 var(--token-font-reading); }
  .facet-stack { padding: 1.3rem; }
  .facet-stack > header { gap: 0.5rem; margin-bottom: 1rem; color: var(--material); }
  .facet-stack article { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 0.65rem; margin-top: 0.55rem; padding: 0.8rem; border: 1px solid var(--line); background: var(--panel); }
  .facet-stack article > span { padding: 0.14rem 0.3rem; border: 1px solid; font: 0.45rem var(--token-font-mono); text-transform: uppercase; }
  .facet-stack article strong { font: 500 0.68rem var(--token-font-mono); }
  .facet-stack article small { grid-column: 2; color: var(--muted); font-size: 0.56rem; line-height: 1.4; }
  .facet-exact > span { border-color: var(--exact-border) !important; color: var(--exact); }
  .facet-authored > span { border-color: var(--attention-border) !important; color: var(--attention); }
  .facet-inferred > span { border-color: var(--material-border) !important; color: var(--material); }
  .facet-native > span { border-color: var(--native-border) !important; color: var(--native); }
  .native-exit { gap: 0.5rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--line); color: var(--native); }
  .native-exit span { color: var(--muted); font: 0.48rem var(--token-font-mono); letter-spacing: 0.07em; }
  .native-exit code { margin-left: auto; font-size: 0.65rem; }
  .granularity-note { gap: 0.6rem; margin-top: 0.75rem; color: var(--muted); }
  .granularity-note > :global(svg) { color: var(--material); }
  .granularity-note span { font: 0.51rem var(--token-font-mono); letter-spacing: 0.09em; }
  .granularity-note p { margin: 0; color: var(--secondary); font-size: 0.67rem; }

  .pipeline-track { display: grid; grid-template-columns: repeat(11, minmax(0, auto)); align-items: center; overflow-x: auto; padding-bottom: 0.5rem; }
  .pipeline-track article { width: 12.7rem; min-height: 19rem; padding: 1.2rem; border: 1px solid var(--line-strong); background: var(--raised); }
  .step-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .step-top > span { color: var(--muted); font: 0.56rem var(--token-font-mono); }
  .pipeline-track article > :global(svg) { display: block; margin: 2.4rem 0 1.1rem; color: var(--material); }
  .pipeline-track article > code { color: var(--material); font-size: 0.65rem; overflow-wrap: anywhere; }
  .pipeline-track article > p { margin: 1rem 0 0; color: var(--secondary); font-size: 0.67rem; line-height: 1.55; }
  .pipeline-track > :global(.pipeline-arrow) { margin: 0 0.55rem; flex: 0 0 auto; color: var(--material); }
  .pipeline-rails { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin-top: 1.2rem; border: 1px solid var(--line); background: var(--line); }
  .pipeline-rails article { align-items: flex-start; gap: 0.8rem; padding: 1rem; background: var(--panel); }
  .pipeline-rails article > :global(svg) { flex: 0 0 auto; color: var(--material); }
  .pipeline-rails span { color: var(--muted); }
  .pipeline-rails strong { display: block; margin-top: 0.3rem; font-size: 0.71rem; }
  .pipeline-rails small { display: block; margin-top: 0.25rem; color: var(--muted); font-size: 0.59rem; }

  .lane-map { padding: 1.4rem; border: 1px solid var(--line-strong); background: color-mix(in srgb, var(--raised) 94%, transparent); }
  .lane-query { justify-content: center; gap: 0.7rem; padding: 1rem; border: 1px solid var(--line); background: var(--panel); }
  .lane-query > :global(svg) { color: var(--material); }
  .lane-query span { color: var(--ink); }
  .lane-query small { color: var(--muted); font-size: 0.58rem; }
  .lane-branch { max-width: 45rem; margin: auto; }
  .lane-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .lane-columns > article { padding: 1.3rem; border: 1px solid; }
  .lane-columns article > header { gap: 0.65rem; }
  .lane-columns header > div { flex: 1; }
  .lane-columns header span { color: var(--muted); }
  .lane-columns header strong { display: block; margin-top: 0.2rem; font: 400 1rem var(--token-font-reading); }
  .lane-columns header > small { padding: 0.2rem 0.35rem; border: 1px solid; font: 0.48rem var(--token-font-mono); }
  .exact-index { border-color: var(--exact-border) !important; background: var(--exact-surface); }
  .exact-index header > :global(svg), .exact-index header > small { color: var(--exact); }
  .material-index { border-color: var(--material-border) !important; background: var(--material-surface); }
  .material-index header > :global(svg), .material-index header > small { color: var(--material); }
  .index-nodes { position: relative; display: flex; justify-content: space-around; align-items: end; height: 8rem; margin: 1.5rem 0; border-bottom: 1px solid var(--line-strong); }
  .index-nodes::before { position: absolute; top: 1rem; left: 50%; width: 58%; height: 4rem; border: solid var(--line-strong); border-width: 1px 1px 0; content: ""; transform: translateX(-50%); }
  .index-nodes b { z-index: 1; display: block; width: 0.75rem; height: 0.75rem; border: 1px solid currentColor; border-radius: 50%; background: var(--raised); }
  .index-nodes b:nth-child(1) { position: absolute; top: 0.65rem; left: calc(50% - 0.4rem); width: 1rem; height: 1rem; }
  .exact-index .index-nodes { color: var(--exact); }
  .material-index .index-nodes { color: var(--material); }
  .lane-columns dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin: 0; }
  .lane-columns dl div { padding-top: 0.65rem; border-top: 1px solid var(--line); }
  .lane-columns dt { color: var(--muted); font: 0.49rem var(--token-font-mono); text-transform: uppercase; }
  .lane-columns dd { margin: 0.3rem 0 0; color: var(--secondary); font-size: 0.62rem; }
  .scope-floor { justify-content: center; gap: 0.55rem; margin-top: 1rem; padding: 0.85rem; border: 1px dashed var(--line-strong); color: var(--secondary); font-size: 0.62rem; text-align: center; }
  .scope-floor > :global(svg) { color: var(--native); }
  .facet-scope-gate { display: grid; grid-template-columns: 1fr 7rem 1fr; align-items: stretch; margin-top: 0.75rem; }
  .facet-scope-gate article { display: grid; grid-template-columns: auto 1fr; gap: 0.35rem 0.75rem; align-items: start; padding: 1.15rem; border: 1px solid; background: var(--panel); }
  .facet-scope-gate article > :global(svg) { grid-row: 1 / 3; margin-top: 0.1rem; }
  .facet-scope-gate article span { font: 0.5rem var(--token-font-mono); letter-spacing: 0.09em; }
  .facet-scope-gate article strong { display: block; margin-top: 0.25rem; font: 400 0.95rem var(--token-font-reading); }
  .facet-scope-gate article small { display: block; margin-top: 0.3rem; color: var(--muted); font-size: 0.58rem; line-height: 1.4; }
  .facet-scope-gate article > code { grid-column: 2; margin-top: 0.8rem; font-size: 0.59rem; overflow-wrap: anywhere; }
  .safe-facets { border-color: var(--native-border) !important; }
  .safe-facets > :global(svg), .safe-facets span, .safe-facets > code { color: var(--native); }
  .contextual-facets { border-color: var(--material-border) !important; background: var(--material-surface) !important; }
  .contextual-facets > :global(svg), .contextual-facets span, .contextual-facets > code { color: var(--material); }
  .scope-divider { display: grid; place-items: center; align-content: center; gap: 0.45rem; color: var(--muted); text-align: center; }
  .scope-divider span, .scope-divider strong { font: 0.47rem var(--token-font-mono); letter-spacing: 0.08em; }
  .scope-divider strong { color: var(--material); }
  .scope-divider i { width: 1px; height: 1.25rem; background: var(--line-strong); }

  .query-tabs { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid var(--line-strong); background: var(--line); gap: 1px; }
  .query-tabs button { min-height: 7rem; padding: 1rem; border: 0; background: var(--raised); color: var(--muted); text-align: left; cursor: pointer; }
  .query-tabs button span { display: block; color: var(--secondary); font: 0.54rem var(--token-font-mono); letter-spacing: 0.08em; }
  .query-tabs button small { display: block; margin-top: 1.2rem; font-size: 0.64rem; line-height: 1.4; }
  .query-tabs button.active { background: var(--material-surface); box-shadow: inset 0 -2px var(--material); }
  .query-tabs button.active span { color: var(--material); }
  .query-console { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center; margin-top: 1rem; padding: 1.4rem; border: 1px solid var(--line-strong); background: var(--panel); }
  .question-card, .hit-card { min-height: 12rem; padding: 1.2rem; border: 1px solid var(--line); background: var(--raised); }
  .question-card > span { color: var(--muted); }
  .question-card blockquote { margin: 2rem 0 0; font: italic 400 1.2rem/1.4 var(--token-font-reading); }
  .console-arrow { color: var(--material); }
  .hit-card { border-color: var(--material-border); background: var(--material-surface); }
  .hit-card header { gap: 0.5rem; color: var(--material); }
  .hit-card header small { margin-left: auto; font: 0.49rem var(--token-font-mono); }
  .hit-card > strong { display: block; margin: 2rem 0 0.4rem; font: 400 1.35rem var(--token-font-reading); }
  .hit-card > p { margin: 0; color: var(--secondary); font-size: 0.67rem; }
  .hit-card > code { display: block; margin-top: 1.2rem; color: var(--material); font-size: 0.6rem; }
  .query-route { display: flex; align-items: stretch; gap: 0.6rem; margin-top: 1rem; overflow-x: auto; }
  .query-route > article { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 0.6rem; min-width: 12rem; padding: 0.8rem; border: 1px solid; background: var(--raised); }
  .query-route article > span { grid-row: 1 / 3; color: var(--muted); font: 0.5rem var(--token-font-mono); }
  .query-route article > code { font-size: 0.63rem; }
  .query-route article > small { color: var(--muted); font-size: 0.55rem; }
  .route-material { border-color: var(--material-border) !important; }
  .route-material > code { color: var(--material); }
  .route-native { border-color: var(--native-border) !important; }
  .route-native > code { color: var(--native); }
  .route-text { border-color: var(--exact-border) !important; }
  .query-route > :global(svg) { align-self: center; flex: 0 0 auto; color: var(--muted); }
  .route-claim { min-width: 20rem; gap: 0.55rem; padding: 0.8rem; border: 1px solid var(--native-border); background: var(--native-surface); color: var(--native); }
  .route-claim p { margin: 0; color: var(--secondary); font-size: 0.62rem; line-height: 1.4; }

  .evidence-ruler { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; border: 1px solid var(--line-strong); background: var(--line); }
  .evidence-ruler article { position: relative; min-height: 18rem; padding: 1.3rem; background: var(--raised); }
  .evidence-ruler article > span { display: grid; width: 2rem; height: 2rem; place-items: center; margin-bottom: 2rem; border: 1px solid currentColor; border-radius: 50%; font: 0.55rem var(--token-font-mono); }
  .evidence-ruler article > :global(svg) { margin-bottom: 0.8rem; }
  .evidence-ruler strong { display: block; font: 0.61rem var(--token-font-mono); letter-spacing: 0.08em; }
  .evidence-ruler p { margin: 1.4rem 0; color: var(--secondary); font-size: 0.69rem; line-height: 1.5; }
  .evidence-ruler code { position: absolute; right: 1.3rem; bottom: 1.2rem; left: 1.3rem; color: var(--muted); font-size: 0.54rem; line-height: 1.5; }
  .distance-zero { color: var(--exact); background: var(--exact-surface) !important; }
  .distance-one { color: var(--native); }
  .distance-two { color: var(--material); background: var(--material-surface) !important; }
  .distance-three { color: var(--attention); }
  .evidence-guidance { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
  .evidence-guidance > div { padding: 1.2rem; border: 1px solid; }
  .evidence-guidance > div:first-child { border-color: var(--material-border); background: var(--material-surface); }
  .evidence-guidance > div:last-child { border-color: var(--native-border); background: var(--native-surface); }
  .evidence-guidance span { font: 0.52rem var(--token-font-mono); letter-spacing: 0.08em; }
  .evidence-guidance > div:first-child span { color: var(--material); }
  .evidence-guidance > div:last-child span { color: var(--native); }
  .evidence-guidance p { margin: 0.75rem 0 0.4rem; font: italic 400 1rem var(--token-font-reading); }
  .evidence-guidance small { color: var(--muted); font-size: 0.59rem; }

  .schema-wall { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .schema-wall > article { min-width: 0; border: 1px solid var(--line-strong); background: var(--raised); }
  .schema-wall article > header { gap: 0.55rem; padding: 0.8rem 1rem; border-bottom: 1px solid var(--line); color: var(--material); }
  .schema-wall pre { min-height: 21rem; margin: 0; padding: 1.1rem; overflow: auto; background: var(--panel); color: var(--secondary); font-size: 0.62rem; line-height: 1.55; }
  .implementation-ledger { margin-top: 1.2rem; border: 1px solid var(--line-strong); background: var(--raised); }
  .implementation-ledger > header { gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--line); }
  .implementation-ledger > header span { color: var(--material); }
  .implementation-ledger > header strong { font: 400 1rem var(--token-font-reading); }
  .implementation-ledger article { display: grid; grid-template-columns: 5rem minmax(14rem, 1.1fr) minmax(11rem, 0.65fr) minmax(18rem, 1.2fr); gap: 1rem; align-items: center; padding: 0.85rem 1rem; border-top: 1px solid var(--line); }
  .implementation-ledger article:first-of-type { border-top: 0; }
  .implementation-ledger article > code { color: var(--secondary); font-size: 0.6rem; overflow-wrap: anywhere; }
  .implementation-ledger article > strong { color: var(--material); font: 500 0.61rem var(--token-font-mono); }
  .implementation-ledger article > p { margin: 0; color: var(--muted); font-size: 0.62rem; line-height: 1.45; }

  .decisions-section { padding: 6.5rem 0; border-top: 1px solid var(--line); }
  .decisions-section > header { display: grid; grid-template-columns: 1fr 1fr; align-items: end; margin-bottom: 2rem; }
  .decision-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; border: 1px solid var(--line-strong); background: var(--line); }
  .decision-grid article { min-height: 12rem; padding: 1.2rem; background: var(--raised); }
  .decision-grid article > span { color: var(--material); font: 0.54rem var(--token-font-mono); }
  .decision-grid article > strong { display: block; margin-top: 2rem; font: 400 1.05rem var(--token-font-reading); }
  .decision-grid article > p { margin: 0.7rem 0 0; color: var(--secondary); font-size: 0.67rem; line-height: 1.5; }
  .final-call { display: grid; grid-template-columns: auto 1fr auto; gap: 1.2rem; margin-top: 1rem; padding: 1.5rem; border: 1px solid var(--material-border); background: var(--material-surface); }
  .final-call > div { display: grid; width: 3.5rem; height: 3.5rem; place-items: center; border: 1px solid var(--material-border); color: var(--material); }
  .final-call section > span { color: var(--material); }
  .final-call h2 { margin: 0.45rem 0 0; font: 400 1.45rem var(--token-font-reading); }
  .final-call p { max-width: 72ch; margin: 0.45rem 0 0; color: var(--secondary); font-size: 0.68rem; line-height: 1.5; }
  .final-call a { gap: 0.4rem; color: var(--material); font-size: 0.67rem; font-weight: 600; text-decoration: none; }
  .page-footer { justify-content: space-between; min-height: 6rem; border-top: 1px solid var(--line); color: var(--muted); font: 0.53rem var(--token-font-mono); letter-spacing: 0.08em; }

  @media (max-width: 1120px) {
    .local-nav nav a:not(.back-link) { display: none; }
    .hero { grid-template-columns: 1fr; gap: 2rem; }
    .hero h1 { max-width: 14ch; }
    .material-specimen { grid-template-columns: 0.75fr 1.25fr; }
    .facet-stack { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
    .facet-stack > header, .native-exit { grid-column: 1 / -1; }
    .pipeline-track { grid-template-columns: repeat(11, max-content); }
    .implementation-ledger article { grid-template-columns: 5rem 1fr 0.7fr; }
    .implementation-ledger article > p { grid-column: 2 / -1; }
  }

  @media (max-width: 760px) {
    .local-nav { top: 0; padding: 0 1rem; }
    .local-nav nav { display: none; }
    main, .page-footer { width: min(100% - 2rem, 92rem); }
    .hero { min-height: auto; padding: 4.5rem 0; }
    .hero h1 { font-size: clamp(3.2rem, 16vw, 5.5rem); }
    .hero-machine { padding: 0.7rem; }
    .query-beam { align-items: flex-start; flex-direction: column; }
    .query-beam strong { margin-left: 0; }
    .machine-lanes, .lane-columns, .evidence-guidance, .schema-wall { grid-template-columns: 1fr; }
    .section { padding: 4.5rem 0; }
    .section-heading { grid-template-columns: 1fr; gap: 1.25rem; }
    .section-heading h2 { font-size: clamp(2.5rem, 12vw, 4rem); }
    .principle-rule { grid-template-columns: 1fr; }
    .not-equal { display: flex; height: 5rem; gap: 0.7rem; }
    .not-equal i { width: 2.5rem; height: 1px; }
    .not-equal small { writing-mode: initial; }
    .claim-policy { align-items: flex-start; flex-wrap: wrap; }
    .claim-policy > code { width: 100%; padding-left: 2rem; }
    .material-tabs, .query-tabs { grid-template-columns: 1fr 1fr; }
    .material-specimen { grid-template-columns: 1fr; }
    .facet-stack { grid-column: auto; grid-template-columns: 1fr; }
    .context-row ul { grid-template-columns: 1fr; }
    .pipeline-rails { grid-template-columns: 1fr; }
    .lane-columns dl { grid-template-columns: 1fr; }
    .facet-scope-gate { grid-template-columns: 1fr; gap: 0.5rem; }
    .scope-divider { display: flex; justify-content: center; min-height: 2.5rem; }
    .scope-divider i { width: 1.5rem; height: 1px; }
    .query-console { grid-template-columns: 1fr; }
    .console-arrow { transform: rotate(90deg); justify-self: center; }
    .evidence-ruler { grid-template-columns: 1fr 1fr; }
    .implementation-ledger article { grid-template-columns: 4.5rem 1fr; }
    .implementation-ledger article > strong, .implementation-ledger article > p { grid-column: 2; }
    .decision-grid { grid-template-columns: 1fr 1fr; }
    .final-call { grid-template-columns: auto 1fr; }
    .final-call a { grid-column: 2; }
    .page-footer { align-items: flex-start; flex-direction: column; justify-content: center; gap: 0.35rem; }
  }

  @media (max-width: 460px) {
    .machine-lanes, .material-tabs, .query-tabs, .evidence-ruler, .decision-grid { grid-template-columns: 1fr; }
    .identity-card dl div { grid-template-columns: 5rem 1fr; }
    .final-call { grid-template-columns: 1fr; }
    .final-call a { grid-column: auto; }
  }
</style>
