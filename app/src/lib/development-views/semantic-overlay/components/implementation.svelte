<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Bot from "@lucide/svelte/icons/bot";
  import Braces from "@lucide/svelte/icons/braces";
  import Check from "@lucide/svelte/icons/check";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import Clock3 from "@lucide/svelte/icons/clock-3";
  import Database from "@lucide/svelte/icons/database";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import FilePenLine from "@lucide/svelte/icons/file-pen-line";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Network from "@lucide/svelte/icons/network";
  import ServerCog from "@lucide/svelte/icons/server-cog";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  type Action = "add" | "change" | "delete";
  type Status = "landed" | "active" | "queued";
  type FileChange = {
    action: Action;
    status: Status;
    path: string;
    purpose: string;
    contents: string;
  };

  const FILES: FileChange[] = [
    {
      action: "change",
      status: "landed",
      path: "../.gitignore",
      purpose: "Keep reference code local",
      contents: "Adds the root-anchored /semantic-overlay/ rule requested for the supplied executable reference project."
    },
    {
      action: "delete",
      status: "landed",
      path: "representation/data/types/knowledge/lattice.ts",
      purpose: "Remove the old model",
      contents: "Deletes LatticeBinding, windows, clusters, causes, and removals. Nothing imports this contract after cutover."
    },
    {
      action: "delete",
      status: "landed",
      path: "representation/data/types/knowledge/derived-output.ts",
      purpose: "Remove the Knowledge domain",
      contents: "Derived state moves to semantic/derived-output.ts; DerivedEvidence is replaced by SemanticCitation."
    },
    {
      action: "add",
      status: "landed",
      path: "representation/data/types/semantic/source.ts",
      purpose: "Source boundary",
      contents: "SemanticEncoding, SemanticSourceInput, and copied SemanticSourceSnapshot values."
    },
    {
      action: "add",
      status: "landed",
      path: "representation/data/types/semantic/overlay.ts",
      purpose: "Overlay values",
      contents: "EmbeddingSpace, half-open SemanticSpan, and the self-contained object snapshot retained in history."
    },
    {
      action: "add",
      status: "landed",
      path: "representation/data/types/semantic/translation.ts",
      purpose: "Procedure messages",
      contents: "Configuration, token field, aligned field, segment ranges, prepared/result messages, drafts, usage, and inspectable peak metrics."
    },
    {
      action: "add",
      status: "landed",
      path: "representation/data/types/semantic/index.ts",
      purpose: "Index + query contract",
      contents: "Recursive configuration, discriminated node children, scoped query input, and coalesced SemanticHit."
    },
    {
      action: "add",
      status: "landed",
      path: "representation/data/types/semantic/derived-output.ts",
      purpose: "Durable evidence values",
      contents: "SemanticCitation carries a source snapshot, exact span text, and the observed overlay generation."
    },
    {
      action: "add",
      status: "landed",
      path: "representation/data/behavior/semantic/encoding.ts",
      purpose: "Coordinate invariants",
      contents: "Pure UTF-8 encoding, byte-boundary conversion, coordinate length, and exact slicing for UTF-8/UTF-16."
    },
    {
      action: "add",
      status: "landed",
      path: "representation/data/behavior/semantic/token-alignment.ts",
      purpose: "Exact Jina alignment",
      contents: "Decodes visible byte labels, removes Passage:, aligns to source bytes, coalesces split code points, and fails on gaps."
    },
    {
      action: "add",
      status: "landed",
      path: "representation/data/behavior/semantic/segmentation.ts",
      purpose: "One segmentation method",
      contents: "Cosine-change field, basins, mass, prominence, signed attraction, stationary selection, spacing coalescence, and hard max."
    },
    {
      action: "add",
      status: "landed",
      path: "representation/data/behavior/semantic/translation.ts",
      purpose: "Provider-free orchestration",
      contents: "prepareTranslation creates exact final span texts; completeTranslation attaches the final dense vectors."
    },
    {
      action: "add",
      status: "landed",
      path: "representation/data/behavior/semantic/test/unit/translation.test.ts",
      purpose: "Executable contract",
      contents: "Eight tests cover both encodings, real token labels, failure behavior, the equation, selection, max size, and materialization."
    },
    {
      action: "add",
      status: "landed",
      path: "configuration/semantic-overlay.yaml",
      purpose: "Translation defaults",
      contents: "The seven fixed distance-attraction thresholds. Jina provisioning joins this file in the next phase."
    },
    {
      action: "change",
      status: "landed",
      path: "representation/store/tables.ts",
      purpose: "Hard schema cutover",
      contents: "Removes Project.lattice and four lattice tables; adds overlay/source/object/history/index tables; changes Derived Output to citation values."
    },
    {
      action: "change",
      status: "landed",
      path: "configuration/representation.yaml",
      purpose: "Domain graph",
      contents: "Replaces the knowledge domain declaration with semantic → core."
    },
    {
      action: "change",
      status: "landed",
      path: "configuration/revisions.yaml",
      purpose: "Remove dead retention",
      contents: "Deletes latticeChanges retention; semantic history is durable object-value history, not an explanation log."
    },
    {
      action: "change",
      status: "landed",
      path: "surfaces/tab-bar/procedures/resource-name.ts",
      purpose: "Remove surface coupling",
      contents: "Removes lattice names and makes the naming map partial; semantic internal tables are deliberately absent."
    },
    {
      action: "change",
      status: "landed",
      path: "surfaces/status-bar/procedures/resource-name.ts",
      purpose: "Remove surface coupling",
      contents: "Mirrors the partial allowlist so future internal tables do not become status-bar concerns."
    },
    {
      action: "add",
      status: "landed",
      path: "development-views/semantic-overlay/semantic-overlay.svelte",
      purpose: "Architecture contract",
      contents: "Interactive structures, procedure flows, exact attraction equation, lifecycles, migration, and revised delivery order."
    },
    {
      action: "add",
      status: "landed",
      path: "routes/demo/semantic-overlay/+page.svelte",
      purpose: "Architecture development route",
      contents: "Mounts the contract and methodology view under the demo tree."
    },
    {
      action: "add",
      status: "landed",
      path: "development-views/semantic-overlay/components/implementation.svelte",
      purpose: "This handoff surface",
      contents: "Exact branch plan, file inventory, procedure/function map, test evidence, and phased Jina/index/Derived Output work."
    },
    {
      action: "add",
      status: "landed",
      path: "development-views/semantic-overlay/components/components.md",
      purpose: "Surface concern contract",
      contents: "Documents why the implementation view is a component beneath the Semantic Overlay development surface."
    },
    {
      action: "add",
      status: "landed",
      path: "routes/demo/semantic-overlay/implementation/+page.svelte",
      purpose: "Direct development route",
      contents: "Mounts this visual plan under the existing Semantic Overlay demo."
    }
  ];

  const FUNCTIONS = [
    {
      step: "01",
      state: "landed",
      function: "coordinateLength · sliceByCoordinates",
      file: "encoding.ts",
      input: "text + SemanticEncoding",
      output: "exact source coordinates/text"
    },
    {
      step: "02",
      state: "landed",
      function: "displayedTokenBytes · alignTokenField",
      file: "token-alignment.ts",
      input: "SemanticSourceInput + TokenEmbeddingField",
      output: "AlignedTokenField"
    },
    {
      step: "03",
      state: "landed",
      function: "distanceDiscountedPull · segmentAlignedField",
      file: "segmentation.ts",
      input: "AlignedTokenField + configuration",
      output: "SegmentRange[] + peak metrics"
    },
    {
      step: "04",
      state: "landed",
      function: "prepareTranslation",
      file: "translation.ts",
      input: "source + returned token field",
      output: "exact final span texts"
    },
    {
      step: "05",
      state: "landed",
      function: "completeTranslation",
      file: "translation.ts",
      input: "prepared spans + dense vectors",
      output: "TranslationResult"
    },
    {
      step: "06",
      state: "queued",
      function: "publishSemanticTranslation",
      file: "semantic-overlay capability",
      input: "TranslationResult + scoped project",
      output: "history + active rows + generation"
    }
  ] as const;

  const PHASES = [
    {
      state: "done",
      number: "01",
      title: "Translate + cut over",
      summary: "Delete Knowledge/Lattice, install the semantic contract, and prove deterministic translation without a network call.",
      deliverable: "Types + pure behavior + table schema + tests",
      icon: Braces
    },
    {
      state: "next",
      number: "02",
      title: "Provision Jina + index/query",
      summary: "Add the server-owned Jina adapter, publish recursive cluster nodes, and compare tree retrieval against exhaustive cosine.",
      deliverable: "Two embedding modes + recursive tree + scoped hits",
      icon: Network
    },
    {
      state: "later",
      number: "03",
      title: "Bridge Derived Output",
      summary: "Give synthesis retrieve/read tools, capture citation values, and validate cited revisions immediately before publication.",
      deliverable: "Pull refresh + retry guard + last response",
      icon: Bot
    }
  ] as const;

  const TESTS = [
    "UTF-8 byte and UTF-16 code-unit coordinates",
    "Unicode source slicing at valid code-point boundaries",
    "Real Jina/Qwen visible-byte token labels",
    "Failure on skipped non-whitespace source text",
    "Exact signed exponential attraction equation",
    "Stationary semantic-change peak selection",
    "Hard max splitting when no peak survives",
    "Prepared spans → final dense object drafts"
  ];

  let filter = $state<"all" | Action>("all");
  const visibleFiles = $derived(
    filter === "all" ? FILES : FILES.filter((file) => file.action === filter)
  );
</script>

<svelte:head>
  <title>Semantic Overlay implementation plan — Icarus</title>
  <meta
    name="description"
    content="The file-level implementation plan and current cutover status for Icarus Semantic Overlay."
  />
</svelte:head>

<div class="implementation-shell">
  <header class="topbar">
    <a class="wordmark" href="/demo/semantic-overlay">
      <ChevronLeft size={15} aria-hidden="true" />
      <span class="mark" aria-hidden="true"></span>
      <span>ICARUS</span>
      <span class="muted">/ SEMANTIC OVERLAY</span>
    </a>
    <nav aria-label="On this page">
      <a href="#sequence">Sequence</a>
      <a href="#functions">Functions</a>
      <a href="#files">Files</a>
      <a href="#verification">Verification</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div>
        <div class="eyebrow"><CircleDot size={13} aria-hidden="true" /> IMPLEMENTATION / LANDED</div>
        <h1>From contract<br />to cutover.</h1>
        <p class="lede">
          The first implementation slice is cut over to local main. It removes the lattice schema
          and ports the deterministic translation core; provider transport and retrieval remain
          cleanly separated for the next pass.
        </p>
      </div>

      <aside class="branch-card">
        <header><GitBranch size={17} aria-hidden="true" /> CUTOVER STATE</header>
        <code>main ← work/semantic-overlay-cutover</code>
        <dl>
          <div><dt>old tables removed</dt><dd>4</dd></div>
          <div><dt>new semantic tables</dt><dd>6</dd></div>
          <div><dt>focused tests passing</dt><dd>8</dd></div>
          <div><dt>representation findings</dt><dd>0</dd></div>
        </dl>
        <p>
          The semantic commit is now on local main. Pre-existing uncommitted workspace changes
          remain intact and outside the cutover; the work branch is retained as an exact pointer
          to the landed commit.
        </p>
      </aside>
    </section>

    <section class="status-line" aria-label="Current result">
      <Check size={17} aria-hidden="true" />
      <p><strong>Executable now:</strong> source coordinates → token alignment → segmentation → exact span texts → dense-vector object drafts.</p>
      <a href="/demo/semantic-overlay#method">View the equation <ArrowRight size={14} aria-hidden="true" /></a>
    </section>

    <section id="sequence" class="section">
      <div class="section-heading">
        <div><span class="kicker">REVISED ORDER</span><h2>Three deliberate passes</h2></div>
        <p>Translation and schema replacement happen first. Jina and retrieval land together next; Derived Output consumes the proven query seam last.</p>
      </div>

      <div class="phase-grid">
        {#each PHASES as phase, index (phase.number)}
          {@const PhaseIcon = phase.icon}
          <article class="phase phase-{phase.state}">
            <header>
              <span class="phase-icon"><PhaseIcon size={18} aria-hidden="true" /></span>
              <span class="phase-number">{phase.number}</span>
              <span class="phase-state">{phase.state}</span>
            </header>
            <h3>{phase.title}</h3>
            <p>{phase.summary}</p>
            <div><strong>DELIVERABLE</strong><span>{phase.deliverable}</span></div>
          </article>
          {#if index < PHASES.length - 1}<ArrowRight class="phase-arrow" size={19} aria-hidden="true" />{/if}
        {/each}
      </div>
    </section>

    <section id="functions" class="section">
      <div class="section-heading">
        <div><span class="kicker">PROCEDURE → FUNCTION</span><h2>The callable spine</h2></div>
        <p>Transient messages cross each arrow. Only the publication function writes semantic rows and advances the overlay generation.</p>
      </div>

      <ol class="function-flow">
        {#each FUNCTIONS as item (item.step)}
          <li class:queued={item.state === "queued"}>
            <div class="function-step">{item.step}</div>
            <div class="function-main">
              <span class="function-status">{item.state === "landed" ? "implemented" : "publication seam"}</span>
              <code>{item.function}</code>
              <small>{item.file}</small>
            </div>
            <div class="function-contract"><span>IN</span><code>{item.input}</code></div>
            <ArrowRight size={15} aria-hidden="true" />
            <div class="function-contract"><span>OUT</span><code>{item.output}</code></div>
          </li>
        {/each}
      </ol>
    </section>

    <section class="section provider-seam" aria-labelledby="provider-title">
      <div class="provider-copy">
        <span class="kicker">NEXT / SERVER CONFIGURATION</span>
        <h2 id="provider-title">Jina gets its own embedding API section.</h2>
        <p>
          Translation behavior does not know about HTTP or credentials. A server-owned adapter
          will read this provision, make the two Jina calls, and pass plain messages into the
          functions already implemented.
        </p>
        <div class="provider-path">
          <span><ServerCog size={15} aria-hidden="true" /> token field call</span>
          <ArrowRight size={14} aria-hidden="true" />
          <span><Braces size={15} aria-hidden="true" /> deterministic core</span>
          <ArrowRight size={14} aria-hidden="true" />
          <span><ServerCog size={15} aria-hidden="true" /> final dense call</span>
        </div>
      </div>
      <pre><code>semanticOverlay:
  embedding:
    api: jina
    jina:
      endpoint: https://api.jina.ai/v1/embeddings
      model: jina-embeddings-v4
      dimensions: 512
      timeoutMs: 90000
      # apiKey: local.yaml only</code></pre>
    </section>

    <section id="files" class="section">
      <div class="section-heading">
        <div><span class="kicker">FOLD-IN MANIFEST</span><h2>Every semantic file-level change</h2></div>
        <p>This is the review boundary. Shared files are changed narrowly so unrelated work already in the tree is preserved.</p>
      </div>

      <div class="file-toolbar">
        <div class="filters" aria-label="Filter file changes">
          {#each ["all", "add", "change", "delete"] as option}
            <button class:active={filter === option} type="button" onclick={() => (filter = option as typeof filter)}>
              {option}
              <span>{option === "all" ? FILES.length : FILES.filter((file) => file.action === option).length}</span>
            </button>
          {/each}
        </div>
        <span class="root-path"><Database size={13} aria-hidden="true" /> app/src/lib/… unless noted</span>
      </div>

      <div class="file-list">
        {#each visibleFiles as file (file.path)}
          <article class="file-row file-{file.action}">
            <div class="file-action">
              {#if file.action === "add"}<FilePlus2 size={15} aria-hidden="true" />{:else if file.action === "change"}<FilePenLine size={15} aria-hidden="true" />{:else}<Trash2 size={15} aria-hidden="true" />{/if}
              <span>{file.action}</span>
            </div>
            <div class="file-path">
              <code>{file.path}</code>
              <span class="status status-{file.status}">{file.status}</span>
            </div>
            <div class="file-detail">
              <strong>{file.purpose}</strong>
              <p>{file.contents}</p>
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section id="verification" class="section">
      <div class="section-heading">
        <div><span class="kicker">CURRENT EVIDENCE</span><h2>What the branch proves today</h2></div>
        <p>These checks stop at the provider seam. No mocked HTTP response is being mistaken for a live Jina integration.</p>
      </div>

      <div class="verification-grid">
        <article class="test-card">
          <header><FlaskConical size={18} aria-hidden="true" /><div><span>FOCUSED UNIT SUITE</span><strong>8 / 8 passing</strong></div></header>
          <ul>{#each TESTS as test}<li><Check size={13} aria-hidden="true" /> {test}</li>{/each}</ul>
        </article>
        <div class="check-stack">
          <article><FileCode2 size={18} aria-hidden="true" /><div><span>ARCHITECTURE LINT</span><strong>63 checks · 0 findings</strong><p>The complete repository architecture suite, including six representation invariants.</p></div></article>
          <article><FlaskConical size={18} aria-hidden="true" /><div><span>REPOSITORY TESTS</span><strong>591 / 591 passing</strong><p>The eight new translation checks run inside the existing 55-file suite.</p></div></article>
          <article><Braces size={18} aria-hidden="true" /><div><span>TYPES + PRODUCTION BUILD</span><strong>0 errors · build complete</strong><p>Both semantic routes bundle; one unrelated carousel accessibility warning remains outside this manifest.</p></div></article>
          <article class="pending"><Clock3 size={18} aria-hidden="true" /><div><span>NEXT PROOF</span><strong>Jina + exhaustive-cosine oracle</strong><p>Live provisioning and recursive retrieval recall belong to phase two.</p></div></article>
        </div>
      </div>
    </section>

    <section class="handoff">
      <div><span class="kicker">CURRENT DECISION POINT</span><h2>The translation contract is executable.</h2><p>Review the manifest and callable spine; the next implementation move is the server-owned Jina provision plus recursive index/query.</p></div>
      <a href="/demo/semantic-overlay"><ChevronLeft size={15} aria-hidden="true" /> Architecture overview</a>
    </section>
  </main>

  <footer><span>SEMANTIC OVERLAY / IMPLEMENTATION PLAN 02</span><span>branch: work/semantic-overlay-cutover</span></footer>
</div>

<style>
  :global(body) { margin: 0; }
  :global(*) { box-sizing: border-box; }
  .implementation-shell {
    min-height: 100vh;
    background:
      radial-gradient(circle at 86% 3%, color-mix(in srgb, var(--token-color-active-fill) 11%, transparent), transparent 25rem),
      var(--token-surface-canvas);
    color: var(--token-ink-primary);
  }
  .topbar {
    position: sticky;
    z-index: 20;
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
  .wordmark, nav, .provider-path, .handoff a { display: flex; align-items: center; }
  .wordmark { gap: .5rem; color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .7rem; letter-spacing: .1em; text-decoration: none; }
  .wordmark > :global(svg) { color: var(--token-ink-muted); }
  .mark { width: .58rem; height: .58rem; border: 2px solid var(--token-color-active-text); transform: rotate(45deg); }
  .muted { color: var(--token-ink-muted); }
  nav { gap: 1.35rem; }
  nav a { color: var(--token-ink-secondary); font-size: .76rem; text-decoration: none; }
  nav a:hover { color: var(--token-color-interactive-text); }
  main, footer { width: min(100% - 3rem, 78rem); margin-inline: auto; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(20rem, .75fr); gap: 4rem; align-items: end; padding: 6.5rem 0 3rem; }
  .eyebrow, .kicker { color: var(--token-color-active-text); font-family: var(--token-font-mono); font-size: .66rem; font-weight: 500; letter-spacing: .11em; text-transform: uppercase; }
  .eyebrow { display: flex; gap: .45rem; align-items: center; margin-bottom: 1.2rem; }
  h1, h2, h3, p { margin: 0; }
  h1 { max-width: 12ch; font-size: clamp(3rem, 6vw, 5.4rem); font-weight: 500; letter-spacing: -.065em; line-height: .94; }
  .lede { max-width: 48rem; margin-top: 1.6rem; color: var(--token-ink-secondary); font-size: clamp(.98rem, 2vw, 1.14rem); line-height: 1.65; }
  .branch-card { overflow: hidden; border: 1px solid var(--token-color-active-border); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); box-shadow: var(--token-shadow-panel); }
  .branch-card header { display: flex; gap: .5rem; align-items: center; padding: .7rem .85rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-color-active-text); font-family: var(--token-font-mono); font-size: .63rem; letter-spacing: .08em; }
  .branch-card > code { display: block; padding: 1rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .82rem; }
  .branch-card dl { display: grid; grid-template-columns: 1fr 1fr; margin: 0; }
  .branch-card dl div { padding: .85rem 1rem; border-right: 1px solid var(--token-border-subtle); border-bottom: 1px solid var(--token-border-subtle); }
  .branch-card dl div:nth-child(even) { border-right: 0; }
  .branch-card dt { color: var(--token-ink-muted); font-size: .62rem; }
  .branch-card dd { margin: .25rem 0 0; font-family: var(--token-font-mono); font-size: 1.35rem; }
  .branch-card > p { padding: .85rem 1rem 1rem; color: var(--token-ink-muted); font-size: .68rem; line-height: 1.5; }
  .status-line { display: grid; grid-template-columns: auto 1fr auto; gap: .8rem; align-items: center; padding: .9rem 1rem; border: 1px solid var(--token-color-success-border); border-radius: var(--token-radius-control); background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .status-line p { color: var(--token-ink-secondary); font-size: .78rem; line-height: 1.45; }
  .status-line strong { color: var(--token-color-success-text); font-weight: 500; }
  .status-line a { display: inline-flex; gap: .4rem; align-items: center; color: var(--token-color-success-text); font-family: var(--token-font-mono); font-size: .65rem; text-decoration: none; white-space: nowrap; }
  .section { padding: 6rem 0 0; scroll-margin-top: 4rem; }
  .section-heading { display: flex; justify-content: space-between; gap: 3rem; align-items: end; margin-bottom: 2rem; }
  h2 { margin-top: .42rem; font-size: clamp(1.8rem, 3.5vw, 2.7rem); font-weight: 500; letter-spacing: -.04em; line-height: 1.05; }
  .section-heading > p { max-width: 31rem; color: var(--token-ink-muted); font-size: .8rem; line-height: 1.55; text-align: right; }
  .phase-grid { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: .7rem; align-items: center; }
  .phase { min-height: 17rem; padding: 1rem; border: 1px solid var(--token-border-subtle); border-top: 3px solid var(--phase-color); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .phase-done { --phase-color: var(--token-color-success-border); background: linear-gradient(145deg, var(--token-color-success-surface), var(--token-surface-panel) 65%); }
  .phase-next { --phase-color: var(--token-color-intelligence-border); }
  .phase-later { --phase-color: var(--token-color-accent-1-border); }
  .phase header { display: flex; gap: .55rem; align-items: center; }
  .phase-icon { display: grid; place-items: center; width: 2.1rem; height: 2.1rem; border-radius: var(--token-radius-control); background: color-mix(in srgb, var(--phase-color) 18%, transparent); color: var(--phase-color); }
  .phase-number { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .62rem; }
  .phase-state { margin-left: auto; padding: .18rem .38rem; border: 1px solid var(--phase-color); border-radius: 999px; color: var(--phase-color); font-family: var(--token-font-mono); font-size: .56rem; letter-spacing: .06em; text-transform: uppercase; }
  .phase h3 { margin-top: 1.4rem; font-size: 1.05rem; font-weight: 500; }
  .phase > p { min-height: 6.5rem; margin-top: .65rem; color: var(--token-ink-muted); font-size: .74rem; line-height: 1.55; }
  .phase > div { padding-top: .75rem; border-top: 1px solid var(--token-border-subtle); }
  .phase > div strong, .phase > div span { display: block; }
  .phase > div strong { color: var(--phase-color); font-family: var(--token-font-mono); font-size: .56rem; letter-spacing: .08em; }
  .phase > div span { margin-top: .35rem; color: var(--token-ink-secondary); font-size: .68rem; line-height: 1.4; }
  .phase-arrow { color: var(--token-ink-muted); }
  .function-flow { overflow: hidden; margin: 0; padding: 0; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); list-style: none; }
  .function-flow li { display: grid; grid-template-columns: 2rem minmax(15rem, 1.25fr) minmax(10rem, 1fr) auto minmax(10rem, 1fr); gap: 1rem; align-items: center; min-height: 6.5rem; padding: .9rem 1rem; border-bottom: 1px solid var(--token-border-subtle); }
  .function-flow li:last-child { border-bottom: 0; }
  .function-flow li.queued { background: var(--token-color-attention-surface); }
  .function-step { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .62rem; }
  .function-main code, .function-main small { display: block; }
  .function-status { color: var(--token-color-success-text); font-family: var(--token-font-mono); font-size: .55rem; letter-spacing: .07em; text-transform: uppercase; }
  .queued .function-status { color: var(--token-color-attention-text); }
  .function-main code { margin-top: .42rem; color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .76rem; overflow-wrap: anywhere; }
  .function-main small { margin-top: .25rem; color: var(--token-ink-muted); font-size: .61rem; }
  .function-contract span { display: block; color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .54rem; }
  .function-contract code { display: block; margin-top: .35rem; color: var(--token-ink-secondary); font-family: var(--token-font-mono); font-size: .64rem; line-height: 1.4; white-space: normal; }
  .function-flow li > :global(svg) { color: var(--token-color-active-text); }
  .provider-seam { display: grid; grid-template-columns: 1fr minmax(22rem, .8fr); gap: 3rem; align-items: center; }
  .provider-copy > p { max-width: 42rem; margin-top: .8rem; color: var(--token-ink-muted); font-size: .8rem; line-height: 1.6; }
  .provider-path { flex-wrap: wrap; gap: .5rem; margin-top: 1.25rem; color: var(--token-color-intelligence-text); }
  .provider-path span { display: inline-flex; gap: .35rem; align-items: center; padding: .35rem .55rem; border: 1px solid var(--token-color-intelligence-border); border-radius: 999px; background: var(--token-color-intelligence-surface); color: var(--token-ink-secondary); font-size: .64rem; }
  .provider-seam pre { overflow-x: auto; margin: 0; padding: 1.2rem; border: 1px solid var(--token-color-intelligence-border); border-radius: var(--token-radius-panel); background: var(--token-color-intelligence-surface); color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .69rem; line-height: 1.65; }
  .file-toolbar { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-bottom: .75rem; }
  .filters { display: flex; gap: .4rem; }
  .filters button { display: inline-flex; gap: .45rem; align-items: center; padding: .4rem .65rem; border: 1px solid var(--token-border-subtle); border-radius: 999px; background: var(--token-surface-panel); color: var(--token-ink-secondary); font-family: var(--token-font-mono); font-size: .62rem; text-transform: uppercase; cursor: pointer; }
  .filters button.active { border-color: var(--token-color-active-border); background: var(--token-color-active-surface); color: var(--token-color-active-text); }
  .filters button span { display: grid; place-items: center; min-width: 1.1rem; height: 1.1rem; border-radius: 999px; background: var(--token-surface-work); font-size: .55rem; }
  .root-path { display: inline-flex; gap: .4rem; align-items: center; color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .61rem; }
  .file-list { overflow: hidden; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .file-row { display: grid; grid-template-columns: 5rem minmax(18rem, 1.1fr) minmax(20rem, 1fr); gap: 1rem; align-items: center; min-height: 6rem; padding: .85rem 1rem; border-left: 3px solid var(--action-color); border-bottom: 1px solid var(--token-border-subtle); }
  .file-row:last-child { border-bottom: 0; }
  .file-add { --action-color: var(--token-color-success-border); }
  .file-change { --action-color: var(--token-color-attention-border); }
  .file-delete { --action-color: var(--token-color-danger-border); }
  .file-action { display: flex; gap: .4rem; align-items: center; color: var(--action-color); font-family: var(--token-font-mono); font-size: .58rem; letter-spacing: .06em; text-transform: uppercase; }
  .file-path { min-width: 0; }
  .file-path > code { color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .69rem; line-height: 1.45; overflow-wrap: anywhere; }
  .status { display: block; width: fit-content; margin-top: .38rem; padding: .14rem .32rem; border: 1px solid currentColor; border-radius: 999px; font-family: var(--token-font-mono); font-size: .51rem; letter-spacing: .05em; text-transform: uppercase; }
  .status-landed { color: var(--token-color-success-text); }
  .status-active { color: var(--token-color-active-text); }
  .status-queued { color: var(--token-color-attention-text); }
  .file-detail strong { font-size: .72rem; font-weight: 500; }
  .file-detail p { margin-top: .35rem; color: var(--token-ink-muted); font-size: .66rem; line-height: 1.5; }
  .verification-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem; }
  .test-card, .check-stack article { border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .test-card header { display: flex; gap: .7rem; align-items: center; padding: 1rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-color-success-text); }
  .test-card header span, .test-card header strong { display: block; }
  .test-card header span, .check-stack span { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .56rem; letter-spacing: .08em; }
  .test-card header strong { margin-top: .2rem; color: var(--token-color-success-text); font-size: .85rem; font-weight: 500; }
  .test-card ul { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin: 0; padding: 0; list-style: none; }
  .test-card li { display: flex; gap: .45rem; align-items: start; min-height: 3.5rem; padding: .75rem; border-right: 1px solid var(--token-border-subtle); border-bottom: 1px solid var(--token-border-subtle); color: var(--token-ink-secondary); font-size: .66rem; line-height: 1.4; }
  .test-card li:nth-child(even) { border-right: 0; }
  .test-card li:nth-last-child(-n + 2) { border-bottom: 0; }
  .test-card li > :global(svg) { flex: 0 0 auto; margin-top: .1rem; color: var(--token-color-success-text); }
  .check-stack { display: grid; gap: .65rem; }
  .check-stack article { display: grid; grid-template-columns: auto 1fr; gap: .75rem; align-items: start; padding: 1rem; color: var(--token-color-success-text); }
  .check-stack article.pending { border-color: var(--token-color-attention-border); background: var(--token-color-attention-surface); color: var(--token-color-attention-text); }
  .check-stack strong { display: block; margin-top: .28rem; color: var(--token-ink-primary); font-size: .82rem; font-weight: 500; }
  .check-stack p { margin-top: .35rem; color: var(--token-ink-muted); font-size: .66rem; line-height: 1.45; }
  .handoff { display: grid; grid-template-columns: 1fr auto; gap: 3rem; align-items: center; margin-top: 6rem; padding: 2rem; border: 1px solid var(--token-color-active-border); border-radius: var(--token-radius-panel); background: var(--token-color-active-surface); }
  .handoff h2 { font-size: 1.8rem; }
  .handoff p { max-width: 48rem; margin-top: .65rem; color: var(--token-ink-secondary); font-size: .8rem; line-height: 1.55; }
  .handoff a { gap: .45rem; padding: .55rem .7rem; border: 1px solid var(--token-color-active-border); border-radius: var(--token-radius-control); color: var(--token-color-active-text); font-family: var(--token-font-mono); font-size: .64rem; text-decoration: none; white-space: nowrap; }
  footer { display: flex; justify-content: space-between; gap: 2rem; margin-top: 6rem; padding: 1.5rem 0 2rem; border-top: 1px solid var(--token-border-subtle); color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .61rem; letter-spacing: .08em; text-transform: uppercase; }
  @media (max-width: 62rem) {
    nav { display: none; }
    .hero { grid-template-columns: 1fr; gap: 2.5rem; padding-top: 4.5rem; }
    .branch-card { max-width: 35rem; }
    .phase-grid { grid-template-columns: 1fr; }
    .phase { min-height: auto; }
    .phase > p { min-height: auto; padding-bottom: 1.4rem; }
    .phase-arrow { justify-self: center; transform: rotate(90deg); }
    .function-flow li { grid-template-columns: 2rem 1fr; }
    .function-contract, .function-flow li > :global(svg) { grid-column: 2; }
    .function-flow li > :global(svg) { transform: rotate(90deg); }
    .provider-seam, .verification-grid { grid-template-columns: 1fr; }
    .file-row { grid-template-columns: 5rem 1fr; }
    .file-detail { grid-column: 2; }
  }
  @media (max-width: 43rem) {
    .topbar { padding: 0 1rem; }
    .wordmark .muted { display: none; }
    main, footer { width: min(100% - 2rem, 78rem); }
    .hero { padding-top: 3.5rem; }
    h1 { font-size: clamp(2.9rem, 15vw, 4.2rem); }
    .status-line { grid-template-columns: auto 1fr; }
    .status-line a { grid-column: 2; }
    .section { padding-top: 4.5rem; }
    .section-heading { display: block; }
    .section-heading > p { margin-top: .8rem; text-align: left; }
    .file-toolbar { align-items: start; flex-direction: column; }
    .filters { flex-wrap: wrap; }
    .file-row { grid-template-columns: 1fr; }
    .file-detail { grid-column: 1; }
    .test-card ul { grid-template-columns: 1fr; }
    .test-card li { border-right: 0; }
    .test-card li:nth-last-child(2) { border-bottom: 1px solid var(--token-border-subtle); }
    .provider-seam pre { font-size: .62rem; }
    .handoff { grid-template-columns: 1fr; padding: 1.3rem; }
    footer { flex-direction: column; }
  }
</style>
