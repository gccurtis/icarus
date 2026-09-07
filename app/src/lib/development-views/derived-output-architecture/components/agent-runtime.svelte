<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Binary from "@lucide/svelte/icons/binary";
  import Bot from "@lucide/svelte/icons/bot";
  import Box from "@lucide/svelte/icons/box";
  import Braces from "@lucide/svelte/icons/braces";
  import Check from "@lucide/svelte/icons/check";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import Database from "@lucide/svelte/icons/database";
  import FileSearch from "@lucide/svelte/icons/file-search";
  import Fingerprint from "@lucide/svelte/icons/fingerprint";
  import Gauge from "@lucide/svelte/icons/gauge";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import Layers3 from "@lucide/svelte/icons/layers-3";
  import ListTree from "@lucide/svelte/icons/list-tree";
  import LockKeyhole from "@lucide/svelte/icons/lock-keyhole";
  import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
  import Network from "@lucide/svelte/icons/network";
  import Search from "@lucide/svelte/icons/search";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import TimerReset from "@lucide/svelte/icons/timer-reset";
  import Wrench from "@lucide/svelte/icons/wrench";

  import { DERIVED_OUTPUT_SYSTEM_PROMPT } from "$capabilities/derived-output/index";
  import MermaidDiagram from "$development-views/derived-output-architecture/components/mermaid-diagram.svelte";

  type ToolId = "selection" | "find" | "retrieve";

  const TOOLS = [
    {
      id: "selection" as const,
      number: "01",
      name: "read_selection",
      role: "selected focus",
      icon: MousePointer2,
      decision: "TARGET",
      when: "The run envelope says the user has an active selection. This is the first call so the agent can anchor its work around that focus.",
      input: `{
  // no model-authored coordinates
}`,
      output: `{
  selection: null | {
    evidenceId: "evidence-1",
    source: { ref, revision, encoding },
    span: { from, to, text },
    locator: ResourceLocator
  }
}`,
      rules: [
        "The application resolves the current selection against the authoritative resource; the model never supplies a range.",
        "The selected text is registered as evidence and remains untrusted source data.",
        "This tool does not query the Semantic Overlay and can work before indexing catches up."
      ]
    },
    {
      id: "find" as const,
      number: "02",
      name: "find_resources",
      role: "navigation",
      icon: FileSearch,
      decision: "NEXT",
      when: "The task names a resource ambiguously, asks for broad coverage, or needs an exact ref before reading.",
      input: `{
  query?: string;
  kinds?: ResourceKind[];
  cursor?: string;
  limit?: number; // default 20, max 50
}`,
      output: `{
  resources: [{
    resourceHandle: "resource-3",
    ref: { kind, id },
    title: string,
    revision: number,
    updatedAt: number
  }],
  nextCursor?: string
}`,
      rules: [
        "Project authority and Derived Output scope are injected server-side.",
        "Returns metadata and opaque handles, never complete represented rows.",
        "Navigation does not mint factual evidence; read or retrieve the content before citing it."
      ]
    },
    {
      id: "retrieve" as const,
      number: "03",
      name: "retrieve",
      role: "semantic evidence",
      icon: Search,
      decision: "LIVE",
      when: "The common path: find passages by meaning across the scoped Semantic Overlay.",
      input: `{
  query: string;
  topK?: number; // default 8, max 20
}`,
      output: `{
  hits: [{
    evidenceId: "evidence-4",
    resourceHandle: "resource-3",
    source: { ref, revision, encoding },
    span: { from, to, text },
    locators?: SemanticLocatorSpan[],
    score: number,
    overlayGeneration: number
  }],
  diagnostics
}`,
      rules: [
        "Delegates to querySemanticOverlay and uses the Derived Output's stored scope.",
        "Overlapping or exactly adjacent hits from one source snapshot consolidate before top K.",
        "Exact hit text is already citation-ready, so the normal path needs no redundant read.",
        "After selection, touching citations from repeated tool calls consolidate again without losing their evidence uses."
      ]
    }
  ];

  let activeTool = $state<ToolId>("retrieve");
  const tool = $derived(TOOLS.find((candidate) => candidate.id === activeTool) ?? TOOLS[2]);
  const ActiveToolIcon = $derived(tool.icon);

  const AGENT_LOOP = `flowchart TD
    context["buildDerivedRunContext<br/>stable system + per-run task"]:::start --> selected{"hasSelection?"}:::decision
    selected -- yes --> focus["force read_selection<br/>authoritative selected range"]:::tool
    selected -- no --> retrieve["force retrieve<br/>Semantic Overlay query"]:::tool
    focus --> registry["issue evidence IDs<br/>inside attempt registry"]:::evidence
    retrieve --> registry
    registry --> agent["IntelligenceModel.completeWithTools"]:::agent
    registry --> decide{"Enough grounded context?"}:::decision
    decide -- "no · resource unknown" --> find["find_resources"]:::tool
    decide -- "no · need more meaning" --> retrieveMore["retrieve"]:::tool
    decide -- "no · need non-prose material" --> material["retrieve_materials"]:::tool
    decide -- "no · need orientation" --> orient["list_* / inspect_* / view_*"]:::context
    decide -- "no · need source material" --> read["read_text / table / chart / image / csv / code"]:::tool
    find --> agent
    orient --> agent
    retrieveMore --> registry
    material --> registry
    read --> registry
    decide -- yes --> structured["SynthesisDecision<br/>response + selected IDs"]:::answer
    structured --> validate["parse schema + reject<br/>duplicate or unissued IDs"]:::gate
    validate --> freshness{"Citations current—or<br/>negative generation stable?"}:::decision
    freshness -- no --> retry["discard attempt<br/>fresh registry + bounded retry"]:::warn
    retry --> context
    freshness -- yes --> publish["responseBlock + writeOutput"]:::done
    publish --> destroy["destroy registry<br/>citations persist by value"]:::quiet

    classDef start fill:#1b2f45,color:#eef7f3,stroke:#77a9d4,stroke-width:2px;
    classDef agent fill:#4ed9b1,color:#071711,stroke:#4ed9b1,stroke-width:2px;
    classDef gate fill:#142538,color:#eef7f3,stroke:#77a9d4,stroke-width:2px;
    classDef evidence fill:#201f35,color:#f6ebe2,stroke:#b397e6,stroke-width:2px;
    classDef decision fill:#142538,color:#eef7f3,stroke:#ec8f6b,stroke-width:2px;
    classDef tool fill:#173542,color:#eef7f3,stroke:#4ed9b1,stroke-width:2px;
    classDef context fill:#3a2c18,color:#fff3df,stroke:#d7a34b,stroke-width:2px,stroke-dasharray: 4 3;
    classDef answer fill:#2b2945,color:#f5efff,stroke:#b397e6,stroke-width:2px;
    classDef warn fill:#3a231f,color:#fff3eb,stroke:#ec8f6b,stroke-width:2px;
    classDef done fill:#4ed9b1,color:#071711,stroke:#4ed9b1,stroke-width:2px;
    classDef quiet fill:#0f1c2b,color:#91a5b4,stroke:#31516b,stroke-dasharray: 4 4;`;

  const SYSTEM_PROMPT = DERIVED_OUTPUT_SYSTEM_PROMPT;

  const TASK_ENVELOPE = `CURRENT EXECUTABLE SHAPE
Task: At what frequency does the fictional Atlas beacon emit?

Previous response for stylistic continuity only
(never factual evidence): …

TARGET RUN ENVELOPE
{
  "task": "…",
  "hasSelection": true,
  "previousResponse": "…",
  "responseContract": { "kind": "text", "maxChars": 2400 }
}

Selection text and coordinates are deliberately absent.
The agent obtains them from read_selection.`;

  const OUTPUT_SCHEMA = `type SynthesisDecision = {
  status: "answered" | "insufficient";
  response: string;
  evidence: {
    evidenceId: string;
    use: string;
  }[];
};

// Application-owned conversion after validation
responseBlock(output, nextRevision, decision.response, now)

type TemplatedDerivedDecision = {
  variables: { name, status, value, evidence }[];
};
// renderDerivedTemplate validates and substitutes values.`;

  const EVIDENCE_STEPS = [
    {
      who: "APPLICATION",
      title: "Issues the ID",
      code: "evidence-4 → trusted SemanticHit",
      body: "The registry holds source ref, exact revision, encoding, text coordinates, structural locators, and observed overlay generation."
    },
    {
      who: "MODEL",
      title: "Declares its use",
      code: `{ evidenceId: "evidence-4", use: "supports the outage count" }`,
      body: "The model can select and explain an issued handle. It cannot change the value behind it."
    },
    {
      who: "APPLICATION",
      title: "Resolves and validates",
      code: "resolveEvidenceSelections(decision, registry)",
      body: "Unknown, repeated, blank, or cross-attempt identifiers fail closed before model prose is trusted."
    },
    {
      who: "REPRESENTATION",
      title: "Persists by value",
      code: "SemanticCitation { selections, source, span, generation }",
      body: "Active semantic object IDs disappear. The citation remains intelligible after the overlay replaces them."
    }
  ];

  const INFRASTRUCTURE = [
    {
      priority: "P0",
      name: "Resource text projection + locator map",
      status: "built",
      icon: ListTree,
      gap: "Document blocks, slide elements, groups, tables, captions, and notes now share one UTF-16 projection; specialized traversal and reader adapters remain.",
      unlocks: "ingestion, direct read, selected text, citations, and later highlights"
    },
    {
      priority: "P0",
      name: "Transactional outbox + coalescing workers",
      status: "partial",
      icon: TimerReset,
      gap: "semanticSyncJobs is persisted and revision-coalesced. The JSON store still lacks cross-table transactions and an always-on worker host; derived refresh is still explicit.",
      unlocks: "fast writes, retries, idempotency, crash recovery, and per-resource supersession"
    },
    {
      priority: "P0",
      name: "Evidence tool gateway",
      status: "partial",
      icon: Fingerprint,
      gap: "Retrieve can issue IDs, but selected focus, resource handles, typed read_* tools, shared budgets, and one registry policy need a common owner.",
      unlocks: "unforgeable provenance and consistent limits across every tool"
    },
    {
      priority: "P1",
      name: "Index watermark + delta tier",
      status: "measure then build",
      icon: Network,
      gap: "A full recursive-tree rebuild after every source edit will become the ingestion bottleneck, and agents cannot currently see index lag.",
      unlocks: "immediate search over new spans, background compaction, and explicit stale-index fallback to read"
    },
    {
      priority: "P1",
      name: "Run ledger + retrieval evaluation",
      status: "instrument now",
      icon: Gauge,
      gap: "Provider usage exists, but there is no joined trace for queue wait, index generation, tool rounds, hit recall, selected citations, or publish outcome.",
      unlocks: "latency budgets, cost control, regression tests, and evidence-quality tuning"
    },
    {
      priority: "P2",
      name: "Immutable output revisions",
      status: "defer",
      icon: Database,
      gap: "The current response is enough for prompt blocks. A history table adds storage and retention policy without a named consumer today.",
      unlocks: "audit and rollback only when those become actual product requirements"
    }
  ];

  const BUDGETS = [
    { label: "tool rounds", value: "8", note: "configured hard maximum; first retrieve is forced" },
    { label: "retrieve top K", value: "8", note: "default; model may request up to 20" },
    { label: "text read", value: "12k", note: "characters per call; typed readers own other bounds" },
    { label: "source retries", value: "2", note: "new registry each time evidence changes" }
  ];

</script>

<svelte:head>
  <title>Derived Output agent runtime — Icarus</title>
  <meta
    name="description"
    content="The exact prompts, tools, evidence protocol, selected-text handling, bounds, and infrastructure for the Derived Output agent."
  />
</svelte:head>

<div class="runtime-page">
  <header class="local-nav">
    <a class="brand" href="/demo/semantic-overlay/derived-output-flow">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>DERIVED OUTPUT</span>
      <ChevronRight class="brand-chevron" size={13} aria-hidden="true" />
      <strong>AGENT RUNTIME</strong>
    </a>
    <nav aria-label="Agent runtime sections">
      <a href="#context">context</a>
      <a href="#loop">loop</a>
      <a href="#tools">tools</a>
      <a href="#evidence">evidence</a>
      <a href="#infrastructure">infrastructure</a>
      <a href="/demo/semantic-overlay/resource-reading">resource reading</a>
      <a href="/demo/semantic-overlay/material-layer">material layer</a>
      <a href="/demo/semantic-overlay/derived-output-live">live proof</a>
      <a class="flow-link" href="/demo/semantic-overlay/derived-output-flow"><ArrowLeft size={13} aria-hidden="true" /> procedure flow</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-grid" aria-hidden="true"></div>
      <div class="hero-copy">
        <div class="eyebrow"><Bot size={14} aria-hidden="true" /> RUNTIME CONTRACT / GROUNDED SYNTHESIS</div>
        <h1>The agent gets<br /><em>handles, not trust.</em></h1>
        <p>
          The running agent retrieves semantic evidence through one bounded tool and returns either
          one answer or named grounded variables. This page also shows the deliberately deferred
          discovery plus the specialized resource-reading tools that complete the target runtime.
        </p>
      </div>

      <div class="hero-principles">
        <article><span>01</span><strong>GROUNDING</strong><p>No factual claim may come from outside an evidence tool result.</p></article>
        <article><span>02</span><strong>AUTHORITY</strong><p>Project scope, resource reads, and evidence IDs remain application-owned.</p></article>
        <article><span>03</span><strong>BOUNDS</strong><p>Tool rounds, result size, retries, time, and final output are all finite.</p></article>
      </div>
    </section>

    <section id="context" class="section context-section">
      <header class="section-heading">
        <div><span>01 / CONTEXT ASSEMBLY</span><h2>Stable law.<br />Variable case file.</h2></div>
        <p>
          The executable instruction below is imported from the capability itself. The target runtime
          adds tool policy through its actual schemas and sends only task facts, continuity, and a
          selection-presence flag per run.
        </p>
      </header>

      <div class="context-stack">
        <article class="system-layer">
          <header><LockKeyhole size={17} aria-hidden="true" /><span>LAYER A · SYSTEM / STABLE</span><small>application-authored · cacheable</small></header>
          <pre><code>{SYSTEM_PROMPT}</code></pre>
        </article>

        <div class="stack-join"><span></span><strong>+</strong><span></span></div>

        <article class="task-layer">
          <header><Box size={17} aria-hidden="true" /><span>LAYER B · TASK ENVELOPE / PER RUN</span><small>data, not instructions</small></header>
          <pre><code>{TASK_ENVELOPE}</code></pre>
        </article>
      </div>

      <div class="selection-decision">
        <div class="selection-target"><MousePointer2 size={23} aria-hidden="true" /><span></span></div>
        <div>
          <span>SELECTED TEXT / TARGET TOOL</span>
          <h3>Read selection through its own evidence tool.</h3>
          <p>
            The run says only <code>hasSelection: true</code>. Its first call to
            <code>read_selection</code> resolves the current authoritative range and receives an
            application-issued evidence ID. This keeps source text out of instruction space while
            making the user's focus explicit and citable.
          </p>
        </div>
        <ul>
          <li><Check class="selection-check" size={13} aria-hidden="true" /> anchors the agent before broader search</li>
          <li><Check class="selection-check" size={13} aria-hidden="true" /> works before the semantic index catches up</li>
          <li><Check class="selection-check" size={13} aria-hidden="true" /> participates in the same freshness check</li>
          <li><Check class="selection-check" size={13} aria-hidden="true" /> never queries the Semantic Overlay</li>
        </ul>
      </div>
    </section>

    <section id="loop" class="section loop-section">
      <header class="section-heading">
        <div><span>02 / CONTROL LOOP</span><h2>One agent.<br />A bounded tool grammar.</h2></div>
        <p>
          Today, retrieval is the forced first action and the only executable tool. The target loop
          conditionally starts with selection, then uses exact-text or interpreted-material
          discovery, contextual traversal, and specialized authoritative readers inside one attempt.
        </p>
      </header>

      <div class="diagram-frame night-frame">
        <div class="diagram-label"><span>CONTROL / AGENT-01</span><small>attempt-local evidence registry</small></div>
        <MermaidDiagram
          source={AGENT_LOOP}
          label="Bounded Derived Output agent control loop with selection, discovery, retrieval, contextual traversal, and specialized evidence readers"
          caption="Exact-text retrieve and its retry-local evidence registry are live. Material retrieval, selection, discovery, contextual traversal, and typed readers are explicit target extensions."
          minHeight="48rem"
        />
      </div>

      <div class="budget-strip" aria-label="Proposed initial agent budgets">
        <div class="budget-title"><Gauge size={18} aria-hidden="true" /><span>INITIAL BOUNDS</span><small>defaults to benchmark, not eternal constants</small></div>
        {#each BUDGETS as budget (budget.label)}
          <div><strong>{budget.value}</strong><span>{budget.label}</span><small>{budget.note}</small></div>
        {/each}
      </div>
    </section>

    <section id="tools" class="section tools-section">
      <header class="section-heading">
        <div><span>03 / CORE TOOL SURFACE</span><h2>Three anchors.<br />Then typed doors.</h2></div>
        <p>
          These are the common entry tools. The resource-reading contract expands the old generic
          read sketch into explicit list, inspect, view, and read_* operations whose names declare
          whether they mint evidence.
        </p>
      </header>

      <div class="tool-console">
        <div class="tool-rail" role="tablist" aria-label="Agent evidence tools">
          {#each TOOLS as candidate (candidate.id)}
            {@const ToolIcon = candidate.icon}
            <button
              type="button"
              role="tab"
              aria-selected={activeTool === candidate.id}
              class:active={activeTool === candidate.id}
              onclick={() => (activeTool = candidate.id)}
            >
              <span class="tool-number">{candidate.number}</span>
              <span class="tool-icon"><ToolIcon size={20} aria-hidden="true" /></span>
              <span><code>{candidate.name}</code><small>{candidate.role}</small></span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          {/each}
        </div>

        <article class="tool-detail">
          <header>
            <div class="active-tool-icon"><ActiveToolIcon size={24} aria-hidden="true" /></div>
            <div><span>{tool.decision}</span><h3><code>{tool.name}</code></h3><p>{tool.when}</p></div>
          </header>
          <div class="schema-pair">
            <div><span>INPUT</span><pre><code>{tool.input}</code></pre></div>
            <div><span>OUTPUT</span><pre><code>{tool.output}</code></pre></div>
          </div>
          <ul>
            {#each tool.rules as rule (rule)}<li><ShieldCheck class="tool-check" size={13} aria-hidden="true" />{rule}</li>{/each}
          </ul>
        </article>
      </div>

      <a class="reading-expansion" href="/demo/semantic-overlay/resource-reading">
        <Layers3 size={23} aria-hidden="true" />
        <div><span>RESOURCE-READING CONTRACT</span><strong>Find and view orient. Retrieve and read cite.</strong><small>Inspect sixteen exact tool contracts, four task routes, slide anatomy, evidence kinds, and the document/deck projection seam.</small></div>
        <ArrowRight size={19} aria-hidden="true" />
      </a>
    </section>

    <section id="evidence" class="section evidence-section">
      <header class="section-heading">
        <div><span>04 / EVIDENCE PROTOCOL</span><h2>The model selects.<br />The application attests.</h2></div>
        <p>
          Evidence IDs are capabilities with the shortest useful lifetime: one synthesis attempt.
          They allow the model to point while preventing it from forging provenance.
        </p>
      </header>

      <div class="evidence-line">
        {#each EVIDENCE_STEPS as step, index (step.title)}
          <article>
            <header><span>{step.who}</span><strong>0{index + 1}</strong></header>
            <h3>{step.title}</h3>
            <code>{step.code}</code>
            <p>{step.body}</p>
          </article>
          {#if index < EVIDENCE_STEPS.length - 1}<ArrowRight class="evidence-arrow" size={19} aria-hidden="true" />{/if}
        {/each}
      </div>

      <div class="output-grid">
        <article class="output-schema">
          <header><Braces size={17} aria-hidden="true" /><span>ONLY TRUSTED MODEL OUTPUT</span></header>
          <pre><code>{OUTPUT_SCHEMA}</code></pre>
        </article>
        <div class="output-rules">
          <article><span>FAIL CLOSED</span><strong>Answered + zero valid evidence</strong><p>Discard the prose and publish the application's deterministic insufficiency response.</p></article>
          <article><span>VALIDATE LATE</span><strong>Recheck after the final model turn</strong><p>If a cited source revision moved, discard the entire attempt and retrieve again.</p></article>
          <article><span>STORE VALUES</span><strong>Never persist runtime handles</strong><p>Copy source snapshot, exact span, selection annotation, and observed generation into the citation.</p></article>
        </div>
      </div>
    </section>

    <section id="infrastructure" class="section infrastructure-section">
      <header class="section-heading">
        <div><span>05 / SYSTEM GAPS</span><h2>What makes this<br />fast in production.</h2></div>
        <p>
          Projection and semantic queue rows now exist. The remaining production gaps are an
          always-on worker host, cross-table transactions, bounded traversal/read tools, and joined evaluation telemetry.
        </p>
      </header>

      <div class="infra-grid">
        {#each INFRASTRUCTURE as item (item.name)}
          {@const InfraIcon = item.icon}
          <article class:deferred={item.status === "defer"}>
            <header><span class="priority">{item.priority}</span><span class="infra-status">{item.status}</span><InfraIcon class="infra-icon" size={18} aria-hidden="true" /></header>
            <h3>{item.name}</h3>
            <div><span>GAP</span><p>{item.gap}</p></div>
            <div><span>UNLOCKS</span><p>{item.unlocks}</p></div>
          </article>
        {/each}
      </div>

      <div class="performance-path">
        <div><TimerReset size={20} aria-hidden="true" /><span>LATENCY PATH</span></div>
        <div class="path-segment fast"><strong>editor commit</strong><small>store + queue only</small></div>
        <ArrowRight class="path-arrow" size={16} aria-hidden="true" />
        <div class="path-segment async"><strong>semantic sync</strong><small>coalesced by ref/revision</small></div>
        <ArrowRight class="path-arrow" size={16} aria-hidden="true" />
        <div class="path-segment async"><strong>derived run</strong><small>bounded tools + provider</small></div>
        <ArrowRight class="path-arrow" size={16} aria-hidden="true" />
        <div class="path-segment fast"><strong>response read</strong><small>ID lookup + cited-source join</small></div>
      </div>
    </section>

    <section class="verdict">
      <div class="verdict-icon"><Sparkles size={26} aria-hidden="true" /></div>
      <div>
        <span>RECOMMENDED FIRST VERTICAL SLICE</span>
        <h2>Retrieve directly. Read selectively. Cite everything used.</h2>
        <p>
          Keep the implemented projector, coalesced semantic queue, one-agent structured-output
          loop, and value API. The generic <code>read</code> sketch on this page is refined into
          explicit traversal, context, and evidentiary readers on the resource-reading page. A
          separate planner, raw JSON tool, and output-history table remain deferred.
        </p>
      </div>
      <a href="/demo/semantic-overlay/resource-reading">Open resource reading <ArrowRight size={16} aria-hidden="true" /></a>
    </section>
  </main>

  <footer class="page-footer">
    <span>DERIVED OUTPUT / AGENT RUNTIME</span>
    <span>live retrieve · target selection/discovery/resource reading · evidence · scale</span>
  </footer>
</div>

<style>
  :global(body) { margin: 0; }
  :global(*) { box-sizing: border-box; }
  :global(html) { scroll-behavior: smooth; }

  .runtime-page {
    --night: #08111c;
    --night-raised: #0f1c2b;
    --panel: #142538;
    --panel-2: #1b2f45;
    --ink: #eef7f3;
    --muted: #91a5b4;
    --line: #29445b;
    --mint: #4ed9b1;
    --blue: #77a9d4;
    --violet: #b397e6;
    --coral: #ec8f6b;
    min-height: 100vh;
    background:
      radial-gradient(circle at 78% 4%, rgba(78, 217, 177, 0.12), transparent 26rem),
      radial-gradient(circle at 12% 29%, rgba(179, 151, 230, 0.08), transparent 22rem),
      var(--night);
    color: var(--ink);
  }

  :global(html[data-appearance="helios"]) .runtime-page {
    --night: #f4f0e8;
    --night-raised: #fffdf8;
    --panel: #e8f0ef;
    --panel-2: #e2ebe9;
    --ink: #172232;
    --muted: #687784;
    --line: #cec7ba;
    --mint: #347f78;
    --blue: #315a72;
    --violet: #715a9f;
    --coral: #b65c39;
    background:
      radial-gradient(circle at 78% 4%, rgba(52, 127, 120, 0.1), transparent 26rem),
      radial-gradient(circle at 12% 29%, rgba(113, 90, 159, 0.07), transparent 22rem),
      var(--night);
  }

  :global(html[data-appearance="helios"]) .local-nav {
    background: rgba(244, 240, 232, 0.9);
  }

  :global(html[data-appearance="helios"]) .hero-copy > p,
  :global(html[data-appearance="helios"]) .tool-detail li {
    color: #465462;
  }

  :global(html[data-appearance="helios"]) .hero-principles article {
    background: rgba(255, 253, 248, 0.94);
  }

  :global(html[data-appearance="helios"]) .context-stack pre,
  :global(html[data-appearance="helios"]) .schema-pair pre {
    color: #263951;
  }

  :global(html[data-appearance="helios"]) .selection-decision {
    background: #fff1e8;
  }

  :global(html[data-appearance="helios"]) .selection-decision p,
  :global(html[data-appearance="helios"]) .selection-decision li {
    color: #644f4a;
  }

  :global(html[data-appearance="helios"]) .selection-decision code {
    color: #8e3f26;
  }

  :global(html[data-appearance="helios"]) .diagram-label,
  :global(html[data-appearance="helios"]) .schema-pair > div,
  :global(html[data-appearance="helios"]) .reading-expansion,
  :global(html[data-appearance="helios"]) .evidence-line article > code,
  :global(html[data-appearance="helios"]) .performance-path {
    background: #ece7dc;
  }

  :global(html[data-appearance="helios"]) .evidence-line article > code {
    color: #715a9f;
  }

  :global(html[data-appearance="helios"]) .output-schema {
    background: #f4effd;
  }

  :global(html[data-appearance="helios"]) .output-schema header {
    border-bottom-color: #c9bce1;
  }

  :global(html[data-appearance="helios"]) .output-schema pre {
    color: #3f335a;
  }

  :global(html[data-appearance="helios"]) .verdict {
    background: #e7f3ef;
  }

  :global(html[data-appearance="helios"]) .verdict p {
    color: #455e59;
  }

  .local-nav {
    position: sticky;
    z-index: 30;
    top: 2.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 3.65rem;
    padding: 0 2rem;
    border-bottom: 1px solid var(--line);
    background: rgba(8, 17, 28, 0.9);
    backdrop-filter: blur(18px);
  }

  .brand, .local-nav nav, .flow-link, .eyebrow, .context-stack article header,
  .selection-target, .diagram-label, .budget-title, .tool-rail button,
  .tool-detail > header, .tool-detail li, .reading-expansion,
  .evidence-line article header, .output-schema header,
  .infra-grid article header, .performance-path, .verdict, .verdict a, .page-footer {
    display: flex;
    align-items: center;
  }

  .brand {
    gap: 0.5rem;
    color: var(--ink);
    font-family: var(--token-font-mono);
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    text-decoration: none;
  }

  .brand strong { color: var(--mint); font-weight: 500; }
  .brand-mark { width: 0.62rem; height: 0.62rem; border: 2px solid var(--mint); transform: rotate(45deg); }
  .local-nav nav { gap: 1.2rem; }
  .local-nav nav a { color: var(--muted); font-size: 0.73rem; text-decoration: none; }
  .local-nav nav a:hover { color: var(--ink); }
  .local-nav nav .flow-link { gap: 0.35rem; color: var(--mint); font-weight: 600; }

  main, .page-footer { width: min(100% - 3rem, 86rem); margin-inline: auto; }

  .hero {
    position: relative;
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 4rem;
    align-items: end;
    min-height: 43rem;
    padding: 7rem 0 5rem;
    overflow: hidden;
  }

  .hero-grid {
    position: absolute;
    inset: 3rem 0 0 48%;
    opacity: 0.22;
    background-image:
      linear-gradient(var(--line) 1px, transparent 1px),
      linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 2.4rem 2.4rem;
    mask-image: linear-gradient(90deg, transparent, #000 24%, transparent 92%);
  }

  .hero-copy { position: relative; z-index: 1; }
  .eyebrow { gap: 0.5rem; color: var(--mint); font-family: var(--token-font-mono); font-size: 0.68rem; letter-spacing: 0.11em; }
  .hero h1 { max-width: 12ch; margin: 1.25rem 0 1.5rem; font-family: var(--token-font-serif); font-size: clamp(4rem, 8vw, 7.2rem); font-weight: 400; letter-spacing: -0.06em; line-height: 0.9; }
  .hero h1 em { color: var(--mint); font-weight: 400; }
  .hero-copy > p { max-width: 64ch; margin: 0; color: #b3c2cb; font-size: 1.05rem; line-height: 1.7; }

  .hero-principles { position: relative; z-index: 1; display: grid; gap: 1px; border: 1px solid var(--line); background: var(--line); }
  .hero-principles article { display: grid; grid-template-columns: 2.7rem 1fr; gap: 0.2rem 1rem; padding: 1.35rem; background: rgba(15, 28, 43, 0.94); }
  .hero-principles article > span { grid-row: 1 / 3; color: var(--mint); font-family: var(--token-font-serif); font-size: 1.8rem; }
  .hero-principles strong { color: var(--blue); font-family: var(--token-font-mono); font-size: 0.62rem; letter-spacing: 0.12em; }
  .hero-principles p { margin: 0.38rem 0 0; color: var(--muted); font-size: 0.78rem; line-height: 1.5; }

  .section { padding: 6.5rem 0; border-top: 1px solid var(--line); scroll-margin-top: 7rem; }
  .section-heading { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.6fr); gap: 5rem; align-items: end; margin-bottom: 3rem; }
  .section-heading > div > span, .selection-decision > div > span, .diagram-label,
  .budget-title span, .tool-detail > header span, .schema-pair > div > span,
  .evidence-line header span, .output-schema header, .output-rules article > span,
  .priority, .infra-status, .infra-grid article > div > span, .performance-path > div:first-child span,
  .verdict > div > span, .page-footer {
    font-family: var(--token-font-mono);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .section-heading > div > span { color: var(--mint); font-size: 0.65rem; }
  .section-heading h2 { margin: 0.75rem 0 0; font-family: var(--token-font-serif); font-size: clamp(2.7rem, 5vw, 4.7rem); font-weight: 400; letter-spacing: -0.045em; line-height: 0.96; }
  .section-heading > p { margin: 0; color: var(--muted); font-size: 0.95rem; line-height: 1.65; }

  .context-stack { display: grid; grid-template-columns: 1fr 4rem 1fr; gap: 1rem; align-items: stretch; }
  .context-stack article { min-width: 0; border: 1px solid var(--line); background: var(--night-raised); }
  .context-stack article header { gap: 0.55rem; padding: 0.8rem 1rem; border-bottom: 1px solid var(--line); color: var(--mint); font-family: var(--token-font-mono); font-size: 0.61rem; letter-spacing: 0.08em; }
  .context-stack article header small { margin-left: auto; color: var(--muted); letter-spacing: 0; }
  .context-stack pre { margin: 0; padding: 1.3rem; overflow: auto; color: #d7e8e2; font-size: 0.73rem; line-height: 1.65; white-space: pre-wrap; }
  .task-layer { box-shadow: inset 0 3px 0 var(--violet); }
  .task-layer header { color: var(--violet) !important; }
  .stack-join { display: grid; grid-template-rows: 1fr auto 1fr; justify-items: center; color: var(--coral); }
  .stack-join span { width: 1px; background: var(--line); }
  .stack-join strong { display: grid; width: 2rem; height: 2rem; place-items: center; border: 1px solid var(--coral); border-radius: 50%; font-family: var(--token-font-mono); }

  .selection-decision { display: grid; grid-template-columns: auto 1fr minmax(18rem, 0.55fr); gap: 1.5rem; align-items: center; margin-top: 1.5rem; padding: 1.5rem; border: 1px solid var(--coral); background: #211a20; }
  .selection-target { position: relative; justify-content: center; width: 4rem; height: 4rem; border: 1px solid var(--coral); border-radius: 50%; color: var(--coral); }
  .selection-target span { position: absolute; width: 5.2rem; height: 5.2rem; border: 1px dashed rgba(236, 143, 107, 0.42); border-radius: 50%; }
  .selection-decision > div > span { color: var(--coral); font-size: 0.6rem; }
  .selection-decision h3 { margin: 0.4rem 0; font-family: var(--token-font-serif); font-size: 1.55rem; font-weight: 400; }
  .selection-decision p { margin: 0; color: #c0adb0; font-size: 0.8rem; line-height: 1.58; }
  .selection-decision code { color: #ffd0c0; }
  .selection-decision ul { display: grid; gap: 0.55rem; margin: 0; padding: 0; list-style: none; }
  .selection-decision li { display: flex; gap: 0.5rem; align-items: center; color: #cbbabe; font-size: 0.72rem; }
  .selection-decision li :global(.selection-check) { flex: 0 0 auto; color: var(--coral); }

  .diagram-frame { overflow: hidden; border: 1px solid var(--line); background: var(--night-raised); box-shadow: 0.55rem 0.55rem 0 rgba(78, 217, 177, 0.08); }
  .diagram-label { justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid var(--line); background: #0b1724; color: var(--mint); font-size: 0.61rem; }
  .diagram-label small { color: var(--muted); font-family: var(--token-font-mono); letter-spacing: 0; text-transform: none; }

  .budget-strip { display: grid; grid-template-columns: 1.25fr repeat(4, 1fr); margin-top: 1rem; border: 1px solid var(--line); background: var(--line); gap: 1px; }
  .budget-strip > div { min-width: 0; padding: 1rem; background: var(--night-raised); }
  .budget-title { gap: 0.6rem; color: var(--mint); }
  .budget-title span { font-size: 0.61rem; }
  .budget-title small { display: block; margin-left: auto; max-width: 12rem; color: var(--muted); font-size: 0.61rem; line-height: 1.4; }
  .budget-strip > div:not(.budget-title) { display: grid; grid-template-columns: auto 1fr; gap: 0.15rem 0.65rem; align-items: center; }
  .budget-strip > div:not(.budget-title) strong { grid-row: 1 / 3; color: var(--mint); font-family: var(--token-font-serif); font-size: 2rem; font-weight: 400; }
  .budget-strip > div:not(.budget-title) span { font-size: 0.73rem; font-weight: 600; }
  .budget-strip > div:not(.budget-title) small { color: var(--muted); font-size: 0.58rem; line-height: 1.35; }

  .tool-console { display: grid; grid-template-columns: minmax(17rem, 0.55fr) minmax(0, 1.45fr); border: 1px solid var(--line); background: var(--night-raised); }
  .tool-rail { border-right: 1px solid var(--line); }
  .tool-rail button { display: grid; grid-template-columns: 2rem 2.6rem 1fr auto; gap: 0.7rem; width: 100%; min-height: 6rem; padding: 0.9rem; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--muted); text-align: left; cursor: pointer; }
  .tool-rail button:last-child { border-bottom: 0; }
  .tool-rail button.active { background: var(--panel); color: var(--ink); box-shadow: inset 3px 0 0 var(--mint); }
  .tool-number { color: var(--mint); font-family: var(--token-font-mono); font-size: 0.61rem; }
  .tool-icon { display: grid; width: 2.5rem; height: 2.5rem; place-items: center; border: 1px solid var(--line); border-radius: 50%; color: var(--mint); }
  .tool-rail button > span:nth-child(3) { display: grid; gap: 0.3rem; }
  .tool-rail code { color: inherit; font-size: 0.78rem; }
  .tool-rail small { font-size: 0.65rem; }

  .tool-detail { min-width: 0; padding: 1.5rem; }
  .tool-detail > header { gap: 1rem; }
  .active-tool-icon { display: grid; width: 3.6rem; height: 3.6rem; place-items: center; border: 1px solid var(--mint); border-radius: 50%; color: var(--mint); }
  .tool-detail > header > div:last-child { flex: 1; }
  .tool-detail > header span { color: var(--mint); font-size: 0.56rem; }
  .tool-detail h3 { margin: 0.28rem 0; font-size: 1.25rem; font-weight: 400; }
  .tool-detail h3 code { color: var(--ink); }
  .tool-detail > header p { margin: 0; color: var(--muted); font-size: 0.76rem; line-height: 1.5; }
  .schema-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin-top: 1.4rem; background: var(--line); }
  .schema-pair > div { min-width: 0; padding: 1rem; background: #0b1724; }
  .schema-pair > div > span { color: var(--blue); font-size: 0.55rem; }
  .schema-pair pre { margin: 0.65rem 0 0; overflow: auto; color: #d4e2e8; font-size: 0.66rem; line-height: 1.55; }
  .tool-detail ul { display: grid; gap: 0.55rem; margin: 1rem 0 0; padding: 0; list-style: none; }
  .tool-detail li { gap: 0.55rem; color: #b8c5cd; font-size: 0.71rem; line-height: 1.45; }
  .tool-detail li :global(.tool-check) { flex: 0 0 auto; color: var(--mint); }

  .reading-expansion { gap: 1rem; margin-top: 1.5rem; padding: 1.2rem; border: 1px solid var(--mint); background: #0b1724; color: var(--mint); text-decoration: none; }
  .reading-expansion > div { min-width: 0; flex: 1; }
  .reading-expansion span { color: var(--mint); font-family: var(--token-font-mono); font-size: 0.54rem; letter-spacing: 0.09em; }
  .reading-expansion strong { display: block; margin: 0.35rem 0; color: var(--ink); font-family: var(--token-font-serif); font-size: 1.2rem; font-weight: 400; }
  .reading-expansion small { display: block; color: var(--muted); font-size: 0.64rem; line-height: 1.45; }

  .evidence-line { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr; gap: 0.8rem; align-items: center; }
  .evidence-line > :global(.evidence-arrow) { color: var(--mint); }
  .evidence-line article { min-width: 0; min-height: 18rem; padding: 1.15rem; border: 1px solid var(--line); background: var(--night-raised); }
  .evidence-line article header { justify-content: space-between; color: var(--mint); }
  .evidence-line header span { font-size: 0.54rem; }
  .evidence-line header strong { color: var(--line); font-family: var(--token-font-serif); font-size: 1.8rem; font-weight: 400; }
  .evidence-line h3 { margin: 1.2rem 0 0.8rem; font-family: var(--token-font-serif); font-size: 1.25rem; font-weight: 400; }
  .evidence-line article > code { display: block; min-height: 3.8rem; padding: 0.65rem; overflow-wrap: anywhere; background: #0b1724; color: #c9b9ed; font-size: 0.62rem; line-height: 1.45; }
  .evidence-line p { margin: 0.9rem 0 0; color: var(--muted); font-size: 0.7rem; line-height: 1.52; }

  .output-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 1rem; margin-top: 1.5rem; }
  .output-grid > *, .output-schema, .output-rules { min-width: 0; }
  .output-schema { border: 1px solid var(--violet); background: #15162a; }
  .output-schema header { gap: 0.5rem; padding: 0.8rem 1rem; border-bottom: 1px solid #3b3763; color: var(--violet); font-size: 0.59rem; }
  .output-schema pre { margin: 0; padding: 1.3rem; overflow: auto; color: #ded7ef; font-size: 0.72rem; line-height: 1.6; }
  .output-rules { display: grid; gap: 1px; background: var(--line); }
  .output-rules article { padding: 1rem; background: var(--night-raised); }
  .output-rules article > span { color: var(--coral); font-size: 0.54rem; }
  .output-rules strong { display: block; margin: 0.35rem 0; font-family: var(--token-font-serif); font-size: 1.02rem; font-weight: 400; }
  .output-rules p { margin: 0; color: var(--muted); font-size: 0.68rem; line-height: 1.45; }

  .infra-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; border: 1px solid var(--line); background: var(--line); }
  .infra-grid article { min-height: 22rem; padding: 1.2rem; background: var(--night-raised); }
  .infra-grid article.deferred { opacity: 0.68; }
  .infra-grid article header { gap: 0.6rem; }
  .priority { padding: 0.2rem 0.38rem; border: 1px solid var(--mint); color: var(--mint); font-size: 0.54rem; }
  .infra-status { color: var(--muted); font-size: 0.52rem; }
  .infra-grid article header :global(.infra-icon) { margin-left: auto; color: var(--mint); }
  .infra-grid h3 { min-height: 3.1rem; margin: 1.25rem 0 1.1rem; font-family: var(--token-font-serif); font-size: 1.35rem; font-weight: 400; line-height: 1.12; }
  .infra-grid article > div { padding-top: 0.9rem; border-top: 1px solid var(--line); }
  .infra-grid article > div + div { margin-top: 0.9rem; }
  .infra-grid article > div > span { color: var(--blue); font-size: 0.51rem; }
  .infra-grid article > div > p { margin: 0.35rem 0 0; color: var(--muted); font-size: 0.69rem; line-height: 1.5; }

  .performance-path { gap: 0.7rem; margin-top: 1rem; padding: 1rem; border: 1px solid var(--line); background: #0b1724; }
  .performance-path > div:first-child { display: flex; gap: 0.5rem; align-items: center; margin-right: auto; color: var(--mint); }
  .performance-path > div:first-child span { font-size: 0.57rem; }
  .path-segment { display: grid; gap: 0.16rem; min-width: 10rem; padding: 0.7rem; border: 1px solid var(--line); }
  .path-segment.fast { border-color: var(--mint); }
  .path-segment.async { border-color: var(--blue); }
  .path-segment strong { font-size: 0.72rem; }
  .path-segment small { color: var(--muted); font-size: 0.57rem; }
  .performance-path > :global(.path-arrow) { flex: 0 0 auto; color: var(--muted); }

  .verdict { display: grid; grid-template-columns: auto 1fr auto; gap: 1.5rem; align-items: center; margin: 5rem 0 3rem; padding: 2rem; border: 1px solid var(--mint); background: #0d2428; }
  .verdict-icon { display: grid; width: 4rem; height: 4rem; place-items: center; border: 1px solid var(--mint); border-radius: 50%; color: var(--mint); }
  .verdict > div > span { color: var(--mint); font-size: 0.58rem; }
  .verdict h2 { margin: 0.45rem 0; font-family: var(--token-font-serif); font-size: clamp(1.8rem, 3.5vw, 3rem); font-weight: 400; line-height: 1.02; }
  .verdict p { max-width: 74ch; margin: 0; color: #a9c3c2; font-size: 0.78rem; line-height: 1.55; }
  .verdict code { color: var(--mint); }
  .verdict a { gap: 0.5rem; padding: 0.75rem 1rem; border: 1px solid var(--mint); color: var(--mint); font-size: 0.72rem; text-decoration: none; white-space: nowrap; }

  .page-footer { justify-content: space-between; padding: 1.5rem 0 3rem; color: var(--muted); font-size: 0.57rem; }
  code { font-family: var(--token-font-mono); }

  @media (max-width: 72rem) {
    .local-nav nav a:not(.flow-link) { display: none; }
    .context-stack { grid-template-columns: 1fr; }
    .stack-join { grid-template: none; grid-auto-flow: column; align-items: center; }
    .stack-join span { width: 100%; height: 1px; }
    .selection-decision { grid-template-columns: auto 1fr; }
    .selection-decision ul { grid-column: 2; }
    .budget-strip { grid-template-columns: repeat(4, 1fr); }
    .budget-title { grid-column: 1 / -1; }
    .infra-grid { grid-template-columns: repeat(2, 1fr); }
    .performance-path { flex-wrap: wrap; }
    .performance-path > div:first-child { width: 100%; }
  }

  @media (max-width: 52rem) {
    .local-nav { padding-inline: 1rem; }
    .brand > span:not(.brand-mark), .brand > :global(.brand-chevron) { display: none; }
    main, .page-footer { width: min(100% - 1.5rem, 86rem); }
    .hero { grid-template-columns: 1fr; min-height: auto; padding: 4.5rem 0; }
    .hero h1 { font-size: clamp(3.3rem, 15vw, 5.2rem); }
    .section { padding: 4.5rem 0; }
    .section-heading { grid-template-columns: 1fr; gap: 1.5rem; }
    .selection-decision, .tool-console, .output-grid, .verdict { grid-template-columns: minmax(0, 1fr); }
    .selection-decision ul { grid-column: auto; }
    .budget-strip, .schema-pair, .infra-grid { grid-template-columns: 1fr; }
    .budget-title { grid-column: auto; }
    .tool-rail { border-right: 0; border-bottom: 1px solid var(--line); }
    .evidence-line { grid-template-columns: 1fr; }
    .evidence-line > :global(.evidence-arrow) { margin: 0 auto; transform: rotate(90deg); }
    .performance-path { display: grid; grid-template-columns: 1fr; }
    .performance-path > :global(.path-arrow) { margin-inline: auto; transform: rotate(90deg); }
    .verdict a { width: fit-content; }
    .page-footer { flex-direction: column; gap: 0.7rem; align-items: flex-start; }
  }
</style>
