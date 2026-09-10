<script lang="ts">
  import AlertTriangle from "@lucide/svelte/icons/triangle-alert";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Braces from "@lucide/svelte/icons/braces";
  import Check from "@lucide/svelte/icons/check";
  import Code2 from "@lucide/svelte/icons/code-2";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Layers3 from "@lucide/svelte/icons/layers-3";
  import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Server from "@lucide/svelte/icons/server";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import Type from "@lucide/svelte/icons/type";
  import Users from "@lucide/svelte/icons/users";

  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";

  type Stage = "text" | "prompt" | "linked" | "refreshed";

  const STAGES: {
    readonly id: Stage;
    readonly label: string;
    readonly action: string;
    readonly inspector: string;
    readonly display: string;
    readonly detail: string;
  }[] = [
    {
      id: "text",
      label: "01 · Text",
      action: "Select a text box",
      inspector: "Text box",
      display: "Quarterly readiness summary",
      detail: "The element is ordinary authored text. Prompt is an action beside Comment."
    },
    {
      id: "prompt",
      label: "02 · Convert",
      action: "Click Prompt",
      inspector: "Prompt block · setup",
      display: "Quarterly readiness summary",
      detail: "Only element.content changes. Geometry, paint, order, text, marks and IDs stay put."
    },
    {
      id: "linked",
      label: "03 · Link",
      action: "Enter prompt + Generate",
      inspector: "Prompt block · generating",
      display: "Quarterly readiness summary",
      detail: "The current text seeds optional previous-response continuity; it is never evidence."
    },
    {
      id: "refreshed",
      label: "04 · Publish",
      action: "Server refresh completes",
      inspector: "Prompt block · evidence",
      display: "Readiness improved to 92% across all regions.",
      detail: "The response arrives through deck ops. It remains editable and keeps its mark ranges."
    }
  ];

  let active = $state<Stage>("refreshed");
  const current = $derived(STAGES.find((stage) => stage.id === active) ?? STAGES[0]);

  const SEQUENCE = `sequenceDiagram
    autonumber
    participant U as Editor action
    participant D as SlideDeckRuntime
    participant O as Derived Output server
    participant S as Semantic Overlay
    participant R as Representation store

    U->>D: withPromptElement(body, elementId)
    D->>R: flush set element/content
    Note over U,R: Same element + block IDs, text, marks, frame, paint and order
    U->>O: createDerivedOutput(prompt, origin: slides)
    O-->>U: derivedOutputId
    U->>D: linkPromptBlockOps(block, id)
    D->>R: flush accepted deck revision
    U->>O: refreshDerivedOutput(id)
    O->>R: coalesce one refresh job by Derived Output ID
    O->>S: drain semantic work + retrieve evidence
    S-->>O: source spans + application-issued evidence IDs
    O->>R: publish response + evidence atomically
    O-->>U: shared refresh result
    U->>D: syncPromptBlockOps(block, output)
    D->>R: remove and insert atoms and marks, then flush
    Note over U,D: The star is editor chrome, and the slide still renders ordinary text`;

  const CALLS = [
    ["withPromptElement", "slide editor", "Text element → Prompt element; presentation survives"],
    ["createDerivedOutput", "server capability", "Creates the durable definition and evidence owner"],
    ["linkPromptBlockOps", "slide adapter", "Replaces inline definition ownership with derivedOutputId"],
    ["refreshDerivedOutput", "server capability", "Queues or joins one shared refresh flight"],
    ["querySemanticOverlay", "semantic capability", "Retrieves consolidated exact-text evidence"],
    ["syncPromptBlockOps", "slide adapter", "Publishes text through collaborative atom/mark ops"],
    ["sceneOf → SlideSurface", "presentation", "Renders PromptBlock exactly like a text box"],
    ["promptBlocksIn", "navigation", "Drives stars and the deck-wide Prompts index"]
  ] as const;

  const FILES = [
    ["representation/data/types/content/content-block.ts", "PromptBlock contract"],
    ["representation/data/types/slide-decks/body.ts", "Prompt element inside SlideElement"],
    ["slide-deck-editor/procedures/prompt-blocks.ts", "Conversion, linking, publication, listing"],
    ["slide-deck-editor/components/prompt-action.svelte", "Text-box entry action"],
    ["slide-deck-editor/inspector/prompt-block.svelte", "Setup plus normal text/element controls"],
    ["slide-deck-editor/components/prompt-settings.svelte", "Refresh state and evidence"],
    ["components/authored/slide-surface/slide-surface.svelte", "Editor-only star marker"],
    ["semantic/projection/resources/slide-deck.ts", "Excludes generated response from ingestion"]
  ] as const;
</script>

<svelte:head>
  <title>Slide Prompt Blocks — Icarus</title>
  <meta
    name="description"
    content="The implemented interaction and exact procedure for editable, derived text in slide decks."
  />
</svelte:head>

<div class="reference-page">
  <header class="local-nav">
    <a class="brand" href="/demo/semantic-overlay">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>SEMANTIC OVERLAY</span>
      <ArrowRight size={13} aria-hidden="true" />
      <strong>SLIDE PROMPT BLOCKS</strong>
    </a>
    <nav aria-label="Slide Prompt Block reference sections">
      <a href="#interaction">interaction</a>
      <a href="#boundary">data boundary</a>
      <a href="#procedure">procedure</a>
      <a href="#collaboration">collaboration</a>
      <a href="#files">files</a>
      <a class="flow-link" href="/demo/semantic-overlay/derived-output-flow">
        full flow <ExternalLink size={12} aria-hidden="true" />
      </a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow"><Sparkles size={14} aria-hidden="true" /> IMPLEMENTED EDITOR SLICE / LIVE CONTRACT</p>
        <h1>The slide stays a slide.<br /><em>The text gains a source.</em></h1>
        <p class="lede">
          A slide Prompt Block is not a special-looking card. It is an ordinary text box whose
          content carries one Derived Output ID. The deck still owns placement and formatting;
          the server owns refresh work, grounding, and the canonical response.
        </p>
        <div class="hero-actions">
          <a href="#interaction">Walk the interaction <ArrowRight size={14} aria-hidden="true" /></a>
          <a class="secondary" href="/app/dev-project">Open the editor</a>
        </div>
      </div>

      <aside class="invariant" aria-label="Slide Prompt Block invariant">
        <span>THE INVARIANT</span>
        <strong>Same element.<br />Same text behavior.<br />One new relationship.</strong>
        <div class="invariant-code">
          <code>SlideElement</code><span>keeps</span><b>frame · paint · order</b>
          <code>PromptBlock</code><span>keeps</span><b>atoms · display · marks</b>
          <code>DerivedOutput</code><span>owns</span><b>prompt · evidence · value</b>
        </div>
      </aside>
    </section>

    <section id="interaction" class="interaction section">
      <header class="section-heading">
        <div><span>01</span><h2>One text box,<br />four observable states.</h2></div>
        <p>
          This specimen follows the shipped interaction. Switch stages to inspect exactly what
          moves and what deliberately does not.
        </p>
      </header>

      <div class="stage-tabs" role="tablist" aria-label="Prompt Block lifecycle">
        {#each STAGES as stage (stage.id)}
          <button
            type="button"
            role="tab"
            aria-selected={active === stage.id}
            onclick={() => (active = stage.id)}
          >
            {stage.label}
          </button>
        {/each}
      </div>

      <div class="editor-specimen">
        <div class="mini-canvas">
          <div class="mini-slide">
            <div class="slide-kicker">OPERATIONS REVIEW · 04</div>
            <div class="slide-rule"></div>
            <div class="text-element" class:is-prompt={active !== "text"}>
              <span>{current.display}</span>
              {#if active !== "text"}
                <button type="button" aria-label="Edit Prompt Block" title="Editor-only Prompt Block marker">✦</button>
              {/if}
            </div>
            <div class="slide-caption">Formatting, geometry and export surface remain unchanged.</div>
          </div>
        </div>

        <aside class="mini-inspector">
          <div class="crumb">DECK / SLIDE 4</div>
          <div class="inspector-title">
            <strong>{current.inspector}</strong>
            <div>
              {#if active === "text"}<button type="button"><Sparkles size={12} /> Prompt</button>{/if}
              <button type="button">Comment</button>
            </div>
          </div>
          {#if active === "text"}
            <div class="control"><span>Kind</span><b>Text box</b></div>
            <div class="control"><span>Text style</span><b>Body · 24</b></div>
            <div class="control"><span>Geometry</span><b>44% × 12%</b></div>
          {:else}
            <label>Prompt<textarea readonly value={active === "prompt" ? "" : "Summarize project readiness in one sentence."}></textarea></label>
            <div class="control"><span>Scope</span><b>Whole project</b></div>
            <button class="refresh" type="button" disabled={active === "prompt"}>
              {#if active === "linked"}<RefreshCw size={12} class="spinning" /> Generating{:else}<RefreshCw size={12} /> Refresh{/if}
            </button>
            {#if active === "refreshed"}
              <div class="evidence-mini"><span>EXACT TEXT</span><q>Readiness improved to 92%...</q><a href="#procedure">Regional readiness</a></div>
            {/if}
            <div class="control"><span>Text style</span><b>Body · 24</b></div>
            <div class="control"><span>Geometry</span><b>44% × 12%</b></div>
          {/if}
        </aside>
      </div>

      <div class="stage-explanation">
        <span>{current.action}</span>
        <p>{current.detail}</p>
        <code>{active === "text" ? 'content.type: "text"' : active === "prompt" ? 'content.type: "prompt" · state: "idle"' : active === "linked" ? 'derivedOutputId: "derivedOutputs:…" · refresh: running' : 'state: "fresh" · evidence.length > 0'}</code>
      </div>
    </section>

    <section id="boundary" class="boundary section">
      <header class="section-heading inverse">
        <div><span>02</span><h2>The conversion is narrow<br />by construction.</h2></div>
        <p>
          The outer element and presentation text never cross the generation boundary. The
          Derived Output knows no slide coordinates, paint, font, or mark ranges.
        </p>
      </header>

      <div class="xray">
        <article class="shell-card">
          <header><Layers3 size={17} /><span>SLIDE ELEMENT / UNCHANGED SHELL</span></header>
          <pre><code>{`{
  id: "element-42",
  frame: { x, y, width, height },
  paint: { fill, stroke, opacity },
  overflow: "grow",
  content:  ↓
}`}</code></pre>
        </article>

        <div class="swap" aria-label="Content conversion">
          <div><Type size={16} /><code>text</code></div>
          <ArrowRight size={19} />
          <div class="active"><Sparkles size={16} /><code>prompt</code></div>
          <small><code>withPromptElement</code></small>
        </div>

        <article class="block-card">
          <header><Braces size={17} /><span>INNER CONTENT / EDITOR OWNED</span></header>
          <pre><code>{`{
  id: "block-42",          // same
  atoms: [...],             // same
  display: "…",            // same
  marks: [...],             // same
  style, format,            // same
  type: "prompt",           // changed
  state: "idle",            // added
  derivedOutputId?: Id       // linked later
}`}</code></pre>
        </article>

        <article class="output-card">
          <header><Server size={17} /><span>DERIVED OUTPUT / SERVER OWNED</span></header>
          <pre><code>{`{
  prompt,
  origin: { kind: "slides", id: deckId },
  scope,
  evidence,
  lastResponse,
  definitionRevision,
  state,
  refreshedAt
}`}</code></pre>
        </article>
      </div>

      <div class="ownership-strip">
        <div><Check size={15} /><span>Marks remain absolute editor ranges and are clipped only when a shorter response no longer covers them.</span></div>
        <div><Check size={15} /><span>Generated display text is excluded from exact and material semantic projection, preventing self-evidence.</span></div>
        <div><Check size={15} /><span>The star is SlideSurface chrome. It is neither slide content nor part of an exported artifact.</span></div>
      </div>
    </section>

    <section id="procedure" class="procedure section">
      <header class="section-heading">
        <div><span>03</span><h2>The exact call chain,<br />including publication.</h2></div>
        <p>
          Conversion and response publication travel through the deck runtime’s collaborative op
          stream. Provider work and refresh coordination remain entirely server-side.
        </p>
      </header>

      <div class="sequence-frame">
        <div class="frame-label"><Code2 size={14} /> SEQUENCE / SLIDE-PROMPT-01</div>
        <MermaidDiagram
          source={SEQUENCE}
          label="Slide Prompt Block conversion, Derived Output refresh, and collaborative response publication"
          caption="The editor sends intent and presentation ops. The server owns semantic settlement, one coalesced refresh job, synthesis, evidence validation, and canonical publication."
          minHeight="40rem"
        />
      </div>

      <div class="call-ledger">
        {#each CALLS as [name, owner, purpose], index (name)}
          <article>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <code>{name}</code>
            <small>{owner}</small>
            <p>{purpose}</p>
          </article>
        {/each}
      </div>
    </section>

    <section id="collaboration" class="collaboration section">
      <header class="section-heading">
        <div><span>04</span><h2>Many clicks.<br />One server flight.</h2></div>
        <p>
          Browser loading state is never the lock. Every refresh signal resolves to the durable job
          for one Derived Output ID, so collaborators see and join the same operation.
        </p>
      </header>

      <div class="flight-map">
        <div class="people">
          <div><Users size={19} /><strong>Browser A</strong><small>Refresh</small></div>
          <div><Users size={19} /><strong>Browser B</strong><small>Refresh × 3</small></div>
        </div>
        <div class="signals"><span></span><span></span><b>derivedOutputId</b></div>
        <div class="job">
          <small>DURABLE SERVER STATE</small>
          <strong>queued → running → idle</strong>
          <code>requestKey + requestedVersion</code>
        </div>
        <ArrowRight class="flight-arrow" size={24} />
        <div class="worker">
          <Server size={22} />
          <strong>one refresh worker</strong>
          <small>drain → retrieve → synthesize → validate → publish</small>
        </div>
      </div>

      <div class="rules-grid">
        <article><span>JOIN</span><p>Identical definition + selection signals return the current shared job.</p></article>
        <article><span>FOLLOW-UP</span><p>Only a changed prompt, previous response, scope, or selection advances the requested version.</p></article>
        <article><span>DISPLAY</span><p>Inspectors poll shared status; queued/running disables duplicate local interaction without becoming authority.</p></article>
        <article><span>RECOVERY</span><p>The last good response remains readable if a later refresh fails.</p></article>
      </div>
    </section>

    <section id="files" class="files section">
      <header class="section-heading">
        <div><span>05</span><h2>Where to change<br />each concern.</h2></div>
        <p>
          These are the durable seams. Slide traversal, generation, presentation, and semantic
          projection remain separate enough to evolve independently.
        </p>
      </header>

      <div class="file-map">
        {#each FILES as [path, role] (path)}
          <article><code>{path}</code><span>{role}</span></article>
        {/each}
      </div>

      <aside class="bounds">
        <AlertTriangle size={19} aria-hidden="true" />
        <div>
          <strong>Intentional first-slice boundaries</strong>
          <p>
            Prompt conversion is offered for standalone text boxes, not text nested inside shapes,
            tables, notes, or groups. Scope is Whole project. Automatic interval refresh, first-link
            compare-and-set, a server-owned single-writer presentation mirror, saved Resource Sets,
            and export-time freeze policy remain explicit next work. Today the canonical refresh is
            coalesced on the server; each mounted editor mirrors that same result through normal deck ops.
          </p>
        </div>
      </aside>
    </section>

    <footer class="page-footer">
      <span><MousePointer2 size={14} /> LIVE ENTRY</span>
      <p>Select a text box → Prompt beside Comment → configure → Generate.</p>
      <a href="/app/dev-project">Try it in the seeded project <ArrowRight size={14} /></a>
    </footer>
  </main>
</div>

<style>
  :global(body) { margin: 0; }
  :global(html) { scroll-behavior: smooth; }

  .reference-page {
    min-height: 100vh;
    background: var(--token-surface-canvas);
    color: var(--token-ink-primary);
    font-family: var(--token-font-sans);
  }

  .local-nav {
    position: sticky;
    z-index: 20;
    top: 0;
    display: flex;
    min-height: 3.25rem;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 0 2rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: color-mix(in srgb, var(--token-surface-panel) 92%, transparent);
    backdrop-filter: blur(16px);
  }

  .brand,
  .local-nav nav,
  .local-nav nav a {
    display: flex;
    align-items: center;
  }

  .brand {
    gap: 0.55rem;
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-decoration: none;
  }

  .brand strong { color: var(--token-ink-primary); font-weight: 650; }
  .brand-mark { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: var(--token-color-intelligence-fill); box-shadow: 0 0 0 4px color-mix(in srgb, var(--token-color-intelligence-fill) 16%, transparent); }
  .local-nav nav { gap: 1rem; }
  .local-nav nav a { gap: 0.25rem; color: var(--token-ink-muted); font-size: 0.72rem; text-decoration: none; }
  .local-nav nav a:hover { color: var(--token-ink-primary); }
  .local-nav .flow-link { color: var(--token-color-intelligence-text); }

  main { overflow: hidden; }
  .hero, .section, .page-footer { max-width: 82rem; margin: 0 auto; }
  .hero { display: grid; min-height: 39rem; grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.65fr); gap: 5rem; align-items: center; padding: 7rem 2.5rem 5.5rem; }
  .eyebrow { display: flex; align-items: center; gap: 0.45rem; margin: 0 0 1.4rem; color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: 0.7rem; font-weight: 650; letter-spacing: 0.12em; }
  h1, h2 { margin: 0; font-family: var(--token-font-serif); font-weight: 500; letter-spacing: -0.035em; }
  h1 { max-width: 53rem; font-size: clamp(3.3rem, 6.5vw, 6.5rem); line-height: 0.92; }
  h1 em { color: var(--token-color-intelligence-text); font-weight: 400; }
  .lede { max-width: 43rem; margin: 2rem 0 0; color: var(--token-ink-secondary); font-size: 1.05rem; line-height: 1.75; }
  .hero-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2rem; }
  .hero-actions a { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.7rem 1rem; border: 1px solid var(--token-color-intelligence-border); border-radius: var(--token-radius-control); background: var(--token-color-intelligence-fill); color: var(--token-color-intelligence-on-fill); font-size: 0.8rem; font-weight: 650; text-decoration: none; }
  .hero-actions a.secondary { background: transparent; color: var(--token-color-intelligence-text); }

  .invariant { position: relative; display: flex; flex-direction: column; gap: 1rem; padding: 2rem; border: 1px solid var(--token-border-subtle); background: var(--token-surface-elevated); box-shadow: var(--token-shadow-raised); }
  .invariant::before { position: absolute; top: -1px; left: -1px; width: 4rem; height: 3px; background: var(--token-color-intelligence-fill); content: ""; }
  .invariant > span { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.66rem; letter-spacing: 0.12em; }
  .invariant > strong { font-family: var(--token-font-serif); font-size: 2rem; line-height: 1.1; font-weight: 500; }
  .invariant-code { display: grid; grid-template-columns: auto auto 1fr; gap: 0.65rem 0.85rem; padding-top: 1rem; border-top: 1px solid var(--token-border-subtle); font-size: 0.72rem; }
  .invariant-code code { color: var(--token-color-intelligence-text); }
  .invariant-code span { color: var(--token-ink-muted); }
  .invariant-code b { color: var(--token-ink-secondary); font-weight: 500; }

  .section { padding: 6rem 2.5rem; }
  .section-heading { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.7fr); gap: 4rem; align-items: end; margin-bottom: 3rem; }
  .section-heading > div { display: flex; gap: 1.25rem; align-items: flex-start; }
  .section-heading > div > span { padding-top: 0.5rem; color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: 0.72rem; }
  h2 { font-size: clamp(2.4rem, 4.5vw, 4.5rem); line-height: 0.96; }
  .section-heading > p { margin: 0; color: var(--token-ink-secondary); line-height: 1.7; }

  .interaction { border-top: 1px solid var(--token-border-subtle); }
  .stage-tabs { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--token-border-subtle); border-bottom: 0; }
  .stage-tabs button { padding: 0.85rem 1rem; border-right: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.7rem; text-align: left; }
  .stage-tabs button:last-child { border-right: 0; }
  .stage-tabs button[aria-selected="true"] { background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); box-shadow: inset 0 -3px 0 var(--token-color-intelligence-border); }
  .editor-specimen { display: grid; min-height: 32rem; grid-template-columns: minmax(0, 1fr) 20rem; border: 1px solid var(--token-border-subtle); background: var(--token-surface-pasteboard); box-shadow: var(--token-shadow-raised); }
  .mini-canvas { display: flex; align-items: center; justify-content: center; padding: 3rem; }
  .mini-slide { position: relative; width: min(100%, 45rem); aspect-ratio: 16 / 9; box-sizing: border-box; padding: 8% 8%; border: 1px solid var(--token-border-subtle); background: var(--token-surface-elevated); box-shadow: var(--token-shadow-panel); }
  .slide-kicker { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: clamp(0.45rem, 1vw, 0.65rem); letter-spacing: 0.12em; }
  .slide-rule { width: 3rem; height: 3px; margin-top: 0.8rem; background: var(--token-color-intelligence-fill); }
  .text-element { position: absolute; top: 36%; left: 8%; width: 67%; min-height: 18%; box-sizing: border-box; padding: 0.6rem; color: var(--token-ink-primary); font-family: var(--token-font-serif); font-size: clamp(1rem, 2.4vw, 2.2rem); line-height: 1.15; }
  .text-element.is-prompt { outline: 1px solid color-mix(in srgb, var(--token-color-active-border) 45%, transparent); outline-offset: 4px; }
  .text-element button { position: absolute; top: -0.9rem; right: -0.9rem; display: grid; width: 1.55rem; height: 1.55rem; place-items: center; border: 2px solid var(--token-surface-elevated); border-radius: 50%; background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); box-shadow: var(--token-shadow-panel); }
  .slide-caption { position: absolute; right: 8%; bottom: 7%; color: var(--token-ink-muted); font-size: clamp(0.45rem, 1vw, 0.7rem); }
  .mini-inspector { padding: 1rem; border-left: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); }
  .crumb { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.62rem; letter-spacing: 0.08em; }
  .inspector-title { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem 0; border-bottom: 1px solid var(--token-border-subtle); }
  .inspector-title strong { color: var(--token-ink-secondary); font-size: 0.9rem; }
  .inspector-title div { display: flex; gap: 0.4rem; }
  .inspector-title button, .refresh { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.55rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-elevated); color: var(--token-ink-secondary); font-size: 0.7rem; }
  .mini-inspector label { display: grid; gap: 0.4rem; margin-top: 1rem; color: var(--token-ink-muted); font-size: 0.68rem; font-weight: 600; }
  .mini-inspector textarea { min-height: 5.5rem; resize: none; padding: 0.55rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-canvas); color: var(--token-ink-primary); font: inherit; font-weight: 400; }
  .control { display: flex; justify-content: space-between; gap: 1rem; padding: 0.9rem 0; border-bottom: 1px solid var(--token-border-subtle); font-size: 0.7rem; }
  .control span { color: var(--token-ink-muted); }
  .control b { color: var(--token-ink-secondary); font-weight: 500; }
  .refresh { margin: 0.7rem 0; }
  .evidence-mini { display: grid; gap: 0.35rem; margin: 0.4rem 0 0.8rem; padding: 0.7rem; border-left: 2px solid var(--token-color-intelligence-border); background: var(--token-color-intelligence-surface); font-size: 0.66rem; }
  .evidence-mini span { color: var(--token-ink-muted); font-family: var(--token-font-mono); }
  .evidence-mini q { color: var(--token-ink-secondary); }
  .evidence-mini a { color: var(--token-color-active-text); }
  .stage-explanation { display: grid; grid-template-columns: 13rem minmax(0, 1fr) auto; gap: 1.5rem; align-items: center; padding: 1.2rem 1.5rem; border: 1px solid var(--token-border-subtle); border-top: 0; background: var(--token-surface-panel); }
  .stage-explanation > span { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: 0.7rem; }
  .stage-explanation p { margin: 0; color: var(--token-ink-secondary); font-size: 0.8rem; }
  .stage-explanation code { color: var(--token-ink-muted); font-size: 0.68rem; }
  :global(.spinning) { animation: turn 1s linear infinite; }
  @keyframes turn { to { transform: rotate(360deg); } }

  .boundary { max-width: none; padding-inline: max(2.5rem, calc((100vw - 77rem) / 2)); background: var(--token-ink-primary); color: var(--token-surface-canvas); }
  .section-heading.inverse > div > span { color: var(--token-color-intelligence-surface); }
  .section-heading.inverse > p { color: color-mix(in srgb, var(--token-surface-canvas) 72%, transparent); }
  .xray { display: grid; grid-template-columns: 1fr 10rem 1fr; gap: 1rem; align-items: center; }
  .shell-card, .block-card, .output-card { border: 1px solid color-mix(in srgb, var(--token-surface-canvas) 24%, transparent); background: color-mix(in srgb, var(--token-surface-canvas) 7%, transparent); }
  .shell-card header, .block-card header, .output-card header { display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem 1rem; border-bottom: 1px solid color-mix(in srgb, var(--token-surface-canvas) 18%, transparent); color: color-mix(in srgb, var(--token-surface-canvas) 72%, transparent); font-family: var(--token-font-mono); font-size: 0.65rem; }
  .xray pre { margin: 0; padding: 1.2rem; overflow: auto; color: var(--token-surface-canvas); font-size: 0.72rem; line-height: 1.7; }
  .swap { display: grid; place-items: center; gap: 0.7rem; }
  .swap > div { display: flex; width: 6rem; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.6rem; border: 1px solid color-mix(in srgb, var(--token-surface-canvas) 25%, transparent); }
  .swap > div.active { border-color: var(--token-color-intelligence-border); background: var(--token-color-intelligence-fill); color: var(--token-color-intelligence-on-fill); }
  .swap small { color: color-mix(in srgb, var(--token-surface-canvas) 65%, transparent); }
  .output-card { grid-column: 1 / -1; width: min(42rem, 80%); justify-self: center; }
  .ownership-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin-top: 2rem; background: color-mix(in srgb, var(--token-surface-canvas) 20%, transparent); }
  .ownership-strip div { display: flex; gap: 0.7rem; align-items: flex-start; padding: 1rem; background: var(--token-ink-primary); color: color-mix(in srgb, var(--token-surface-canvas) 76%, transparent); font-size: 0.76rem; line-height: 1.55; }
  .ownership-strip :global(svg) { flex: 0 0 auto; color: var(--token-color-intelligence-surface); }

  .sequence-frame { overflow: hidden; border: 1px solid var(--token-border-subtle); background: var(--token-surface-elevated); box-shadow: var(--token-shadow-raised); }
  .frame-label { display: flex; align-items: center; gap: 0.45rem; padding: 0.8rem 1rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.66rem; letter-spacing: 0.08em; }
  .call-ledger { display: grid; grid-template-columns: repeat(2, 1fr); margin-top: 1.5rem; border: 1px solid var(--token-border-subtle); }
  .call-ledger article { display: grid; grid-template-columns: 2rem minmax(10rem, 0.8fr) minmax(7rem, 0.45fr) 1fr; gap: 0.75rem; align-items: center; padding: 0.9rem; border-right: 1px solid var(--token-border-subtle); border-bottom: 1px solid var(--token-border-subtle); }
  .call-ledger article:nth-child(even) { border-right: 0; }
  .call-ledger article:nth-last-child(-n + 2) { border-bottom: 0; }
  .call-ledger article > span { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: 0.65rem; }
  .call-ledger code { color: var(--token-color-intelligence-text); font-size: 0.68rem; }
  .call-ledger small { color: var(--token-ink-muted); font-size: 0.68rem; }
  .call-ledger p { margin: 0; color: var(--token-ink-secondary); font-size: 0.72rem; line-height: 1.45; }

  .collaboration { border-top: 1px solid var(--token-border-subtle); }
  .flight-map { display: grid; grid-template-columns: 12rem 8rem minmax(16rem, 1fr) auto minmax(16rem, 1fr); gap: 1.2rem; align-items: center; padding: 2rem; border: 1px solid var(--token-border-subtle); background: var(--token-surface-elevated); box-shadow: var(--token-shadow-raised); }
  .people { display: grid; gap: 0.65rem; }
  .people div { display: grid; grid-template-columns: auto 1fr; gap: 0.15rem 0.55rem; align-items: center; padding: 0.7rem; border: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); }
  .people :global(svg) { grid-row: 1 / 3; color: var(--token-ink-muted); }
  .people strong { color: var(--token-ink-secondary); font-size: 0.75rem; }
  .people small { color: var(--token-ink-muted); font-size: 0.65rem; }
  .signals { display: grid; grid-template-columns: 1fr; gap: 0.5rem; }
  .signals span { height: 1px; background: var(--token-color-intelligence-border); }
  .signals b { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: 0.6rem; font-weight: 500; text-align: center; }
  .job, .worker { display: flex; min-height: 7rem; flex-direction: column; align-items: center; justify-content: center; gap: 0.55rem; padding: 1rem; border: 1px solid var(--token-color-intelligence-border); background: var(--token-color-intelligence-surface); text-align: center; }
  .job small, .worker small { color: var(--token-ink-muted); font-size: 0.65rem; }
  .job strong, .worker strong { color: var(--token-ink-primary); font-size: 0.9rem; }
  .job code { color: var(--token-color-intelligence-text); font-size: 0.65rem; }
  .worker :global(svg) { color: var(--token-color-intelligence-text); }
  :global(.flight-arrow) { color: var(--token-color-intelligence-text); }
  .rules-grid { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 1.5rem; border: 1px solid var(--token-border-subtle); }
  .rules-grid article { padding: 1rem; border-right: 1px solid var(--token-border-subtle); }
  .rules-grid article:last-child { border-right: 0; }
  .rules-grid span { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: 0.64rem; letter-spacing: 0.08em; }
  .rules-grid p { margin: 0.65rem 0 0; color: var(--token-ink-secondary); font-size: 0.75rem; line-height: 1.55; }

  .files { border-top: 1px solid var(--token-border-subtle); }
  .file-map { display: grid; grid-template-columns: repeat(2, 1fr); border: 1px solid var(--token-border-subtle); }
  .file-map article { display: grid; gap: 0.4rem; padding: 1rem; border-right: 1px solid var(--token-border-subtle); border-bottom: 1px solid var(--token-border-subtle); }
  .file-map article:nth-child(even) { border-right: 0; }
  .file-map article:nth-last-child(-n + 2) { border-bottom: 0; }
  .file-map code { color: var(--token-color-intelligence-text); font-size: 0.7rem; }
  .file-map span { color: var(--token-ink-secondary); font-size: 0.75rem; }
  .bounds { display: flex; gap: 1rem; margin-top: 1.5rem; padding: 1.2rem; border: 1px solid var(--token-color-attention-border); background: var(--token-color-attention-surface); }
  .bounds > :global(svg) { flex: 0 0 auto; color: var(--token-color-attention-text); }
  .bounds strong { color: var(--token-ink-primary); font-size: 0.85rem; }
  .bounds p { margin: 0.4rem 0 0; color: var(--token-ink-secondary); font-size: 0.78rem; line-height: 1.6; }

  .page-footer { display: grid; grid-template-columns: auto 1fr auto; gap: 1.5rem; align-items: center; margin-bottom: 4rem; padding: 1.5rem 2rem; border: 1px solid var(--token-color-intelligence-border); background: var(--token-color-intelligence-surface); }
  .page-footer > span, .page-footer a { display: flex; align-items: center; gap: 0.45rem; color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: 0.68rem; font-weight: 600; text-decoration: none; }
  .page-footer p { margin: 0; color: var(--token-ink-secondary); font-size: 0.8rem; }

  @media (max-width: 980px) {
    .local-nav nav a:not(.flow-link) { display: none; }
    .hero { grid-template-columns: 1fr; gap: 3rem; }
    .section-heading { grid-template-columns: 1fr; gap: 1.5rem; }
    .editor-specimen { grid-template-columns: 1fr; }
    .mini-inspector { border-top: 1px solid var(--token-border-subtle); border-left: 0; }
    .xray { grid-template-columns: 1fr; }
    .swap { grid-template-columns: 1fr auto 1fr; }
    .output-card { grid-column: auto; width: auto; }
    .flight-map { grid-template-columns: 1fr; }
    .signals { grid-template-columns: 1fr; }
    :global(.flight-arrow) { transform: rotate(90deg); justify-self: center; }
    .ownership-strip, .rules-grid { grid-template-columns: 1fr; }
    .rules-grid article { border-right: 0; border-bottom: 1px solid var(--token-border-subtle); }
    .rules-grid article:last-child { border-bottom: 0; }
    .call-ledger { grid-template-columns: 1fr; }
    .call-ledger article { border-right: 0; }
    .call-ledger article:nth-last-child(-n + 2) { border-bottom: 1px solid var(--token-border-subtle); }
    .call-ledger article:last-child { border-bottom: 0; }
  }

  @media (max-width: 660px) {
    .local-nav { padding: 0 1rem; }
    .brand > span:not(.brand-mark), .brand :global(svg) { display: none; }
    .hero, .section { padding-right: 1rem; padding-left: 1rem; }
    .hero { padding-top: 5rem; }
    h1 { font-size: 3.25rem; }
    .stage-tabs { grid-template-columns: repeat(2, 1fr); }
    .stage-tabs button:nth-child(2) { border-right: 0; }
    .stage-tabs button:nth-child(-n + 2) { border-bottom: 1px solid var(--token-border-subtle); }
    .mini-canvas { padding: 1rem; }
    .stage-explanation { grid-template-columns: 1fr; }
    .call-ledger article { grid-template-columns: 2rem 1fr; }
    .call-ledger article small, .call-ledger article p { grid-column: 2; }
    .file-map { grid-template-columns: 1fr; }
    .file-map article { border-right: 0; }
    .file-map article:nth-last-child(-n + 2) { border-bottom: 1px solid var(--token-border-subtle); }
    .file-map article:last-child { border-bottom: 0; }
    .page-footer { grid-template-columns: 1fr; margin-right: 1rem; margin-left: 1rem; }
  }
</style>
