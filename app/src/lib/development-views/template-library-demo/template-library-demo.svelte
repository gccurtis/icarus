<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Check from "@lucide/svelte/icons/check";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import Database from "@lucide/svelte/icons/database";
  import FileClock from "@lucide/svelte/icons/file-clock";
  import FileText from "@lucide/svelte/icons/file-text";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import Layers3 from "@lucide/svelte/icons/layers-3";
  import Presentation from "@lucide/svelte/icons/presentation";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import Sheet from "@lucide/svelte/icons/sheet";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import BehaviorMap from "$development-views/template-library-demo/components/behavior-map.svelte";
  import BranchAudit from "$development-views/template-library-demo/components/branch-audit.svelte";
  import DataFlow from "$development-views/template-library-demo/components/data-flow.svelte";
  import LibraryStage from "$development-views/template-library-demo/components/library-stage.svelte";

  const LIFECYCLE = [
    {
      number: "01",
      title: "Open an authoring session",
      detail: "Proposed: retain the base revision and a durable lease so a tab switch can suspend safely.",
      icon: FileText
    },
    {
      number: "02",
      title: "Mint local scratch",
      detail: "Proposed: materialize the body behind a clearly temporary identity. It is not a project resource.",
      icon: Sparkles
    },
    {
      number: "03",
      title: "Use the ordinary editor",
      detail: "Document and slide-deck behavior stay in their owners. The spreadsheet editor is still mock-backed.",
      icon: Layers3
    },
    {
      number: "04",
      title: "Done: flush, then commit",
      detail: "Await editor flush, compare-and-swap the template revision, and only then remove scratch state.",
      icon: FileClock
    },
    {
      number: "05",
      title: "Cancel or expire",
      detail: "Cancel discards explicitly; an abandoned durable session is cleaned by expiry. A tab switch only suspends.",
      icon: RotateCcw
    }
  ];

  const CHECKS = [
    {
      label: "Composition",
      value: "real Context · Content · Inspector",
      detail: "The reference imports the shell registries, not a second drawing of the library.",
      state: "implemented"
    },
    {
      label: "Data boundary",
      value: "project-scoped route",
      detail: "Remote calls originate below /app/[project], while Template visibility itself remains owner-only.",
      state: "implemented"
    },
    {
      label: "Availability",
      value: "Personal now · Project model open",
      detail: "Every current row is viewer-owned and emitted as Personal. Project templates wait for an explicit ownership and transfer model; Shared is not part of the current contract.",
      state: "deferred"
    },
    {
      label: "View isolation",
      value: "fresh workspace coordinator",
      detail: "The demo does not restore or flush tabs, panel geometry, selection or inspection.",
      state: "implemented"
    },
    {
      label: "Editor strategy",
      value: "proposed · deferred",
      detail: "Document and deck reuse need a durable authoring session; the spreadsheet editor itself remains mock-backed.",
      state: "deferred"
    },
    {
      label: "Command lifetime",
      value: "one pending intent per workspace",
      detail: "Create, update, duplicate, remove, and Use share one in-flight promise across remounts and sibling panes.",
      state: "implemented"
    }
  ];

  const DECISIONS = [
    {
      title: "Personal and Project ownership",
      priority: "Before Project scope · not a current-library blocker",
      today: "Every stored template has a userId, the capability returns only that viewer's rows, and every row is labeled Personal. Shared has been removed from the current UI and public availability type.",
      worst: "Calling a row Project without a represented project owner would make access, deletion, and responsibility ambiguous; deriving it from the route could expose one person's template to every project member.",
      next: "Decide whether Personal and Project are separate tables or one explicit ownership union. Define personal-to-project and project-to-personal as copy, promotion, or attachment. A later personal access list can name an owner plus readers/users without reviving a vague Shared bucket."
    },
    {
      title: "Role-aware production writes",
      priority: "Before non-owner production use · high",
      today: "The route proves project membership, and template metadata writes separately require the represented owner. The development session is the project owner, but scope does not yet distinguish project owner, editor, and viewer.",
      worst: "A read-only project member could reach a resource-creation command once this development boundary is exposed to real multi-role traffic.",
      next: "Carry the admitted membership role in server scope and require a write-capable role in Project Resources and any future Project-template mutation. This is authorization work, not visual library work."
    },
    {
      title: "Retry-safe server commands",
      priority: "Before automatic retry/offline queues · medium",
      today: "Workspace single-flight shares one identical pending promise inside one browser workspace. Revision checks protect update and delete, but create, duplicate, and Use intentionally mint a fresh UUID for every separately accepted request.",
      worst: "If a transport retries after the server committed but before the browser received the answer—or two clients submit the same intent—the result can be two templates or two created resources. Existing rows are not overwritten or corrupted.",
      next: "Add a caller-generated operation id and a persisted, user/project-scoped result ledger so a retry returns the first result. This is a moderate server contract and retention decision, not a reliable one-line debounce; it does not block this merge while the client has no automatic retry queue."
    },
    {
      title: "Cross-table failure recovery",
      priority: "Before production-critical mutations · high, low-frequency",
      today: "Admission and conflicts are resolved before writing, and each individual table file is replaced atomically. There is no transaction spanning template, version, resource, snapshot, provenance, and cell tables.",
      worst: "An I/O or process failure between table commits can leave a new template without its history row, an updated template without the matching version, an instantiated resource without its snapshot, or a partially completed delete. Ordinary validation failures do not cause this; it requires a persistence failure after an earlier table committed.",
      next: "Use a transactional backend or add a durable mutation journal with deterministic recovery. The current per-table hardening reduces the failure window but cannot honestly promise all-or-nothing behavior across files."
    },
    {
      title: "Template authoring session and failed Done",
      priority: "Before a real template editor · does not block library CRUD",
      today: "The library editor surface is intentionally only a shell. No scratch resource is created, so the current library has no Done path and cannot lose editor changes it never accepts.",
      worst: "A naive future Done could flush an editor, lose a revision race, and then delete the only scratch body—or a tab close could race an asynchronous flush and leave either lost edits or orphan scratch data.",
      next: "Represent a session with user, template, scratch id, base revision, lease, and status. Done must retain the scratch and surface a retry/conflict state until flush and compare-and-swap both succeed; cleanup happens last. Cancel is explicit, while navigation merely suspends the session."
    },
    {
      title: "Remaining Use inputs and hand-offs",
      priority: "Before every template can be used from UI · medium",
      today: "Document and deck Use persist independent resources using represented defaults. Spreadsheet materialization is implemented and tested, but its button stays disabled because the spreadsheet editor does not consume the created resource id. Missing or cyclic variable defaults refuse before any write.",
      worst: "Enabling these paths prematurely would either open a mock disconnected from the resource just written or force callers to invent variable-answer data that representation cannot record.",
      next: "Define the variable-answer command shape and connect the spreadsheet runtime to represented resource ids. Neither changes the current Personal library's create, edit, duplicate, or delete persistence."
    }
  ];
</script>

<svelte:head>
  <title>Template library future state — Icarus</title>
  <meta
    name="description"
    content="A live, implementation-grounded reference for the Icarus Template library, its data flow and a proposed authoring lifecycle."
  />
</svelte:head>

<div class="reference-shell">
  <header class="topbar">
    <a class="wordmark" href="/demo">
      <span class="mark" aria-hidden="true"></span>
      <span>ICARUS</span>
      <span class="muted">/ TEMPLATE LIBRARY</span>
    </a>
    <nav aria-label="On this page">
      <a href="#live">Live library</a>
      <a href="#behaviors">Behaviors</a>
      <a href="#flow">Data flow</a>
      <a href="#model">Model</a>
      <a href="#justifications">Justifications</a>
      <a href="#decisions">Decisions</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow"><Sparkles size={13} aria-hidden="true" /> FUTURE STATE / WORKING REFERENCE</div>
        <h1>Templates,<br />end to end.</h1>
        <p class="lede">
          The library implementation pictured by this branch: seeded representation data, a scoped server
          boundary and one common read model across three live panes. A separate, clearly marked
          proposal shows how ordinary editors could later author a template through durable scratch
          state rather than a template-specific canvas.
        </p>
      </div>

      <aside class="branch-card">
        <header><GitBranch size={17} aria-hidden="true" /> REFERENCE BRANCH</header>
        <code>work/template-library-future</code>
        <dl>
          <div><dt>live product panes</dt><dd>3</dd></div>
          <div><dt>resource targets</dt><dd>3</dd></div>
          <div><dt>recent shelf limit</dt><dd>10</dd></div>
          <div><dt>planned bespoke editors</dt><dd>0</dd></div>
        </dl>
        <p>
          This route is a review surface, not a parallel product. Its centre and flanks are the
          actual filesystem-registered Template views running against an isolated workspace view.
          All reference implementation lives in <code>development-views</code>; the app route is only
          the thin project-scope adapter those real views require.
        </p>
      </aside>
    </section>

    <section class="status-line" aria-label="Reference result">
      <Check size={17} aria-hidden="true" />
      <p>
        <strong>One reference, two jobs:</strong> use the live stage to judge the library; use the
        sections beneath it to review every boundary and unresolved choice.
      </p>
      <a href="#live">Open the stage <ArrowRight size={14} aria-hidden="true" /></a>
    </section>

    <section id="live" class="section live-section">
      <div class="section-heading">
        <div><span class="kicker">THE PRODUCT / LIVE</span><h2>The library in its real geometry</h2></div>
        <p>
          Context, centre and inspector share one disposable workspace coordinator. Search, filters,
          shelf scrolling and selection are interactive; no UI is copied into this page. Visibility
          is owner-only today: every returned template is Personal. Project ownership remains an
          explicit design decision, and Shared is not a current library state.
        </p>
      </div>
      <div class="persistence-fact">
        <Database size={16} aria-hidden="true" />
        <p>
          <strong>Persisted now, not mocked:</strong> create, rename, description,
          variable-description, tag, duplicate, and delete mutations write through the Templates
          capability into the representation store. Refreshing the page or restarting the server
          keeps accepted changes. Document and deck Use also persist the independent resource they create.
        </p>
      </div>
      <div class="live-warning">
        <CircleAlert size={16} aria-hidden="true" />
        <p><strong>Live means writable.</strong> Create, edit, duplicate, delete, and Use change this isolated worktree's development project data. Stop the dev server first, then run <code>pnpm seed -- --force</code> from <code>app/</code> so in-memory state cannot overwrite the reset.</p>
      </div>
      <LibraryStage />
    </section>

    <section id="behaviors" class="section">
      <div class="section-heading">
        <div><span class="kicker">BEHAVIOR CONTRACT</span><h2>Seven gestures, one library</h2></div>
        <p>
          Every gesture changes one source of truth. A shelf selection, table selection and inspector
          action never create three competing ideas of which template is active.
        </p>
      </div>
      <BehaviorMap />
    </section>

    <section id="flow" class="section">
      <div class="section-heading">
        <div><span class="kicker">DATA FLOW</span><h2>Stored once, projected where needed</h2></div>
        <p>
          Representation owns durable values. Capabilities own scope and mutation. Procedures shape
          those answers for views, and the views own only interaction state.
        </p>
      </div>
      <DataFlow />
    </section>

    <section id="editing" class="section">
      <div class="section-heading">
        <div><span class="kicker">PROPOSED / DEFERRED AUTHORING</span><h2>Borrow an editor, not its storage</h2></div>
        <p>
          This is not implemented. A durable authoring session and scratch resource could satisfy
          existing editor runtimes without turning scratch into another project document.
        </p>
      </div>

      <ol class="lifecycle">
        {#each LIFECYCLE as step, index (step.number)}
          {@const Icon = step.icon}
          <li>
            <article class="life-card">
              <header><span>{step.number}</span><span class="life-icon"><Icon size={17} aria-hidden="true" /></span></header>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
            {#if index < LIFECYCLE.length - 1}
              <span class="life-arrow" aria-hidden="true"><ArrowRight size={17} /></span>
            {/if}
          </li>
        {/each}
      </ol>

      <div class="lifecycle-rule">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>Proposed safety rule: no close-to-delete coupling</strong>
          <p>Done cleans up only after flush and a successful template commit; Cancel or expiry discards. Tab switching suspends the durable session.</p>
        </div>
      </div>
    </section>

    <section id="model" class="section">
      <div class="section-heading">
        <div><span class="kicker">REPRESENTATION RELATIONSHIPS</span><h2>Portable body, explicit history</h2></div>
        <p>
          A template owns portable content rather than live resource IDs. Versions preserve prior
          values; resources created with Use retain provenance but become independent. Ownership is
          represented for Personal templates; Project ownership is not yet represented or emitted.
        </p>
      </div>

      <div class="model-map">
        <article class="model-main">
          <header><Database size={18} aria-hidden="true" /><span>templates</span></header>
          <h3>Template</h3>
          <code>name · description · tags</code>
          <code>body · variables[]</code>
          <code>userId · createdBy · revision · updatedAt</code>
        </article>

        <div class="model-links">
          <article>
            <header><FileClock size={16} aria-hidden="true" /><span>HISTORY</span></header>
            <h3>TemplateVersion</h3>
            <p>A value snapshot for each replaced revision. Deleting the owner removes its history.</p>
          </article>
          <article>
            <header><Layers3 size={16} aria-hidden="true" /><span>DISCRIMINATED BODY</span></header>
            <h3>One of three portable bodies</h3>
            <div class="kind-row">
              <span><FileText size={13} />Document</span>
              <span><Presentation size={13} />Slides</span>
              <span><Sheet size={13} />Spreadsheet</span>
            </div>
          </article>
          <article>
            <header><ArrowRight size={16} aria-hidden="true" /><span>PROVENANCE</span></header>
            <h3>Created resource</h3>
            <p>An independent document, deck or workbook retains templateId; later template edits never rewrite it.</p>
          </article>
        </div>
      </div>
    </section>

    <section id="justifications" class="section">
      <div class="section-heading">
        <div><span class="kicker">EXACT BRANCH AUDIT</span><h2>Every file, every changed line, and why</h2></div>
        <p>
          Full paths are never abbreviated. Every disclosure states what changed in that exact file,
          why its area is in scope, and the exact unified diff captured against the feature baseline.
        </p>
      </div>
      <BranchAudit />
    </section>

    <section id="verification" class="section">
      <div class="section-heading">
        <div><span class="kicker">VERIFICATION SHAPE</span><h2>What must remain true</h2></div>
        <p>
          These are architectural proofs in the page itself. Type, lint, unit, build and browser
          interaction results belong in the branch handoff rather than being frozen as decorative counts.
        </p>
      </div>

      <div class="checks">
        {#each CHECKS as check (check.label)}
          <article class:deferred={check.state === "deferred"}>
            {#if check.state === "deferred"}
              <CircleAlert size={15} aria-hidden="true" />
            {:else}
              <Check size={15} aria-hidden="true" />
            {/if}
            <div><span>{check.label} · {check.state}</span><strong>{check.value}</strong><p>{check.detail}</p></div>
          </article>
        {/each}
      </div>
    </section>

    <section id="decisions" class="section">
      <div class="section-heading">
        <div><span class="kicker">FOLLOW-ON / PRIORITIZED</span><h2>Six decisions, with their actual stakes</h2></div>
        <p>
          These six are the only product and architecture choices requested from the reviewer. The
          branch audit above is evidence and merge-scope explanation, not a seventh decision. Each
          row says what works today, the worst credible failure, when it matters, and what completing
          it entails.
        </p>
      </div>

      <div class="decisions">
        {#each DECISIONS as decision, index (decision.title)}
          <article>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <CircleAlert size={16} aria-hidden="true" />
            <div>
              <h3>{decision.title}</h3>
              <strong class="decision-priority">{decision.priority}</strong>
              <dl>
                <div><dt>Today</dt><dd>{decision.today}</dd></div>
                <div><dt>Worst case</dt><dd>{decision.worst}</dd></div>
                <div><dt>Completion</dt><dd>{decision.next}</dd></div>
              </dl>
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="handoff">
      <div>
        <span class="kicker">REVIEW FROM THE TOP</span>
        <h2>The product and its argument are on one page.</h2>
        <p>Change the live library first; use the contracts below it to decide whether that change belongs in data, behavior or presentation.</p>
      </div>
      <a href="#live">Back to the library <ArrowRight size={15} aria-hidden="true" /></a>
    </section>
  </main>

  <footer>
    <span>TEMPLATE LIBRARY / FUTURE-STATE REFERENCE</span>
    <span>work/template-library-future</span>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .reference-shell {
    min-height: 100vh;
    background:
      radial-gradient(circle at 88% 2%, color-mix(in srgb, var(--token-color-active-fill) 11%, transparent), transparent 27rem),
      var(--token-surface-canvas);
    color: var(--token-ink-primary);
  }

  .topbar {
    position: sticky;
    z-index: 30;
    top: 0;
    display: flex;
    min-height: 3.5rem;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    padding: 0 2rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: color-mix(in srgb, var(--token-surface-canvas) 88%, transparent);
    backdrop-filter: blur(16px);
  }

  .wordmark,
  nav,
  .status-line a,
  .handoff a {
    display: flex;
    align-items: center;
  }

  .wordmark {
    gap: 0.5rem;
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-decoration: none;
  }

  .mark {
    width: 0.58rem;
    height: 0.58rem;
    border: 2px solid var(--token-color-active-text);
    transform: rotate(45deg);
  }

  .muted {
    color: var(--token-ink-muted);
  }

  nav {
    gap: 1.2rem;
  }

  nav a {
    color: var(--token-ink-secondary);
    font-size: 0.75rem;
    text-decoration: none;
  }

  nav a:hover {
    color: var(--token-color-interactive-text);
  }

  main,
  footer {
    width: min(100% - 3rem, 84rem);
    margin-inline: auto;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(20rem, 0.72fr);
    gap: 4rem;
    align-items: end;
    padding: 6.5rem 0 3rem;
  }

  .eyebrow,
  .kicker {
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
    font-weight: 500;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .eyebrow {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    margin-bottom: 1.2rem;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  h1 {
    max-width: 13ch;
    font-size: clamp(3rem, 6vw, 5.4rem);
    font-weight: 500;
    letter-spacing: -0.065em;
    line-height: 0.94;
  }

  .lede {
    max-width: 52rem;
    margin-top: 1.6rem;
    color: var(--token-ink-secondary);
    font-size: clamp(0.98rem, 2vw, 1.14rem);
    line-height: 1.65;
  }

  .branch-card {
    overflow: hidden;
    border: 1px solid var(--token-color-active-border);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
    box-shadow: var(--token-shadow-panel);
  }

  .branch-card > header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.7rem 0.85rem;
    border-bottom: 1px solid var(--token-border-subtle);
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
  }

  .branch-card > code {
    display: block;
    padding: 1rem;
    border-bottom: 1px solid var(--token-border-subtle);
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: 0.82rem;
  }

  .branch-card dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin: 0;
  }

  .branch-card dl div {
    padding: 0.85rem 1rem;
    border-right: 1px solid var(--token-border-subtle);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .branch-card dl div:nth-child(even) {
    border-right: 0;
  }

  .branch-card dt {
    color: var(--token-ink-muted);
    font-size: 0.75rem;
  }

  .branch-card dd {
    margin: 0.25rem 0 0;
    font-family: var(--token-font-mono);
    font-size: 1.35rem;
  }

  .branch-card > p {
    padding: 0.85rem 1rem 1rem;
    color: var(--token-ink-muted);
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .status-line {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.8rem;
    align-items: center;
    padding: 0.9rem 1rem;
    border: 1px solid var(--token-color-success-border);
    border-radius: var(--token-radius-control);
    background: var(--token-color-success-surface);
    color: var(--token-color-success-text);
  }

  .status-line p {
    color: var(--token-ink-secondary);
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .status-line strong {
    color: var(--token-color-success-text);
    font-weight: 550;
  }

  .status-line a,
  .handoff a {
    gap: 0.4rem;
    font-family: var(--token-font-mono);
    text-decoration: none;
    white-space: nowrap;
  }

  .status-line a {
    color: var(--token-color-success-text);
    font-size: 0.75rem;
  }

  .section {
    padding: 6rem 0 0;
    scroll-margin-top: 4rem;
  }

  .section-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 3rem;
    margin-bottom: 2rem;
  }

  h2 {
    margin-top: 0.42rem;
    font-size: clamp(1.8rem, 3.5vw, 2.7rem);
    font-weight: 500;
    letter-spacing: -0.04em;
    line-height: 1.05;
  }

  .section-heading > p {
    max-width: 33rem;
    color: var(--token-ink-muted);
    font-size: 0.8rem;
    line-height: 1.55;
    text-align: right;
  }

  .persistence-fact,
  .live-warning {
    display: flex;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2.5) calc(var(--token-spacing-unit) * 3);
    border-radius: var(--token-radius-control);
  }

  .persistence-fact {
    margin: -0.75rem 0 calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-color-success-border);
    background: var(--token-color-success-surface);
    color: var(--token-color-success-text);
  }

  .live-warning {
    margin: 0 0 calc(var(--token-spacing-unit) * 3);
    border: 1px solid var(--token-color-attention-border);
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
  }

  .persistence-fact :global(svg),
  .live-warning :global(svg) {
    flex: none;
    margin-top: 0.1rem;
  }

  .persistence-fact p,
  .live-warning p {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .live-warning strong {
    color: var(--token-color-attention-text);
  }

  .persistence-fact strong {
    color: var(--token-color-success-text);
  }

  .lifecycle {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: calc(var(--token-spacing-unit) * 2);
    align-items: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .lifecycle li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: calc(var(--token-spacing-unit) * 2);
    align-items: center;
    min-width: 0;
  }

  .lifecycle li:last-child {
    grid-template-columns: minmax(0, 1fr);
  }

  .life-card {
    min-height: 16rem;
    padding: calc(var(--token-spacing-unit) * 4);
    border: 1px solid var(--token-border-subtle);
    border-top: 3px solid var(--token-color-intelligence-border);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .life-card header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
  }

  .life-icon {
    display: grid;
    width: calc(var(--token-spacing-unit) * 8);
    height: calc(var(--token-spacing-unit) * 8);
    place-items: center;
    border-radius: var(--token-radius-control);
    background: var(--token-color-intelligence-surface);
    color: var(--token-color-intelligence-text);
  }

  .lifecycle h3 {
    margin-top: calc(var(--token-spacing-unit) * 5);
    font-size: 0.86rem;
    font-weight: 550;
  }

  .lifecycle p {
    margin-top: calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-muted);
    font-size: 0.75rem;
    line-height: 1.55;
  }

  .life-arrow {
    display: grid;
    place-items: center;
    color: var(--token-color-intelligence-text);
  }

  .lifecycle-rule {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 3);
    align-items: flex-start;
    margin-top: calc(var(--token-spacing-unit) * 4);
    padding: calc(var(--token-spacing-unit) * 4);
    border: 1px solid var(--token-color-success-border);
    border-radius: var(--token-radius-panel);
    background: var(--token-color-success-surface);
    color: var(--token-color-success-text);
  }

  .lifecycle-rule strong {
    font-size: 0.78rem;
    font-weight: 550;
  }

  .lifecycle-rule p {
    margin-top: calc(var(--token-spacing-unit) * 1);
    color: var(--token-ink-secondary);
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .model-map {
    display: grid;
    grid-template-columns: minmax(19rem, 0.72fr) minmax(0, 1.28fr);
    gap: calc(var(--token-spacing-unit) * 4);
  }

  .model-main,
  .model-links article {
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .model-main {
    padding: calc(var(--token-spacing-unit) * 5);
    border-color: var(--token-color-active-border);
    background: linear-gradient(145deg, var(--token-color-active-surface), var(--token-surface-panel) 72%);
  }

  .model-main header,
  .model-links header,
  .kind-row,
  .kind-row span {
    display: flex;
    align-items: center;
  }

  .model-main header,
  .model-links header {
    gap: calc(var(--token-spacing-unit) * 2);
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .model-main h3 {
    margin-top: calc(var(--token-spacing-unit) * 10);
    font-size: 1.45rem;
    font-weight: 500;
    letter-spacing: -0.03em;
  }

  .model-main code {
    display: block;
    margin-top: calc(var(--token-spacing-unit) * 3);
    padding-top: calc(var(--token-spacing-unit) * 3);
    border-top: 1px solid var(--token-border-subtle);
    color: var(--token-ink-secondary);
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
  }

  .model-links {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .model-links article {
    min-height: 17rem;
    padding: calc(var(--token-spacing-unit) * 4);
  }

  .model-links header {
    color: var(--token-ink-muted);
    font-size: 0.75rem;
  }

  .model-links h3 {
    margin-top: calc(var(--token-spacing-unit) * 6);
    font-size: 0.86rem;
    font-weight: 550;
  }

  .model-links p {
    margin-top: calc(var(--token-spacing-unit) * 3);
    color: var(--token-ink-muted);
    font-size: 0.75rem;
    line-height: 1.55;
  }

  .kind-row {
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 1.5);
    margin-top: calc(var(--token-spacing-unit) * 4);
  }

  .kind-row span {
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 1.25) calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: 999px;
    color: var(--token-ink-secondary);
    font-size: 0.75rem;
  }

  .checks {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .checks article {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: calc(var(--token-spacing-unit) * 3);
    align-items: start;
    padding: calc(var(--token-spacing-unit) * 4);
    border: 1px solid var(--token-color-success-border);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
    color: var(--token-color-success-text);
  }

  .checks article.deferred {
    border-color: var(--token-color-intelligence-border);
    background: linear-gradient(135deg, var(--token-color-intelligence-surface), var(--token-surface-panel) 72%);
    color: var(--token-color-intelligence-text);
  }

  .checks span,
  .checks strong {
    display: block;
  }

  .checks span {
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .checks strong {
    margin-top: calc(var(--token-spacing-unit) * 1);
    color: var(--token-ink-primary);
    font-size: 0.8rem;
    font-weight: 550;
  }

  .checks p {
    margin-top: calc(var(--token-spacing-unit) * 1.5);
    color: var(--token-ink-muted);
    font-size: 0.75rem;
    line-height: 1.5;
  }

  .decisions {
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  .decisions article {
    display: grid;
    grid-template-columns: 2rem auto 1fr;
    gap: calc(var(--token-spacing-unit) * 3);
    align-items: start;
    padding: calc(var(--token-spacing-unit) * 4);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .decisions article:last-child {
    border-bottom: 0;
  }

  .decisions article > span {
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
  }

  .decisions article > :global(svg) {
    color: var(--token-color-attention-text);
  }

  .decisions h3 {
    font-size: 0.78rem;
    font-weight: 550;
  }

  .decision-priority {
    display: block;
    margin-top: calc(var(--token-spacing-unit) * 1);
    color: var(--token-color-attention-text);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .decisions dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: calc(var(--token-spacing-unit) * 3);
    margin-top: calc(var(--token-spacing-unit) * 1.5);
  }

  .decisions dt,
  .decisions dd {
    margin: 0;
  }

  .decisions dt {
    color: var(--token-ink-secondary);
    font-family: var(--token-font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .decisions dd {
    margin-top: calc(var(--token-spacing-unit) * 1);
    color: var(--token-ink-muted);
    font-size: 0.75rem;
    line-height: 1.55;
  }

  .handoff {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 3rem;
    align-items: center;
    margin-top: 6rem;
    padding: 2rem;
    border: 1px solid var(--token-color-active-border);
    border-radius: var(--token-radius-panel);
    background: var(--token-color-active-surface);
  }

  .handoff h2 {
    font-size: 1.8rem;
  }

  .handoff p {
    max-width: 48rem;
    margin-top: 0.65rem;
    color: var(--token-ink-secondary);
    font-size: 0.8rem;
    line-height: 1.55;
  }

  .handoff a {
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--token-color-active-border);
    border-radius: var(--token-radius-control);
    color: var(--token-color-active-text);
    font-size: 0.75rem;
  }

  footer {
    display: flex;
    justify-content: space-between;
    gap: 2rem;
    margin-top: 6rem;
    padding: 1.5rem 0 2rem;
    border-top: 1px solid var(--token-border-subtle);
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  @media (max-width: 76rem) {
    nav {
      display: none;
    }

    .hero {
      grid-template-columns: 1fr;
      gap: 2.5rem;
      padding-top: 4.5rem;
    }

    .branch-card {
      max-width: 36rem;
    }

    .lifecycle {
      grid-template-columns: 1fr;
    }

    .lifecycle li,
    .lifecycle li:last-child {
      grid-template-columns: 1fr;
    }

    .life-card {
      min-height: 0;
    }

    .life-arrow {
      justify-self: center;
      transform: rotate(90deg);
    }

    .model-map {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 58rem) {
    .model-links {
      grid-template-columns: 1fr;
    }

    .model-links article {
      min-height: 0;
    }

    .checks {
      grid-template-columns: 1fr;
    }

    .decisions dl {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 43rem) {
    .topbar {
      padding: 0 1rem;
    }

    .wordmark .muted {
      display: none;
    }

    main,
    footer {
      width: min(100% - 2rem, 84rem);
    }

    .hero {
      padding-top: 3.5rem;
    }

    h1 {
      font-size: clamp(2.9rem, 15vw, 4.2rem);
    }

    .status-line {
      grid-template-columns: auto 1fr;
    }

    .status-line a {
      grid-column: 2;
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

    .handoff {
      grid-template-columns: 1fr;
      padding: 1.3rem;
    }

    footer {
      flex-direction: column;
    }
  }
</style>
