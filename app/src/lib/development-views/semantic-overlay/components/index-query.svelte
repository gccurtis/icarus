<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import AlertTriangle from "@lucide/svelte/icons/triangle-alert";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Binary from "@lucide/svelte/icons/binary";
  import Check from "@lucide/svelte/icons/check";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import Database from "@lucide/svelte/icons/database";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import Network from "@lucide/svelte/icons/network";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Route from "@lucide/svelte/icons/route";
  import Search from "@lucide/svelte/icons/search";
  import ServerCog from "@lucide/svelte/icons/server-cog";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sigma from "@lucide/svelte/icons/sigma";
  import Sparkles from "@lucide/svelte/icons/sparkles";

  type AlgorithmId = "vectors" | "partition" | "traversal" | "coalescing";
  type FileGroup = "configuration" | "embedding" | "representation" | "capability" | "runtime" | "tests" | "artifact";

  type Algorithm = {
    id: AlgorithmId;
    number: string;
    label: string;
    title: string;
    summary: string;
    equations: { symbol: string; meaning: string }[];
    steps: string[];
    invariants: string[];
    complexity: string;
  };

  type LedgerEntry = {
    group: FileGroup;
    action: "add" | "change";
    path: string;
    lines: string;
    symbols: string;
    change: string;
    reason: string;
  };

  const ALGORITHMS: Algorithm[] = [
    {
      id: "vectors",
      number: "01",
      label: "Vector geometry",
      title: "All comparisons happen on the unit sphere.",
      summary:
        "Objects, centroids, and the query are normalized before comparison. Once normalized, a dot product is cosine similarity; that gives one metric to build and search the tree.",
      equations: [
        { symbol: "x̂ = x / ‖x‖₂", meaning: "Normalize every non-zero vector." },
        { symbol: "s(a,b) = â · b̂", meaning: "Cosine similarity, in [−1, 1]." },
        { symbol: "c(G) = normalize(Σ x̂)", meaning: "Spherical centroid of cluster G." }
      ],
      steps: [
        "Reject empty, zero-magnitude, non-finite, or mixed-dimensional vectors.",
        "Normalize every semantic object exactly once while constructing the pure index draft.",
        "Normalize a query once; normalize hydrated centroids and candidate vectors defensively at query time.",
        "If a centroid sum cancels to approximately zero, fall back to a known member vector so the tree stays valid."
      ],
      invariants: ["finite coordinates", "one dimension per space", "non-zero magnitude", "deterministic fallback"],
      complexity: "Normalization and one similarity each cost O(d), where d is embedding dimension."
    },
    {
      id: "partition",
      number: "02",
      label: "Recursive build",
      title: "Deterministic spherical k-means creates the forest.",
      summary:
        "Each oversized group is split by farthest-first seeds and bounded spherical k-means. Stable ID ordering removes random initialization, making the same corpus and configuration produce the same draft tree.",
      equations: [
        { symbol: "c₁ = argminₓ x̂ · μ̂", meaning: "First seed: farthest from corpus centroid μ." },
        { symbol: "cₜ = argminₓ maxⱼ<t(x̂ · cⱼ)", meaning: "Next seed: least similar to its nearest chosen seed." },
        { symbol: "a(x) = argmaxⱼ x̂ · cⱼ", meaning: "Assign each member to its most similar centroid." },
        { symbol: "Δ = maxⱼ(1 − cⱼ(old) · cⱼ(new))", meaning: "Largest centroid cosine displacement." }
      ],
      steps: [
        "Sort objects lexically by semantic object ID and choose up to branchFactor clusters.",
        "Assign by maximum cosine. Exact ties remain with the lower cluster index.",
        "Repair an empty cluster with the least-similar member of the largest viable donor, breaking ties by ID.",
        "Recompute spherical centroids; stop on stable membership, Δ ≤ ε, or maxIterations.",
        "Recurse until each leaf contains at most leafSize object IDs; paths such as 2.0.3 are stable draft keys."
      ],
      invariants: ["no random seed", "no empty cluster", "bounded iterations", "each object appears once"],
      complexity: "Build ≈ O(depth·I·(n·b·d + n log n)); cosine work usually dominates, and stored nodes/references are O(n)."
    },
    {
      id: "traversal",
      number: "03",
      label: "Best-first query",
      title: "A max-heap follows the most promising centroid first.",
      summary:
        "The query starts at every root and expands nodes by query-to-centroid cosine. Objects are not scored until a visited leaf admits them into the candidate set.",
      equations: [
        { symbol: "p(node) = q̂ · ĉnode", meaning: "Max-heap priority for every frontier node." },
        { symbol: "C = min(|E|, max(k, k·m))", meaning: "Candidate budget for eligible set E, top-k k, multiplier m." },
        { symbol: "score(o) = q̂ · ô", meaning: "Exact object score, computed only for candidates." }
      ],
      steps: [
        "Apply project and ResourceSet eligibility before the provider call; an empty scope returns without using Jina.",
        "Embed the query with Jina's retrieval.query task in the overlay's configured vector space.",
        "Push all roots into a binary max-heap; pop and expand the highest-centroid-similarity node.",
        "At leaves, add only eligible object IDs. Check at C candidates; if overlap leaves fewer than k hits, double the checkpoint up to |E|.",
        "Exact-score candidates, coalesce overlaps, order deterministically, then slice to k."
      ],
      invariants: ["scope before retrieval", "exact candidate scores", "cycle/revisit rejection", "observable diagnostics"],
      complexity: "Vector math is O(V·d + C·d), heap work O(V log V), geometric overlap checks O(C log C); the oracle is O(N·d)."
    },
    {
      id: "coalescing",
      number: "04",
      label: "Hit coalescing",
      title: "Overlapping evidence becomes one citation-ready hit.",
      summary:
        "Selected objects are grouped by exact source identity, revision, and encoding. Strict interval overlap forms transitive connected components; touching but non-overlapping spans stay separate.",
      equations: [
        { symbol: "a.from < b.to ∧ b.from < a.to", meaning: "Strict overlap for half-open spans [from,to)." },
        { symbol: "span(H) = [min from, max to)", meaning: "Union coordinates for one overlap component." },
        { symbol: "score(H) = max score(o)", meaning: "A merged hit keeps its strongest member score." }
      ],
      steps: [
        "Group by source kind + source ID + revision + encoding; never merge across provenance boundaries.",
        "Sort by from, then to, then object ID; sweep intervals to form transitive overlap groups.",
        "Compare text in every shared coordinate range and fail if stored spans disagree.",
        "Union exact text and coordinates, retain every contributing object ID, and copy the overlay generation.",
        "Rank merged hits by score and stable provenance tie-breakers; apply top-k only after merging."
      ],
      invariants: ["same source revision", "exact overlap text", "transitive union", "top-k after merge"],
      complexity: "Grouping and interval sorting cost O(C log C); the sweep itself is O(C)."
    }
  ];

  const LEDGER: LedgerEntry[] = [
    {
      group: "configuration",
      action: "change",
      path: "app/configuration/semantic-overlay.yaml",
      lines: "L1–25",
      symbols: "semanticOverlay.embedding · semanticOverlay.index",
      change: "Adds Jina endpoint/model/dimension/timeout provision and five recursive-index controls.",
      reason: "Keep credentials local while making the embedding space and retrieval policy explicit, typed runtime inputs."
    },
    {
      group: "embedding",
      action: "add",
      path: "app/src/lib/model/server/embedding/types.ts",
      lines: "L7–43",
      symbols: "EmbeddingModel · EmbeddingResult · EmbeddingState · EmbeddingServiceError",
      change: "Defines the server boundary for token-field, passage, and asymmetric query embedding operations.",
      reason: "Representation remains provider-free; the runtime owns HTTP, credentials, and usage metadata."
    },
    {
      group: "embedding",
      action: "add",
      path: "app/src/lib/model/server/embedding/constructor.ts",
      lines: "L8–61",
      symbols: "createEmbedding",
      change: "Reads and validates the nested Jina configuration, including the local API key and 1–2048 dense dimensions.",
      reason: "Invalid provisioning fails during server-model construction rather than on the first user query."
    },
    {
      group: "embedding",
      action: "add",
      path: "app/src/lib/model/server/embedding/definition.ts",
      lines: "L16–43",
      symbols: "JinaEmbedding · defineEmbedding",
      change: "Binds immutable embedding state to the three adapter methods and exposes the configured EmbeddingSpace.",
      reason: "Capabilities depend on a narrow model object instead of configuration or fetch directly."
    },
    {
      group: "embedding",
      action: "add",
      path: "app/src/lib/model/server/embedding/methods/request.ts",
      lines: "L8–79",
      symbols: "JinaResponse · requestJina",
      change: "Implements bearer-authenticated JSON POST, timeout abort, response parsing, request IDs, and bounded error detail.",
      reason: "One audited transport path prevents credential leakage and inconsistent provider error handling."
    },
    {
      group: "embedding",
      action: "add",
      path: "app/src/lib/model/server/embedding/methods/embed.ts",
      lines: "L18–151",
      symbols: "embedTokenField · embedPassages · embedQuery",
      change: "Validates ordered finite response rows and sends distinct payloads for token, passage, and query embedding.",
      reason: "Translation needs multivectors while stored objects and queries need compatible dense vectors with asymmetric tasks."
    },
    {
      group: "embedding",
      action: "add",
      path: "app/src/lib/model/server/embedding/index.server.ts",
      lines: "L1–7",
      symbols: "server-only public exports",
      change: "Exports construction/definition and the model types through the server architecture boundary.",
      reason: "Prevents client-side imports of a credential-bearing model."
    },
    {
      group: "embedding",
      action: "add",
      path: "app/src/lib/model/server/embedding/embedding.md",
      lines: "L1–13",
      symbols: "model object contract",
      change: "Documents ownership, operation semantics, and the local-secret boundary.",
      reason: "Keeps the generated model folder compliant with repository structure checks."
    },
    {
      group: "representation",
      action: "change",
      path: "app/src/lib/representation/data/types/semantic/index.ts",
      lines: "L6–90",
      symbols: "RecursiveIndexConfiguration · node drafts · searchable values · diagnostics",
      change: "Extends the stored contract with build-time, hydrated-query, and observable result message types.",
      reason: "Makes state rows distinct from transient algorithm messages without duplicating source membership in index nodes."
    },
    {
      group: "representation",
      action: "change",
      path: "app/src/lib/representation/data/types/semantic/translation.ts",
      lines: "L48",
      symbols: "ProviderUsage.operation",
      change: "Adds queryVector to the closed usage-operation union.",
      reason: "Query cost and provider request IDs remain inspectable beside translation usage."
    },
    {
      group: "representation",
      action: "add",
      path: "app/src/lib/representation/data/behavior/semantic/vector.ts",
      lines: "L1–52",
      symbols: "validateVector · normalizeVector · dotProduct · cosineSimilarity · sphericalCentroid",
      change: "Adds guarded vector primitives and a cancellation-safe spherical centroid.",
      reason: "Build, traversal, and the exhaustive oracle share one tested numerical contract."
    },
    {
      group: "representation",
      action: "add",
      path: "app/src/lib/representation/data/behavior/semantic/recursive-index.ts",
      lines: "L22–222",
      symbols: "validateRecursiveIndexConfiguration · sphericalPartition · buildRecursiveIndex",
      change: "Implements deterministic farthest-first spherical k-means and recursive leaf-bounded tree construction.",
      reason: "Produces a provider/store-independent draft that is reproducible and directly unit-testable."
    },
    {
      group: "representation",
      action: "add",
      path: "app/src/lib/representation/data/behavior/semantic/scope.ts",
      lines: "L6–45",
      symbols: "ResourceSetLookup · resourceInScope",
      change: "Evaluates exact resources, kind prefixes, nested sets, exclusions, empty includes, and cycles.",
      reason: "Scoping stays in query eligibility and reuses the representation's existing ResourceSet contract."
    },
    {
      group: "representation",
      action: "add",
      path: "app/src/lib/representation/data/behavior/semantic/query.ts",
      lines: "L27–343",
      symbols: "coalesceSemanticHits · searchSemanticObjectsExhaustively · searchRecursiveIndex",
      change: "Adds strict span validation/union, a binary max-heap, lazy candidate scoring, diagnostics, and an exact oracle.",
      reason: "Separates approximate candidate selection from exact ranking and makes recall measurable."
    },
    {
      group: "capability",
      action: "add",
      path: "app/src/lib/capabilities/semantic-overlay/index.remote.ts",
      lines: "L1–15",
      symbols: "querySemanticOverlay · rebuildSemanticIndex",
      change: "Publishes one scoped query and one scoped rebuild procedure.",
      reason: "Creates the remote seam the future Derived Output agent will call."
    },
    {
      group: "capability",
      action: "add",
      path: "…/api/query-semantic-overlay/query-semantic-overlay.ts",
      lines: "L20–129",
      symbols: "querySemanticOverlay",
      change: "Joins active sources/objects, applies ResourceSet eligibility, selects the current tree, embeds once, and returns hits plus diagnostics.",
      reason: "Coordinates runtime services and pure behavior while returning citation-ready values rather than store rows."
    },
    {
      group: "capability",
      action: "add",
      path: "…/api/query-semantic-overlay/validate-query-semantic-overlay.ts",
      lines: "L1–69",
      symbols: "validateQuerySemanticOverlay",
      change: "Validates nonblank text, topK 1–100, and the complete recursive ResourceSet input shape.",
      reason: "The unchecked transport wrapper receives a fully checked domain message."
    },
    {
      group: "capability",
      action: "add",
      path: "…/api/rebuild-semantic-index/rebuild-semantic-index.ts",
      lines: "L20–126",
      symbols: "rebuildSemanticIndex · persist",
      change: "Builds a replacement draft, persists descendants, publishes roots, then retires the previous tree; failed partial builds are cleaned up.",
      reason: "Readers retain a complete old index until the successor is navigable."
    },
    {
      group: "capability",
      action: "add",
      path: "…/api/rebuild-semantic-index/validate-rebuild-semantic-index.ts",
      lines: "L1–11",
      symbols: "validateRebuildSemanticIndex",
      change: "Restricts rebuild input to an empty object.",
      reason: "Project scope and configuration come from trusted runtime context, not callers."
    },
    {
      group: "capability",
      action: "add",
      path: "…/api/shared/{configuration,overlay,rows}.ts",
      lines: "L1–27 · L1–19 · L1–15",
      symbols: "semanticIndexConfiguration · currentOverlay · rowsOf",
      change: "Centralizes typed config parsing, one-overlay enforcement, and table hydration helpers.",
      reason: "Both procedures share identical project-state assumptions and failure behavior."
    },
    {
      group: "capability",
      action: "add",
      path: "…/types/{query-semantic-overlay,rebuild-semantic-index}.ts",
      lines: "L1–19 · L1–8",
      symbols: "procedure input/result types",
      change: "Defines remote messages including provider usage and recursive query diagnostics.",
      reason: "Callers can observe generation, retrieval work, and rebuild size without touching internal rows."
    },
    {
      group: "capability",
      action: "add",
      path: "app/src/lib/capabilities/semantic-overlay/semantic-overlay.md",
      lines: "L1–13",
      symbols: "capability contract",
      change: "Documents access, state ownership, and query/rebuild responsibilities.",
      reason: "Satisfies the capability architecture contract and records the trust boundary."
    },
    {
      group: "runtime",
      action: "change",
      path: "app/src/lib/runtime/server/start.server.ts",
      lines: "L5 · L47 · L54",
      symbols: "createEmbedding · buildServerModel",
      change: "Constructs the embedding model immediately after configuration and adds it to the server graph.",
      reason: "Credential/config errors surface during startup; every capability receives one shared adapter."
    },
    {
      group: "runtime",
      action: "change",
      path: "app/src/lib/runtime/server/types.ts",
      lines: "L1 · L23",
      symbols: "ServerModel.embedding",
      change: "Adds the server-only EmbeddingModel dependency to the runtime graph type.",
      reason: "Makes the new service explicit rather than importing a singleton provider from capabilities."
    },
    {
      group: "tests",
      action: "add",
      path: "app/src/lib/model/server/embedding/test/unit/embedding.test.ts",
      lines: "L1–158",
      symbols: "6 adapter tests",
      change: "Asserts configuration failures, all three exact request payloads, usage parsing, response order/shape, timeout, and sanitized errors.",
      reason: "Provider integration behavior is proven without spending tokens or depending on the network."
    },
    {
      group: "tests",
      action: "add",
      path: "app/src/lib/model/server/embedding/test/integration/jina.test.ts",
      lines: "L1–79",
      symbols: "opt-in live Jina suite",
      change: "Calls all three real modes and retrieves the expected passage through a built recursive index.",
      reason: "Confirms the configured key, current provider schema, shared vector space, and end-to-end retrieval seam."
    },
    {
      group: "tests",
      action: "add",
      path: "…/behavior/semantic/test/unit/index.test.ts",
      lines: "L1–353",
      symbols: "8 index/query tests",
      change: "Covers determinism, degenerate vectors, tree-vs-oracle recall, reduced scoring, scope semantics, and transitive overlap merging.",
      reason: "The approximation is judged against exact cosine rather than only testing implementation details."
    },
    {
      group: "tests",
      action: "add",
      path: "…/capabilities/semantic-overlay/test/unit/semantic-overlay.test.ts",
      lines: "L1–265",
      symbols: "5 capability tests",
      change: "Exercises successful replacement, failure cleanup, query output, empty scope short-circuit, ResourceSet filtering, and validation.",
      reason: "Verifies store and runtime orchestration around the pure algorithms."
    },
    {
      group: "tests",
      action: "change",
      path: "app/src/lib/runtime/server/test/{construction,lifetime}.test.ts",
      lines: "L25–33 · L66 / L31–39",
      symbols: "embedding model mocks · graph assertion",
      change: "Adds a no-network embedding test double and asserts the runtime graph owns it.",
      reason: "Existing server lifecycle tests remain isolated from credentials and Jina."
    },
    {
      group: "artifact",
      action: "change",
      path: "…/semantic-overlay/components/implementation.svelte",
      lines: "L489",
      symbols: "pass-two review link",
      change: "Replaces the pass-one footer's architecture backlink with a direct link to this phase-two review.",
      reason: "Connects the two implementation artifacts in delivery order."
    },
    {
      group: "artifact",
      action: "change",
      path: "…/semantic-overlay/components/components.md",
      lines: "L3–11",
      symbols: "development component concern contract",
      change: "Distinguishes the pass-one plan from the pass-two implementation review and names this view's evidence boundaries.",
      reason: "Keeps the development-view folder contract accurate after adding a second component."
    },
    {
      group: "artifact",
      action: "add",
      path: "…/development-views/semantic-overlay/components/index-query.svelte",
      lines: "L1–1145",
      symbols: "algorithms · exact ledger · evidence · limitations",
      change: "Adds the visual implementation review you are reading.",
      reason: "The review surface stays executable alongside the branch it describes."
    },
    {
      group: "artifact",
      action: "add",
      path: "app/src/routes/demo/semantic-overlay/index-query/+page.svelte",
      lines: "L1–5",
      symbols: "SemanticOverlayIndexQuery",
      change: "Mounts the phase-two artifact beneath the existing Semantic Overlay demo.",
      reason: "Provides a stable URL for browser review without adding a product surface."
    }
  ];

  const GROUPS: { id: "all" | FileGroup; label: string }[] = [
    { id: "all", label: "all" },
    { id: "configuration", label: "config" },
    { id: "embedding", label: "embedding" },
    { id: "representation", label: "algorithms" },
    { id: "capability", label: "capability" },
    { id: "runtime", label: "runtime" },
    { id: "tests", label: "tests" },
    { id: "artifact", label: "view" }
  ];

  const EVIDENCE = [
    { value: "608", label: "normal tests", detail: "608 pass · 1 live suite skipped" },
    { value: "1", label: "live Jina proof", detail: "all modes + relevant passage" },
    { value: "10/10", label: "capability lint", detail: "zero findings" },
    { value: "6/6", label: "representation lint", detail: "zero findings" }
  ];

  let activeAlgorithm = $state<AlgorithmId>("partition");
  let activeGroup = $state<"all" | FileGroup>("all");
  const algorithm = $derived(ALGORITHMS.find((item) => item.id === activeAlgorithm) ?? ALGORITHMS[0]);
  const visibleLedger = $derived(
    activeGroup === "all" ? LEDGER : LEDGER.filter((entry) => entry.group === activeGroup)
  );
</script>

<svelte:head>
  <title>Semantic Overlay index + query — Icarus</title>
  <meta
    name="description"
    content="A line-level implementation review of the Jina embedding adapter, recursive semantic index, and scoped query path."
  />
</svelte:head>

<div class="review-shell">
  <header class="topbar">
    <a class="wordmark" href="/demo/semantic-overlay/implementation">
      <ChevronLeft size={15} aria-hidden="true" />
      <span class="mark" aria-hidden="true"></span>
      <span>ICARUS</span>
      <span class="muted">/ SEMANTIC OVERLAY / PASS 02</span>
    </a>
    <nav aria-label="On this page">
      <a href="#system">System</a>
      <a href="#algorithms">Algorithms</a>
      <a href="#publication">Publication</a>
      <a href="#files">Line ledger</a>
      <a href="#evidence">Evidence</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow"><CircleDot size={13} aria-hidden="true" /> IMPLEMENTATION / REVIEW BRANCH</div>
        <h1>Index the meaning.<br /><em>Retrieve the evidence.</em></h1>
        <p class="lede">
          Pass two is implemented in an isolated worktree: a server-owned Jina v4 adapter, a
          deterministic recursive spherical index, scoped best-first retrieval, and citation-ready
          overlap coalescing. It is tested, live-provider verified, and intentionally not merged.
        </p>
        <div class="hero-actions">
          <a class="primary-action" href="#algorithms">Inspect the algorithms <ArrowDown size={15} aria-hidden="true" /></a>
          <a href="#files">See every changed line</a>
        </div>
      </div>

      <aside class="branch-card">
        <header><GitBranch size={17} aria-hidden="true" /> REVIEW STATE</header>
        <div class="branch-name"><span>branch</span><code>work/semantic-overlay-index-query</code></div>
        <div class="branch-state"><span class="pulse"></span><strong>Implemented in worktree</strong><small>Not folded into main</small></div>
        <dl>
          {#each EVIDENCE as item}
            <div><dt>{item.label}</dt><dd>{item.value}</dd><small>{item.detail}</small></div>
          {/each}
        </dl>
        <p><KeyRound size={13} aria-hidden="true" /> The Jina key was found in ignored <code>local.yaml</code>, copied only into this worktree, and never written to tracked files or test output.</p>
      </aside>
    </section>

    <section class="result-strip" aria-label="Implemented result">
      <Check size={18} aria-hidden="true" />
      <p><strong>Working seam:</strong> query text → scoped eligibility → Jina query vector → recursive candidates → exact cosine → coalesced SemanticHit[]</p>
      <span>PHASE 02 / BUILT</span>
    </section>

    <section id="system" class="section">
      <div class="section-heading">
        <div><span class="kicker">SYSTEM BOUNDARY</span><h2>One provider edge. One pure algorithm core.</h2></div>
        <p>HTTP and credentials stop in the server model. Representation owns only deterministic values and behavior; capabilities coordinate scope, storage, and observability.</p>
      </div>

      <div class="system-flow">
        <article class="system-node provider">
          <div class="node-icon"><Sparkles size={19} aria-hidden="true" /></div>
          <span>PROVIDER EDGE</span>
          <h3>Jina embeddings v4</h3>
          <p>token multivectors · passage vectors · query vectors</p>
          <code>model/server/embedding</code>
        </article>
        <div class="flow-arrow"><ArrowRight size={20} aria-hidden="true" /><small>plain values</small></div>
        <article class="system-node core">
          <div class="node-icon"><Sigma size={19} aria-hidden="true" /></div>
          <span>PURE CORE</span>
          <h3>Semantic behavior</h3>
          <p>vector geometry · recursive build · scope · query · coalescing</p>
          <code>representation/data/behavior/semantic</code>
        </article>
        <div class="flow-arrow"><ArrowRight size={20} aria-hidden="true" /><small>drafts + hits</small></div>
        <article class="system-node capability">
          <div class="node-icon"><Route size={19} aria-hidden="true" /></div>
          <span>PROJECT SCOPE</span>
          <h3>Overlay capability</h3>
          <p>hydrate · filter · embed · traverse · publish · log</p>
          <code>capabilities/semantic-overlay</code>
        </article>
      </div>

      <div class="contract-grid">
        <article>
          <header><ServerCog size={16} aria-hidden="true" /><span>SERVER MODEL</span></header>
          <pre><code>interface EmbeddingModel &#123;
  space: EmbeddingSpace;
  tokenField(text): TokenEmbeddingField;
  passages(texts): number[][];
  query(text): number[];
&#125;</code></pre>
          <p>Owns API key, fetch, timeout, provider response validation, and usage capture.</p>
        </article>
        <article>
          <header><Network size={16} aria-hidden="true" /><span>INDEX STATE</span></header>
          <pre><code>SemanticIndexNode &#123;
  centroidVector: number[];
  children:
    | &#123; kind: "nodes"; ids: Id[] &#125;
    | &#123; kind: "objects"; ids: Id[] &#125;;
&#125;</code></pre>
          <p>A discriminated child union prevents a node from simultaneously being a branch and a leaf.</p>
        </article>
        <article>
          <header><Search size={16} aria-hidden="true" /><span>QUERY VALUE</span></header>
          <pre><code>SemanticHit &#123;
  semanticObjectIds: Id[];
  source: SemanticSourceSnapshot;
  span: &#123; from; to; text &#125;;
  score; overlayGeneration;
&#125;</code></pre>
          <p>The result copies evidence values and provenance; several IDs record an overlap union.</p>
        </article>
      </div>
    </section>

    <section id="algorithms" class="section">
      <div class="section-heading">
        <div><span class="kicker">ALGORITHM NOTEBOOK</span><h2>The math and execution path</h2></div>
        <p>Select a stage to inspect its equations, exact procedure, invariants, and computational shape.</p>
      </div>

      <div class="algorithm-tabs" role="tablist" aria-label="Algorithm stages">
        {#each ALGORITHMS as item}
          <button
            type="button"
            role="tab"
            aria-selected={activeAlgorithm === item.id}
            class:active={activeAlgorithm === item.id}
            onclick={() => (activeAlgorithm = item.id)}
          >
            <span>{item.number}</span><strong>{item.label}</strong>
          </button>
        {/each}
      </div>

      <div class="algorithm-panel" role="tabpanel">
        <div class="algorithm-intro">
          <span class="panel-number">{algorithm.number}</span>
          <div><h3>{algorithm.title}</h3><p>{algorithm.summary}</p></div>
        </div>
        <div class="equation-grid">
          {#each algorithm.equations as equation}
            <article><code>{equation.symbol}</code><p>{equation.meaning}</p></article>
          {/each}
        </div>
        <div class="algorithm-detail">
          <div>
            <span class="detail-label">PROCEDURE</span>
            <ol>{#each algorithm.steps as step, index}<li><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>{/each}</ol>
          </div>
          <aside>
            <span class="detail-label">INVARIANTS</span>
            <ul>{#each algorithm.invariants as invariant}<li><Check size={13} aria-hidden="true" />{invariant}</li>{/each}</ul>
            <div class="complexity"><Activity size={15} aria-hidden="true" /><div><span>COMPUTATIONAL SHAPE</span><p>{algorithm.complexity}</p></div></div>
          </aside>
        </div>
      </div>
    </section>

    <section class="section traversal-section" aria-labelledby="traversal-title">
      <div class="section-heading compact">
        <div><span class="kicker">QUERY WALKTHROUGH</span><h2 id="traversal-title">The heap de-clusters on demand.</h2></div>
        <p>Illustrative order, not a fixed tree: centroid score determines the next branch; only reached leaf objects enter exact ranking.</p>
      </div>

      <div class="tree-card">
        <div class="query-pill"><Search size={14} aria-hidden="true" /><span>q̂</span><code>“revision-safe retrieval”</code></div>
        <div class="tree-roots">
          <div class="tree-node faded"><small>root 0</small><strong>.31</strong></div>
          <div class="tree-node hot"><small>root 1</small><strong>.87</strong><span>POP 01</span></div>
          <div class="tree-node"><small>root 2</small><strong>.54</strong></div>
        </div>
        <div class="tree-connector"></div>
        <div class="tree-children">
          <div class="tree-node"><small>1.0</small><strong>.62</strong></div>
          <div class="tree-node hot"><small>1.1</small><strong>.91</strong><span>POP 02</span></div>
          <div class="tree-node"><small>1.2</small><strong>.73</strong></div>
        </div>
        <div class="tree-connector short"></div>
        <div class="leaf-row">
          <div><span>LEAF 1.1</span><code>o₈ · o₁₃ · o₂₁ · o₃₄</code></div>
          <ArrowRight size={18} aria-hidden="true" />
          <div><span>EXACT CANDIDATES</span><code>q̂·ô₈ · q̂·ô₁₃ · q̂·ô₂₁ · q̂·ô₃₄</code></div>
          <ArrowRight size={18} aria-hidden="true" />
          <div class="hit"><span>COALESCED HITS</span><code>rank → top k</code></div>
        </div>
        <div class="heap-note"><Binary size={15} aria-hidden="true" /><strong>Frontier after POP 02</strong><code>1.2(.73) · 1.0(.62) · root 2(.54) · root 0(.31)</code></div>
      </div>
    </section>

    <section class="section jina-section" aria-labelledby="jina-title">
      <div class="section-heading">
        <div><span class="kicker">CURRENT JINA CONTRACT</span><h2 id="jina-title">Three calls, two vector shapes.</h2></div>
        <p>The adapter uses the same model but deliberately different tasks and output modes. Authorization is redacted here and lives only in ignored local configuration.</p>
      </div>

      <div class="payload-grid">
        <article>
          <header><span>TRANSLATION / PASS 1</span><strong>contextual token field</strong></header>
          <pre><code>POST /v1/embeddings
Authorization: Bearer ••••••••
&#123;
  "model": "jina-embeddings-v4",
  "input": [sourceText],
  "task": "retrieval.passage",
  "return_multivector": true,
  "return_tokenized_input": true,
  "embedding_type": "float",
  "truncate": false
&#125;</code></pre>
          <p>No <code>dimensions</code> field: multivector output retains its provider token-vector width.</p>
        </article>
        <article>
          <header><span>TRANSLATION / PASS 2</span><strong>stored object vectors</strong></header>
          <pre><code>POST /v1/embeddings
&#123;
  "model": "jina-embeddings-v4",
  "input": segmentTexts,
  "task": "retrieval.passage",
  "dimensions": 512,
  "late_chunking": true,
  "embedding_type": "float",
  "truncate": false
&#125;</code></pre>
          <p>Every finalized semantic segment receives one dense vector in the overlay embedding space.</p>
        </article>
        <article>
          <header><span>RETRIEVAL</span><strong>asymmetric query vector</strong></header>
          <pre><code>POST /v1/embeddings
&#123;
  "model": "jina-embeddings-v4",
  "input": [queryText],
  "task": "retrieval.query",
  "dimensions": 512,
  "embedding_type": "float",
  "truncate": false
&#125;</code></pre>
          <p>The query side shares dimensions/model with objects but uses the query-specific retrieval task.</p>
        </article>
      </div>
    </section>

    <section id="publication" class="section">
      <div class="section-heading">
        <div><span class="kicker">INDEX PUBLICATION</span><h2>Build beside the old tree. Switch only when complete.</h2></div>
        <p>The JSON store has no transaction primitive, so rebuild uses an explicit publication boundary and best-effort rollback for a partial successor.</p>
      </div>

      <div class="publication-flow">
        <article><span>01</span><div><strong>Read active overlay + objects</strong><p>Verify overlay embedding space exactly matches the configured Jina model and dimension.</p></div></article>
        <ArrowRight size={18} aria-hidden="true" />
        <article><span>02</span><div><strong>Build pure draft</strong><p>No store mutations occur during recursive clustering; node paths reference draft children.</p></div></article>
        <ArrowRight size={18} aria-hidden="true" />
        <article><span>03</span><div><strong>Create unpublished index</strong><p>Insert an index with <code>rootNodeIds: []</code>, then recursively mint and link all node rows.</p></div></article>
        <ArrowRight size={18} aria-hidden="true" />
        <article class="publish"><span>04</span><div><strong>Publish roots</strong><p>One update installs every root ID. Until here, readers continue selecting the old complete index.</p></div></article>
        <ArrowRight size={18} aria-hidden="true" />
        <article><span>05</span><div><strong>Retire predecessor</strong><p>Delete old nodes and index rows only after the successor has a complete root set.</p></div></article>
      </div>

      <div class="failure-lane">
        <ShieldCheck size={18} aria-hidden="true" />
        <div><strong>Failure before publication</strong><p>Remove newly created nodes in reverse order, remove the empty-root successor, rethrow the original error, and leave the old tree intact.</p></div>
        <code>old index remains queryable</code>
      </div>
    </section>

    <section id="files" class="section">
      <div class="section-heading">
        <div><span class="kicker">LINE-LEVEL CHANGE LEDGER</span><h2>Exactly what this branch changes</h2></div>
        <p>Line references describe the current review worktree. Ellipses abbreviate only repeated path prefixes; symbols identify the executable review boundary.</p>
      </div>

      <div class="ledger-toolbar">
        <div class="ledger-filters" aria-label="Filter line-level changes">
          {#each GROUPS as group}
            <button type="button" class:active={activeGroup === group.id} onclick={() => (activeGroup = group.id)}>
              {group.label}<span>{group.id === "all" ? LEDGER.length : LEDGER.filter((entry) => entry.group === group.id).length}</span>
            </button>
          {/each}
        </div>
        <span><FileCode2 size={14} aria-hidden="true" /> {visibleLedger.length} review entries</span>
      </div>

      <div class="ledger-list">
        {#each visibleLedger as entry}
          <article>
            <div class="ledger-meta">
              <span class="action action-{entry.action}">{entry.action}</span>
              <span class="group">{entry.group}</span>
            </div>
            <div class="ledger-location"><code>{entry.path}</code><strong>{entry.lines}</strong><small>{entry.symbols}</small></div>
            <div class="ledger-change"><span>CHANGE</span><p>{entry.change}</p></div>
            <div class="ledger-reason"><span>WHY</span><p>{entry.reason}</p></div>
          </article>
        {/each}
      </div>
    </section>

    <section id="evidence" class="section">
      <div class="section-heading">
        <div><span class="kicker">VERIFICATION</span><h2>Measured against the exact answer.</h2></div>
        <p>The fast path has its own exhaustive-cosine oracle. Provider behavior is covered both by exact mocked payload tests and one opt-in live run.</p>
      </div>

      <div class="evidence-grid">
        {#each EVIDENCE as item}
          <article><Check size={17} aria-hidden="true" /><div><strong>{item.value}</strong><span>{item.label}</span><p>{item.detail}</p></div></article>
        {/each}
      </div>

      <div class="proof-grid">
        <article>
          <header><FlaskConical size={17} aria-hidden="true" /><div><span>ALGORITHM PROOF</span><strong>Deterministic 288-object corpus</strong></div></header>
          <dl>
            <div><dt>exact top-5 recall</dt><dd>≥ 0.95</dd></div>
            <div><dt>average exact evaluations</dt><dd>&lt; N / 3</dd></div>
            <div><dt>comparison oracle</dt><dd>all-object cosine</dd></div>
          </dl>
          <p>The test also checks separated-cluster equality, deterministic tree serialization, and identical-vector termination.</p>
        </article>
        <article>
          <header><Sparkles size={17} aria-hidden="true" /><div><span>LIVE PROVIDER PROOF</span><strong>Real configured Jina key</strong></div></header>
          <ul>
            <li><Check size={13} aria-hidden="true" /> token labels and multivectors align in shape</li>
            <li><Check size={13} aria-hidden="true" /> passage and query vectors are 512-dimensional</li>
            <li><Check size={13} aria-hidden="true" /> recursive query returns the relevant passage</li>
            <li><Check size={13} aria-hidden="true" /> usage metadata carries provider/model/request information</li>
          </ul>
        </article>
      </div>

      <div class="command-evidence">
        <code>pnpm test</code><span>58 files passed · 1 live file skipped · 608 tests passed · 1 skipped</span>
        <code>pnpm lint:capabilities</code><span>10 / 10 checks · no findings</span>
        <code>pnpm lint:representation</code><span>6 / 6 checks · no findings</span>
        <code>ICARUS_LIVE_JINA=1 …/jina.test.ts</code><span>1 / 1 live integration suite passed</span>
      </div>
    </section>

    <section class="section caveat-section" aria-labelledby="caveat-title">
      <div class="caveat-icon"><AlertTriangle size={22} aria-hidden="true" /></div>
      <div>
        <span class="kicker">SCALING BOUNDARY / EXPLICIT</span>
        <h2 id="caveat-title">The vector search is pruned. Table hydration is not—yet.</h2>
        <p>
          The recursive algorithm avoids scoring every high-dimensional object: query work is proportional to visited nodes and admitted candidates.
          But the current JSON Store exposes whole in-memory tables, so the capability presently reads and joins O(N) source/object/node rows before calling that algorithm.
          This pass proves index quality, provider integration, publication safety, and the capability contract—not million-object end-to-end latency.
        </p>
      </div>
      <div class="caveat-comparison">
        <article><span>PROVEN NOW</span><strong>O(V·d + C·d)</strong><p>high-dimensional similarity work</p></article>
        <article><span>FOLLOW-UP STORAGE WORK</span><strong>ID maps / cached hydration</strong><p>avoid O(N) table scans per query</p></article>
        <article><span>INTENTIONALLY DEFERRED</span><strong>PCA / alternate indexes</strong><p>recursive clustering is the first swappable method</p></article>
      </div>
    </section>

    <section class="next-pass">
      <div><span class="kicker">NEXT / PASS 03</span><h2>Bridge Derived Output to retrieval.</h2><p>Give synthesis an overlay query/read seam, persist copied SemanticCitation values, remember last generation/revisions, and validate cited source revisions immediately before publishing a refreshed response.</p></div>
      <div class="next-steps">
        <span><Search size={14} aria-hidden="true" /> retrieve</span><ArrowRight size={14} aria-hidden="true" />
        <span><Database size={14} aria-hidden="true" /> cite values</span><ArrowRight size={14} aria-hidden="true" />
        <span><RefreshCw size={14} aria-hidden="true" /> revision guard</span>
      </div>
      <a href="/demo/semantic-overlay/implementation"><ChevronLeft size={15} aria-hidden="true" /> Pass-one implementation</a>
    </section>
  </main>

  <footer><span>SEMANTIC OVERLAY / INDEX + QUERY / REVIEW 03</span><span>work/semantic-overlay-index-query · not merged</span></footer>
</div>

<style>
  :global(body) { margin: 0; }
  :global(*) { box-sizing: border-box; }
  .review-shell {
    --index-blue: var(--token-color-intelligence-text);
    min-height: 100vh;
    background:
      radial-gradient(circle at 83% 4%, color-mix(in srgb, var(--token-color-intelligence-border) 16%, transparent), transparent 27rem),
      radial-gradient(circle at 9% 25%, color-mix(in srgb, var(--token-color-active-fill) 8%, transparent), transparent 24rem),
      var(--token-surface-canvas);
    color: var(--token-ink-primary);
  }
  .topbar {
    position: sticky;
    z-index: 30;
    top: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 3.5rem;
    padding: 0 2rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: color-mix(in srgb, var(--token-surface-canvas) 88%, transparent);
    backdrop-filter: blur(16px);
  }
  .wordmark, nav, .hero-actions, .next-steps, .next-pass > a { display: flex; align-items: center; }
  .wordmark { gap: .5rem; color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .69rem; letter-spacing: .1em; text-decoration: none; }
  .wordmark > :global(svg) { color: var(--token-ink-muted); }
  .mark { width: .58rem; height: .58rem; border: 2px solid var(--token-color-intelligence-text); transform: rotate(45deg); }
  .muted { color: var(--token-ink-muted); }
  nav { gap: 1.25rem; }
  nav a { color: var(--token-ink-secondary); font-size: .73rem; text-decoration: none; }
  nav a:hover { color: var(--token-color-interactive-text); }
  main, footer { width: min(100% - 3rem, 82rem); margin-inline: auto; }
  h1, h2, h3, p { margin: 0; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(22rem, .68fr); gap: 4rem; align-items: end; padding: 6.5rem 0 3rem; }
  .eyebrow, .kicker, .detail-label { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .65rem; font-weight: 500; letter-spacing: .11em; text-transform: uppercase; }
  .eyebrow { display: flex; gap: .45rem; align-items: center; margin-bottom: 1.25rem; }
  h1 { font-size: clamp(3rem, 6.6vw, 5.9rem); font-weight: 500; letter-spacing: -.067em; line-height: .92; }
  h1 em { color: var(--token-color-intelligence-text); font-style: normal; }
  .lede { max-width: 53rem; margin-top: 1.75rem; color: var(--token-ink-secondary); font-size: clamp(.98rem, 1.8vw, 1.14rem); line-height: 1.67; }
  .hero-actions { gap: .7rem; margin-top: 1.5rem; }
  .hero-actions a { display: inline-flex; gap: .45rem; align-items: center; padding: .55rem .72rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); color: var(--token-ink-secondary); font-family: var(--token-font-mono); font-size: .64rem; text-decoration: none; }
  .hero-actions .primary-action { border-color: var(--token-color-intelligence-border); background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); }
  .branch-card { overflow: hidden; border: 1px solid var(--token-color-intelligence-border); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); box-shadow: var(--token-shadow-panel); }
  .branch-card > header { display: flex; gap: .5rem; align-items: center; padding: .72rem .9rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .62rem; letter-spacing: .09em; }
  .branch-name { padding: 1rem; border-bottom: 1px solid var(--token-border-subtle); }
  .branch-name span, .branch-name code { display: block; }
  .branch-name span { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .56rem; text-transform: uppercase; }
  .branch-name code { margin-top: .35rem; color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .76rem; overflow-wrap: anywhere; }
  .branch-state { display: grid; grid-template-columns: auto 1fr; column-gap: .55rem; align-items: center; padding: .75rem 1rem; border-bottom: 1px solid var(--token-border-subtle); background: var(--token-color-intelligence-surface); }
  .branch-state .pulse { grid-row: 1 / 3; width: .55rem; height: .55rem; border-radius: 50%; background: var(--token-color-intelligence-text); box-shadow: 0 0 0 .3rem color-mix(in srgb, var(--token-color-intelligence-text) 14%, transparent); }
  .branch-state strong, .branch-state small { display: block; }
  .branch-state strong { font-size: .69rem; font-weight: 500; }
  .branch-state small { margin-top: .15rem; color: var(--token-ink-muted); font-size: .58rem; }
  .branch-card dl { display: grid; grid-template-columns: 1fr 1fr; margin: 0; }
  .branch-card dl > div { min-width: 0; padding: .8rem 1rem; border-right: 1px solid var(--token-border-subtle); border-bottom: 1px solid var(--token-border-subtle); }
  .branch-card dl > div:nth-child(even) { border-right: 0; }
  .branch-card dt { color: var(--token-ink-muted); font-size: .59rem; }
  .branch-card dd { margin: .25rem 0 0; font-family: var(--token-font-mono); font-size: 1.25rem; }
  .branch-card dl small { display: block; margin-top: .2rem; color: var(--token-ink-muted); font-size: .53rem; line-height: 1.35; }
  .branch-card > p { display: flex; gap: .5rem; align-items: start; padding: .85rem 1rem 1rem; color: var(--token-ink-muted); font-size: .62rem; line-height: 1.5; }
  .branch-card > p :global(svg) { flex: 0 0 auto; margin-top: .1rem; color: var(--token-color-success-text); }
  .branch-card > p code { color: var(--token-ink-secondary); }
  .result-strip { display: grid; grid-template-columns: auto 1fr auto; gap: .8rem; align-items: center; padding: .9rem 1rem; border: 1px solid var(--token-color-success-border); border-radius: var(--token-radius-control); background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .result-strip p { color: var(--token-ink-secondary); font-size: .76rem; line-height: 1.45; }
  .result-strip strong { color: var(--token-color-success-text); font-weight: 500; }
  .result-strip > span { font-family: var(--token-font-mono); font-size: .59rem; letter-spacing: .08em; white-space: nowrap; }
  .section { padding-top: 6rem; scroll-margin-top: 4rem; }
  .section-heading { display: flex; justify-content: space-between; gap: 3rem; align-items: end; margin-bottom: 2rem; }
  .section-heading.compact { margin-bottom: 1.2rem; }
  h2 { margin-top: .42rem; font-size: clamp(1.85rem, 3.5vw, 2.8rem); font-weight: 500; letter-spacing: -.045em; line-height: 1.04; }
  .section-heading > p { max-width: 33rem; color: var(--token-ink-muted); font-size: .79rem; line-height: 1.58; text-align: right; }
  .system-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: .8rem; align-items: center; }
  .system-node { min-width: 0; min-height: 14rem; padding: 1rem; border: 1px solid var(--node-border); border-top: 3px solid var(--node-border); border-radius: var(--token-radius-panel); background: linear-gradient(145deg, var(--node-surface), var(--token-surface-panel) 70%); }
  .system-node.provider { --node-border: var(--token-color-intelligence-border); --node-surface: var(--token-color-intelligence-surface); --node-text: var(--token-color-intelligence-text); }
  .system-node.core { --node-border: var(--token-color-active-border); --node-surface: var(--token-color-active-surface); --node-text: var(--token-color-active-text); }
  .system-node.capability { --node-border: var(--token-color-success-border); --node-surface: var(--token-color-success-surface); --node-text: var(--token-color-success-text); }
  .node-icon { display: grid; place-items: center; width: 2.2rem; height: 2.2rem; margin-bottom: 1.2rem; border: 1px solid var(--node-border); border-radius: var(--token-radius-control); color: var(--node-text); }
  .system-node > span { color: var(--node-text); font-family: var(--token-font-mono); font-size: .57rem; letter-spacing: .08em; }
  .system-node h3 { margin-top: .45rem; font-size: 1.02rem; font-weight: 500; }
  .system-node p { min-height: 3rem; margin-top: .6rem; color: var(--token-ink-muted); font-size: .68rem; line-height: 1.5; }
  .system-node code { display: block; margin-top: 1rem; padding-top: .65rem; border-top: 1px solid var(--token-border-subtle); color: var(--token-ink-secondary); font-family: var(--token-font-mono); font-size: .59rem; overflow-wrap: anywhere; }
  .flow-arrow { display: grid; justify-items: center; gap: .35rem; color: var(--token-ink-muted); }
  .flow-arrow small { font-size: .52rem; white-space: nowrap; }
  .contract-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .8rem; margin-top: .8rem; }
  .contract-grid article { overflow: hidden; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .contract-grid header { display: flex; gap: .5rem; align-items: center; padding: .7rem .85rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-color-intelligence-text); }
  .contract-grid header span { font-family: var(--token-font-mono); font-size: .57rem; letter-spacing: .08em; }
  pre { margin: 0; }
  .contract-grid pre { min-height: 10.5rem; padding: .9rem; background: var(--token-surface-work); color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .63rem; line-height: 1.6; overflow-x: auto; }
  .contract-grid article > p { padding: .8rem .9rem; color: var(--token-ink-muted); font-size: .65rem; line-height: 1.5; }
  .algorithm-tabs { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel) var(--token-radius-panel) 0 0; overflow: hidden; }
  .algorithm-tabs button { display: flex; gap: .55rem; align-items: center; min-width: 0; padding: .85rem 1rem; border: 0; border-right: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); color: var(--token-ink-muted); cursor: pointer; }
  .algorithm-tabs button:last-child { border-right: 0; }
  .algorithm-tabs button.active { background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); box-shadow: inset 0 -2px 0 var(--token-color-intelligence-border); }
  .algorithm-tabs button span { font-family: var(--token-font-mono); font-size: .56rem; }
  .algorithm-tabs button strong { color: var(--token-ink-primary); font-size: .7rem; font-weight: 500; }
  .algorithm-panel { min-height: 36rem; padding: 1.4rem; border: 1px solid var(--token-color-intelligence-border); border-top: 0; border-radius: 0 0 var(--token-radius-panel) var(--token-radius-panel); background: linear-gradient(145deg, var(--token-color-intelligence-surface), var(--token-surface-panel) 55%); }
  .algorithm-intro { display: grid; grid-template-columns: auto 1fr; gap: 1rem; align-items: start; }
  .panel-number { display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border: 1px solid var(--token-color-intelligence-border); border-radius: 50%; color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .64rem; }
  .algorithm-intro h3 { font-size: 1.35rem; font-weight: 500; letter-spacing: -.025em; }
  .algorithm-intro p { max-width: 58rem; margin-top: .45rem; color: var(--token-ink-secondary); font-size: .77rem; line-height: 1.6; }
  .equation-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: .65rem; margin-top: 1.35rem; }
  .equation-grid article { min-width: 0; padding: .85rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-work); }
  .equation-grid code { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .83rem; overflow-wrap: anywhere; }
  .equation-grid p { margin-top: .42rem; color: var(--token-ink-muted); font-size: .63rem; line-height: 1.4; }
  .algorithm-detail { display: grid; grid-template-columns: 1.5fr .75fr; gap: 1.5rem; margin-top: 1.5rem; }
  .algorithm-detail ol, .algorithm-detail ul { margin: .75rem 0 0; padding: 0; list-style: none; }
  .algorithm-detail ol { border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); overflow: hidden; }
  .algorithm-detail ol li { display: grid; grid-template-columns: 2rem 1fr; gap: .7rem; align-items: start; padding: .72rem; border-bottom: 1px solid var(--token-border-subtle); background: color-mix(in srgb, var(--token-surface-panel) 88%, transparent); }
  .algorithm-detail ol li:last-child { border-bottom: 0; }
  .algorithm-detail ol li span { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .57rem; }
  .algorithm-detail ol li p { color: var(--token-ink-secondary); font-size: .67rem; line-height: 1.48; }
  .algorithm-detail aside ul { display: flex; flex-wrap: wrap; gap: .4rem; }
  .algorithm-detail aside li { display: inline-flex; gap: .35rem; align-items: center; padding: .3rem .45rem; border: 1px solid var(--token-color-success-border); border-radius: 999px; background: var(--token-color-success-surface); color: var(--token-color-success-text); font-size: .59rem; }
  .complexity { display: flex; gap: .65rem; align-items: start; margin-top: 1rem; padding: .8rem; border: 1px solid var(--token-color-active-border); border-radius: var(--token-radius-control); color: var(--token-color-active-text); }
  .complexity span { font-family: var(--token-font-mono); font-size: .54rem; letter-spacing: .07em; }
  .complexity p { margin-top: .35rem; color: var(--token-ink-secondary); font-size: .65rem; line-height: 1.5; }
  .tree-card { overflow: hidden; padding: 1.4rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .query-pill { display: flex; gap: .5rem; align-items: center; width: fit-content; margin: 0 auto; padding: .45rem .65rem; border: 1px solid var(--token-color-intelligence-border); border-radius: 999px; background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); }
  .query-pill span { font-family: var(--token-font-mono); font-size: .78rem; }
  .query-pill code { color: var(--token-ink-secondary); font-size: .63rem; }
  .tree-roots, .tree-children { display: flex; justify-content: center; gap: 2rem; margin-top: 1.3rem; }
  .tree-children { margin-top: 0; }
  .tree-node { position: relative; display: grid; grid-template-columns: 1fr auto; gap: .2rem .8rem; min-width: 7rem; padding: .6rem .7rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-work); }
  .tree-node small { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .55rem; }
  .tree-node strong { color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .72rem; font-weight: 500; }
  .tree-node span { grid-column: 1 / 3; color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .5rem; letter-spacing: .07em; }
  .tree-node.hot { border-color: var(--token-color-intelligence-border); background: var(--token-color-intelligence-surface); }
  .tree-node.faded { opacity: .62; }
  .tree-connector { width: 1px; height: 1.2rem; margin: 0 auto; background: var(--token-color-intelligence-border); }
  .tree-connector.short { height: 1rem; }
  .leaf-row { display: grid; grid-template-columns: 1fr auto 1.35fr auto .75fr; gap: .8rem; align-items: center; }
  .leaf-row > div { min-width: 0; padding: .8rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-work); }
  .leaf-row > div.hit { border-color: var(--token-color-success-border); background: var(--token-color-success-surface); }
  .leaf-row span, .leaf-row code { display: block; }
  .leaf-row span { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .52rem; letter-spacing: .07em; }
  .leaf-row code { margin-top: .38rem; color: var(--token-ink-secondary); font-family: var(--token-font-mono); font-size: .61rem; overflow-wrap: anywhere; }
  .leaf-row > :global(svg) { color: var(--token-color-intelligence-text); }
  .heap-note { display: grid; grid-template-columns: auto auto 1fr; gap: .65rem; align-items: center; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--token-border-subtle); color: var(--token-color-active-text); }
  .heap-note strong { font-size: .62rem; font-weight: 500; }
  .heap-note code { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .6rem; text-align: right; overflow-wrap: anywhere; }
  .payload-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .8rem; }
  .payload-grid article { overflow: hidden; border: 1px solid var(--token-color-intelligence-border); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .payload-grid header { padding: .8rem .9rem; border-bottom: 1px solid var(--token-border-subtle); background: var(--token-color-intelligence-surface); }
  .payload-grid header span, .payload-grid header strong { display: block; }
  .payload-grid header span { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .54rem; letter-spacing: .08em; }
  .payload-grid header strong { margin-top: .27rem; font-size: .75rem; font-weight: 500; }
  .payload-grid pre { min-height: 21rem; padding: 1rem; color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .63rem; line-height: 1.6; overflow-x: auto; }
  .payload-grid article > p { min-height: 5rem; padding: .8rem .9rem; border-top: 1px solid var(--token-border-subtle); color: var(--token-ink-muted); font-size: .64rem; line-height: 1.5; }
  .payload-grid article > p code { color: var(--token-color-intelligence-text); }
  .publication-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr auto 1fr; gap: .55rem; align-items: center; }
  .publication-flow article { min-height: 13rem; padding: .85rem; border: 1px solid var(--token-border-subtle); border-top: 3px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .publication-flow article.publish { border-color: var(--token-color-success-border); background: var(--token-color-success-surface); }
  .publication-flow article > span { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .58rem; }
  .publication-flow strong { display: block; margin-top: 1.1rem; font-size: .72rem; font-weight: 500; }
  .publication-flow p { margin-top: .5rem; color: var(--token-ink-muted); font-size: .62rem; line-height: 1.52; }
  .publication-flow :global(svg) { color: var(--token-ink-muted); }
  .failure-lane { display: grid; grid-template-columns: auto 1fr auto; gap: .8rem; align-items: center; margin-top: .8rem; padding: 1rem; border: 1px solid var(--token-color-success-border); border-radius: var(--token-radius-control); background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .failure-lane strong { font-size: .71rem; font-weight: 500; }
  .failure-lane p { margin-top: .25rem; color: var(--token-ink-secondary); font-size: .64rem; line-height: 1.45; }
  .failure-lane code { color: var(--token-color-success-text); font-family: var(--token-font-mono); font-size: .6rem; white-space: nowrap; }
  .ledger-toolbar { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-bottom: .75rem; }
  .ledger-filters { display: flex; flex-wrap: wrap; gap: .35rem; }
  .ledger-filters button { display: inline-flex; gap: .42rem; align-items: center; padding: .38rem .6rem; border: 1px solid var(--token-border-subtle); border-radius: 999px; background: var(--token-surface-panel); color: var(--token-ink-secondary); font-family: var(--token-font-mono); font-size: .58rem; text-transform: uppercase; cursor: pointer; }
  .ledger-filters button.active { border-color: var(--token-color-intelligence-border); background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); }
  .ledger-filters button span { display: grid; place-items: center; min-width: 1.05rem; height: 1.05rem; border-radius: 999px; background: var(--token-surface-work); font-size: .51rem; }
  .ledger-toolbar > span { display: flex; gap: .4rem; align-items: center; color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .59rem; white-space: nowrap; }
  .ledger-list { overflow: hidden; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .ledger-list article { display: grid; grid-template-columns: 6.5rem minmax(18rem, 1.1fr) minmax(15rem, 1fr) minmax(15rem, 1fr); gap: 1rem; align-items: center; min-height: 7rem; padding: .85rem 1rem; border-bottom: 1px solid var(--token-border-subtle); }
  .ledger-list article:last-child { border-bottom: 0; }
  .ledger-meta { display: flex; flex-direction: column; gap: .35rem; align-items: start; }
  .ledger-meta span { padding: .16rem .35rem; border: 1px solid currentColor; border-radius: 999px; font-family: var(--token-font-mono); font-size: .5rem; letter-spacing: .06em; text-transform: uppercase; }
  .ledger-meta .action-add { color: var(--token-color-success-text); }
  .ledger-meta .action-change { color: var(--token-color-attention-text); }
  .ledger-meta .group { border: 0; padding-left: 0; color: var(--token-ink-muted); }
  .ledger-location { min-width: 0; }
  .ledger-location code, .ledger-location strong, .ledger-location small { display: block; }
  .ledger-location code { color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .66rem; line-height: 1.45; overflow-wrap: anywhere; }
  .ledger-location strong { margin-top: .35rem; color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .59rem; font-weight: 500; }
  .ledger-location small { margin-top: .25rem; color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .55rem; line-height: 1.4; }
  .ledger-change span, .ledger-reason span { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .5rem; letter-spacing: .08em; }
  .ledger-change p, .ledger-reason p { margin-top: .32rem; color: var(--token-ink-secondary); font-size: .63rem; line-height: 1.5; }
  .ledger-reason { padding-left: 1rem; border-left: 1px solid var(--token-border-subtle); }
  .evidence-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: .7rem; }
  .evidence-grid article { display: grid; grid-template-columns: auto 1fr; gap: .7rem; align-items: start; padding: 1rem; border: 1px solid var(--token-color-success-border); border-radius: var(--token-radius-panel); background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .evidence-grid strong, .evidence-grid span, .evidence-grid p { display: block; }
  .evidence-grid strong { font-family: var(--token-font-mono); font-size: 1.3rem; font-weight: 500; }
  .evidence-grid span { margin-top: .16rem; color: var(--token-ink-primary); font-size: .65rem; }
  .evidence-grid p { margin-top: .3rem; color: var(--token-ink-muted); font-size: .56rem; line-height: 1.35; }
  .proof-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem; margin-top: .8rem; }
  .proof-grid > article { border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); overflow: hidden; }
  .proof-grid header { display: flex; gap: .65rem; align-items: center; padding: .9rem 1rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-color-intelligence-text); }
  .proof-grid header span, .proof-grid header strong { display: block; }
  .proof-grid header span { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .52rem; letter-spacing: .07em; }
  .proof-grid header strong { margin-top: .2rem; color: var(--token-ink-primary); font-size: .75rem; font-weight: 500; }
  .proof-grid dl { display: grid; grid-template-columns: repeat(3, 1fr); margin: 0; }
  .proof-grid dl div { padding: .85rem 1rem; border-right: 1px solid var(--token-border-subtle); }
  .proof-grid dl div:last-child { border-right: 0; }
  .proof-grid dt { color: var(--token-ink-muted); font-size: .55rem; }
  .proof-grid dd { margin: .3rem 0 0; color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .73rem; }
  .proof-grid > article > p { padding: .8rem 1rem; border-top: 1px solid var(--token-border-subtle); color: var(--token-ink-muted); font-size: .63rem; line-height: 1.5; }
  .proof-grid ul { margin: 0; padding: .75rem 1rem; list-style: none; }
  .proof-grid li { display: flex; gap: .45rem; align-items: start; padding: .35rem 0; color: var(--token-ink-secondary); font-size: .64rem; line-height: 1.4; }
  .proof-grid li :global(svg) { flex: 0 0 auto; margin-top: .1rem; color: var(--token-color-success-text); }
  .command-evidence { display: grid; grid-template-columns: minmax(16rem, .65fr) 1fr; margin-top: .8rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); overflow: hidden; }
  .command-evidence code, .command-evidence span { padding: .65rem .8rem; border-bottom: 1px solid var(--token-border-subtle); font-size: .62rem; }
  .command-evidence code:nth-last-child(2), .command-evidence span:last-child { border-bottom: 0; }
  .command-evidence code { border-right: 1px solid var(--token-border-subtle); background: var(--token-surface-work); color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); overflow-wrap: anywhere; }
  .command-evidence span { color: var(--token-ink-secondary); }
  .caveat-section { display: grid; grid-template-columns: auto 1.3fr .75fr; gap: 1.2rem; align-items: start; margin-top: 6rem; padding: 1.4rem; border: 1px solid var(--token-color-attention-border); border-radius: var(--token-radius-panel); background: var(--token-color-attention-surface); }
  .caveat-icon { display: grid; place-items: center; width: 2.7rem; height: 2.7rem; border: 1px solid var(--token-color-attention-border); border-radius: var(--token-radius-control); color: var(--token-color-attention-text); }
  .caveat-section h2 { max-width: 21ch; font-size: 1.65rem; }
  .caveat-section > div > p { margin-top: .7rem; color: var(--token-ink-secondary); font-size: .72rem; line-height: 1.6; }
  .caveat-comparison { display: grid; gap: .6rem; }
  .caveat-comparison article { padding: .8rem; border: 1px solid var(--token-color-attention-border); border-radius: var(--token-radius-control); background: color-mix(in srgb, var(--token-surface-panel) 80%, transparent); }
  .caveat-comparison span, .caveat-comparison strong { display: block; }
  .caveat-comparison span { color: var(--token-color-attention-text); font-family: var(--token-font-mono); font-size: .51rem; letter-spacing: .07em; }
  .caveat-comparison strong { margin-top: .35rem; font-family: var(--token-font-mono); font-size: .74rem; font-weight: 500; }
  .caveat-comparison p { margin-top: .25rem; color: var(--token-ink-muted); font-size: .57rem; }
  .next-pass { display: grid; grid-template-columns: 1fr auto; gap: 2rem; align-items: center; margin-top: 6rem; padding: 2rem; border: 1px solid var(--token-color-active-border); border-radius: var(--token-radius-panel); background: var(--token-color-active-surface); }
  .next-pass h2 { font-size: 1.9rem; }
  .next-pass p { max-width: 52rem; margin-top: .65rem; color: var(--token-ink-secondary); font-size: .76rem; line-height: 1.55; }
  .next-steps { grid-column: 1 / 3; gap: .5rem; color: var(--token-color-active-text); }
  .next-steps span { display: inline-flex; gap: .35rem; align-items: center; padding: .35rem .5rem; border: 1px solid var(--token-color-active-border); border-radius: 999px; color: var(--token-ink-secondary); font-size: .61rem; }
  .next-pass > a { grid-column: 2; grid-row: 1; gap: .4rem; padding: .5rem .65rem; border: 1px solid var(--token-color-active-border); border-radius: var(--token-radius-control); color: var(--token-color-active-text); font-family: var(--token-font-mono); font-size: .61rem; text-decoration: none; white-space: nowrap; }
  footer { display: flex; justify-content: space-between; gap: 2rem; margin-top: 6rem; padding: 1.5rem 0 2rem; border-top: 1px solid var(--token-border-subtle); color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .59rem; letter-spacing: .08em; text-transform: uppercase; }
  @media (max-width: 68rem) {
    nav { display: none; }
    .hero { grid-template-columns: 1fr; gap: 2.5rem; padding-top: 4.5rem; }
    .branch-card { max-width: 36rem; }
    .system-flow { grid-template-columns: 1fr; }
    .flow-arrow { transform: rotate(90deg); }
    .flow-arrow small { display: none; }
    .contract-grid, .payload-grid { grid-template-columns: 1fr; }
    .contract-grid pre, .payload-grid pre, .payload-grid article > p { min-height: auto; }
    .algorithm-detail { grid-template-columns: 1fr; }
    .publication-flow { grid-template-columns: 1fr; }
    .publication-flow > :global(svg) { justify-self: center; transform: rotate(90deg); }
    .publication-flow article { min-height: auto; }
    .ledger-list article { grid-template-columns: 6rem 1fr 1fr; }
    .ledger-reason { grid-column: 2 / 4; }
    .caveat-section { grid-template-columns: auto 1fr; }
    .caveat-comparison { grid-column: 2; grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 48rem) {
    .topbar { padding: 0 1rem; }
    .wordmark .muted { display: none; }
    main, footer { width: min(100% - 2rem, 82rem); }
    .hero { padding-top: 3.5rem; }
    h1 { font-size: clamp(2.85rem, 14vw, 4.25rem); }
    .hero-actions { flex-wrap: wrap; }
    .result-strip { grid-template-columns: auto 1fr; }
    .result-strip > span { grid-column: 2; }
    .section { padding-top: 4.5rem; }
    .section-heading { display: block; }
    .section-heading > p { margin-top: .8rem; text-align: left; }
    .algorithm-tabs { grid-template-columns: 1fr 1fr; }
    .algorithm-tabs button { border-bottom: 1px solid var(--token-border-subtle); }
    .algorithm-tabs button:nth-child(even) { border-right: 0; }
    .algorithm-tabs button:nth-last-child(-n + 2) { border-bottom: 0; }
    .algorithm-panel { padding: 1rem; }
    .tree-roots, .tree-children { gap: .4rem; }
    .tree-node { min-width: 0; width: 33%; }
    .leaf-row { grid-template-columns: 1fr; }
    .leaf-row > :global(svg) { justify-self: center; transform: rotate(90deg); }
    .heap-note { grid-template-columns: auto 1fr; }
    .heap-note code { grid-column: 1 / 3; text-align: left; }
    .failure-lane { grid-template-columns: auto 1fr; }
    .failure-lane code { grid-column: 2; white-space: normal; }
    .ledger-toolbar { align-items: start; flex-direction: column; }
    .ledger-list article { grid-template-columns: 1fr; }
    .ledger-reason { grid-column: 1; padding: 0; border-left: 0; }
    .evidence-grid { grid-template-columns: 1fr 1fr; }
    .proof-grid { grid-template-columns: 1fr; }
    .command-evidence { grid-template-columns: 1fr; }
    .command-evidence code { border-right: 0; }
    .command-evidence span { border-bottom: 1px solid var(--token-border-subtle); }
    .caveat-section { grid-template-columns: 1fr; }
    .caveat-comparison { grid-column: 1; grid-template-columns: 1fr; }
    .next-pass { grid-template-columns: 1fr; padding: 1.3rem; }
    .next-pass > a, .next-steps { grid-column: 1; grid-row: auto; }
    .next-steps { flex-wrap: wrap; }
    footer { flex-direction: column; }
  }
  @media (max-width: 31rem) {
    .branch-card dl, .algorithm-tabs, .evidence-grid { grid-template-columns: 1fr; }
    .branch-card dl > div { border-right: 0; }
    .algorithm-tabs button { border-right: 0; }
    .algorithm-tabs button:nth-last-child(2) { border-bottom: 1px solid var(--token-border-subtle); }
    .equation-grid { grid-template-columns: 1fr; }
    .proof-grid dl { grid-template-columns: 1fr; }
    .proof-grid dl div { border-right: 0; border-bottom: 1px solid var(--token-border-subtle); }
    .proof-grid dl div:last-child { border-bottom: 0; }
  }
</style>
