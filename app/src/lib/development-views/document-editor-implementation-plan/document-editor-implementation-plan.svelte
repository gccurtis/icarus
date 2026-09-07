<script lang="ts">
  type View = "strategy" | "sequence" | "workstreams" | "decisions" | "gate";

  const adoptionGroups = [
    {
      tone: "adopt",
      label: "Adopt",
      description: "The architecture and working capability are right.",
      items: [
        "Native op/applier spine",
        "Optimistic live runtime",
        "Structural addresses",
        "Rich projection and pagination",
        "Real context-panel data flows",
        "Non-contiguous selection"
      ]
    },
    {
      tone: "repair",
      label: "Repair first",
      description: "Useful code with a correctness failure at its seam.",
      items: [
        "Mark replacement ordering",
        "Full selection restoration",
        "Enter / next-style behavior",
        "Link activation",
        "Comment anchor movement",
        "Sections placement"
      ]
    },
    {
      tone: "recompose",
      label: "Recompose",
      description: "Keep the behavior; recover the intended interface.",
      items: [
        "Four-up formatting row",
        "Shared color picker",
        "Direct numeric fields",
        "Body style section",
        "Comment hierarchy",
        "Compact key/value rows"
      ]
    },
    {
      tone: "build",
      label: "Build out",
      description: "The reference stops before the complete behavior.",
      items: [
        "Persisted link notes",
        "Multi-span comment anchors",
        "On-page furniture editing",
        "Anchor shifting",
        "Browser regression harness",
        "Custom-color entry contract"
      ]
    }
  ] as const;

  const guardrails = [
    ["01", "One live body", "The runtime body is the only client truth; the stored leader is canonical."],
    ["02", "Projection, not storage", "ProseMirror renders and translates intent. Its JSON never persists."],
    ["03", "One op language", "Client and server share one validated, invertible document applier."],
    ["04", "Structural identity", "Selections, marks, comments, and links follow stable block and atom IDs."],
    ["05", "Gesture history", "Undo records what the user did; wire coalescing never rewrites history."],
    ["06", "Derived pages", "Reflow and zoom do not manufacture collaborative document changes."],
    ["07", "One furniture editor", "Repeated headers and footers project one canonical editable root."],
    ["08", "Visible selection", "Moving into any panel or picker keeps every selected range visible."],
    ["09", "Shared instruments", "Lenses compose authored controls; they do not grow private variants."],
    ["10", "Recoverable failure", "A rejected edit stays visible and offers a truthful next action."]
  ] as const;

  const phases = [
    {
      id: "00",
      title: "Alignment and harness",
      kind: "Foundation",
      status: "Complete",
      summary: "Settle model-affecting decisions and establish a deterministic browser oracle before porting code.",
      donor: "No donor code",
      tasks: [
        "Confirm continuation, comment-span, link-note, and typography decisions.",
        "Create a resettable Winter readiness brief fixture.",
        "Build a Playwright harness that fails on console, page, and network errors.",
        "Encode gestures and narrow/default/wide rail configurations.",
        "Name an acceptance scenario for every audit finding."
      ],
      tests: ["Clean fixture opens", "Gesture harness reports state", "Current main stays green"],
      exit: "The harness is trustworthy and no model decision remains implicit."
    },
    {
      id: "01",
      title: "Representation and runtime",
      kind: "Adopt + extend",
      status: "Complete",
      summary: "Land the document language and live-body machinery before any editor or panel depends on it.",
      donor: "Rework 62be118",
      tasks: [
        "Port structural mark endpoints, block-format fields, document targets, and selection ranges.",
        "Add approved link-note and comment-anchor shapes with legacy decoding.",
        "Install one shared applier and keep capabilities as validation wrappers.",
        "Port optimistic apply, coalescing, refusal/catch-up, release, and runtime history.",
        "Update representation documentation in the same change."
      ],
      tests: ["Every op applies and inverts", "Invalid paths refuse", "Release never drops work"],
      exit: "A headless runtime performs and undoes every required data change without an editor."
    },
    {
      id: "02",
      title: "Projection and selection",
      kind: "Adopt + repair",
      status: "Complete",
      summary: "Connect the live model to a rich page surface while fixing the failures that made the donor unsafe.",
      donor: "Rework 967064e + 55a7b22",
      tasks: [
        "Port schema, projection, translation, pagination, and style resolution.",
        "Restore selection type, direction, primary range, secondary ranges, and held state.",
        "Implement approved next-style rules without copying stale presentation.",
        "Repair repeated mark/link replacement against evolving operation state.",
        "Implement safe link activation and prevent raw text-block node selection.",
        "Cover IME, local, accepted, remote, formula-display, and layout-only origins."
      ],
      tests: ["Projection round trip", "10× Color/Background replacement", "Multi-range repaint", "Enter matrix", "IME"],
      exit: "Data and pixels agree, and every legal selection survives every repaint path."
    },
    {
      id: "03",
      title: "Shared panel instruments",
      kind: "Build + recompose",
      status: "Complete",
      summary: "Build the responsive controls once, with complete states, before wiring any real lens.",
      donor: "Main interaction concepts",
      tasks: [
        "Implement responsive four-up PanelMarks with words or B/I/U/S.",
        "Implement one PanelColorPicker with palette, EyeDropper state, and custom entry.",
        "Simplify PanelNumber to direct input and keyboard stepping.",
        "Add compact key/value row and group primitives.",
        "Specify idle, hover, focus, selected, disabled, invalid, and mixed states."
      ],
      tests: ["Keyboard-only", "Focus visible", "280 / default / 500px", "Mixed and invalid states"],
      exit: "Every shared control is independently reviewable and no lens owns a private copy."
    },
    {
      id: "04",
      title: "Inspectors and context",
      kind: "Adopt + recompose",
      status: "Complete",
      summary: "Bring the real lenses and panels across through the shared controls and the established ownership model.",
      donor: "Rework c4a542e + 3d9b633",
      tasks: [
        "Wire text, next-letter, empty-line, named-style, image, and table lenses to native ops.",
        "Compose Body style from alignment, space above/below, line height, and indent.",
        "Keep font family and size owned by named styles.",
        "Remove hard-coded Quote and link presentation.",
        "Port Sections, Find, Styles, Layout, and Comments with compact hierarchy.",
        "Round Sections placement and protect long titles."
      ],
      tests: ["Control → exact op path", "Mixed multi-block state", "Find boundaries", "Long Sections rows"],
      exit: "Every implemented rail and lens is real, responsive, and composed from shared controls."
    },
    {
      id: "05",
      title: "Comments and links",
      kind: "Repair + build",
      status: "Complete",
      summary: "Make annotations survive editing and make link meaning independent from link appearance.",
      donor: "Rework b70d0b8 + comment/link portions of c4a542e",
      tasks: [
        "Persist validated URL plus note under the approved ownership model.",
        "Keep navigation semantic while foreground and underline remain ordinary marks.",
        "Compose Commented text, opener, replies, composer, and actions distinctly.",
        "Implement the approved span model without silent truncation.",
        "Shift anchors on the canonical text-operation path.",
        "Move detached threads to a named panel group and draw no detached page pin."
      ],
      tests: ["Link lifecycle + unsafe URL", "Comment lifecycle", "Anchor shift/overlap/delete", "Detach/relink"],
      exit: "Links and comments remain truthful through edits, reload, undo, and server application."
    },
    {
      id: "06",
      title: "Furniture and layout",
      kind: "Rebuild interaction",
      status: "Complete",
      summary: "Keep the stored model, replace the mini-editor, and make repeated furniture genuinely canonical.",
      donor: "Rework fae879e",
      tasks: [
        "Mount one canonical header/footer editor in the page canvas.",
        "Render styled read-only projections on every other page.",
        "Expose the normal text inspector and reliable Escape / Move to body.",
        "Remove From edge from UI while retaining a compatibility default.",
        "Keep orientation and compact margins on their required rows.",
        "Treat Start at as the first visible page number."
      ],
      tests: ["One op per gesture", "Repeated projection equality", "Focus return", "Numbering matrix"],
      exit: "Furniture is edited where it appears and every page reflects one canonical root."
    },
    {
      id: "07",
      title: "Convergence gate",
      kind: "Evidence",
      status: "Complete",
      summary: "Prove the integrated editor from a clean checkout before any production merge is proposed.",
      donor: "No donor code",
      tasks: [
        "Rebase onto current main and rerun all static, unit, browser, and build gates.",
        "Update specs where approved behavior supersedes Code, From edge, or detached pins.",
        "Run keyboard, reduced-motion, light/dark, and grayscale reviews.",
        "Reset and manually inspect Winter readiness brief.",
        "Publish a donor delta: adopted, rewritten, omitted, and newly built."
      ],
      tests: ["Clean checkout", "Two browser engines", "Zero console/network events", "Manual acceptance"],
      exit: "The integration branch is demonstrably mergeable and contains no unchanged donor commits."
    }
  ] as const;

  const workstreams = [
    {
      name: "Representation",
      phase: "01",
      path: "representation/data · capabilities/document",
      risk: "Client/server shape drift",
      reviewer: "Model boundary",
      outcome: "One validated and invertible operation language"
    },
    {
      name: "Runtime + history",
      phase: "01",
      path: "model/client/document-runtimes",
      risk: "Lost buffered work",
      reviewer: "Client model",
      outcome: "Optimistic body, truthful sync, gesture undo"
    },
    {
      name: "Projection + input",
      phase: "02",
      path: "document-editor/procedures",
      risk: "Data/pixel or selection divergence",
      reviewer: "Editor adapter",
      outcome: "Stable rich projection and input translation"
    },
    {
      name: "Panel system",
      phase: "03",
      path: "components/authored/panel",
      risk: "One-off behavior and states",
      reviewer: "Design system + a11y",
      outcome: "One responsive component vocabulary"
    },
    {
      name: "Lenses + context",
      phase: "04",
      path: "document-editor/inspector · context",
      risk: "Controls write the wrong owner",
      reviewer: "Product editor",
      outcome: "Real panels composed from shared instruments"
    },
    {
      name: "Comments + links",
      phase: "05",
      path: "editor procedures · general/comment · store",
      risk: "Anchor corruption or unsafe navigation",
      reviewer: "Collaboration + security",
      outcome: "Durable context and truthful annotation"
    },
    {
      name: "Furniture + layout",
      phase: "06",
      path: "document content · furniture · layout",
      risk: "Multiple writable roots",
      reviewer: "Editor adapter",
      outcome: "One canonical on-page editor per root"
    },
    {
      name: "Browser evidence",
      phase: "00–07",
      path: "seed fixtures · browser suite",
      risk: "Green units hide interaction failure",
      reviewer: "Reviewer outside slice",
      outcome: "Reproducible end-to-end merge evidence"
    }
  ] as const;

  const decisions = [
    {
      id: "continuation",
      label: "Style after Enter",
      question: "Where should the next block's style come from?",
      why: "This decides whether continuation is editor semantics or persisted style data.",
      options: [
        {
          id: "semantic",
          label: "Fixed semantic rules",
          detail: "Body→Body, list→list, Heading/Quote/Caption→Body.",
          recommended: true
        },
        {
          id: "metadata",
          label: "Configurable next style",
          detail: "Add a nextStyle field to named-style data and its editor.",
          recommended: false
        }
      ]
    },
    {
      id: "comments",
      label: "Comment span",
      question: "May one comment cross block boundaries?",
      why: "Supporting it changes the anchor representation and text-op shifting rules.",
      options: [
        {
          id: "multispan",
          label: "Cross-block spans",
          detail: "One contiguous selection stores one structural span per touched block.",
          recommended: true
        },
        {
          id: "single",
          label: "One block only",
          detail: "Disable creation across blocks and explain the restriction before submit.",
          recommended: false
        }
      ]
    },
    {
      id: "linkNotes",
      label: "Link-note ownership",
      question: "What does a note belong to?",
      why: "A shared URL object adds identity, deduplication, and another editing surface.",
      options: [
        {
          id: "occurrence",
          label: "This occurrence",
          detail: "The note travels with this marked range and its link.",
          recommended: true
        },
        {
          id: "url",
          label: "Shared URL",
          detail: "Every occurrence of the same URL reads one shared note.",
          recommended: false
        }
      ]
    },
    {
      id: "typography",
      label: "Typography ownership",
      question: "May font family and size become character-level overrides?",
      why: "The current model deliberately puts typography on named styles, not inline marks.",
      options: [
        {
          id: "named",
          label: "Named styles own it",
          detail: "Selection changes style; Body style may add block-level overrides.",
          recommended: true
        },
        {
          id: "inline",
          label: "Inline typography",
          detail: "Extend mark data for per-range family and size.",
          recommended: false
        }
      ]
    }
  ] as const;

  const risks = [
    ["Selection", "A repaint looks harmless while dropping held or secondary ranges.", "Browser assertions begin in Phase 00."],
    ["Op batches", "An insertion points at an ID removed earlier in the same gesture.", "Test complete sequences against evolving state."],
    ["Anchors", "Comments drift after edits or concurrent acceptance.", "Shift in the canonical applier, not a view effect."],
    ["Furniture", "Repeated pages accidentally mount several writable editors.", "Registry keyed by native furniture root."],
    ["Responsive UI", "A narrow rail silently loses actions or labels.", "Same DOM/actions; container query changes copy only."],
    ["History", "The donor becomes accidental ancestry.", "CI/review verifies no donor commit is reachable."]
  ] as const;

  const gates = [
    [
      "Static",
      "Typecheck · architecture/style checks · production build",
      "0 diagnostics · 56/56 checks · build passed"
    ],
    [
      "Model",
      "Apply/invert matrix · validation · legacy decoding · runtime refusal/rebase",
      "73 files · 745 unit assertions passed"
    ],
    [
      "Editor",
      "Projection round trip · selection origins · IME · Enter/Backspace · multi-range",
      "Every implemented editor regression passed"
    ],
    [
      "Browser",
      "Narrow/default/wide · gestures · comments · links · furniture",
      "16 Chromium current-main scenarios · 13 Firefox scenarios on the pre-rebase baseline"
    ],
    [
      "Access",
      "Keyboard only · visible focus · reduced motion · grayscale hierarchy",
      "Helios/Selene and non-color hierarchy verified in the current Chromium run"
    ],
    [
      "Quiet",
      "Console warnings/errors · page errors · unexpected failed requests",
      "0 captured events across the current Chromium run"
    ]
  ] as const;

  let view = $state<View>("strategy");
  let selectedPhaseId = $state("00");
  let choices = $state<Record<string, string>>({
    continuation: "semantic",
    comments: "multispan",
    linkNotes: "occurrence",
    typography: "named"
  });

  const selectedPhase = $derived(phases.find((phase) => phase.id === selectedPhaseId) ?? phases[0]);
  const choiceLabel = (decisionId: string) => {
    const decision = decisions.find((item) => item.id === decisionId);
    return decision?.options.find((option) => option.id === choices[decisionId])?.label ?? "Not selected";
  };
</script>

<svelte:head>
  <title>Document editor implementation plan · Icarus</title>
  <link rel="icon" href="/favicon.svg" />
  <meta
    name="description"
    content="A phased, evidence-gated convergence plan for the Icarus document editor."
  />
</svelte:head>

<div class="artifact">
  <header class="mast">
    <div class="mast-copy">
      <a class="back-link" href="/demo/document-editor-review">← Review and target UI</a>
      <p class="eyebrow">Document editor · implementation plan</p>
      <h1>Port deliberately.<br />Prove each seam.</h1>
      <p class="lede">
        The reference branch is a donor, not a destination. Bring its useful engine across in green,
        reviewable slices; repair correctness before styling depends on it; merge only with evidence.
      </p>
    </div>
    <aside class="plan-state">
      <span>Plan state</span>
      <strong>Complete</strong>
      <p>Eight slices complete · rebased to current main · current Chromium gates green</p>
      <code>main → work/document-editor-integration</code>
      <a class="live-link" href="/app/dev-project">Open the live editor →</a>
    </aside>
  </header>

  <nav class="tabs" aria-label="Implementation plan views">
    {#each [
      ["strategy", "01", "Strategy"],
      ["sequence", "02", "Sequence"],
      ["workstreams", "03", "Workstreams"],
      ["decisions", "04", "Decisions"],
      ["gate", "05", "Merge gate"]
    ] as tab}
      <button
        type="button"
        class:active={view === tab[0]}
        onclick={() => (view = tab[0] as View)}
      ><span>{tab[1]}</span>{tab[2]}</button>
    {/each}
  </nav>

  {#if view === "strategy"}
    <main class="page">
      <section class="intro-grid">
        <div>
          <span class="kicker">Integration stance</span>
          <h2>No wholesale merge. No rewrite from memory.</h2>
        </div>
        <p>
          Start from current <code>main</code>. Use <code>work/document-editor</code> as executable
          reference material. Each donor phase is brought in without committing, corrected against
          its acceptance scenarios, and recorded only once the slice is green.
        </p>
      </section>

      <section class="flow-card" aria-label="Document ownership flow">
        <div class="flow-main">
          <article><span>Canonical</span><b>Store leader</b><small>Accepted change sets</small></article>
          <i>↔</i>
          <article class="live"><span>One live copy</span><b>Document runtime</b><small>Apply · history · buffer</small></article>
          <i>→</i>
          <article><span>Projection</span><b>ProseMirror</b><small>Render · type · select</small></article>
        </div>
        <div class="panel-flow"><article><span>Intent</span><b>Panels</b></article><i>→ native ops →</i><b>Runtime</b></div>
        <p>Typing is the one editor-first exception. Every other control speaks native operations.</p>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div><span class="kicker">Reference disposition</span><h2>Four ways code enters the plan.</h2></div>
          <p>“Adopt” describes intent and structure, never permission to copy an unsafe line unchanged.</p>
        </div>
        <div class="adoption-grid">
          {#each adoptionGroups as group}
            <article class="bucket {group.tone}">
              <header><span>{String(group.items.length).padStart(2, "0")}</span><h3>{group.label}</h3></header>
              <p>{group.description}</p>
              <ul>{#each group.items as item}<li>{item}</li>{/each}</ul>
            </article>
          {/each}
        </div>
      </section>

      <section class="section-block">
        <div class="section-head">
          <div><span class="kicker">Protected principles</span><h2>What must not move.</h2></div>
          <p>Each guardrail becomes a test or review gate in the phase that touches it.</p>
        </div>
        <div class="guardrail-grid">
          {#each guardrails as guardrail}
            <article><span>{guardrail[0]}</span><div><h3>{guardrail[1]}</h3><p>{guardrail[2]}</p></div></article>
          {/each}
        </div>
      </section>

      <section class="branch-card">
        <div><span class="kicker">History discipline</span><h2>Bad intermediate code never becomes ancestry.</h2></div>
        <div class="branch-lines">
          <p><b>main</b><span>new integration branch</span><span>green slices 01–07</span><strong>merge</strong></p>
          <p class="donor"><b>donor @ 55a7b22</b><span>inspect · apply without commit · reshape</span><em>never merge</em></p>
        </div>
      </section>
    </main>
  {:else if view === "sequence"}
    <main class="page">
      <section class="page-intro">
        <span class="kicker">Dependency order</span>
        <h2>Every phase begins green and ends green.</h2>
        <p>Choose a phase to inspect its donor material, work package, tests, and exit evidence.</p>
      </section>

      <div class="phase-layout">
        <nav class="phase-rail" aria-label="Implementation phases">
          {#each phases as phase}
            <button
              type="button"
              class:active={selectedPhaseId === phase.id}
              onclick={() => (selectedPhaseId = phase.id)}
            >
              <span>{phase.id}</span><div><b>{phase.title}</b><small>{phase.status} · {phase.kind}</small></div>
            </button>
          {/each}
        </nav>

        <article class="phase-detail">
          <header>
            <div><span>Phase {selectedPhase.id} · {selectedPhase.status} · {selectedPhase.kind}</span><h2>{selectedPhase.title}</h2></div>
            <code>{selectedPhase.donor}</code>
          </header>
          <p class="phase-summary">{selectedPhase.summary}</p>
          <div class="phase-columns">
            <section><h3>Work package</h3><ol>{#each selectedPhase.tasks as task}<li>{task}</li>{/each}</ol></section>
            <aside><h3>Evidence</h3><ul>{#each selectedPhase.tests as test}<li><span>✓</span>{test}</li>{/each}</ul></aside>
          </div>
          <footer><span>Exit gate</span><strong>{selectedPhase.exit}</strong></footer>
        </article>
      </div>

      <section class="sequence-strip" aria-label="Phase dependency sequence">
        {#each phases as phase, index}
          <button type="button" onclick={() => (selectedPhaseId = phase.id)} class:active={selectedPhaseId === phase.id}>
            <span>{phase.id}</span><b>{phase.title}</b>
          </button>
          {#if index < phases.length - 1}<i>→</i>{/if}
        {/each}
      </section>
    </main>
  {:else if view === "workstreams"}
    <main class="page">
      <section class="page-intro">
        <span class="kicker">Review boundaries</span>
        <h2>Ownership follows the seam that can fail.</h2>
        <p>Each stream names its code boundary, primary risk, reviewer, and observable outcome.</p>
      </section>

      <section class="workstream-list">
        {#each workstreams as stream}
          <article>
            <span class="phase-chip">{stream.phase}</span>
            <div class="work-name"><h3>{stream.name}</h3><code>{stream.path}</code></div>
            <div><small>Principal risk</small><p>{stream.risk}</p></div>
            <div><small>Reviewer</small><p>{stream.reviewer}</p></div>
            <div><small>Observable outcome</small><p>{stream.outcome}</p></div>
          </article>
        {/each}
      </section>

      <section class="section-block">
        <div class="section-head">
          <div><span class="kicker">Risk register</span><h2>Find the failure early.</h2></div>
          <p>The plan places evidence before the layer most likely to hide the defect.</p>
        </div>
        <div class="risk-table">
          <header><span>Risk</span><span>Early signal</span><span>Containment</span></header>
          {#each risks as risk}<div><b>{risk[0]}</b><p>{risk[1]}</p><p>{risk[2]}</p></div>{/each}
        </div>
      </section>

      <section class="scope-grid">
        <article><span>Now</span><h3>Convergence scope</h3><p>All audit P0/P1 behavior, responsive panels, link notes, comment integrity, on-page furniture, and browser evidence.</p></article>
        <article><span>Contract now, detail later</span><h3>Custom colors</h3><p>Shared picker, EyeDropper state, and “More colors…” callback ship; visual hex/color field follows.</p></article>
        <article><span>Deferred honestly</span><h3>Adjacent editor depth</h3><p>Variables, Templates, Prompts, table-cell editing, uploads, formula authoring, presence, rulers, and margin guides.</p></article>
      </section>
    </main>
  {:else if view === "decisions"}
    <main class="page">
      <section class="decision-intro">
        <div><span class="kicker">Aligned decisions</span><h2>Four choices now encoded in the editor.</h2></div>
        <p>
          The approved choices are selected and implemented. Change them here to compare the
          alternatives; this page is explanatory and does not change editor behavior.
        </p>
      </section>

      <section class="decision-grid">
        {#each decisions as decision, index}
          <article>
            <header><span>{String(index + 1).padStart(2, "0")}</span><div><small>{decision.label}</small><h3>{decision.question}</h3></div></header>
            <p>{decision.why}</p>
            <div class="choice-list">
              {#each decision.options as option}
                <button
                  type="button"
                  class:selected={choices[decision.id] === option.id}
                  aria-pressed={choices[decision.id] === option.id}
                  onclick={() => (choices[decision.id] = option.id)}
                >
                  <span class="radio">{choices[decision.id] === option.id ? "●" : "○"}</span>
                  <span><b>{option.label}</b><small>{option.detail}</small></span>
                  {#if option.recommended}<em>Recommended</em>{/if}
                </button>
              {/each}
            </div>
          </article>
        {/each}
      </section>

      <section class="decision-summary">
        <div><span class="kicker">Implemented contract</span><h2>Decisions carried through the integration</h2></div>
        <ol>
          {#each decisions as decision}
            <li><span>{decision.label}</span><strong>{choiceLabel(decision.id)}</strong></li>
          {/each}
        </ol>
      </section>
    </main>
  {:else}
    <main class="page">
      <section class="gate-hero">
        <div><span class="kicker">Definition of done</span><h2>Ready means reproducible, reviewable, and quiet.</h2></div>
        <p>Recorded from the main-based integration branch after clean-fixture runs. Chromium was rerun after the latest rebase; Firefox retains the prior green baseline and is labeled separately.</p>
      </section>

      <section class="gate-grid">
        {#each gates as gate, index}
          <article><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{gate[0]}</h3><p>{gate[1]}</p><small>{gate[2]}</small></div></article>
        {/each}
      </section>

      <section class="acceptance">
        <header><span class="kicker">Browser acceptance</span><h2>The paths that must stay boring.</h2></header>
        <div>
          <article><h3>Editing + selection</h3><ul>
            <li>Selection remains visible through every panel, picker, composer, and repaint.</li>
            <li>Three ranges survive formatting, remote/catch-up movement, undo, and redo.</li>
            <li>Enter/Backspace follows the approved semantic matrix in data and pixels.</li>
            <li>Double-click word and Shift-double-click block never expose node chrome.</li>
          </ul></article>
          <article><h3>Formatting + panels</h3><ul>
            <li>Ten Color, ten Background, and alternating changes succeed and reverse in order.</li>
            <li>B/I/U/S, Color/Background, and orientation hold one row at every rail width.</li>
            <li>Zero numeric values look editable; Sections never prints fractional placement.</li>
            <li>Every panel mutation produces the intended native operation.</li>
          </ul></article>
          <article><h3>Links + comments</h3><ul>
            <li>URL and notes survive edit, reload, remove/re-add, undo/redo, and safe open.</li>
            <li>Source, opener, and replies are unmistakable; anchors shift with text.</li>
            <li>Cross-block behavior matches the approved model without truncation.</li>
            <li>Detached threads stay in Comments and produce no page pin.</li>
          </ul></article>
          <article><h3>Furniture + system</h3><ul>
            <li>Styled on-page header/footer edits repeat identically on every page.</li>
            <li>Hidden first page makes page two start at the first visible number.</li>
            <li>Keyboard, focus return, reduced motion, themes, and grayscale pass.</li>
            <li>Console, page-error, and unexpected-request collections remain empty.</li>
          </ul></article>
        </div>
      </section>

      <section class="commit-discipline">
        <div><span class="kicker">Review discipline</span><h2>One coherent reason per change.</h2></div>
        <ul>
          <li><b>Green commits.</b> Locally red test-first work is fine; red review checkpoints are not.</li>
          <li><b>Model changes travel together.</b> Type, validator, applier, inverse, legacy fixture, and docs.</li>
          <li><b>Components precede consumers.</b> Shared controls land before lenses; private copies leave with adoption.</li>
          <li><b>No cleanup tail.</b> If correctness and design cannot be reviewed in a slice, the slice is too large.</li>
          <li><b>No donor ancestry.</b> Final review proves the unchanged reference commits are unreachable.</li>
        </ul>
      </section>
    </main>
  {/if}

  <footer class="artifact-footer">
    <div class="footer-links">
      <a href="/demo/document-editor-review">Review + target UI</a>
      <a href="/demo/document-editor-reference">Implemented system reference</a>
      <a href="/demo/document-editor-controls">Control laboratory</a>
      <a href="/app/dev-project">Live editor</a>
    </div>
    <span>Planning source: <code>docs/artifacts/document-editor-implementation-plan</code></span>
  </footer>
</div>

<style>
  :global(body) { margin: 0; }
  :global(*) { box-sizing: border-box; }
  :global(button) { font: inherit; }

  .artifact {
    --ground: var(--token-surface-canvas);
    --panel: var(--token-surface-panel);
    --raised: var(--token-surface-elevated);
    --work: var(--token-surface-work);
    --ink: var(--token-ink-primary);
    --ink-2: var(--token-ink-secondary);
    --ink-3: var(--token-ink-muted);
    --rule: var(--token-border-subtle);
    --rule-strong: var(--token-border-strong);
    --active: var(--token-color-active-text);
    --active-soft: var(--token-color-active-surface);
    --interactive: var(--token-color-interactive-text);
    --interactive-soft: var(--token-color-interactive-surface);
    --accent: var(--token-color-accent-1-text);
    --accent-soft: var(--token-color-accent-1-surface);
    --attention: var(--token-color-attention-text);
    --attention-soft: var(--token-color-attention-surface);
    --success: var(--token-color-success-text);
    --success-soft: var(--token-color-success-surface);
    min-height: 100vh;
    background: var(--ground);
    color: var(--ink);
    font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.5;
  }

  button, a { color: inherit; }
  code, .phase-chip, .phase-rail > button > span, .guardrail-grid article > span, .gate-grid article > span { font-family: "IBM Plex Mono", ui-monospace, monospace; }
  code { padding: .12rem .35rem; border: 1px solid var(--rule); border-radius: 4px; background: var(--panel); font-size: .82em; }
  .mast { display: grid; grid-template-columns: minmax(0, 1fr) 18rem; gap: 4rem; max-width: 94rem; margin: 0 auto; padding: 4rem 3.5rem 3.2rem; }
  .back-link { display: inline-block; margin-bottom: 2.5rem; color: var(--interactive); font-size: 12px; font-weight: 650; text-decoration: none; }
  .back-link:hover { text-decoration: underline; }
  .eyebrow, .kicker { display: block; margin: 0 0 .75rem; color: var(--accent); font-size: 10px; font-weight: 750; letter-spacing: .15em; text-transform: uppercase; }
  .mast h1 { max-width: 14ch; margin: 0; font-size: clamp(3.2rem, 6vw, 5.8rem); line-height: .93; letter-spacing: -.055em; }
  .lede { max-width: 66ch; margin: 1.65rem 0 0; color: var(--ink-2); font-size: 1.08rem; }
  .plan-state { align-self: end; padding: 1.2rem 1.25rem; border: 1px solid var(--token-color-attention-border); border-left: 4px solid var(--attention); border-radius: 0 var(--token-radius-panel) var(--token-radius-panel) 0; background: var(--attention-soft); }
  .plan-state > span { display: block; color: var(--attention); font-size: 9px; font-weight: 750; letter-spacing: .13em; text-transform: uppercase; }
  .plan-state strong { display: block; margin: .2rem 0; font-size: 2rem; line-height: 1; }
  .plan-state p { margin: .55rem 0 .9rem; color: var(--ink-2); font-size: 12px; }
  .plan-state code { color: var(--ink-2); font-size: 9px; }
  .live-link { display: block; margin-top: 1rem; color: var(--interactive); font-size: 11px; font-weight: 700; text-decoration: none; }
  .live-link:hover { text-decoration: underline; }

  .tabs { position: sticky; top: 0; z-index: 30; display: grid; grid-template-columns: repeat(5, 1fr); border-block: 1px solid var(--rule); background: color-mix(in srgb, var(--ground) 92%, transparent); backdrop-filter: blur(12px); }
  .tabs button { min-height: 3.15rem; padding: .75rem 1rem; border: 0; border-right: 1px solid var(--rule); background: transparent; color: var(--ink-3); cursor: pointer; font-size: 12px; font-weight: 650; }
  .tabs button:last-child { border-right: 0; }
  .tabs button span { margin-right: .5rem; color: var(--rule-strong); font-family: "IBM Plex Mono", monospace; font-size: 9px; }
  .tabs button.active { box-shadow: inset 0 -3px 0 var(--active); background: var(--active-soft); color: var(--active); }
  .page { max-width: 94rem; margin: 0 auto; padding: 3.5rem 3.5rem 7rem; }
  h2 { margin: 0; font-size: clamp(1.9rem, 3.5vw, 3.2rem); line-height: 1.02; letter-spacing: -.04em; }
  .intro-grid, .decision-intro, .gate-hero { display: grid; grid-template-columns: minmax(20rem, .85fr) minmax(22rem, 1fr); gap: 4rem; align-items: end; }
  .intro-grid > p, .decision-intro > p, .gate-hero > p { margin: 0; color: var(--ink-2); font-size: 1rem; }
  .page-intro { max-width: 62rem; }
  .page-intro p { max-width: 65ch; margin: 1rem 0 0; color: var(--ink-2); }
  .section-block { margin-top: 5rem; }
  .section-head { display: flex; align-items: end; justify-content: space-between; gap: 3rem; padding-bottom: 1rem; border-bottom: 2px solid var(--ink); }
  .section-head p { max-width: 34rem; margin: 0; color: var(--ink-3); font-size: 12px; text-align: right; }

  .flow-card { margin-top: 2.5rem; padding: 2rem; border: 1px solid var(--rule-strong); border-radius: var(--token-radius-panel); background: var(--raised); box-shadow: var(--token-shadow-panel); }
  .flow-main { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 1rem; align-items: center; }
  .flow-main article, .panel-flow article { padding: 1rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--panel); }
  .flow-main article.live { border-color: var(--token-color-active-border); background: var(--active-soft); }
  .flow-main article span, .panel-flow article span { display: block; color: var(--ink-3); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .flow-main article b, .panel-flow article b { display: block; margin: .2rem 0; font-size: 1rem; }
  .flow-main article small { color: var(--ink-3); font-size: 10px; }
  .flow-main > i { color: var(--interactive); font-size: 1.5rem; font-style: normal; text-align: center; }
  .panel-flow { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--rule); }
  .panel-flow article { min-width: 10rem; padding: .65rem 1rem; }
  .panel-flow i { color: var(--interactive); font-family: "IBM Plex Mono", monospace; font-size: 10px; font-style: normal; }
  .flow-card > p { margin: 1rem 0 0; color: var(--ink-3); font-size: 11px; text-align: center; }

  .adoption-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin-top: 1.25rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--rule); overflow: hidden; }
  .bucket { min-height: 25rem; padding: 1.2rem; background: var(--raised); }
  .bucket header { display: flex; align-items: baseline; gap: .65rem; }
  .bucket header span { color: var(--ink-3); font-family: "IBM Plex Mono", monospace; font-size: 10px; }
  .bucket h3 { margin: 0; font-size: 1.3rem; }
  .bucket > p { min-height: 3.2rem; margin: .7rem 0 1rem; color: var(--ink-3); font-size: 11px; }
  .bucket ul { display: grid; gap: .6rem; margin: 0; padding: 0; list-style: none; }
  .bucket li { padding-top: .55rem; border-top: 1px solid var(--rule); color: var(--ink-2); font-size: 12px; }
  .bucket.adopt { box-shadow: inset 0 3px 0 var(--success); }
  .bucket.repair { box-shadow: inset 0 3px 0 var(--attention); }
  .bucket.recompose { box-shadow: inset 0 3px 0 var(--active); }
  .bucket.build { box-shadow: inset 0 3px 0 var(--accent); }

  .guardrail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; margin-top: 1.25rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--rule); overflow: hidden; }
  .guardrail-grid article { display: grid; grid-template-columns: 2.5rem 1fr; gap: .8rem; min-height: 7.5rem; padding: 1.15rem; background: var(--raised); }
  .guardrail-grid article > span { color: var(--active); font-size: 10px; }
  .guardrail-grid h3 { margin: 0 0 .35rem; font-size: 1rem; }
  .guardrail-grid p { margin: 0; color: var(--ink-2); font-size: 12px; }
  .branch-card { display: grid; grid-template-columns: minmax(17rem, .7fr) minmax(24rem, 1fr); gap: 3rem; margin-top: 5rem; padding: 2rem; border-radius: var(--token-radius-panel); background: var(--ink); color: var(--token-ink-on-fill); }
  .branch-card .kicker { color: var(--token-color-accent-1-on-fill); }
  .branch-lines { display: grid; gap: .8rem; align-content: center; }
  .branch-lines p { display: grid; grid-template-columns: auto 1fr 1fr auto; gap: .6rem; align-items: center; margin: 0; }
  .branch-lines p > * { padding: .55rem .65rem; border: 1px solid color-mix(in srgb, var(--token-ink-on-fill) 22%, transparent); border-radius: var(--token-radius-control); font-size: 10px; text-align: center; }
  .branch-lines p > span { color: var(--token-ink-on-fill); }
  .branch-lines strong { background: var(--token-color-success-fill); color: var(--token-color-success-on-fill); }
  .branch-lines .donor { grid-template-columns: auto 1fr auto; opacity: .86; }
  .branch-lines em { color: var(--token-color-attention-on-fill); font-style: normal; }

  .phase-layout { display: grid; grid-template-columns: 18rem minmax(0, 1fr); gap: 1.2rem; margin-top: 2.5rem; }
  .phase-rail { display: flex; flex-direction: column; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .phase-rail button { display: grid; grid-template-columns: 2rem 1fr; gap: .5rem; min-height: 4.25rem; padding: .75rem .85rem; border: 0; border-bottom: 1px solid var(--rule); background: transparent; color: var(--ink-2); cursor: pointer; text-align: left; }
  .phase-rail button:last-child { border-bottom: 0; }
  .phase-rail button:hover { background: var(--panel); }
  .phase-rail button.active { box-shadow: inset 3px 0 0 var(--active); background: var(--active-soft); color: var(--active); }
  .phase-rail > button > span { font-size: 9px; }
  .phase-rail b { display: block; font-size: 12px; }
  .phase-rail small { display: block; margin-top: .15rem; color: var(--ink-3); font-size: 9px; }
  .phase-detail { min-height: 43rem; border: 1px solid var(--rule-strong); border-radius: var(--token-radius-panel); background: var(--raised); box-shadow: var(--token-shadow-panel); overflow: hidden; }
  .phase-detail > header { display: flex; align-items: start; justify-content: space-between; gap: 2rem; padding: 1.6rem; border-bottom: 1px solid var(--rule); background: var(--panel); }
  .phase-detail header span { color: var(--active); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .phase-detail header h2 { margin-top: .25rem; font-size: 2.15rem; }
  .phase-detail header code { white-space: nowrap; }
  .phase-summary { max-width: 72ch; margin: 0; padding: 1.4rem 1.6rem; color: var(--ink-2); font-size: 14px; }
  .phase-columns { display: grid; grid-template-columns: minmax(0, 1fr) 17rem; gap: 2rem; padding: .4rem 1.6rem 1.6rem; }
  .phase-columns h3 { margin: 0 0 .8rem; font-size: .82rem; letter-spacing: .08em; text-transform: uppercase; }
  .phase-columns ol { display: grid; gap: .75rem; margin: 0; padding-left: 1.25rem; }
  .phase-columns ol li { padding-left: .35rem; color: var(--ink-2); font-size: 12.5px; }
  .phase-columns aside { padding-left: 1.2rem; border-left: 1px solid var(--rule); }
  .phase-columns ul { display: grid; gap: .6rem; margin: 0; padding: 0; list-style: none; }
  .phase-columns ul li { display: grid; grid-template-columns: 1rem 1fr; gap: .35rem; color: var(--ink-2); font-size: 11px; }
  .phase-columns li span { color: var(--success); font-weight: 750; }
  .phase-detail > footer { margin: 0 1.6rem 1.6rem; padding: 1rem; border: 1px solid var(--token-color-success-border); border-radius: var(--token-radius-control); background: var(--success-soft); }
  .phase-detail footer span { display: block; color: var(--success); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .phase-detail footer strong { display: block; margin-top: .25rem; font-size: 12px; }
  .sequence-strip { display: flex; align-items: stretch; gap: .35rem; margin-top: 1.2rem; overflow-x: auto; }
  .sequence-strip button { min-width: 7.5rem; min-height: 4rem; padding: .55rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--raised); cursor: pointer; text-align: left; }
  .sequence-strip button.active { border-color: var(--token-color-active-border); background: var(--active-soft); }
  .sequence-strip button span { display: block; color: var(--active); font-family: "IBM Plex Mono", monospace; font-size: 9px; }
  .sequence-strip button b { display: block; margin-top: .2rem; font-size: 10px; line-height: 1.2; }
  .sequence-strip > i { align-self: center; color: var(--ink-3); font-style: normal; }

  .workstream-list { margin-top: 2.5rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .workstream-list article { display: grid; grid-template-columns: 3.5rem minmax(13rem, 1.25fr) repeat(3, minmax(10rem, 1fr)); gap: 1rem; align-items: start; padding: 1rem 1.1rem; border-bottom: 1px solid var(--rule); }
  .workstream-list article:last-child { border-bottom: 0; }
  .phase-chip { display: inline-grid; min-height: 1.7rem; place-items: center; border: 1px solid var(--token-color-active-border); border-radius: 99px; background: var(--active-soft); color: var(--active); font-size: 9px; }
  .work-name h3 { margin: 0 0 .3rem; font-size: 1rem; }
  .work-name code { color: var(--ink-3); font-size: 8.5px; }
  .workstream-list small { display: block; margin-bottom: .2rem; color: var(--ink-3); font-size: 8.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .workstream-list p { margin: 0; color: var(--ink-2); font-size: 11px; }
  .risk-table { margin-top: 1.25rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); overflow: hidden; }
  .risk-table > header, .risk-table > div { display: grid; grid-template-columns: .7fr 1.2fr 1.2fr; gap: 1rem; padding: .8rem 1rem; border-bottom: 1px solid var(--rule); }
  .risk-table > header { background: var(--panel); color: var(--ink-3); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .risk-table > div:last-child { border-bottom: 0; }
  .risk-table b { font-size: 12px; }
  .risk-table p { margin: 0; color: var(--ink-2); font-size: 11px; }
  .scope-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; margin-top: 4rem; }
  .scope-grid article { min-height: 12rem; padding: 1.2rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); }
  .scope-grid article > span { color: var(--accent); font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .scope-grid h3 { margin: 1rem 0 .5rem; font-size: 1.15rem; }
  .scope-grid p { margin: 0; color: var(--ink-2); font-size: 12px; }

  .decision-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 2.5rem; }
  .decision-grid > article { min-height: 26rem; padding: 1.3rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); }
  .decision-grid article > header { display: grid; grid-template-columns: 2rem 1fr; gap: .6rem; }
  .decision-grid article > header > span { color: var(--active); font-family: "IBM Plex Mono", monospace; font-size: 10px; }
  .decision-grid header small { color: var(--ink-3); font-size: 9px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
  .decision-grid h3 { margin: .25rem 0 0; font-size: 1.2rem; }
  .decision-grid article > p { min-height: 3rem; margin: .9rem 0; color: var(--ink-2); font-size: 12px; }
  .choice-list { display: grid; gap: .6rem; }
  .choice-list button { position: relative; display: grid; grid-template-columns: 1.4rem 1fr auto; gap: .5rem; min-height: 6rem; align-items: start; padding: .8rem; border: 1px solid var(--rule); border-radius: var(--token-radius-control); background: var(--work); cursor: pointer; text-align: left; }
  .choice-list button:hover { border-color: var(--rule-strong); background: var(--panel); }
  .choice-list button.selected { border-color: var(--token-color-active-border); box-shadow: inset 3px 0 0 var(--active); background: var(--active-soft); }
  .choice-list .radio { color: var(--active); }
  .choice-list b { display: block; font-size: 12px; }
  .choice-list small { display: block; margin-top: .3rem; color: var(--ink-2); font-size: 10.5px; }
  .choice-list em { padding: .2rem .35rem; border-radius: 99px; background: var(--success-soft); color: var(--success); font-size: 8px; font-style: normal; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .decision-summary { display: grid; grid-template-columns: minmax(18rem, .7fr) minmax(24rem, 1fr); gap: 3rem; margin-top: 4rem; padding: 2rem; border-radius: var(--token-radius-panel); background: var(--ink); color: var(--token-ink-on-fill); }
  .decision-summary .kicker { color: var(--token-color-accent-1-on-fill); }
  .decision-summary h2 { font-size: 2rem; }
  .decision-summary ol { display: grid; gap: .5rem; margin: 0; padding: 0; list-style: none; }
  .decision-summary li { display: flex; justify-content: space-between; gap: 1rem; padding: .55rem 0; border-bottom: 1px solid color-mix(in srgb, var(--token-ink-on-fill) 18%, transparent); }
  .decision-summary li:last-child { border-bottom: 0; }
  .decision-summary li span { color: var(--token-ink-on-fill); font-size: 11px; }
  .decision-summary li strong { font-size: 11px; text-align: right; }

  .gate-hero { padding: 2rem; border-radius: var(--token-radius-panel); background: var(--ink); color: var(--token-ink-on-fill); }
  .gate-hero .kicker { color: var(--token-color-success-on-fill); }
  .gate-hero > p { color: var(--token-ink-on-fill); }
  .gate-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin-top: 1.5rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--rule); overflow: hidden; }
  .gate-grid article { display: grid; grid-template-columns: 2rem 1fr; gap: .7rem; min-height: 9rem; padding: 1rem; background: var(--raised); }
  .gate-grid article > span { color: var(--success); font-size: 10px; }
  .gate-grid h3 { margin: 0 0 .4rem; font-size: 1rem; }
  .gate-grid p { margin: 0; color: var(--ink-2); font-size: 11.5px; }
  .gate-grid small { display: block; margin-top: .85rem; color: var(--success); font-size: 10px; font-weight: 650; }
  .acceptance { margin-top: 5rem; }
  .acceptance > header { padding-bottom: 1rem; border-bottom: 2px solid var(--ink); }
  .acceptance > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; margin-top: 1.25rem; }
  .acceptance article { padding: 1.2rem; border: 1px solid var(--rule); border-radius: var(--token-radius-panel); background: var(--raised); }
  .acceptance h3 { margin: 0 0 .75rem; font-size: 1.1rem; }
  .acceptance ul { display: grid; gap: .55rem; margin: 0; padding-left: 1.1rem; }
  .acceptance li { color: var(--ink-2); font-size: 12px; }
  .commit-discipline { display: grid; grid-template-columns: minmax(17rem, .65fr) minmax(25rem, 1fr); gap: 3rem; margin-top: 4rem; padding: 2rem; border: 1px solid var(--rule-strong); border-radius: var(--token-radius-panel); background: var(--panel); }
  .commit-discipline h2 { font-size: 2rem; }
  .commit-discipline ul { display: grid; gap: .7rem; margin: 0; padding: 0; list-style: none; }
  .commit-discipline li { color: var(--ink-2); font-size: 12px; }
  .commit-discipline li b { color: var(--ink); }

  .artifact-footer { display: flex; justify-content: space-between; gap: 1rem; max-width: 94rem; margin: 0 auto; padding: 1.5rem 3.5rem 2.5rem; border-top: 1px solid var(--rule); color: var(--ink-3); font-size: 10px; }
  .artifact-footer a { color: var(--interactive); font-weight: 650; text-decoration: none; }
  .artifact-footer a:hover { text-decoration: underline; }
  .footer-links { display: flex; flex-wrap: wrap; gap: 1rem; }

  @media (max-width: 76rem) {
    .mast { grid-template-columns: 1fr; gap: 2rem; }
    .plan-state { max-width: 28rem; }
    .adoption-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .workstream-list article { grid-template-columns: 3rem 1.2fr repeat(2, 1fr); }
    .workstream-list article > div:last-child { grid-column: 2 / -1; }
  }

  @media (max-width: 58rem) {
    .tabs { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .tabs button span { display: none; }
    .intro-grid, .decision-intro, .gate-hero, .branch-card, .decision-summary, .commit-discipline { grid-template-columns: 1fr; gap: 1.5rem; }
    .flow-main { grid-template-columns: 1fr; }
    .flow-main > i { transform: rotate(90deg); }
    .phase-layout { grid-template-columns: 1fr; }
    .phase-rail { display: grid; grid-template-columns: repeat(4, 1fr); }
    .phase-rail button { border-right: 1px solid var(--rule); }
    .phase-columns { grid-template-columns: 1fr; }
    .phase-columns aside { padding: 1rem 0 0; border-top: 1px solid var(--rule); border-left: 0; }
    .workstream-list article { grid-template-columns: 3rem 1fr 1fr; }
    .workstream-list article > div:nth-last-child(-n+2) { grid-column: 2 / -1; }
    .scope-grid, .gate-grid { grid-template-columns: 1fr; }
  }

  @media (max-width: 42rem) {
    .mast, .page, .artifact-footer { padding-right: 1rem; padding-left: 1rem; }
    .mast { padding-top: 2.5rem; }
    .mast h1 { font-size: 3.15rem; }
    .tabs button { padding: .65rem .25rem; font-size: 9.5px; }
    .section-head { align-items: start; flex-direction: column; gap: .7rem; }
    .section-head p { text-align: left; }
    .adoption-grid, .guardrail-grid, .decision-grid, .acceptance > div { grid-template-columns: 1fr; }
    .bucket { min-height: 0; }
    .phase-rail { grid-template-columns: repeat(2, 1fr); }
    .phase-detail > header { flex-direction: column; }
    .phase-detail header code { white-space: normal; }
    .phase-columns { padding-right: 1rem; padding-left: 1rem; }
    .workstream-list article { grid-template-columns: 2.5rem 1fr; }
    .workstream-list article > div { grid-column: 2; }
    .risk-table > header { display: none; }
    .risk-table > div { grid-template-columns: 1fr; }
    .artifact-footer { align-items: start; flex-direction: column; }
  }
</style>
