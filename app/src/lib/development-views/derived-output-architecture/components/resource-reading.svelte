<script lang="ts">
  import type { Component } from "svelte";
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Braces from "@lucide/svelte/icons/braces";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Check from "@lucide/svelte/icons/check";
  import Compass from "@lucide/svelte/icons/compass";
  import Eye from "@lucide/svelte/icons/eye";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import FileSearch from "@lucide/svelte/icons/file-search";
  import FileSpreadsheet from "@lucide/svelte/icons/file-spreadsheet";
  import FileText from "@lucide/svelte/icons/file-text";
  import Image from "@lucide/svelte/icons/image";
  import Layers3 from "@lucide/svelte/icons/layers-3";
  import ListTree from "@lucide/svelte/icons/list-tree";
  import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
  import PanelsTopLeft from "@lucide/svelte/icons/panels-top-left";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Route from "@lucide/svelte/icons/route";
  import ScanEye from "@lucide/svelte/icons/scan-eye";
  import Search from "@lucide/svelte/icons/search";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import TableIcon from "@lucide/svelte/icons/table";

  type Icon = Component<{
    size?: number | string;
    strokeWidth?: number | string;
    "aria-hidden"?: boolean | "true" | "false";
  }>;

  type Authority = "navigation" | "context" | "evidence";
  type Status = "live";
  type Tool = {
    id: string;
    name: string;
    group: "discover" | "traverse" | "orient" | "read";
    authority: Authority;
    status: Status;
    icon: Icon;
    summary: string;
    when: string;
    input: string;
    output: string;
    rules: string[];
  };

  const TOOLS: Tool[] = [
    {
      id: "find-resources",
      name: "find_resources",
      group: "discover",
      authority: "navigation",
      status: "live",
      icon: FileSearch,
      summary: "Locate project resources without reading their factual content.",
      when: "The task names a resource ambiguously or needs a bounded project inventory.",
      input: `{
  query?: string;
  kinds?: string[];       // max 20
  cursor?: number;        // default 0
  limit?: number;         // default 50, max 100
}`,
      output: `{
  items: [{ ref: { kind, id }, name: string }];
  nextCursor: number | null;
  // no evidenceId
}`,
      rules: [
        "Project scope and Resource Set are injected by the application.",
        "Metadata may guide the next call but may not support a factual claim.",
        "A returned ref is authority to navigate within scope, not evidence."
      ]
    },
    {
      id: "retrieve",
      name: "retrieve",
      group: "discover",
      authority: "evidence",
      status: "live",
      icon: Search,
      summary: "Search the Semantic Overlay and return exact text evidence.",
      when: "The agent knows the meaning it needs but not the resource or exact range.",
      input: `{
  query: string;
  topK?: number;
}`,
      output: `{
  hits: [{
    evidenceId: string;
    source: { ref, revision, encoding };
    span: { from, to, text };
    locators?: SemanticLocatorSpan[];
    partition?: string;
    score: number;
    overlayGeneration: number;
  }];
}`,
      rules: [
        "This is the only exact-text query tool; retrieve_materials owns the separate material lane.",
        "Every returned hit is already exact, citable text and receives an evidence ID.",
        "The hit says where the text lives; it does not preload a resource inventory."
      ]
    },
    {
      id: "retrieve-materials",
      name: "retrieve_materials",
      group: "discover",
      authority: "evidence",
      status: "live",
      icon: Sparkles,
      summary: "Search interpreted descriptions of tables, CSV data, charts, images, and code.",
      when: "The question asks whether a relevant non-prose material exists or where to inspect it.",
      input: `{
  query: string;
  kinds?: ("table" | "csv" | "chart" | "image" | "code")[];
  topK?: number;
}`,
      output: `{
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
    placement?: MaterialPlacementSnapshot;
    score: number;
  }];
}`,
      rules: [
        "Searches a separate material index; ordinary retrieve continues to return exact text only.",
        "A hit may support a broad relevance claim, but exact values or depicted details require the matching native read_* tool.",
        "Generated summary, deterministic profile, user description, and native visual vector keep distinct provenance.",
        "For shared assets, authored/generated facets require every contributor in the Resource Set; safe asset facets need one in-scope source or placement."
      ]
    },
    {
      id: "read-selection",
      name: "read_selection",
      group: "traverse",
      authority: "evidence",
      status: "live",
      icon: MousePointer2,
      summary: "Resolve the user's current selection as authoritative evidence.",
      when: "The run envelope says that a selection exists; the agent calls this first.",
      input: `{
  // no model-authored IDs or ranges
}`,
      output: `{
  evidenceId: string;
  source: { ref, revision, contentHash? };
  span: { from, to, text };
  locators: SemanticLocatorSpan[];
}`,
      rules: [
        "The application resolves selection state against the current authoritative resource.",
        "The selected value is evidence, not a splice into the system prompt.",
        "It works even when Semantic Overlay indexing has not caught up."
      ]
    },
    {
      id: "list-document-blocks",
      name: "list_document_blocks",
      group: "traverse",
      authority: "navigation",
      status: "live",
      icon: ListTree,
      summary: "Traverse document order through bounded block handles.",
      when: "The agent needs neighboring blocks, headers, footers, or a document outline.",
      input: `{
  resourceId: string;
  area?: "body" | "header" | "firstPageHeader" |
         "footer" | "firstPageFooter";
  cursor?: number;
  limit?: number; // max 100
}`,
      output: `{
  area: DocumentArea;
  revision: number;
  items: [{
    rowId: string;
    blockPath: string[];
    type: ContentKind;
    ranges: { from, to }[];
  }];
  nextCursor: number | null;
  // no factual payload, no evidenceId
}`,
      rules: [
        "Returns recursive block paths and exact projection ranges, not block text or raw represented rows.",
        "The agent follows a range with read_text or discovers a material handle separately.",
        "Pagination prevents an accidental whole-document JSON dump."
      ]
    },
    {
      id: "list-deck-slides",
      name: "list_deck_slides",
      group: "traverse",
      authority: "navigation",
      status: "live",
      icon: Presentation,
      summary: "Traverse slide order and obtain neighboring slide handles.",
      when: "The agent needs the previous, current, or next slide around a known locator.",
      input: `{
  resourceId: string;
  cursor?: number;
  limit?: number; // max 100
}`,
      output: `{
  items: [{ slideId: string, position: number }];
  nextCursor: number | null;
  // no evidenceId
}`,
      rules: [
        "Order and stable slide IDs orient the agent; slide contents remain unread.",
        "A retrieved locator supplies the slide ID without a synthetic title token in the index.",
        "Hidden slides are omitted from this live traversal."
      ]
    },
    {
      id: "inspect-slide",
      name: "inspect_slide",
      group: "traverse",
      authority: "context",
      status: "live",
      icon: PanelsTopLeft,
      summary: "List the typed parts of one slide and map spans to shapes.",
      when: "Retrieved text suggests that visual, tabular, or chart context may matter.",
      input: `{
  resourceId: string;
  slideId: string;
}`,
      output: `{
  slideId: string;
  revision: number;
  items: [{
    id: string;
    elementPath: string[];
    type: SlideContentKind;
    frame: { x, y, width, height };
    ranges: { from, to, blockPath? }[];
    materials: [{ materialHandle, kind, name, locator }];
  }];
  backgroundMaterials: MaterialEntry[];
  notes: [{ blockPath, type, ranges }];
  view: { tool: "view_slide", kind: "schematic", citable: false };
  // no evidenceId
}`,
      rules: [
        "The manifest exposes kinds, placement, exact ranges, and every current material handle—not factual values.",
        "Nested group frames are composed into absolute normalized slide coordinates before they are returned.",
        "Ranges route to read_text; material handles route to read_table, read_chart, or read_image.",
        "resourceId plus slideId routes to the non-citable schematic view."
      ]
    },
    {
      id: "inspect-dataset",
      name: "inspect_dataset",
      group: "traverse",
      authority: "context",
      status: "live",
      icon: FileSpreadsheet,
      summary: "Expose a bounded dataset outline without returning its factual rows.",
      when: "A material hit identifies a CSV, spreadsheet, or large table and the agent must choose a native selection.",
      input: `{
  materialHandle: string;
}`,
      output: `{
  name: string;
  kind: "table" | "csv";
  shape: { rows, columns, headers };
  columns: [{ name, inferredType, nullCount, distinctCount? }];
  coverage: { sampledRows, truncated };
  warnings: string[];
  reader: "read_table" | "read_csv";
  materialHandle: string;
  // no row values, no evidenceId
}`,
      rules: [
        "Returns bounded shape, schema, coverage, and warnings; native values remain unread.",
        "The same attempt-local handle routes to read_csv or read_table.",
        "Partitioned large-dataset inspection is a named follow-up, not implied by this response."
      ]
    },
    {
      id: "inspect-code",
      name: "inspect_code",
      group: "traverse",
      authority: "context",
      status: "live",
      icon: FileCode2,
      summary: "Expose a code file's symbol and range outline without source text.",
      when: "A code material hit identifies a file and the agent must choose the exact implementation to read.",
      input: `{
  materialHandle: string;
}`,
      output: `{
  name: string;
  language: string;
  lines: number;
  symbols: [{
    kind: string;
    name: string;
    fromLine: number;
    toLine: number;
  }];
  // no source text, no evidenceId
}`,
      rules: [
        "The bounded-regex outline is orientation, not evidence or AST precision.",
        "Its line ranges route to read_code for exact source lines.",
        "Profiles stop at configured byte, line, and symbol limits and report truncation."
      ]
    },
    {
      id: "view-slide",
      name: "view_slide",
      group: "orient",
      authority: "context",
      status: "live",
      icon: Eye,
      summary: "Render a schematic slide layout so the agent can understand spatial relationships.",
      when: "Spatial association, grouping, overlap, or visual hierarchy helps interpret evidence.",
      input: `{
  resourceId: string;
  slideId: string;
}`,
      output: `{
  kind: "intelligenceToolOutput";
  value: {
    slideId: string;
    viewKind: "schematic";
    supportingContext: true;
  };
  images: [{ kind: "bytes", mediaType: "image/svg+xml", base64 }];
}`,
      rules: [
        "View means orient: the schematic rendering deliberately returns no evidenceId and never enters the evidence registry.",
        "The live view composes nested groups, rotation, and the normalized deck aspect ratio.",
        "A claim still cites the underlying text, table, chart, or original image.",
        "This is not the production slide renderer; that adapter remains explicit follow-up work."
      ]
    },
    {
      id: "read-text",
      name: "read_text",
      group: "read",
      authority: "evidence",
      status: "live",
      icon: FileText,
      summary: "Read an exact authoritative text range from a resource or content handle.",
      when: "The agent needs a known block, shape, note, or bounded context around a hit.",
      input: `{
  kind: string;
  resourceId: string;
  from: number;
  to: number; // maximum 20,000 UTF-16 units
}`,
      output: `{
  evidenceId: string;
  source: { ref, revision, contentHash? };
  span: { from, to, text };
  locators: SemanticLocatorSpan[];
}`,
      rules: [
        "Reads the authoritative project resource directly; it never queries the overlay.",
        "Ranges are exact, bounded, returned with revision/hash, and may not cross a slide boundary.",
        "Overlapping or touching selected text citations consolidate by source snapshot."
      ]
    },
    {
      id: "read-table",
      name: "read_table",
      group: "read",
      authority: "evidence",
      status: "live",
      icon: TableIcon,
      summary: "Read native cells and their row/column relationships.",
      when: "The agent needs values whose meaning depends on table structure.",
      input: `{
  materialHandle: string;
  rowFrom?: number;
  rowTo?: number;       // exclusive, at most 100 rows
  columnFrom?: number;
  columnTo?: number;    // exclusive, at most 50 columns
}`,
      output: `{
  evidenceId: string;
  rowFrom: number; rowTo: number;
  columnFrom: number; columnTo: number;
  rows: string[][];
}`,
      rules: [
        "The payload preserves native cells instead of flattening relationships into prose.",
        "The source values are exact; the claim drawn from their structure is interpretive.",
        "Each bounded call stores its exact row/column index selection in one evidence record."
      ]
    },
    {
      id: "read-chart",
      name: "read_chart",
      group: "read",
      authority: "evidence",
      status: "live",
      icon: ChartColumn,
      summary: "Read native chart series, axes, labels, and values.",
      when: "The agent needs what a chart encodes rather than how its pixels happen to look.",
      input: `{
  materialHandle: string;
  series?: string[]; // max 50
}`,
      output: `{
  evidenceId: string;
  series: string[];
  spec: NativeChartSpec; // selected series only
}`,
      rules: [
        "Native chart data is preferred to OCR or vision reconstruction.",
        "A requested subset must exist and be isolatable from the native specification.",
        "The response is capped at 60,000 serialized characters; view_slide remains context only."
      ]
    },
    {
      id: "read-image",
      name: "read_image",
      group: "read",
      authority: "evidence",
      status: "live",
      icon: Image,
      summary: "Read a content-addressed original image asset as visual evidence.",
      when: "The claim concerns what is actually depicted in an image content item.",
      input: `{
  materialHandle: string;
  crop?: { x, y, width, height };
}`,
      output: `{
  kind: "intelligenceToolOutput";
  value: {
    evidenceId: string;
    assetHash: string;
    mediaType?: string;
    crop: Rect | null;
  };
  images: [{ kind: "bytes", base64, mediaType }];
}`,
      rules: [
        "The original project image is the durable source—not a generated caption or mutable URL.",
        "The pixels are authoritative; the factual description inferred from them remains interpretive.",
        "Crop coordinates are validated and bound to evidence; the original raster is currently supplied until server-side cropping lands."
      ]
    },
    {
      id: "read-csv",
      name: "read_csv",
      group: "read",
      authority: "evidence",
      status: "live",
      icon: FileSpreadsheet,
      summary: "Read a bounded native row and column selection from a raw CSV file.",
      when: "The answer needs exact values from a CSV material rather than its semantic descriptor.",
      input: `{
  materialHandle: string;
  rows: number[];      // explicit data-row indexes, max 100
  columns: string[];   // header names, max 50
}`,
      output: `{
  evidenceId: string;
  headers: string[];
  rows: [{ row: number, values: string[] }];
}`,
      rules: [
        "The immutable file hash and exact native selection anchor the evidence.",
        "The bounded parser preserves quoted delimiters/newlines and reports malformed or truncated profiles.",
        "Current limits are 5 MB, 20,000 rows, 256 columns, and 200,000 cells before per-read bounds."
      ]
    },
    {
      id: "read-code",
      name: "read_code",
      group: "read",
      authority: "evidence",
      status: "live",
      icon: FileCode2,
      summary: "Read exact source lines or one known code symbol.",
      when: "The answer makes a claim about implementation, declaration, or behavior in a code file.",
      input: `{
  materialHandle: string;
  fromLine: number;
  toLine: number; // inclusive, at most 500 lines
}`,
      output: `{
  evidenceId: string;
  language: string;
  fromLine: number;
  toLine: number;
  text: string;
}`,
      rules: [
        "Returns verbatim code from the authoritative file; it never reads a generated summary.",
        "Exact line ranges and immutable file hash survive into the citation record.",
        "The caller chooses an inclusive line range from inspect_code's bounded outline."
      ]
    }
  ];

  const GROUPS = [
    { id: "discover", label: "Discover", note: "find by name or meaning" },
    { id: "traverse", label: "Traverse", note: "move through resource structure" },
    { id: "orient", label: "Orient", note: "understand the composite" },
    { id: "read", label: "Read", note: "mint source-backed evidence" }
  ] as const;

  let activeToolId = $state("inspect-slide");
  const activeTool = $derived(TOOLS.find((tool) => tool.id === activeToolId) ?? TOOLS[0]);
  const ActiveToolIcon = $derived(activeTool.icon);

  type Scenario = {
    id: string;
    kicker: string;
    title: string;
    question: string;
    steps: { tool: string; authority: Authority; note: string }[];
    evidence: string[];
    context: string[];
  };

  const SCENARIOS: Scenario[] = [
    {
      id: "chart",
      kicker: "CHART / NATIVE FIRST",
      title: "Explain the change in readiness.",
      question: "What caused the Q4 readiness increase shown in the deck?",
      steps: [
        { tool: "retrieve", authority: "evidence", note: "find the nearby claim" },
        { tool: "inspect_slide", authority: "context", note: "discover chart-02" },
        { tool: "read_chart", authority: "evidence", note: "read native series" },
        { tool: "view_slide", authority: "context", note: "confirm visual association" }
      ],
      evidence: ["text · span 418–502", "structured · chart-02 / series-ready"],
      context: ["slide manifest", "schematic slide view"]
    },
    {
      id: "image",
      kicker: "IMAGE / PIXELS ARE SOURCE",
      title: "Describe what the photograph shows.",
      question: "What safety condition is visible in the field photograph?",
      steps: [
        { tool: "retrieve_materials", authority: "evidence", note: "find image meaning" },
        { tool: "inspect_slide", authority: "context", note: "discover image-03" },
        { tool: "read_image", authority: "evidence", note: "read original pixels" },
        { tool: "view_slide", authority: "context", note: "understand placement" }
      ],
      evidence: ["text · caption span", "visual · image-03 / asset hash"],
      context: ["shape inventory", "schematic slide view"]
    },
    {
      id: "neighbors",
      kicker: "DECK / ADJACENT CONTEXT",
      title: "Follow the argument across slides.",
      question: "How does the previous slide qualify this recommendation?",
      steps: [
        { tool: "retrieve", authority: "evidence", note: "locate recommendation" },
        { tool: "list_deck_slides", authority: "navigation", note: "obtain previous handle" },
        { tool: "inspect_slide", authority: "context", note: "map its content" },
        { tool: "read_text", authority: "evidence", note: "read exact qualifier" }
      ],
      evidence: ["text · recommendation", "text · previous-slide qualifier"],
      context: ["deck order", "previous slide manifest"]
    },
    {
      id: "document",
      kicker: "DOCUMENT / BOUNDED EXPANSION",
      title: "Expand one retrieved passage.",
      question: "What assumptions immediately follow this policy statement?",
      steps: [
        { tool: "retrieve", authority: "evidence", note: "locate policy text" },
        { tool: "list_document_blocks", authority: "navigation", note: "find following blocks" },
        { tool: "read_text", authority: "evidence", note: "read bounded neighbors" }
      ],
      evidence: ["text · policy span", "text · following block spans"],
      context: ["document block order"]
    }
  ];

  let activeScenarioId = $state("chart");
  const activeScenario = $derived(
    SCENARIOS.find((scenario) => scenario.id === activeScenarioId) ?? SCENARIOS[0]
  );

  const SPECIMENS = [
    {
      id: "text",
      label: "text-01",
      kind: "text",
      tool: "read_text",
      result: "exact UTF-16 span + locator",
      evidence: "text evidence"
    },
    {
      id: "chart",
      label: "chart-02",
      kind: "chart",
      tool: "read_chart",
      result: "native axes + series + values",
      evidence: "structured evidence"
    },
    {
      id: "image",
      label: "image-03",
      kind: "image",
      tool: "read_image",
      result: "original pixels + asset hash",
      evidence: "visual evidence"
    }
  ] as const;

  let activeSpecimenId = $state<"text" | "chart" | "image">("chart");
  const activeSpecimen = $derived(
    SPECIMENS.find((specimen) => specimen.id === activeSpecimenId) ?? SPECIMENS[1]
  );

  const DIRECTORY = `representation/data/behavior/semantic/projection/
├── contract.ts                 exact + material output
├── writer.ts                   one UTF-16 coordinate space
├── project-resource.ts         resource-kind dispatcher
├── shared.ts                   authored labels + ordering
├── resources/
│   ├── document.ts             document traversal only
│   └── slide-deck.ts           slide + shape traversal only

representation/data/behavior/semantic/materials/
├── profile.ts                  table/chart/image
├── csv.ts                      bounded parser + profile
├── code.ts                     bounded structural profile
├── spreadsheet.ts              native sheet inventory
└── external-file.ts            file-kind adapter`;

  const PROJECTION_CONTRACT = `type ProjectedResource = {
  exact: {
    ref: ResourceRef;
    revision: number;
    encoding: "utf-16";
    text: string;
    locators: SemanticLocatorSpan[];
    hardBoundaries: number[];
  };
  materials: MaterialSeed[];
};

// no "Slide 1" tokens
// no Prompt Block responses
// raw rows/pixels stay out of exact text
// no segment or citation crosses a hard boundary`;
</script>

<svelte:head>
  <title>Resource reading and evidence — Icarus</title>
  <meta
    name="description"
    content="The implemented resource traversal, specialized read tools, evidence kinds, slide context, and semantic projection seam for Derived Output."
  />
</svelte:head>

<div class="reading-page">
  <header class="local-nav">
    <a class="brand" href="/demo/semantic-overlay/agent-runtime">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>DERIVED OUTPUT</span>
      <ArrowRight size={13} aria-hidden="true" />
      <strong>RESOURCE READING</strong>
    </a>
    <nav aria-label="Resource reading sections">
      <a href="#grammar">grammar</a>
      <a href="#tools">tools</a>
      <a href="#routes">routes</a>
      <a href="#slide">slide anatomy</a>
      <a href="#evidence">evidence</a>
      <a href="#projection">projection</a>
      <a href="/demo/semantic-overlay/material-layer">material layer</a>
      <a class="back-link" href="/demo/semantic-overlay/agent-runtime">
        <ArrowLeft size={13} aria-hidden="true" /> agent runtime
      </a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow"><BookOpen size={15} aria-hidden="true" /> LIVE CONTRACT / RESOURCE AUTHORITY</div>
        <h1><span>Read</span> means cite.</h1>
        <p>
          Give the agent several narrow doors whose names declare their authority. Find, list,
          inspect, and view establish orientation. Retrieve and read return source-backed material
          and therefore mint evidence IDs—with the evidence kind stating whether it is exact or interpreted.
        </p>
        <div class="hero-status">
          <span class="status-live">LIVE · two retrieval lanes</span>
          <span class="status-live">LIVE · specialized resource tools</span>
        </div>
      </div>

      <div class="verb-index" aria-label="Tool naming grammar">
        <div class="verb-axis" aria-hidden="true"><span></span><span></span></div>
        <article><span>01</span><strong>FIND</strong><p>Locate a resource.</p><small>NO EVIDENCE</small></article>
        <article><span>02</span><strong>LIST</strong><p>Traverse its order.</p><small>NO EVIDENCE</small></article>
        <article><span>03</span><strong>INSPECT</strong><p>Expose typed handles.</p><small>NO EVIDENCE</small></article>
        <article><span>04</span><strong>VIEW</strong><p>Understand composition.</p><small>NO EVIDENCE</small></article>
        <article class="evidentiary"><span>05</span><strong>RETRIEVE</strong><p>Search one explicit index lane.</p><small>EVIDENCE IDs</small></article>
        <article class="evidentiary"><span>06</span><strong>READ</strong><p>Open authoritative content.</p><small>EVIDENCE IDs</small></article>
      </div>
    </section>

    <section id="grammar" class="section grammar-section">
      <header class="section-heading">
        <div><span>01 / AUTHORITY GRAMMAR</span><h2>Many tools.<br />One predictable verb.</h2></div>
        <p>
          More tools are useful when each eliminates an ambiguity. The model never has to infer
          whether a generic response is citable: the verb and response schema settle that before
          the call.
        </p>
      </header>

      <div class="law-strip">
        <article class="no-id">
          <header><Compass size={19} aria-hidden="true" /><span>ORIENTATION CHANNEL</span></header>
          <div><code>find*</code><code>list*</code><code>inspect*</code><code>view*</code></div>
          <p>Returns scoped handles, order, bounds, and rendered context. Never appears in <code>SynthesisDecision.evidence</code>.</p>
        </article>
        <div class="law-gate" aria-label="Evidence boundary">
          <span></span><strong>CLAIM<br />BOUNDARY</strong><span></span>
        </div>
        <article class="with-id">
          <header><BookOpen size={19} aria-hidden="true" /><span>EVIDENCE CHANNEL</span></header>
          <div><code>retrieve</code><code>retrieve_materials</code><code>read*</code></div>
          <p>Returns source-backed material with an application-issued evidence ID, evidence kind, and durable provenance shape.</p>
        </article>
      </div>

      <div class="grammar-note">
        <Check size={17} aria-hidden="true" />
        <p><strong><code>view_slide</code> replaces “read visual slide.”</strong> Its current schematic SVG is explicitly context, not evidence or a production render. <code>read_image</code> is evidentiary only when it returns content-addressed original pixels.</p>
      </div>

      <a class="material-expansion" href="/demo/semantic-overlay/material-layer">
        <Sparkles size={20} aria-hidden="true" />
        <div><span>SEMANTIC MATERIAL LAYER</span><strong>Exact text and interpreted material use separate retrieval lanes.</strong><small>See how CSV data, native tables, images, charts, and code become discoverable without replacing their authoritative source.</small></div>
        <ArrowRight size={18} aria-hidden="true" />
      </a>
    </section>

    <section id="tools" class="section tools-section">
      <header class="section-heading compact-heading">
        <div><span>02 / SPECIALIZED TOOL FIELD</span><h2>The output shape chooses the door.</h2></div>
        <p>Choose a tool to inspect its bounded live contract. Status is textual; color only reinforces authority and implementation state.</p>
      </header>

      <div class="tool-field" role="tablist" aria-label="Implemented resource tools">
        {#each GROUPS as group (group.id)}
          <section class="tool-group">
            <header><span>{group.label}</span><small>{group.note}</small></header>
            <div>
              {#each TOOLS.filter((tool) => tool.group === group.id) as tool (tool.id)}
                {@const ToolIcon = tool.icon}
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeToolId === tool.id}
                  aria-controls="tool-contract"
                  class:active={activeToolId === tool.id}
                  class:evidence-tool={tool.authority === "evidence"}
                  class:context-tool={tool.authority === "context"}
                  onclick={() => (activeToolId = tool.id)}
                >
                  <span class="tool-icon"><ToolIcon size={18} aria-hidden="true" /></span>
                  <span class="tool-name"><code>{tool.name}</code><small>{tool.summary}</small></span>
                  <span class="tool-badges">
                    <small class="status-{tool.status}">{tool.status}</small>
                    <small class="authority-{tool.authority}">{tool.authority === "evidence" ? "evidence ID" : "no ID"}</small>
                  </span>
                </button>
              {/each}
            </div>
          </section>
        {/each}
      </div>

      <div id="tool-contract" class="tool-contract" role="tabpanel">
        <header>
          <span class="contract-icon authority-{activeTool.authority}"><ActiveToolIcon size={25} aria-hidden="true" /></span>
          <div><span>{activeTool.authority} · {activeTool.status}</span><h3><code>{activeTool.name}</code></h3><p>{activeTool.when}</p></div>
          <strong class="contract-verdict authority-{activeTool.authority}">{activeTool.authority === "evidence" ? "ISSUES EVIDENCE" : "ORIENTATION ONLY"}</strong>
        </header>
        <div class="schema-grid">
          <div><span>INPUT</span><pre><code>{activeTool.input}</code></pre></div>
          <div><span>OUTPUT</span><pre><code>{activeTool.output}</code></pre></div>
        </div>
        <ul>
          {#each activeTool.rules as rule (rule)}
            <li><Check size={13} aria-hidden="true" />{rule}</li>
          {/each}
        </ul>
      </div>
    </section>

    <section id="routes" class="section route-section">
      <header class="section-heading">
        <div><span>03 / TOOL SELECTION</span><h2>A question traces<br />its own route.</h2></div>
        <p>
          Specialized tools do not create model confusion when their preconditions are distinct.
          Each route states whether it crosses the evidence boundary through exact text,
          interpreted material discovery, or an authoritative native read.
        </p>
      </header>

      <div class="scenario-tabs" role="tablist" aria-label="Resource-reading scenarios">
        {#each SCENARIOS as scenario (scenario.id)}
          <button
            type="button"
            role="tab"
            aria-selected={activeScenarioId === scenario.id}
            class:active={activeScenarioId === scenario.id}
            onclick={() => (activeScenarioId = scenario.id)}
          >
            <span>{scenario.kicker}</span><strong>{scenario.title}</strong>
          </button>
        {/each}
      </div>

      <div class="scenario-stage" role="tabpanel">
        <header><Route size={20} aria-hidden="true" /><span>AGENT TASK</span><p>“{activeScenario.question}”</p></header>
        <div class="route-flow">
          {#each activeScenario.steps as step, index (`${activeScenario.id}-${step.tool}`)}
            <div class="route-node authority-{step.authority}">
              <span>0{index + 1}</span><code>{step.tool}</code><small>{step.note}</small>
            </div>
            {#if index < activeScenario.steps.length - 1}
              <ArrowRight class="route-arrow" size={18} aria-hidden="true" />
            {/if}
          {/each}
          <ArrowRight class="route-arrow" size={18} aria-hidden="true" />
          <div class="route-node answer-node"><span>✓</span><code>answer</code><small>select evidence IDs only</small></div>
        </div>
        <div class="route-ledger">
          <div><span>EVIDENCE LEDGER</span>{#each activeScenario.evidence as item (item)}<code>{item}</code>{/each}</div>
          <div><span>SUPPORTING CONTEXT</span>{#each activeScenario.context as item (item)}<code>{item} · not selectable</code>{/each}</div>
        </div>
      </div>
    </section>

    <section id="slide" class="section slide-section">
      <header class="section-heading">
        <div><span>04 / SLIDE ANATOMY</span><h2>Inspect the whole.<br />Read the part.</h2></div>
        <p>
          A retrieved text locator identifies the slide and shape. <code>inspect_slide</code> exposes
          neighboring content handles; <code>view_slide</code> explains composition; the matching
          reader supplies evidence.
        </p>
      </header>

      <div class="slide-lab">
        <div class="slide-column">
      <div class="view-ribbon"><Eye size={14} aria-hidden="true" /><code>view_slide</code><span>SCHEMATIC CONTEXT · NO EVIDENCE ID</span></div>
          <div class="mock-slide" aria-label="Illustrative slide containing text, a chart, and an image">
            <div class="slide-grid" aria-hidden="true"></div>
            <button class:active={activeSpecimenId === "text"} onclick={() => (activeSpecimenId = "text")} class="slide-title">
              <small>text-01</small><strong>Quarterly readiness</strong><span>Response time improved after the field retrofit.</span>
            </button>
            <button class:active={activeSpecimenId === "chart"} onclick={() => (activeSpecimenId = "chart")} class="slide-chart" aria-label="Select chart-02">
              <small>chart-02 · native</small>
              <div class="chart-axis"><i style="height: 34%"></i><i style="height: 48%"></i><i style="height: 66%"></i><i style="height: 86%"></i></div>
              <span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span>
            </button>
            <button class:active={activeSpecimenId === "image"} onclick={() => (activeSpecimenId = "image")} class="slide-image" aria-label="Select image-03">
              <small>image-03 · original asset</small>
              <div class="image-scene" aria-hidden="true"><span></span><i></i><b></b></div>
              <span>Field installation · north station</span>
            </button>
            <div class="slide-number">07</div>
          </div>
        </div>

        <div class="slide-inspector">
          <header><ScanEye size={19} aria-hidden="true" /><div><span>CONTEXT RESULT</span><code>inspect_slide(slide-07)</code></div><small>NO EVIDENCE ID</small></header>
          <div class="manifest">
            {#each SPECIMENS as specimen (specimen.id)}
              <button class:active={activeSpecimenId === specimen.id} onclick={() => (activeSpecimenId = specimen.id)}>
                <span>{specimen.kind}</span><code>{specimen.label}</code><small>{specimen.id === "text" ? "range 418–502" : "content handle"}</small>
              </button>
            {/each}
          </div>
          <div class="next-call">
            <span>NEXT AUTHORITATIVE CALL</span>
            <strong><code>{activeSpecimen.tool}</code></strong>
            <p>{activeSpecimen.result}</p>
            <div><BookOpen size={15} aria-hidden="true" /> {activeSpecimen.evidence} <ArrowRight size={14} aria-hidden="true" /> evidence ID</div>
          </div>
          <p class="slide-rule">The schematic helps the agent associate these parts. It is not a production render and cannot be selected in the final evidence array.</p>
        </div>
      </div>
    </section>

    <section id="evidence" class="section evidence-section">
      <header class="section-heading">
        <div><span>05 / EVIDENCE KINDS</span><h2>Same registry.<br />Different acts of reading.</h2></div>
        <p>
          Text can be quoted directly. Tables, charts, and images require interpretation. They are
          still grounded evidence, but their durable citation records the native source material
          that the interpretation came from.
        </p>
      </header>

      <div class="evidence-spectrum">
        <article class="text-evidence">
          <header><FileText size={20} aria-hidden="true" /><span>TEXT EVIDENCE</span><small>VERBATIM</small></header>
          <blockquote>“Response time improved after the field retrofit.”</blockquote>
          <dl><div><dt>stores</dt><dd>source · revision/hash · exact span/range · locators</dd></div><div><dt>reader</dt><dd><code>retrieve</code> · <code>read_text</code> · <code>read_code</code></dd></div></dl>
        </article>
        <article class="structured-evidence">
          <header><ChartColumn size={20} aria-hidden="true" /><span>STRUCTURED EVIDENCE</span><small>INTERPRETED</small></header>
          <div class="mini-series"><span>Q1 <b>62</b></span><span>Q2 <b>68</b></span><span>Q3 <b>79</b></span><span>Q4 <b>91</b></span></div>
          <dl><div><dt>stores</dt><dd>source · content ID/hash · native selection · values</dd></div><div><dt>reader</dt><dd><code>read_table</code> · <code>read_chart</code> · <code>read_csv</code></dd></div></dl>
        </article>
        <article class="visual-evidence">
          <header><Image size={20} aria-hidden="true" /><span>VISUAL EVIDENCE</span><small>INTERPRETED</small></header>
          <div class="visual-swatch"><div class="image-scene" aria-hidden="true"><span></span><i></i><b></b></div><code>content-addressed sha256:9bf…</code></div>
          <dl><div><dt>stores</dt><dd>source · content ID · asset hash · crop bounds</dd></div><div><dt>reader</dt><dd><code>read_image</code></dd></div></dl>
        </article>
        <article class="context-card">
          <header><Eye size={20} aria-hidden="true" /><span>SUPPORTING CONTEXT</span><small>NOT EVIDENCE</small></header>
          <p>Schematic slide view, resource order, item manifest, and shape placement.</p>
          <dl><div><dt>lifetime</dt><dd>one attempt · optional telemetry</dd></div><div><dt>tools</dt><dd><code>find*</code> · <code>list*</code> · <code>inspect*</code> · <code>view*</code></dd></div></dl>
        </article>
      </div>

      <div class="evidence-rule">
        <Braces size={19} aria-hidden="true" />
        <div><span>PUBLICATION RULE</span><strong>The final response selects evidence IDs; it never selects context handles.</strong></div>
        <code>SynthesisDecision.evidence[]</code>
      </div>

      <a class="descriptor-rule" href="/demo/semantic-overlay/material-layer">
        <Sparkles size={19} aria-hidden="true" />
        <div><span>DERIVED DESCRIPTOR EVIDENCE</span><strong>A semantic material summary is one step farther from authority.</strong><p>It can establish broad relevance when visibly labeled interpreted. Exact values, code behavior, and visual details still resolve through the native reader.</p></div>
        <code>retrieve_materials → read_*</code>
      </a>
    </section>

    <section id="projection" class="section projection-section">
      <header class="section-heading">
        <div><span>06 / PROJECTION SEAM</span><h2>Resources traverse.<br />Content projects.</h2></div>
        <p>
          Documents and decks decide order and location. Shared adapters produce two outputs: one
          exact-text projection and one first-class material inventory. The material pipeline is
          independent so generated descriptions never enter ordinary text retrieval.
        </p>
      </header>

      <div class="projection-now">
        <div><span>CURRENT · LIVE</span><code>representation/data/behavior/semantic/projection/project-resource.ts</code></div>
        <p>
          Resource-specific adapters now own document and slide traversal; one writer emits exact
          text, locators, and hard boundaries while that same walk inventories first-class material.
          The old resource-text file is only a compatibility facade.
        </p>
      </div>

      <div class="projection-map">
        <div class="resource-roots">
          <article><FileText size={21} aria-hidden="true" /><span>RESOURCE TRAVERSAL</span><strong>document.ts</strong><small>header → body → footer<br />row → block order</small></article>
          <article><Presentation size={21} aria-hidden="true" /><span>RESOURCE TRAVERSAL</span><strong>slide-deck.ts</strong><small>slide order → visual element order<br />speaker notes</small></article>
        </div>
        <div class="projection-arrow"><span></span><ArrowRight size={19} aria-hidden="true" /><span></span></div>
        <div class="content-core">
          <header><Layers3 size={20} aria-hidden="true" /><span>SHARED CONTENT ADAPTERS</span></header>
          <div><code>shared.ts</code><small>authored labels + ordering</small></div>
          <div><code>profile.ts</code><small>table / chart / image shape</small></div>
          <div><code>csv.ts · code.ts</code><small>external native profiles</small></div>
          <div><code>spreadsheet.ts</code><small>ordered native cells</small></div>
          <p><code>prompt</code> is always excluded from semantic projection.</p>
        </div>
        <div class="projection-arrow"><span></span><ArrowRight size={19} aria-hidden="true" /><span></span></div>
        <div class="projection-output">
          <Braces size={22} aria-hidden="true" /><span>SEMANTIC INPUT</span><strong>one UTF-16 text space</strong>
          <small>exact text + locators + hard slide boundaries</small>
        </div>
      </div>

      <div class="material-fork">
        <div><Layers3 size={18} aria-hidden="true" /><span>SAME RESOURCE WALK</span><strong>inventory tables · charts · images</strong></div>
        <ArrowRight size={18} aria-hidden="true" />
        <div><Sparkles size={18} aria-hidden="true" /><span>SEPARATE LIVE LANE</span><strong>SemanticMaterial[]</strong></div>
        <ArrowRight size={18} aria-hidden="true" />
        <a href="/demo/semantic-overlay/material-layer">Open the material pipeline</a>
      </div>

      <div class="contract-pair">
        <article><header><span>LIVE DIRECTORY</span><small>one obvious extension point</small></header><pre><code>{DIRECTORY}</code></pre></article>
        <article><header><span>LIVE MESSAGE</span><small>structure remains out of band</small></header><pre><code>{PROJECTION_CONTRACT}</code></pre></article>
      </div>

      <div class="boundary-rule">
        <span class="slide-chip">SLIDE A TEXT</span><i aria-hidden="true"></i><strong>HARD BOUNDARY · NOT A TOKEN</strong><i aria-hidden="true"></i><span class="slide-chip">SLIDE B TEXT</span>
        <p>One deck-wide coordinate space; independent embedding spans. Segmentation and citation consolidation may not bridge this boundary.</p>
      </div>
    </section>

    <section class="decision-card">
      <div class="decision-mark"><Check size={27} aria-hidden="true" /></div>
      <div>
        <span>IMPLEMENTED ALIGNMENT</span>
        <h2>Use context to choose. Use evidence to claim.</h2>
        <p>
          Keep retrieval lean. Inspect resource structure only when the question requires it. View
          the schematic slide only to understand relationships. Then read the exact text, native
          structure, or original image that the response will cite.
        </p>
      </div>
      <a href="/demo/semantic-overlay/agent-runtime">Return to agent runtime <ArrowRight size={15} aria-hidden="true" /></a>
    </section>
  </main>

  <footer class="page-footer">
    <span>DERIVED OUTPUT / RESOURCE READING</span>
    <span>live architecture · authoritative tools with explicit fidelity limits</span>
  </footer>
</div>

<style>
  :global(body) { margin: 0; }
  :global(*) { box-sizing: border-box; }
  :global(html) { scroll-behavior: smooth; }

  .reading-page {
    --ground: var(--token-surface-canvas);
    --raised: var(--token-surface-elevated);
    --panel: var(--token-surface-panel);
    --work: var(--token-surface-work);
    --pasteboard: var(--token-surface-pasteboard);
    --ink: var(--token-ink-primary);
    --secondary: var(--token-ink-secondary);
    --muted: var(--token-ink-muted);
    --line: var(--token-border-subtle);
    --line-strong: var(--token-border-strong);
    --evidence: var(--token-color-active-text);
    --evidence-surface: var(--token-color-active-surface);
    --evidence-border: var(--token-color-active-border);
    --context: var(--token-color-attention-text);
    --context-surface: var(--token-color-attention-surface);
    --context-border: var(--token-color-attention-border);
    --navigation: var(--token-color-interactive-text);
    --navigation-surface: var(--token-color-interactive-surface);
    --navigation-border: var(--token-color-interactive-border);
    --structured: var(--token-color-intelligence-text);
    --structured-surface: var(--token-color-intelligence-surface);
    --structured-border: var(--token-color-intelligence-border);
    --visual: var(--token-color-slide-text);
    --visual-surface: var(--token-color-slide-surface);
    --visual-border: var(--token-color-slide-border);
    min-height: 100vh;
    background:
      linear-gradient(90deg, transparent 0 49.93%, color-mix(in srgb, var(--line) 28%, transparent) 50%, transparent 50.07%),
      var(--token-atmosphere), var(--ground);
    color: var(--ink);
  }

  .local-nav {
    position: sticky;
    z-index: 20;
    top: 2.75rem;
    display: flex;
    min-height: 3.6rem;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    padding: 0 2rem;
    border-bottom: 1px solid var(--line);
    background: color-mix(in srgb, var(--ground) 90%, transparent);
    backdrop-filter: blur(18px);
  }

  .brand, .local-nav nav, .back-link, .eyebrow, .hero-status, .law-strip article header,
  .grammar-note, .material-expansion, .tool-contract > header, .tool-contract li, .scenario-stage > header,
  .evidence-spectrum article header, .evidence-rule, .descriptor-rule, .projection-now > div,
  .content-core header, .material-fork, .material-fork > div, .decision-card, .decision-card a, .page-footer {
    display: flex;
    align-items: center;
  }

  .brand { gap: 0.45rem; color: var(--secondary); font: 0.62rem var(--token-font-mono); letter-spacing: 0.1em; text-decoration: none; }
  .brand strong { color: var(--evidence); font-weight: 500; }
  .brand-mark { width: 0.65rem; height: 0.65rem; border: 2px solid var(--evidence); border-radius: 50%; }
  .local-nav nav { gap: 1.05rem; }
  .local-nav nav a { color: var(--muted); font-size: 0.7rem; text-decoration: none; }
  .local-nav nav a:hover { color: var(--ink); }
  .local-nav .back-link { gap: 0.35rem; color: var(--evidence); font-weight: 600; }

  main, .page-footer { width: min(100% - 3rem, 88rem); margin-inline: auto; }

  .hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(28rem, 0.95fr); gap: 6rem; align-items: center; min-height: 44rem; padding: 6rem 0; }
  .eyebrow { gap: 0.5rem; color: var(--evidence); font: 0.65rem var(--token-font-mono); letter-spacing: 0.11em; }
  .hero h1 { max-width: 10ch; margin: 1.2rem 0 1.5rem; font: 400 clamp(4.2rem, 8vw, 8rem)/0.86 var(--token-font-reading); letter-spacing: -0.065em; }
  .hero h1 span { color: var(--evidence); font-style: italic; }
  .hero-copy > p { max-width: 62ch; margin: 0; color: var(--secondary); font-size: 1.02rem; line-height: 1.7; }
  .hero-status { gap: 0.6rem; margin-top: 2rem; }
  .hero-status span, .tool-badges small, .contract-verdict { padding: 0.28rem 0.45rem; border: 1px solid; font: 0.53rem var(--token-font-mono); letter-spacing: 0.08em; text-transform: uppercase; }
  .status-live { border-color: var(--token-color-success-border) !important; background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .status-target { border-color: var(--context-border) !important; background: var(--context-surface); color: var(--context); }

  .verb-index { position: relative; display: grid; grid-template-columns: repeat(2, 1fr); border: 1px solid var(--line-strong); background: var(--line); gap: 1px; box-shadow: 1rem 1rem 0 color-mix(in srgb, var(--evidence) 7%, transparent); }
  .verb-index article { position: relative; min-height: 8.4rem; padding: 1.2rem; background: color-mix(in srgb, var(--raised) 92%, transparent); }
  .verb-index article > span { color: var(--muted); font: 0.55rem var(--token-font-mono); }
  .verb-index strong { display: block; margin-top: 1.2rem; color: var(--navigation); font: 500 0.72rem var(--token-font-mono); letter-spacing: 0.12em; }
  .verb-index p { margin: 0.35rem 0 0; color: var(--secondary); font-size: 0.74rem; }
  .verb-index small { position: absolute; right: 1rem; bottom: 0.8rem; color: var(--muted); font: 0.5rem var(--token-font-mono); letter-spacing: 0.08em; }
  .verb-index article.evidentiary { background: var(--evidence-surface); }
  .verb-index article.evidentiary strong, .verb-index article.evidentiary small { color: var(--evidence); }
  .verb-axis { position: absolute; z-index: 1; inset: 66.66% 0 auto; display: flex; align-items: center; color: var(--evidence); pointer-events: none; }
  .verb-axis span { height: 1px; flex: 1; background: var(--evidence-border); }

  .section { padding: 6.5rem 0; border-top: 1px solid var(--line); scroll-margin-top: 7rem; }
  .section-heading { display: grid; grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.58fr); gap: 5rem; align-items: end; margin-bottom: 3rem; }
  .section-heading > div > span, .tool-group > header span, .tool-contract > header > div > span,
  .schema-grid > div > span, .scenario-stage > header span, .route-ledger span,
  .slide-inspector header span, .next-call > span, .projection-now span, .content-core header span,
  .projection-output > span, .contract-pair header span, .decision-card > div > span {
    font-family: var(--token-font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .section-heading > div > span { color: var(--evidence); font-size: 0.63rem; }
  .section-heading h2 { margin: 0.75rem 0 0; font: 400 clamp(2.8rem, 5vw, 4.8rem)/0.96 var(--token-font-reading); letter-spacing: -0.045em; }
  .section-heading > p { margin: 0; color: var(--secondary); font-size: 0.92rem; line-height: 1.65; }

  .law-strip { display: grid; grid-template-columns: 1fr 7rem 1fr; align-items: stretch; }
  .law-strip article { padding: 1.5rem; border: 1px solid var(--line-strong); }
  .law-strip article.no-id { background: var(--navigation-surface); }
  .law-strip article.with-id { border-color: var(--evidence-border); background: var(--evidence-surface); }
  .law-strip article header { gap: 0.6rem; color: var(--navigation); font: 0.6rem var(--token-font-mono); letter-spacing: 0.1em; }
  .law-strip article.with-id header { color: var(--evidence); }
  .law-strip article > div { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1.5rem 0 1rem; }
  .law-strip article code { padding: 0.35rem 0.5rem; border: 1px solid var(--navigation-border); background: color-mix(in srgb, var(--raised) 55%, transparent); color: var(--ink); font-size: 0.7rem; }
  .law-strip article.with-id code { border-color: var(--evidence-border); }
  .law-strip article p { max-width: 48ch; margin: 0; color: var(--secondary); font-size: 0.77rem; line-height: 1.55; }
  .law-gate { display: grid; grid-template-rows: 1fr auto 1fr; justify-items: center; color: var(--context); }
  .law-gate span { width: 1px; background: var(--context-border); }
  .law-gate strong { padding: 0.75rem 0; font: 0.52rem/1.4 var(--token-font-mono); letter-spacing: 0.08em; text-align: center; }
  .grammar-note { gap: 0.7rem; margin-top: 1rem; padding: 1rem 1.2rem; border: 1px solid var(--context-border); background: var(--context-surface); color: var(--context); }
  .grammar-note p { margin: 0; font-size: 0.74rem; line-height: 1.55; }
  .grammar-note strong { color: var(--ink); }
  .material-expansion { gap: 0.8rem; margin-top: 0.75rem; padding: 1rem 1.2rem; border: 1px solid var(--structured-border); background: var(--structured-surface); color: var(--structured); text-decoration: none; }
  .material-expansion > div { min-width: 0; flex: 1; }
  .material-expansion span { font: 0.5rem var(--token-font-mono); letter-spacing: 0.09em; }
  .material-expansion strong { display: block; margin-top: 0.28rem; color: var(--ink); font: 400 0.92rem var(--token-font-reading); }
  .material-expansion small { display: block; margin-top: 0.24rem; color: var(--secondary); font-size: 0.63rem; line-height: 1.45; }

  .tool-field { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--line-strong); background: var(--line); gap: 1px; }
  .tool-group { min-width: 0; background: var(--panel); }
  .tool-group > header { min-height: 4.4rem; padding: 0.9rem 1rem; border-bottom: 1px solid var(--line); }
  .tool-group > header span { display: block; color: var(--evidence); font-size: 0.58rem; }
  .tool-group > header small { color: var(--muted); font-size: 0.62rem; }
  .tool-group > div { display: grid; }
  .tool-group button { display: grid; grid-template-columns: 2.2rem 1fr; gap: 0.65rem; min-height: 7rem; padding: 0.9rem; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--secondary); text-align: left; cursor: pointer; }
  .tool-group button:last-child { border-bottom: 0; }
  .tool-group button:hover { background: var(--work); }
  .tool-group button.active { background: var(--raised); box-shadow: inset 3px 0 0 var(--navigation); }
  .tool-group button.evidence-tool.active { box-shadow: inset 3px 0 0 var(--evidence); }
  .tool-group button.context-tool.active { box-shadow: inset 3px 0 0 var(--context); }
  .tool-icon { display: grid; width: 2.1rem; height: 2.1rem; place-items: center; border: 1px solid var(--navigation-border); color: var(--navigation); }
  .evidence-tool .tool-icon { border-color: var(--evidence-border); color: var(--evidence); }
  .context-tool .tool-icon { border-color: var(--context-border); color: var(--context); }
  .tool-name { min-width: 0; }
  .tool-name code { display: block; overflow-wrap: anywhere; color: var(--ink); font-size: 0.7rem; }
  .tool-name small { display: block; margin-top: 0.32rem; color: var(--muted); font-size: 0.59rem; line-height: 1.4; }
  .tool-badges { grid-column: 2; display: flex; flex-wrap: wrap; gap: 0.35rem; align-self: end; }
  .tool-badges small { padding: 0.16rem 0.3rem; font-size: 0.46rem; }
  .authority-navigation { border-color: var(--navigation-border) !important; color: var(--navigation) !important; }
  .authority-context { border-color: var(--context-border) !important; color: var(--context) !important; }
  .authority-evidence { border-color: var(--evidence-border) !important; color: var(--evidence) !important; }

  .tool-contract { border: 1px solid var(--line-strong); border-top: 0; background: var(--raised); }
  .tool-contract > header { gap: 1rem; padding: 1.25rem; }
  .contract-icon { display: grid; width: 3.4rem; height: 3.4rem; flex: 0 0 auto; place-items: center; border: 1px solid; }
  .tool-contract > header > div { min-width: 0; flex: 1; }
  .tool-contract > header > div > span { color: var(--muted); font-size: 0.52rem; }
  .tool-contract h3 { margin: 0.25rem 0; font-size: 1.35rem; font-weight: 500; }
  .tool-contract h3 code { color: var(--ink); }
  .tool-contract header p { margin: 0; color: var(--secondary); font-size: 0.72rem; }
  .contract-verdict { margin-left: auto; white-space: nowrap; }
  .schema-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: var(--line); }
  .schema-grid > div { min-width: 0; padding: 1rem 1.2rem; background: var(--work); }
  .schema-grid > div > span { color: var(--navigation); font-size: 0.52rem; }
  .schema-grid pre { margin: 0.7rem 0 0; overflow: auto; color: var(--secondary); font: 0.66rem/1.58 var(--token-font-mono); }
  .tool-contract ul { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin: 0; padding: 0; background: var(--line); list-style: none; }
  .tool-contract li { align-items: flex-start; gap: 0.5rem; padding: 0.9rem 1rem; background: var(--panel); color: var(--secondary); font-size: 0.66rem; line-height: 1.45; }
  .tool-contract li :global(svg) { flex: 0 0 auto; margin-top: 0.1rem; color: var(--evidence); }

  .scenario-tabs { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--line-strong); background: var(--line); gap: 1px; }
  .scenario-tabs button { min-height: 6.5rem; padding: 1rem; border: 0; background: var(--panel); color: var(--secondary); text-align: left; cursor: pointer; }
  .scenario-tabs button:hover { background: var(--work); }
  .scenario-tabs button.active { background: var(--evidence-surface); box-shadow: inset 0 -3px 0 var(--evidence); }
  .scenario-tabs span { display: block; color: var(--muted); font: 0.51rem var(--token-font-mono); letter-spacing: 0.08em; }
  .scenario-tabs button.active span { color: var(--evidence); }
  .scenario-tabs strong { display: block; margin-top: 0.55rem; color: var(--ink); font: 400 1rem/1.2 var(--token-font-reading); }
  .scenario-stage { border: 1px solid var(--line-strong); border-top: 0; background: var(--raised); }
  .scenario-stage > header { gap: 0.6rem; padding: 1rem 1.2rem; border-bottom: 1px solid var(--line); color: var(--evidence); }
  .scenario-stage > header span { font-size: 0.53rem; }
  .scenario-stage > header p { margin: 0 0 0 auto; color: var(--ink); font: italic 1rem var(--token-font-reading); }
  .route-flow { display: flex; align-items: stretch; gap: 0.7rem; padding: 2rem 1.2rem; overflow-x: auto; }
  .route-node { display: grid; min-width: 9.6rem; min-height: 8.5rem; align-content: start; padding: 0.9rem; border: 1px solid; background: var(--panel); }
  .route-node > span { color: var(--muted); font: 0.52rem var(--token-font-mono); }
  .route-node code { margin-top: 1.35rem; color: inherit; font-size: 0.7rem; }
  .route-node small { margin-top: 0.4rem; color: var(--secondary); font-size: 0.6rem; line-height: 1.4; }
  .route-arrow { flex: 0 0 auto; align-self: center; color: var(--muted); }
  .answer-node { border-color: var(--token-color-success-border); background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .route-ledger { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; border-top: 1px solid var(--line); background: var(--line); }
  .route-ledger > div { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 1rem 1.2rem; background: var(--work); }
  .route-ledger span { width: 100%; color: var(--muted); font-size: 0.5rem; }
  .route-ledger code { padding: 0.3rem 0.45rem; border: 1px solid var(--evidence-border); color: var(--evidence); font-size: 0.6rem; }
  .route-ledger > div:last-child code { border-color: var(--context-border); color: var(--context); }

  .slide-lab { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(22rem, 0.7fr); border: 1px solid var(--line-strong); background: var(--line); gap: 1px; }
  .slide-column { min-width: 0; padding: 1.5rem; background: var(--pasteboard); }
  .view-ribbon { display: flex; gap: 0.55rem; align-items: center; margin-bottom: 0.8rem; color: var(--context); font: 0.52rem var(--token-font-mono); letter-spacing: 0.08em; }
  .view-ribbon span { margin-left: auto; }
  .mock-slide { position: relative; aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid var(--line-strong); background: var(--raised); box-shadow: 0 0.8rem 2rem var(--token-shadow-cast); }
  .slide-grid { position: absolute; inset: 0; opacity: 0.35; background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px); background-size: 8% 14.2%; }
  .mock-slide button { position: absolute; border: 1px solid transparent; background: transparent; color: var(--ink); text-align: left; cursor: pointer; }
  .mock-slide button:hover, .mock-slide button.active { border-color: var(--evidence-border); box-shadow: 0 0 0 2px color-mix(in srgb, var(--evidence-border) 20%, transparent); }
  .mock-slide button small { display: block; color: var(--evidence); font: 0.46rem var(--token-font-mono); }
  .slide-title { inset: 10% 8% auto; width: 57%; height: 24%; padding: 0.7rem; }
  .slide-title strong { display: block; margin-top: 0.35rem; font: 400 clamp(1rem, 2vw, 1.9rem) var(--token-font-reading); }
  .slide-title span { display: block; margin-top: 0.35rem; color: var(--secondary); font-size: clamp(0.48rem, 0.8vw, 0.72rem); }
  .slide-chart { left: 9%; bottom: 10%; width: 48%; height: 50%; padding: 0.7rem; }
  .chart-axis { display: flex; height: calc(100% - 2rem); align-items: end; gap: 9%; margin-top: 0.2rem; padding: 0 8%; border-bottom: 1px solid var(--line-strong); border-left: 1px solid var(--line-strong); }
  .chart-axis i { width: 15%; background: linear-gradient(var(--evidence), var(--navigation)); }
  .slide-chart > span { display: inline-block; width: 23%; padding-top: 0.3rem; color: var(--muted); font: 0.43rem var(--token-font-mono); text-align: center; }
  .slide-image { right: 8%; bottom: 11%; width: 28%; height: 68%; padding: 0.7rem; }
  .image-scene { position: relative; height: calc(100% - 2.2rem); min-height: 4rem; overflow: hidden; background: linear-gradient(155deg, var(--visual-surface), var(--navigation-surface)); }
  .image-scene span { position: absolute; top: 13%; right: 13%; width: 1.2rem; height: 1.2rem; border-radius: 50%; background: var(--context-border); }
  .image-scene i, .image-scene b { position: absolute; right: -10%; bottom: -18%; width: 82%; height: 67%; transform: rotate(40deg); background: var(--visual-border); }
  .image-scene b { right: 34%; bottom: -30%; background: var(--navigation-border); }
  .slide-image > span { display: block; margin-top: 0.35rem; color: var(--secondary); font-size: clamp(0.42rem, 0.65vw, 0.58rem); }
  .slide-number { position: absolute; right: 1rem; bottom: 0.65rem; color: var(--muted); font: 0.5rem var(--token-font-mono); }
  .slide-inspector { min-width: 0; background: var(--panel); }
  .slide-inspector > header { display: grid; grid-template-columns: auto 1fr auto; gap: 0.7rem; align-items: center; padding: 1rem; border-bottom: 1px solid var(--line); color: var(--context); }
  .slide-inspector header div { min-width: 0; }
  .slide-inspector header span { display: block; font-size: 0.48rem; }
  .slide-inspector header code { color: var(--ink); font-size: 0.68rem; }
  .slide-inspector header small { color: var(--context); font: 0.48rem var(--token-font-mono); }
  .manifest { display: grid; }
  .manifest button { display: grid; grid-template-columns: 3.2rem 1fr auto; gap: 0.65rem; align-items: center; min-height: 4.2rem; padding: 0.8rem 1rem; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--secondary); text-align: left; cursor: pointer; }
  .manifest button:hover, .manifest button.active { background: var(--work); box-shadow: inset 3px 0 0 var(--context); }
  .manifest span { color: var(--context); font: 0.5rem var(--token-font-mono); text-transform: uppercase; }
  .manifest code { color: var(--ink); font-size: 0.68rem; }
  .manifest small { color: var(--muted); font-size: 0.52rem; }
  .next-call { margin: 1rem; padding: 1rem; border: 1px solid var(--evidence-border); background: var(--evidence-surface); }
  .next-call > span { color: var(--evidence); font-size: 0.5rem; }
  .next-call strong { display: block; margin: 0.65rem 0 0.2rem; font-size: 1.15rem; }
  .next-call p { margin: 0; color: var(--secondary); font-size: 0.66rem; }
  .next-call div { display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem; padding-top: 0.8rem; border-top: 1px solid var(--evidence-border); color: var(--evidence); font: 0.57rem var(--token-font-mono); }
  .slide-rule { margin: 1rem; color: var(--muted); font-size: 0.65rem; line-height: 1.5; }

  .evidence-spectrum { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--line-strong); background: var(--line); gap: 1px; }
  .evidence-spectrum article { min-width: 0; min-height: 24rem; padding: 1.1rem; background: var(--raised); }
  .evidence-spectrum article header { gap: 0.55rem; padding-bottom: 0.8rem; border-bottom: 1px solid var(--line); color: var(--evidence); }
  .evidence-spectrum article header span { font: 0.55rem var(--token-font-mono); letter-spacing: 0.08em; }
  .evidence-spectrum article header small { margin-left: auto; color: var(--muted); font: 0.47rem var(--token-font-mono); }
  .evidence-spectrum blockquote, .context-card > p { min-height: 8.8rem; margin: 1rem 0; padding: 1rem; background: var(--evidence-surface); color: var(--secondary); font: italic 1.02rem/1.5 var(--token-font-reading); }
  .mini-series { display: grid; min-height: 8.8rem; align-content: center; gap: 0.45rem; margin: 1rem 0; padding: 1rem; background: var(--structured-surface); }
  .mini-series span { display: grid; grid-template-columns: 2rem 1fr; align-items: center; color: var(--structured); font: 0.57rem var(--token-font-mono); }
  .mini-series span::after { content: ""; grid-column: 2; grid-row: 1; width: calc(var(--value, 60) * 1%); height: 0.35rem; background: var(--structured-border); }
  .mini-series span:nth-child(1)::after { width: 62%; }.mini-series span:nth-child(2)::after { width: 68%; }.mini-series span:nth-child(3)::after { width: 79%; }.mini-series span:nth-child(4)::after { width: 91%; }
  .mini-series b { grid-column: 2; grid-row: 1; z-index: 1; justify-self: end; color: var(--ink); font-weight: 500; }
  .visual-swatch { min-height: 8.8rem; margin: 1rem 0; padding: 0.7rem; background: var(--visual-surface); }
  .visual-swatch .image-scene { height: 6.2rem; }
  .visual-swatch code { display: block; margin-top: 0.35rem; color: var(--visual); font-size: 0.52rem; }
  .context-card > p { background: var(--context-surface); font-style: normal; font-size: 0.82rem; }
  .structured-evidence header { color: var(--structured) !important; }
  .visual-evidence header { color: var(--visual) !important; }
  .context-card header { color: var(--context) !important; }
  .evidence-spectrum dl { margin: 0; }
  .evidence-spectrum dl div { padding: 0.75rem 0; border-top: 1px solid var(--line); }
  .evidence-spectrum dt { color: var(--muted); font: 0.5rem var(--token-font-mono); letter-spacing: 0.08em; text-transform: uppercase; }
  .evidence-spectrum dd { margin: 0.3rem 0 0; color: var(--secondary); font-size: 0.64rem; line-height: 1.4; }
  .evidence-rule { display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; margin-top: 1rem; padding: 1.2rem; border: 1px solid var(--evidence-border); background: var(--evidence-surface); color: var(--evidence); }
  .evidence-rule div span { display: block; font: 0.5rem var(--token-font-mono); letter-spacing: 0.08em; }
  .evidence-rule strong { display: block; margin-top: 0.3rem; color: var(--ink); font: 400 1rem var(--token-font-reading); }
  .evidence-rule > code { color: var(--evidence); font-size: 0.65rem; }
  .descriptor-rule { display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; margin-top: 0.75rem; padding: 1.2rem; border: 1px solid var(--structured-border); background: var(--structured-surface); color: var(--structured); text-decoration: none; }
  .descriptor-rule span { color: var(--structured); font: 0.5rem var(--token-font-mono); letter-spacing: 0.08em; }
  .descriptor-rule strong { display: block; margin-top: 0.3rem; color: var(--ink); font: 400 1rem var(--token-font-reading); }
  .descriptor-rule p { max-width: 80ch; margin: 0.3rem 0 0; color: var(--secondary); font-size: 0.64rem; line-height: 1.45; }
  .descriptor-rule > code { color: var(--structured); font-size: 0.63rem; }

  .projection-now { display: grid; grid-template-columns: minmax(17rem, 0.7fr) 1fr; gap: 2rem; align-items: center; margin-bottom: 1rem; padding: 1rem 1.2rem; border: 1px solid var(--token-color-success-border); background: var(--token-color-success-surface); }
  .projection-now > div { gap: 0.6rem; flex-wrap: wrap; }
  .projection-now span { color: var(--token-color-success-text); font-size: 0.5rem; }
  .projection-now code { color: var(--ink); font-size: 0.64rem; overflow-wrap: anywhere; }
  .projection-now p { margin: 0; color: var(--secondary); font-size: 0.68rem; line-height: 1.48; }
  .projection-map { display: grid; grid-template-columns: minmax(13rem, 0.75fr) 3.5rem minmax(18rem, 1fr) 3.5rem minmax(13rem, 0.75fr); gap: 0.8rem; align-items: center; padding: 1.2rem; border: 1px solid var(--line-strong); background: var(--pasteboard); }
  .resource-roots { display: grid; gap: 0.7rem; }
  .resource-roots article, .content-core, .projection-output { border: 1px solid var(--line-strong); background: var(--raised); }
  .resource-roots article { min-height: 9rem; padding: 1rem; }
  .resource-roots article :global(svg) { color: var(--navigation); }
  .resource-roots span, .projection-output > span { display: block; margin-top: 0.8rem; color: var(--navigation); font: 0.49rem var(--token-font-mono); letter-spacing: 0.08em; }
  .resource-roots strong, .projection-output strong { display: block; margin-top: 0.25rem; font: 400 1rem var(--token-font-reading); }
  .resource-roots small, .projection-output small { display: block; margin-top: 0.5rem; color: var(--muted); font-size: 0.58rem; line-height: 1.45; }
  .projection-arrow { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; color: var(--evidence); }
  .projection-arrow span { height: 1px; background: var(--evidence-border); }
  .content-core { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); }
  .content-core header { grid-column: 1 / -1; gap: 0.5rem; padding: 0.8rem; background: var(--panel); color: var(--structured); }
  .content-core header span { font-size: 0.5rem; }
  .content-core > div { padding: 0.8rem; background: var(--raised); }
  .content-core > div code { display: block; color: var(--ink); font-size: 0.67rem; }
  .content-core > div small { display: block; margin-top: 0.25rem; color: var(--muted); font-size: 0.55rem; }
  .content-core > p { grid-column: 1 / -1; margin: 0; padding: 0.75rem; background: var(--context-surface); color: var(--context); font-size: 0.6rem; text-align: center; }
  .projection-output { padding: 1rem; }
  .projection-output :global(svg) { color: var(--evidence); }
  .projection-output > span { color: var(--evidence); }
  .material-fork { justify-content: center; gap: 0.75rem; margin-top: 0.75rem; padding: 0.85rem; border: 1px solid var(--structured-border); background: var(--structured-surface); color: var(--structured); }
  .material-fork > div { gap: 0.45rem; }
  .material-fork span { color: var(--muted); font: 0.48rem var(--token-font-mono); letter-spacing: 0.07em; }
  .material-fork strong { color: var(--ink); font: 500 0.63rem var(--token-font-mono); }
  .material-fork > a { padding: 0.45rem 0.6rem; border: 1px solid var(--structured-border); color: var(--structured); font-size: 0.62rem; font-weight: 600; text-decoration: none; }
  .contract-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin-top: 1rem; border: 1px solid var(--line-strong); background: var(--line); }
  .contract-pair article { min-width: 0; background: var(--raised); }
  .contract-pair header { display: flex; justify-content: space-between; gap: 1rem; padding: 0.8rem 1rem; border-bottom: 1px solid var(--line); }
  .contract-pair header span { color: var(--evidence); font-size: 0.52rem; }
  .contract-pair header small { color: var(--muted); font-size: 0.55rem; }
  .contract-pair pre { margin: 0; padding: 1.2rem; overflow: auto; color: var(--secondary); font: 0.65rem/1.58 var(--token-font-mono); }
  .boundary-rule { display: grid; grid-template-columns: 1fr 2rem auto 2rem 1fr; align-items: center; margin-top: 1rem; padding: 1rem; border: 1px solid var(--context-border); background: var(--context-surface); }
  .boundary-rule i { height: 1px; background: var(--context-border); }
  .boundary-rule strong { color: var(--context); font: 0.5rem var(--token-font-mono); letter-spacing: 0.08em; }
  .slide-chip { padding: 0.65rem; border: 1px solid var(--line-strong); background: var(--raised); color: var(--ink); font: 0.56rem var(--token-font-mono); text-align: center; }
  .boundary-rule p { grid-column: 1 / -1; margin: 0.8rem 0 0; color: var(--secondary); font-size: 0.64rem; text-align: center; }

  .decision-card { display: grid; grid-template-columns: auto 1fr auto; gap: 1.5rem; margin: 5rem 0 3rem; padding: 2rem; border: 1px solid var(--evidence-border); background: var(--evidence-surface); }
  .decision-mark { display: grid; width: 4rem; height: 4rem; place-items: center; border: 1px solid var(--evidence-border); border-radius: 50%; color: var(--evidence); }
  .decision-card > div > span { color: var(--evidence); font-size: 0.52rem; }
  .decision-card h2 { margin: 0.45rem 0; font: 400 clamp(1.8rem, 3.5vw, 3rem)/1 var(--token-font-reading); }
  .decision-card p { max-width: 76ch; margin: 0; color: var(--secondary); font-size: 0.76rem; line-height: 1.55; }
  .decision-card a { gap: 0.45rem; padding: 0.75rem 0.9rem; border: 1px solid var(--evidence-border); color: var(--evidence); font-size: 0.7rem; text-decoration: none; white-space: nowrap; }
  .page-footer { justify-content: space-between; padding: 1.5rem 0 3rem; color: var(--muted); font: 0.54rem var(--token-font-mono); letter-spacing: 0.08em; text-transform: uppercase; }
  code { font-family: var(--token-font-mono); }

  @media (max-width: 74rem) {
    .local-nav nav a:not(.back-link) { display: none; }
    .hero { grid-template-columns: 1fr 1fr; gap: 3rem; }
    .tool-field, .evidence-spectrum { grid-template-columns: repeat(2, 1fr); }
    .scenario-tabs { grid-template-columns: repeat(2, 1fr); }
    .projection-map { grid-template-columns: 1fr; }
    .projection-arrow { grid-template-columns: 1fr auto 1fr; transform: rotate(90deg); width: 4rem; margin: 0 auto; }
    .projection-output { width: min(100%, 28rem); justify-self: center; }
  }

  @media (max-width: 56rem) {
    .local-nav { padding-inline: 1rem; }
    .brand > span:not(.brand-mark), .brand > :global(svg) { display: none; }
    main, .page-footer { width: min(100% - 1.5rem, 88rem); }
    .hero { grid-template-columns: 1fr; min-height: auto; padding: 4.5rem 0; }
    .hero h1 { font-size: clamp(3.8rem, 18vw, 6rem); }
    .section { padding: 4.5rem 0; }
    .section-heading, .projection-now { grid-template-columns: 1fr; gap: 1.4rem; }
    .law-strip { grid-template-columns: 1fr; }
    .law-gate { grid-template: none; grid-auto-flow: column; align-items: center; min-height: 5rem; }
    .law-gate span { width: 100%; height: 1px; }
    .schema-grid, .tool-contract ul, .route-ledger, .slide-lab, .contract-pair, .decision-card { grid-template-columns: 1fr; }
    .material-fork { align-items: flex-start; flex-direction: column; }
    .material-fork > :global(svg) { transform: rotate(90deg); align-self: center; }
    .scenario-stage > header { align-items: flex-start; flex-wrap: wrap; }
    .scenario-stage > header p { width: 100%; margin-left: 0; }
    .decision-card a { width: fit-content; }
    .page-footer { flex-direction: column; gap: 0.5rem; align-items: flex-start; }
  }

  @media (max-width: 38rem) {
    .local-nav { gap: 0.75rem; }
    .local-nav .back-link { font-size: 0; }
    .local-nav .back-link :global(svg) { width: 1rem; height: 1rem; }
    .verb-index, .tool-field, .scenario-tabs, .evidence-spectrum { grid-template-columns: 1fr; }
    .verb-axis { display: none; }
    .hero-status { align-items: flex-start; flex-direction: column; }
    .tool-contract > header { align-items: flex-start; flex-wrap: wrap; }
    .contract-verdict { margin-left: 0; }
    .route-flow { align-items: center; flex-direction: column; overflow: visible; }
    .route-node { width: 100%; min-width: 0; }
    .route-arrow { transform: rotate(90deg); }
    .slide-column { padding: 0.75rem; }
    .view-ribbon span { display: none; }
    .slide-title { width: 63%; }
    .manifest button { grid-template-columns: 3rem 1fr; }
    .manifest small { grid-column: 2; }
    .evidence-rule { grid-template-columns: auto 1fr; align-items: start; }
    .evidence-rule > code { grid-column: 2; }
    .descriptor-rule { grid-template-columns: auto 1fr; align-items: start; }
    .descriptor-rule > code { grid-column: 2; }
    .boundary-rule { grid-template-columns: 1fr; gap: 0.5rem; }
    .boundary-rule i { display: none; }
    .boundary-rule p { grid-column: auto; }
  }
</style>
