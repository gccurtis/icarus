<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Braces from "@lucide/svelte/icons/braces";
  import Check from "@lucide/svelte/icons/check";
  import Database from "@lucide/svelte/icons/database";
  import Eye from "@lucide/svelte/icons/eye";
  import Gauge from "@lucide/svelte/icons/gauge";
  import ImageIcon from "@lucide/svelte/icons/image";
  import Layers3 from "@lucide/svelte/icons/layers-3";
  import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
  import Network from "@lucide/svelte/icons/network";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Search from "@lucide/svelte/icons/search";
  import Server from "@lucide/svelte/icons/server";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Wrench from "@lucide/svelte/icons/wrench";

  import {
    DERIVED_AGENT_TOOL_CATALOG,
    type DerivedAgentToolMode,
    type DerivedAgentToolName
  } from "$capabilities/derived-output";

  type TriggerId = "document-create" | "document-save" | "deck-create" | "deck-save";
  type Filter = "all" | DerivedAgentToolMode;

  const TRIGGERS = [
    {
      id: "document-create" as const,
      index: "A1",
      label: "Document created",
      owner: "createProjectResource",
      condition: "The server successfully creates the document row and revision-0 leader snapshot.",
      revision: "document · leader revision 0",
      exact: "Usually empty at creation; publishing it establishes the current source with zero spans.",
      materials: "The same projection inventories any represented table or image content. A blank document has none."
    },
    {
      id: "document-save" as const,
      index: "A2",
      label: "Document save accepted",
      owner: "submitDocumentChanges",
      condition: "The server accepts the change set, advances the leader, and only then emits the semantic signal.",
      revision: "document · newest accepted leader revision",
      exact: "Header, body, footer, formulas, image alt/captions, and declared table headers are projected.",
      materials: "Every represented table and sourced image is inventoried with authored nearby context."
    },
    {
      id: "deck-create" as const,
      index: "A3",
      label: "Slide deck created",
      owner: "createProjectResource",
      condition: "The server successfully creates the deck row and revision-0 leader snapshot.",
      revision: "slides · leader revision 0",
      exact: "The empty first slide contributes no spans, but its authoritative revision is queued.",
      materials: "The initial blank deck contributes no material records."
    },
    {
      id: "deck-save" as const,
      index: "A4",
      label: "Slide save accepted",
      owner: "submitSlideDeckChanges",
      condition: "The server accepts the deck operations, advances the leader, and only then emits the semantic signal.",
      revision: "slides · newest accepted leader revision",
      exact: "Visible slides are traversed in deck/frame order; authored text, formulas, shape text, notes, and image text enter the exact lane.",
      materials: "Tables, charts, sourced images, and image backgrounds become semantic-material inventory."
    }
  ] as const;

  const SOURCE_ROWS = [
    ["Document", "Exact text + table/image materials", "Create · each accepted save", "Automatic"],
    ["Slide deck", "Exact text + table/chart/image materials", "Create · each accepted save", "Automatic"],
    ["External UTF-8 text", "Exact text", "Explicit enqueue · backfill", "Explicit today"],
    ["Spreadsheet", "One native table material", "Explicit enqueue · backfill", "Explicit today"],
    ["External CSV", "CSV profile/material + native bytes", "Explicit enqueue · backfill", "Explicit today"],
    ["External code", "Code profile/material + native bytes", "Explicit enqueue · backfill", "Explicit today"],
    ["External image", "Image profile/visual facet + native pixels", "Explicit enqueue · backfill", "Explicit today"]
  ] as const;

  const PROCESSORS = [
    {
      label: "Derived Output refresh",
      code: "prepareSemanticOverlay",
      behavior: "Drains both queues in bounded batches until settled before retrieval begins.",
      tone: "pull"
    },
    {
      label: "Worker command",
      code: "processSemanticSyncQueue",
      behavior: "Claims a bounded exact batch, then a bounded material batch; failures remain durable.",
      tone: "worker"
    },
    {
      label: "Development backfill",
      code: "backfillSemanticOverlay",
      behavior: "Enumerates current leaders/files, coalesces their revisions, and immediately drains one batch.",
      tone: "backfill"
    },
    {
      label: "Immediate exact sync",
      code: "syncSemanticResource",
      behavior: "Directly projects and publishes one exact-text resource; it does not process material inventory.",
      tone: "direct"
    }
  ] as const;

  const RECIPES = [
    {
      question: "A prose fact anywhere in scope",
      route: ["retrieve", "exact span + evidence ID"],
      note: "Normal and forced-first path when there is no selection."
    },
    {
      question: "The user’s selected passage",
      route: ["read_selection", "exact span + evidence ID"],
      note: "Forced-first path; no semantic index required."
    },
    {
      question: "A number inside a table or CSV",
      route: ["retrieve_materials", "inspect_dataset", "read_table / read_csv", "structured evidence ID"],
      note: "Discovery and orientation never replace the bounded native read."
    },
    {
      question: "What a particular slide contains",
      route: ["find_resources", "list_deck_slides", "inspect_slide", "view_slide + typed readers"],
      note: "The schematic explains layout; factual claims still resolve through evidence tools."
    },
    {
      question: "What an image depicts",
      route: ["retrieve_materials / inspect_slide", "read_image", "original pixels + visual evidence ID"],
      note: "The cited visual is the content-addressed image, not the slide schematic."
    }
  ] as const;

  const FILES = [
    ["project-resources/.../create-project-resource.ts", "Two automatic creation hooks"],
    ["document/.../submit-document-changes.ts", "Accepted document-save hook"],
    ["slide-deck/.../submit-slide-deck-changes.ts", "Accepted deck-save hook"],
    ["semantic-overlay/api/enqueue-semantic-sync", "Revision capture + two-lane coalescing"],
    ["semantic-overlay/api/shared/queue-processor.ts", "Exact and material worker boundary"],
    ["semantic/projection/resources/{document,slide-deck}.ts", "Authoritative traversal"],
    ["derived-output/api/shared/tool-catalog.ts", "All 16 live agent tool contracts"],
    ["derived-output/api/shared/{synthesis,resource-reading}.ts", "Executable tool implementations"]
  ] as const;

  let triggerId = $state<TriggerId>("deck-save");
  const trigger = $derived(TRIGGERS.find((entry) => entry.id === triggerId) ?? TRIGGERS[3]);

  let filter = $state<Filter>("all");
  let activeName = $state<DerivedAgentToolName>("retrieve");
  const tools = $derived(
    DERIVED_AGENT_TOOL_CATALOG.filter((tool) => filter === "all" || tool.mode === filter)
  );
  const activeTool = $derived(
    DERIVED_AGENT_TOOL_CATALOG.find((tool) => tool.name === activeName) ??
    DERIVED_AGENT_TOOL_CATALOG[0]
  );
  const evidenceCount = DERIVED_AGENT_TOOL_CATALOG.filter((tool) => tool.mode === "evidence").length;
  const orientationCount = DERIVED_AGENT_TOOL_CATALOG.length - evidenceCount;
  const evidenceKind = (tool: (typeof DERIVED_AGENT_TOOL_CATALOG)[number]) =>
    "evidence" in tool ? tool.evidence : undefined;
  const activeEvidence = $derived(evidenceKind(activeTool));

  const chooseFilter = (next: Filter) => {
    filter = next;
    const current = DERIVED_AGENT_TOOL_CATALOG.find((tool) => tool.name === activeName);
    if (next !== "all" && current?.mode !== next) {
      activeName = DERIVED_AGENT_TOOL_CATALOG.find((tool) => tool.mode === next)?.name ?? "retrieve";
    }
  };
</script>

<svelte:head>
  <title>Semantic intake and agent tools — Icarus</title>
  <meta
    name="description"
    content="The exact authoring hooks, semantic queue conditions, and sixteen tools visible to the Derived Output agent."
  />
</svelte:head>

<div class="intake-page">
  <header class="local-nav">
    <a class="brand" href="/demo/semantic-overlay">
      <span class="brand-signal" aria-hidden="true"><i></i><i></i><i></i></span>
      <span>SEMANTIC CONTROL ROOM</span>
    </a>
    <nav aria-label="On this page">
      <a href="#triggers">intake</a>
      <a href="#processing">processing</a>
      <a href="#tools">agent tools</a>
      <a href="#routes">routes</a>
    </nav>
    <a class="back" href="/demo">All demos <ArrowRight size={14} /></a>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow"><Network size={14} /> CURRENT BRANCH / LIVE CONTRACT</span>
        <h1>When knowledge moves.<br /><em>How the agent sees.</em></h1>
        <p>
          Saving is a signal, not an embedding call. The server captures an authoritative revision,
          two durable lanes settle it, and the answer-writing agent crosses that boundary through
          sixteen narrow tools.
        </p>
      </div>

      <div class="hero-instruments" aria-label="Current implementation totals">
        <article><strong>04</strong><span>automatic<br />authoring hooks</span></article>
        <article><strong>02</strong><span>durable<br />semantic lanes</span></article>
        <article><strong>16</strong><span>working<br />agent tools</span></article>
      </div>

      <div class="hero-rule">
        <span>SAVE</span><i></i><span>QUEUE LATEST REVISION</span><i></i><span>PROCESS</span><i></i><span>DISCOVER + READ</span>
      </div>
    </section>

    <section id="triggers" class="section triggers-section">
      <header class="section-heading">
        <div><span>01 / INTAKE SWITCHBOARD</span><h2>Four automatic signals.<br />All happen after authority.</h2></div>
        <p>
          A browser edit alone does nothing to the overlay. The hook fires only after the server has
          accepted or created the leader revision. Repeated saves coalesce to the newest requested revision.
        </p>
      </header>

      <div class="switchboard">
        <div class="trigger-keys" role="tablist" aria-label="Automatic semantic ingestion triggers">
          {#each TRIGGERS as entry (entry.id)}
            <button
              type="button"
              role="tab"
              aria-selected={triggerId === entry.id}
              class:active={triggerId === entry.id}
              onclick={() => (triggerId = entry.id)}
            >
              <span>{entry.index}</span>
              <strong>{entry.label}</strong>
              <small>{entry.owner}</small>
            </button>
          {/each}
        </div>

        <div class="signal-readout" role="tabpanel">
          <div class="readout-head"><span>SELECTED SIGNAL</span><strong>{trigger.label}</strong></div>
          <p>{trigger.condition}</p>
          <div class="wire-path" aria-label="Selected trigger call sequence">
            <div><small>AUTHORITATIVE WRITE</small><code>{trigger.owner}</code></div>
            <ArrowDown size={18} aria-hidden="true" />
            <div><small>CAPTURED TARGET</small><code>{trigger.revision}</code></div>
            <ArrowDown size={18} aria-hidden="true" />
            <div class="emit"><small>ONE SERVER CALL</small><code>enqueueSemanticSync(&#123; ref &#125;)</code></div>
            <div class="fork"><span></span><b>coalesces by project + ref</b><span></span></div>
            <div class="lane-pair">
              <article><small>EXACT LANE</small><strong>semanticSyncJobs</strong><p>{trigger.exact}</p></article>
              <article><small>MATERIAL LANE</small><strong>semanticMaterialJobs</strong><p>{trigger.materials}</p></article>
            </div>
          </div>
        </div>
      </div>

      <div class="source-matrix" aria-label="Semantic source update conditions">
        <div class="matrix-head"><span>SOURCE</span><span>WHAT CAN BE PUBLISHED</span><span>POSITIVE TRIGGER</span><span>STATUS</span></div>
        {#each SOURCE_ROWS as row (row[0])}
          <div class="matrix-row">
            {#each row as value, index (value)}
              <span class:automatic={index === 3 && value === "Automatic"}>{value}</span>
            {/each}
          </div>
        {/each}
      </div>

      <aside class="exclusion-note">
        <ShieldCheck size={19} />
        <p><strong>Loop prevention:</strong> generated Prompt Block responses are skipped by document and slide projection. They never become new authored evidence merely because they are displayed in a resource.</p>
      </aside>
    </section>

    <section id="processing" class="section processing-section">
      <header class="section-heading light-heading">
        <div><span>02 / PROCESSING CONDITIONS</span><h2>Queued is durable.<br />Processed is searchable.</h2></div>
        <p>
          The queues survive the initiating interaction, but this branch does not yet host an always-on
          worker. These are the four implemented ways work actually crosses into current semantic state.
        </p>
      </header>

      <div class="processor-grid">
        {#each PROCESSORS as processor, index (processor.code)}
          <article class="processor {processor.tone}">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <RefreshCw size={18} />
            <h3>{processor.label}</h3>
            <code>{processor.code}</code>
            <p>{processor.behavior}</p>
          </article>
        {/each}
      </div>

      <div class="settlement-map">
        <div class="queue queue-exact"><small>EXACT JOB</small><strong>queued → running</strong></div>
        <ArrowRight size={20} />
        <div class="worker-core"><Server size={22} /><strong>revision recheck</strong><small>embed / profile / describe</small></div>
        <ArrowRight size={20} />
        <div class="published"><small>CURRENT STATE</small><strong>guarded publication</strong></div>
        <div class="supersede"><span>newer save during work?</span><strong>requeue newest revision</strong></div>
      </div>
    </section>

    <section id="tools" class="section tools-section">
      <header class="section-heading">
        <div><span>03 / AGENT SIGHTLINE</span><h2>Sixteen tools.<br />Two kinds of knowing.</h2></div>
        <p>
          Search discovers. Orientation supplies handles and structure. Only evidence-producing tools
          can support the final structured answer—and every issued ID is validated after the model responds.
        </p>
      </header>

      <div class="first-call-rule">
        <MousePointer2 size={18} />
        <div><small>APPLICATION-FORCED FIRST CALL</small><strong>selection exists → <code>read_selection</code></strong></div>
        <span>otherwise</span>
        <div><small>DEFAULT DISCOVERY</small><strong>no selection → <code>retrieve</code></strong></div>
        <Search size={18} />
      </div>

      <div class="tool-console">
        <div class="tool-index">
          <div class="tool-filters" role="tablist" aria-label="Filter agent tools">
            <button type="button" role="tab" aria-selected={filter === "all"} onclick={() => chooseFilter("all")}>All <span>16</span></button>
            <button type="button" role="tab" aria-selected={filter === "evidence"} onclick={() => chooseFilter("evidence")}>Evidence <span>{evidenceCount}</span></button>
            <button type="button" role="tab" aria-selected={filter === "orientation"} onclick={() => chooseFilter("orientation")}>Orientation <span>{orientationCount}</span></button>
          </div>

          <div class="tool-list">
            {#each tools as tool, index (tool.name)}
              <button
                type="button"
                class:active={activeName === tool.name}
                class:evidence={tool.mode === "evidence"}
                onclick={() => (activeName = tool.name)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <code>{tool.name}</code>
                <small>{evidenceKind(tool) ?? "context only"}</small>
              </button>
            {/each}
          </div>
        </div>

        <article class="observation-window" data-mode={activeTool.mode}>
          <header>
            <span>{activeTool.mode === "evidence" ? "EVIDENCE-PRODUCING" : "ORIENTATION ONLY"}</span>
            <small>{activeTool.family}</small>
          </header>
          <div class="tool-title"><Eye size={24} /><h3><code>{activeTool.name}</code></h3></div>
          <p class="tool-description">{activeTool.description}</p>
          <dl>
            <div><dt>WHAT THE AGENT CAN OBSERVE</dt><dd>{activeTool.sees}</dd></div>
            <div><dt>CALL SHAPE</dt><dd><code>{activeTool.input}</code></dd></div>
            <div><dt>WHAT COMES BACK</dt><dd>{activeTool.returns}</dd></div>
            <div><dt>AUTHORITY GATE</dt><dd>{activeTool.gate}</dd></div>
          </dl>
          <footer>
            {#if activeEvidence}
              <Check size={16} /><span>May issue <strong>{activeEvidence}</strong> evidence</span>
            {:else}
              <Eye size={16} /><span>May guide another call; cannot support a final claim</span>
            {/if}
          </footer>
        </article>
      </div>

      <div class="observation-planes">
        <article>
          <div class="plane-icon"><Layers3 size={22} /></div>
          <span>SEMANTIC DISCOVERY PLANE</span>
          <h3>Find what may matter.</h3>
          <p><code>retrieve</code> and <code>retrieve_materials</code> depend on current processed overlay objects. This is where embeddings and similarity participate.</p>
        </article>
        <div class="plane-bridge"><ArrowRight size={22} /><small>range or<br />material handle</small></div>
        <article>
          <div class="plane-icon"><Database size={22} /></div>
          <span>AUTHORITATIVE READING PLANE</span>
          <h3>Resolve what is actually there.</h3>
          <p><code>read_*</code>, list, and inspect tools resolve current resource snapshots or content-addressed bytes. They do not search the overlay again.</p>
        </article>
      </div>
    </section>

    <section id="routes" class="section routes-section">
      <header class="section-heading">
        <div><span>04 / ACCESS RECIPES</span><h2>Information is available<br />through a route.</h2></div>
        <p>
          The model is not handed project JSON. It receives a small first result, identifies the missing
          context, and opens only the next bounded door required to answer.
        </p>
      </header>

      <div class="recipe-list">
        {#each RECIPES as recipe, index (recipe.question)}
          <article>
            <span class="recipe-number">0{index + 1}</span>
            <div class="recipe-question"><small>QUESTION SHAPE</small><strong>{recipe.question}</strong><p>{recipe.note}</p></div>
            <div class="recipe-route">
              {#each recipe.route as stop, stopIndex (stop)}
                <code>{stop}</code>
                {#if stopIndex < recipe.route.length - 1}<ArrowRight size={15} aria-hidden="true" />{/if}
              {/each}
            </div>
          </article>
        {/each}
      </div>

      <div class="truth-wall">
        <article><Gauge size={19} /><span>BOUNDED</span><p>Eight tool rounds, top K up to 20, text reads up to 20k UTF-16 units, typed native-reader limits.</p></article>
        <article><ShieldCheck size={19} /><span>SCOPED</span><p>Project authority and the Derived Output Resource Set gate every resource, handle, and read.</p></article>
        <article><Braces size={19} /><span>STRUCTURED</span><p>The final model result is status + response + selected evidence IDs with a declared use for each.</p></article>
        <article><ImageIcon size={19} /><span>VISUAL, WITH A LINE</span><p><code>read_image</code> is visual evidence. <code>view_slide</code> is a schematic orientation image and never evidence.</p></article>
      </div>
    </section>

    <section class="section file-section">
      <header class="section-heading compact-heading">
        <div><span>05 / CHANGE MAP</span><h2>The files behind the board.</h2></div>
        <p>The tool catalogue is imported by both this page and executable registration, preventing the visible 16-tool inventory from drifting away from runtime names and descriptions.</p>
      </header>
      <div class="file-grid">
        {#each FILES as [path, purpose] (path)}
          <article><code>{path}</code><span>{purpose}</span></article>
        {/each}
      </div>
      <aside class="deployment-gap"><Wrench size={18} /><p><strong>Current deployment seam:</strong> queues are durable and Derived Output refresh drains them, but an always-on worker/recovery host and automatic spreadsheet/upload mutation hooks are not present yet.</p></aside>
    </section>
  </main>

  <footer class="page-footer">
    <span><Sparkles size={14} /> REFERENCE / CURRENT IMPLEMENTATION</span>
    <p>Four automatic authoring hooks · two semantic lanes · sixteen working agent tools.</p>
    <a href="/demo/semantic-overlay/agent-runtime">Continue to agent runtime <ArrowRight size={14} /></a>
  </footer>
</div>

<style>
  :global(body) { margin: 0; }
  :global(html) { scroll-behavior: smooth; }

  .intake-page {
    --wire: var(--token-color-intelligence-border);
    --wire-soft: var(--token-color-intelligence-surface);
    --signal: var(--token-color-intelligence-text);
    min-height: 100vh;
    overflow: clip;
    background:
      radial-gradient(circle at 88% 6%, color-mix(in srgb, var(--token-color-intelligence-fill) 12%, transparent), transparent 24rem),
      var(--token-surface-canvas);
    color: var(--token-ink-primary);
    font-family: var(--token-font-sans);
  }

  .local-nav {
    position: sticky;
    z-index: 20;
    top: 0;
    display: grid;
    min-height: 3.25rem;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    border-bottom: 1px solid var(--token-border-subtle);
    padding: 0 2.25rem;
    background: color-mix(in srgb, var(--token-surface-canvas) 90%, transparent);
    backdrop-filter: blur(18px);
  }

  .brand, .back, .local-nav nav { display: flex; align-items: center; }
  .brand { gap: 0.65rem; color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: 0.66rem; font-weight: 700; letter-spacing: 0.11em; text-decoration: none; }
  .brand-signal { display: flex; gap: 2px; align-items: end; width: 1.25rem; height: 0.9rem; }
  .brand-signal i { width: 3px; background: var(--signal); }
  .brand-signal i:nth-child(1) { height: 35%; }
  .brand-signal i:nth-child(2) { height: 100%; }
  .brand-signal i:nth-child(3) { height: 63%; }
  .local-nav nav { gap: 1.5rem; }
  .local-nav nav a, .back { color: var(--token-ink-muted); font-size: 0.7rem; text-decoration: none; }
  .local-nav nav a:hover, .back:hover { color: var(--signal); }
  .back { justify-self: end; gap: 0.35rem; }

  main { max-width: 92rem; margin: 0 auto; }
  .section { padding: 7rem 4.5rem; }

  .hero {
    display: grid;
    min-height: 42rem;
    grid-template-columns: minmax(0, 1.4fr) minmax(20rem, 0.8fr);
    grid-template-rows: 1fr auto;
    column-gap: 5rem;
    align-items: center;
    padding: 6rem 4.5rem 3rem;
  }

  .eyebrow, .section-heading > div > span, .readout-head > span, .observation-window > header span,
  .observation-planes article > span, .recipe-question small, .processor > span {
    font-family: var(--token-font-mono);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.12em;
  }
  .eyebrow { display: flex; gap: 0.5rem; align-items: center; color: var(--signal); }
  .hero h1 { max-width: 14ch; margin: 1.1rem 0 1.5rem; font-family: var(--token-font-serif); font-size: clamp(3.4rem, 6.3vw, 6.7rem); font-weight: 400; letter-spacing: -0.055em; line-height: 0.91; }
  .hero h1 em { color: var(--signal); font-weight: 400; }
  .hero-copy > p { max-width: 59ch; margin: 0; color: var(--token-ink-secondary); font-size: 1.03rem; line-height: 1.75; }

  .hero-instruments { display: grid; border: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); box-shadow: var(--token-shadow-panel); }
  .hero-instruments article { display: grid; grid-template-columns: 5rem 1fr; align-items: center; gap: 1.2rem; padding: 1.35rem 1.5rem; }
  .hero-instruments article + article { border-top: 1px solid var(--token-border-subtle); }
  .hero-instruments strong { color: var(--signal); font-family: var(--token-font-mono); font-size: 2.3rem; font-weight: 500; }
  .hero-instruments span { color: var(--token-ink-secondary); font-size: 0.77rem; font-weight: 600; letter-spacing: 0.04em; line-height: 1.35; text-transform: uppercase; }

  .hero-rule { display: grid; grid-column: 1 / -1; grid-template-columns: auto 1fr auto 1fr auto 1fr auto; align-items: center; gap: 0.8rem; color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.61rem; letter-spacing: 0.07em; }
  .hero-rule i { height: 1px; background: linear-gradient(90deg, var(--wire), transparent); }

  .section-heading { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(18rem, 0.65fr); gap: 4rem; align-items: end; margin-bottom: 3.25rem; }
  .section-heading > div > span { color: var(--signal); }
  .section-heading h2 { max-width: 18ch; margin: 0.7rem 0 0; font-family: var(--token-font-serif); font-size: clamp(2.5rem, 4.2vw, 4.6rem); font-weight: 400; letter-spacing: -0.045em; line-height: 0.98; }
  .section-heading > p { max-width: 48ch; margin: 0; color: var(--token-ink-secondary); line-height: 1.7; }

  .triggers-section { border-top: 1px solid var(--token-border-subtle); }
  .switchboard { display: grid; grid-template-columns: minmax(15rem, 0.42fr) minmax(0, 1fr); min-height: 38rem; border: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); box-shadow: var(--token-shadow-panel); }
  .trigger-keys { display: flex; border-right: 1px solid var(--token-border-subtle); flex-direction: column; background: var(--token-surface-pasteboard); }
  .trigger-keys button { display: grid; position: relative; flex: 1; grid-template-columns: 2.4rem 1fr; grid-template-rows: auto auto; align-content: center; gap: 0.25rem 0.8rem; border: 0; border-bottom: 1px solid var(--token-border-subtle); padding: 1.4rem; background: transparent; color: var(--token-ink-secondary); text-align: left; cursor: pointer; }
  .trigger-keys button:last-child { border-bottom: 0; }
  .trigger-keys button > span { grid-row: 1 / 3; color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.63rem; }
  .trigger-keys strong { font-size: 0.82rem; }
  .trigger-keys small { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.6rem; }
  .trigger-keys button.active { background: var(--token-surface-elevated); color: var(--token-ink-primary); }
  .trigger-keys button.active::after { position: absolute; top: 0; right: -1px; bottom: 0; width: 3px; background: var(--signal); content: ""; }

  .signal-readout { padding: 2rem 2.5rem 2.5rem; }
  .readout-head { display: flex; align-items: baseline; justify-content: space-between; gap: 2rem; border-bottom: 1px solid var(--token-border-subtle); padding-bottom: 1rem; }
  .readout-head span { color: var(--signal); }
  .readout-head strong { font-family: var(--token-font-serif); font-size: 1.4rem; font-weight: 400; }
  .signal-readout > p { max-width: 68ch; color: var(--token-ink-secondary); line-height: 1.65; }
  .wire-path { display: grid; justify-items: center; gap: 0.5rem; padding-top: 0.75rem; }
  .wire-path > div:not(.fork):not(.lane-pair) { display: grid; width: min(100%, 31rem); gap: 0.35rem; border: 1px solid var(--token-border-subtle); padding: 0.9rem 1.1rem; background: var(--token-surface-elevated); text-align: center; }
  .wire-path small { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.55rem; letter-spacing: 0.1em; }
  .wire-path code { color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: 0.68rem; }
  .wire-path .emit { border-color: var(--wire) !important; box-shadow: inset 0 0 0 1px var(--wire-soft); }
  .fork { display: grid; width: 80%; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.6rem; }
  .fork span { height: 1px; background: var(--wire); }
  .fork b { color: var(--signal); font-family: var(--token-font-mono); font-size: 0.55rem; font-weight: 500; }
  .lane-pair { display: grid; width: 100%; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .lane-pair article { border-top: 3px solid var(--wire); padding: 1.1rem; background: var(--token-surface-pasteboard); }
  .lane-pair article:last-child { border-color: var(--token-color-attention-border); }
  .lane-pair strong { display: block; margin: 0.35rem 0 0.6rem; font-family: var(--token-font-mono); font-size: 0.75rem; }
  .lane-pair p { margin: 0; color: var(--token-ink-secondary); font-size: 0.76rem; line-height: 1.55; }

  .source-matrix { margin-top: 2rem; border: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); }
  .matrix-head, .matrix-row { display: grid; grid-template-columns: 0.75fr 1.35fr 1.1fr 0.58fr; }
  .matrix-head { background: var(--token-surface-pasteboard); color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.56rem; font-weight: 700; letter-spacing: 0.08em; }
  .matrix-head span, .matrix-row span { padding: 0.85rem 1rem; }
  .matrix-head span + span, .matrix-row span + span { border-left: 1px solid var(--token-border-subtle); }
  .matrix-row { border-top: 1px solid var(--token-border-subtle); color: var(--token-ink-secondary); font-size: 0.73rem; }
  .matrix-row span:first-child { color: var(--token-ink-primary); font-weight: 600; }
  .matrix-row .automatic { color: var(--signal); font-weight: 700; }
  .exclusion-note, .deployment-gap { display: flex; gap: 0.85rem; align-items: flex-start; margin-top: 1.5rem; border-left: 3px solid var(--token-color-attention-border); padding: 1rem 1.2rem; background: var(--token-color-attention-surface); color: var(--token-color-attention-text); }
  .exclusion-note p, .deployment-gap p { margin: 0; font-size: 0.77rem; line-height: 1.55; }
  .exclusion-note :global(svg), .deployment-gap :global(svg) { flex: 0 0 auto; }

  .processing-section { background: var(--token-ink-primary); color: var(--token-surface-canvas); }
  .light-heading > div > span { color: var(--token-color-intelligence-fill); }
  .light-heading > p { color: color-mix(in srgb, var(--token-surface-canvas) 70%, transparent); }
  .processor-grid { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid color-mix(in srgb, var(--token-surface-canvas) 20%, transparent); }
  .processor { display: grid; min-height: 16rem; grid-template-columns: 1fr auto; align-content: start; border-right: 1px solid color-mix(in srgb, var(--token-surface-canvas) 20%, transparent); padding: 1.4rem; }
  .processor:last-child { border-right: 0; }
  .processor > span { color: color-mix(in srgb, var(--token-surface-canvas) 50%, transparent); }
  .processor > :global(svg) { color: var(--token-color-intelligence-fill); }
  .processor h3 { grid-column: 1 / -1; margin: 2.5rem 0 0.5rem; font-family: var(--token-font-serif); font-size: 1.45rem; font-weight: 400; }
  .processor code { grid-column: 1 / -1; color: var(--token-color-intelligence-fill); font-family: var(--token-font-mono); font-size: 0.62rem; }
  .processor p { grid-column: 1 / -1; margin: 1rem 0 0; color: color-mix(in srgb, var(--token-surface-canvas) 70%, transparent); font-size: 0.76rem; line-height: 1.55; }

  .settlement-map { display: grid; position: relative; grid-template-columns: 1fr auto 1.15fr auto 1fr; align-items: center; gap: 1rem; margin-top: 3rem; }
  .queue, .worker-core, .published { display: grid; min-height: 6rem; align-content: center; gap: 0.4rem; border: 1px solid color-mix(in srgb, var(--token-surface-canvas) 22%, transparent); padding: 1rem; text-align: center; }
  .queue small, .worker-core small, .published small { color: color-mix(in srgb, var(--token-surface-canvas) 56%, transparent); font-family: var(--token-font-mono); font-size: 0.55rem; letter-spacing: 0.1em; }
  .queue strong, .worker-core strong, .published strong { font-size: 0.78rem; }
  .worker-core { justify-items: center; border-color: var(--token-color-intelligence-fill); }
  .worker-core :global(svg) { color: var(--token-color-intelligence-fill); }
  .supersede { position: absolute; right: 20%; bottom: -2.4rem; display: flex; gap: 0.6rem; color: color-mix(in srgb, var(--token-surface-canvas) 55%, transparent); font-family: var(--token-font-mono); font-size: 0.57rem; }
  .supersede strong { color: var(--token-color-intelligence-fill); }

  .first-call-rule { display: grid; grid-template-columns: auto 1fr auto 1fr auto; align-items: center; gap: 1rem; border: 1px solid var(--wire); padding: 1rem 1.25rem; background: var(--wire-soft); }
  .first-call-rule > :global(svg) { color: var(--signal); }
  .first-call-rule div { display: grid; gap: 0.2rem; }
  .first-call-rule small { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.54rem; letter-spacing: 0.08em; }
  .first-call-rule strong { font-size: 0.76rem; font-weight: 500; }
  .first-call-rule > span { color: var(--token-ink-muted); font-family: var(--token-font-serif); font-style: italic; }

  .tool-console { display: grid; grid-template-columns: minmax(22rem, 0.85fr) minmax(0, 1.15fr); min-height: 43rem; margin-top: 1.5rem; border: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); box-shadow: var(--token-shadow-panel); }
  .tool-index { border-right: 1px solid var(--token-border-subtle); }
  .tool-filters { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 1px solid var(--token-border-subtle); }
  .tool-filters button { border: 0; border-right: 1px solid var(--token-border-subtle); padding: 0.9rem 0.7rem; background: var(--token-surface-pasteboard); color: var(--token-ink-muted); font-size: 0.7rem; cursor: pointer; }
  .tool-filters button:last-child { border-right: 0; }
  .tool-filters button[aria-selected="true"] { background: var(--token-surface-elevated); color: var(--token-ink-primary); }
  .tool-filters span { margin-left: 0.25rem; color: var(--signal); font-family: var(--token-font-mono); }
  .tool-list { display: grid; grid-template-columns: 1fr 1fr; padding: 0.7rem; }
  .tool-list button { display: grid; min-width: 0; grid-template-columns: auto 1fr; gap: 0.15rem 0.55rem; border: 1px solid transparent; padding: 0.7rem; background: transparent; color: var(--token-ink-secondary); text-align: left; cursor: pointer; }
  .tool-list button > span { grid-row: 1 / 3; color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.52rem; }
  .tool-list code { overflow: hidden; color: inherit; font-family: var(--token-font-mono); font-size: 0.65rem; text-overflow: ellipsis; }
  .tool-list small { color: var(--token-ink-muted); font-size: 0.58rem; }
  .tool-list button.evidence small { color: var(--signal); }
  .tool-list button:hover { background: var(--token-surface-pasteboard); }
  .tool-list button.active { border-color: var(--wire); background: var(--wire-soft); color: var(--token-ink-primary); }

  .observation-window { display: flex; min-width: 0; flex-direction: column; padding: 2rem 2.5rem; }
  .observation-window > header { display: flex; justify-content: space-between; border-bottom: 1px solid var(--token-border-subtle); padding-bottom: 0.8rem; }
  .observation-window > header span { color: var(--signal); }
  .observation-window > header small { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.58rem; text-transform: uppercase; }
  .tool-title { display: flex; gap: 0.8rem; align-items: center; margin: 2.2rem 0 0.8rem; }
  .tool-title :global(svg) { color: var(--signal); }
  .tool-title h3 { margin: 0; font-size: clamp(1.45rem, 2.2vw, 2.2rem); font-weight: 500; }
  .tool-title code { font-family: var(--token-font-mono); }
  .tool-description { max-width: 58ch; margin: 0; color: var(--token-ink-secondary); line-height: 1.65; }
  .observation-window dl { display: grid; margin: 2.2rem 0 1.5rem; }
  .observation-window dl div { display: grid; grid-template-columns: 10.5rem 1fr; gap: 1rem; border-top: 1px solid var(--token-border-subtle); padding: 1rem 0; }
  .observation-window dt { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.55rem; font-weight: 700; letter-spacing: 0.07em; }
  .observation-window dd { margin: 0; color: var(--token-ink-secondary); font-size: 0.76rem; line-height: 1.55; }
  .observation-window dd code { color: var(--token-ink-primary); font-family: var(--token-font-mono); }
  .observation-window footer { display: flex; gap: 0.55rem; align-items: center; margin-top: auto; border: 1px solid var(--wire); padding: 0.8rem 1rem; background: var(--wire-soft); color: var(--signal); font-size: 0.72rem; }
  .observation-window[data-mode="orientation"] footer { border-style: dashed; border-color: var(--token-border-subtle); background: var(--token-surface-pasteboard); color: var(--token-ink-muted); }

  .observation-planes { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1.5rem; align-items: center; margin-top: 2rem; }
  .observation-planes article { min-height: 12rem; border-top: 3px solid var(--wire); padding: 1.25rem; background: var(--token-surface-panel); }
  .plane-icon { display: grid; width: 2.6rem; height: 2.6rem; margin-bottom: 1.7rem; place-items: center; border: 1px solid var(--wire); color: var(--signal); }
  .observation-planes article > span { color: var(--signal); }
  .observation-planes h3 { margin: 0.5rem 0; font-family: var(--token-font-serif); font-size: 1.65rem; font-weight: 400; }
  .observation-planes p { margin: 0; color: var(--token-ink-secondary); font-size: 0.77rem; line-height: 1.6; }
  .observation-planes code { font-family: var(--token-font-mono); font-size: 0.7rem; }
  .plane-bridge { display: grid; justify-items: center; gap: 0.5rem; color: var(--signal); }
  .plane-bridge small { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.52rem; text-align: center; }

  .routes-section { border-top: 1px solid var(--token-border-subtle); background: var(--token-surface-pasteboard); }
  .recipe-list { border-top: 1px solid var(--token-border-subtle); }
  .recipe-list article { display: grid; grid-template-columns: 3rem minmax(14rem, 0.7fr) minmax(0, 1.3fr); gap: 1.4rem; align-items: center; border-bottom: 1px solid var(--token-border-subtle); padding: 1.4rem 0; }
  .recipe-number { color: var(--signal); font-family: var(--token-font-mono); font-size: 0.65rem; }
  .recipe-question { display: grid; gap: 0.25rem; }
  .recipe-question small { color: var(--token-ink-muted); }
  .recipe-question strong { font-family: var(--token-font-serif); font-size: 1.12rem; font-weight: 400; }
  .recipe-question p { margin: 0; color: var(--token-ink-muted); font-size: 0.68rem; line-height: 1.45; }
  .recipe-route { display: flex; flex-wrap: wrap; gap: 0.55rem; align-items: center; }
  .recipe-route code { border: 1px solid var(--token-border-subtle); padding: 0.45rem 0.6rem; background: var(--token-surface-elevated); color: var(--token-ink-secondary); font-family: var(--token-font-mono); font-size: 0.62rem; }
  .recipe-route :global(svg) { color: var(--signal); }

  .truth-wall { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 3rem; border: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); }
  .truth-wall article { display: grid; min-height: 12rem; align-content: start; border-right: 1px solid var(--token-border-subtle); padding: 1.2rem; }
  .truth-wall article:last-child { border-right: 0; }
  .truth-wall :global(svg) { color: var(--signal); }
  .truth-wall span { margin-top: 1.6rem; color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; }
  .truth-wall p { margin: 0.7rem 0 0; color: var(--token-ink-secondary); font-size: 0.72rem; line-height: 1.55; }

  .file-section { border-top: 1px solid var(--token-border-subtle); }
  .compact-heading h2 { font-size: clamp(2.2rem, 3.5vw, 3.6rem); }
  .file-grid { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); }
  .file-grid article { display: grid; gap: 0.4rem; border-bottom: 1px solid var(--token-border-subtle); padding: 1rem 1.2rem; }
  .file-grid article:nth-child(odd) { border-right: 1px solid var(--token-border-subtle); }
  .file-grid code { color: var(--signal); font-family: var(--token-font-mono); font-size: 0.63rem; }
  .file-grid span { color: var(--token-ink-secondary); font-size: 0.72rem; }

  .page-footer { display: grid; max-width: 92rem; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 1rem; margin: 0 auto; border-top: 1px solid var(--token-border-subtle); padding: 2rem 4.5rem 3.5rem; }
  .page-footer > span { display: flex; gap: 0.45rem; align-items: center; color: var(--signal); font-family: var(--token-font-mono); font-size: 0.57rem; font-weight: 700; letter-spacing: 0.08em; }
  .page-footer p { margin: 0; color: var(--token-ink-muted); font-size: 0.68rem; }
  .page-footer a { display: flex; justify-self: end; gap: 0.4rem; align-items: center; color: var(--token-ink-primary); font-size: 0.7rem; text-decoration: none; }

  @media (max-width: 980px) {
    .local-nav { grid-template-columns: 1fr auto; padding-inline: 1.25rem; }
    .local-nav nav { display: none; }
    .hero { min-height: auto; grid-template-columns: 1fr; gap: 3rem; padding: 5rem 2rem 2.5rem; }
    .hero-rule { margin-top: 1rem; }
    .section { padding: 5rem 2rem; }
    .section-heading { grid-template-columns: 1fr; gap: 1.5rem; }
    .switchboard { grid-template-columns: 1fr; }
    .trigger-keys { display: grid; grid-template-columns: 1fr 1fr; border-right: 0; border-bottom: 1px solid var(--token-border-subtle); }
    .trigger-keys button:nth-child(odd) { border-right: 1px solid var(--token-border-subtle); }
    .processor-grid, .truth-wall { grid-template-columns: 1fr 1fr; }
    .processor:nth-child(2), .truth-wall article:nth-child(2) { border-right: 0; }
    .processor:nth-child(-n+2), .truth-wall article:nth-child(-n+2) { border-bottom: 1px solid color-mix(in srgb, var(--token-surface-canvas) 20%, transparent); }
    .tool-console { grid-template-columns: 1fr; }
    .tool-index { border-right: 0; border-bottom: 1px solid var(--token-border-subtle); }
    .observation-planes { grid-template-columns: 1fr; }
    .plane-bridge { transform: rotate(90deg); }
    .recipe-list article { grid-template-columns: 2rem 1fr; }
    .recipe-route { grid-column: 2; }
    .page-footer { grid-template-columns: 1fr; padding-inline: 2rem; }
    .page-footer a { justify-self: start; }
  }

  @media (max-width: 640px) {
    .local-nav { min-height: 3rem; }
    .back { font-size: 0; }
    .back :global(svg) { width: 16px; height: 16px; }
    .hero { padding: 4rem 1.1rem 2rem; }
    .hero h1 { font-size: clamp(3rem, 15vw, 4.8rem); }
    .hero-instruments article { grid-template-columns: 4rem 1fr; }
    .hero-rule { grid-template-columns: 1fr; gap: 0.35rem; }
    .hero-rule i { width: 1px; height: 1rem; margin-left: 0.2rem; }
    .section { padding: 4rem 1.1rem; }
    .trigger-keys { grid-template-columns: 1fr; }
    .trigger-keys button:nth-child(odd) { border-right: 0; }
    .signal-readout { padding: 1.25rem; }
    .readout-head { display: grid; gap: 0.5rem; }
    .lane-pair { grid-template-columns: 1fr; }
    .source-matrix { overflow-x: auto; }
    .matrix-head, .matrix-row { min-width: 46rem; }
    .processor-grid, .truth-wall { grid-template-columns: 1fr; }
    .processor, .processor:nth-child(2), .truth-wall article, .truth-wall article:nth-child(2) { border-right: 0; border-bottom: 1px solid color-mix(in srgb, var(--token-surface-canvas) 20%, transparent); }
    .settlement-map { grid-template-columns: 1fr; justify-items: center; }
    .settlement-map > :global(svg) { transform: rotate(90deg); }
    .queue, .worker-core, .published { width: 100%; }
    .supersede { position: static; display: grid; justify-items: center; text-align: center; }
    .first-call-rule { grid-template-columns: auto 1fr; }
    .first-call-rule > span { grid-column: 2; }
    .tool-console { min-height: 0; }
    .tool-list { grid-template-columns: 1fr; }
    .observation-window { padding: 1.4rem; }
    .observation-window dl div { grid-template-columns: 1fr; gap: 0.45rem; }
    .file-grid { grid-template-columns: 1fr; }
    .file-grid article:nth-child(odd) { border-right: 0; }
    .page-footer { padding: 1.5rem 1.1rem 3rem; }
  }
</style>
