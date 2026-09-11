<script lang="ts">
  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import CodeFile from "$development-views/pure-functions-reference/components/code-file.svelte";
  import ReferenceFrame from "$development-views/pure-functions-reference/components/reference-frame.svelte";
  import { configurationModelSources } from "$development-views/pure-functions-reference/data/model-sources";

  let { serverAdmissionSource }: { serverAdmissionSource: string } = $props();

  const MODEL_SOURCES = $derived(configurationModelSources(serverAdmissionSource));

  const structureDiagram = `flowchart TD
    L[+layout.server.ts<br/>exact numeric admission] --> I[ClientConfigurationInput]
    I --> C[createConfigurationState]
    C --> S[(ConfigurationState<br/>13 primitive fields)]
    S --> B[bindConfiguration]
    B --> A[ConfigurationAdapter<br/>runtime only]
    A -->|acquire undefined| P[AcquiredConfigurationPort<br/>getNumber + commit]
    P --> G[getNumber state key]
    G --> Q[selectNumber state key]
    Q --> S
    P -->|release port| A

    classDef runtime fill:#2d2925,stroke:#b77b55,color:#fff
    classDef pure fill:#eff4ec,stroke:#4e7b5d,color:#172019
    classDef state fill:#eee8df,stroke:#8c7761,color:#211d18
    class L,C,B,A runtime
    class G,Q pure
    class S,I state`;

  const callDiagram = `flowchart LR
    C[consumer] -->|getNumber key| W[lease wrapper]
    W -->|guard released| G[getNumber]
    G --> S[selectNumber]
    S -->|direct field read| D[(ConfigurationState)]
    W -. one and only one method call .-> G
    classDef boundary fill:#2d2925,stroke:#b77b55,color:#fff
    classDef pure fill:#eff4ec,stroke:#4e7b5d,color:#172019
    class W boundary
    class G,S pure`;

  const constructionDiagram = `sequenceDiagram
    autonumber
    participant Route as Server layout
    participant Build as runtime/models/build.ts
    participant Adapter as Configuration adapter
    participant Port as Acquired port
    participant Graph as Downstream models
    Route-->>Build: exact ClientConfigurationInput
    Build->>Build: createConfigurationState once
    Build->>Adapter: bindConfiguration once
    Build->>Adapter: acquire(undefined)
    Adapter-->>Build: fresh frozen Port
    Build->>Port: getNumber x 13
    Build->>Graph: revision thresholds
    Build->>Graph: presentation stage settings
    Build->>Graph: workspace thresholds
    Build->>Port: commit() read-only no-op
    Build->>Adapter: release(Port) in finally
    Note over Build,Adapter: Adapter stays captured by ClientModel.close
    Build-->>Graph: complete ClientModel
    Graph->>Adapter: close() at workspace teardown`;

  const mappings = [
    ["presentation.gutter.maximumRem", "gutterMaximumRem", "Presentation stage"],
    ["presentation.gutter.minimumRem", "gutterMinimumRem", "Presentation stage"],
    ["presentation.stage.averageGlyphWidthEm", "stageAverageGlyphWidthEm", "Presentation stage"],
    ["presentation.stage.unitsHigh", "stageUnitsHigh", "Presentation stage"],
    ["presentation.stage.widthRem", "stageWidthRem", "Presentation stage"],
    ["presentation.zoom.maximum", "zoomMaximum", "Presentation stage"],
    ["presentation.zoom.minimum", "zoomMinimum", "Presentation stage"],
    ["presentation.zoom.step", "zoomStep", "Presentation stage"],
    ["revisions.changeSets.flushAfterMs", "revisionFlushAfterMs", "Document · presentation · spreadsheet"],
    ["revisions.changeSets.flushAfterOps", "revisionFlushAfterOps", "Document · presentation · spreadsheet"],
    ["revisions.sync.everyMs", "revisionSyncEveryMs", "Document · presentation · spreadsheet"],
    ["workspace.changeSets.flushAfterMs", "workspaceFlushAfterMs", "Workspace"],
    ["workspace.changeSets.flushAfterOps", "workspaceFlushAfterOps", "Workspace"]
  ] as const;

  const runtimeWalk = [
    ["build.ts · 22", "Construct", "Copies the admitted transport into one ConfigurationState. This is the only production createConfigurationState call."],
    ["build.ts · 23–25", "Bind", "Builds the runtime-owned adapter collection and calls bindConfiguration exactly once."],
    ["build.ts · 26", "Acquire", "Requests one construction lease. Configuration has no identity or scope requirement, so its exact context is undefined."],
    ["build.ts · 29–47", "Translate", "Reads all 13 closed keys and constructs three exact downstream-owned setting records."],
    ["build.ts · 49–66", "Compose", "Builds the legacy client models with values, not a generic configuration object or foreign model interface."],
    ["build.ts · 68", "Commit", "Closes the successful read phase with the required commit call; read-only commit is intentionally a no-op."],
    ["build.ts · finally", "Release", "Releases the successful acquisition on return and every thrown construction path."],
    ["ClientModel.close", "Close", "Ends the adapter's client-workspace lifetime after dependent model cleanup and invalidates any unexpectedly open lease."]
  ] as const;
</script>

<svelte:head>
  <title>Configuration model · pure-islands reference · Icarus</title>
  <meta
    name="description"
    content="An end-to-end source reference for the migrated Icarus client configuration model."
  />
</svelte:head>

<ReferenceFrame page="configuration">
  <main class="pf-page">
    <header class="pf-hero">
      <div>
        <span class="pf-eyebrow">Converted model · client/configuration</span>
        <h1>One state. One port. <em>No object methods.</em></h1>
        <p class="pf-lede">
          Configuration is the first complete model slice. The server admits one exact transport,
          runtime constructs and binds its state, and consumers see a short-lived read-only port
          backed by two authority-pure free functions.
        </p>
        <div class="pf-status-row">
          <span class="pf-status">model checkers clean for this directory</span>
          <span class="pf-status">typecheck clean</span>
          <span class="pf-status">exact source embedded below</span>
        </div>
      </div>
      <dl class="pf-hero-aside">
        <div><dt>Lifetime</dt><dd>client-workspace</dd></div>
        <div><dt>Commit mode</dt><dd>read-only</dd></div>
        <div><dt>Stored fields</dt><dd>13 numbers</dd></div>
        <div><dt>Public operations</dt><dd>getNumber(key)</dd></div>
        <div><dt>State construction</dt><dd>runtime only · once</dd></div>
      </dl>
    </header>

    <section class="pf-section" id="overview">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">01 · Whole model</span>
        <h2>The complete path</h2>
        <p>Transport becomes owned state; runtime binding becomes a port; the port delegates to free functions.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-diagram">
          <MermaidDiagram
            source={structureDiagram}
            label="Configuration model structure"
            caption="The dark nodes are impure/runtime boundaries. The green nodes are the model's pure method island."
            minHeight="34rem"
          />
        </div>
        <div class="pf-grid-3">
          <article class="pf-card"><span class="pf-mini-label">Stored</span><h3>Flat primitives</h3><p>The nested transport is copied into 13 readonly numeric fields. No caller-owned object remains aliased to state.</p></article>
          <article class="pf-card"><span class="pf-mini-label">Callable</span><h3>Lease facade</h3><p><code>getNumber</code> and <code>commit</code> are the only acquired own members. Acquire, release, close, and raw state stay outside.</p></article>
          <article class="pf-card"><span class="pf-mini-label">Derived</span><h3>Free operations</h3><p>The call is <code>getNumber(state, key)</code>. There is no class, <code>this</code>, getter, setter, or behavior-bearing state object.</p></article>
        </div>
      </div>
    </section>

    <section class="pf-section" id="port">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">02 · Port first</span>
        <h2>What a consumer actually receives</h2>
        <p>The acquired port is intentionally smaller than the adapter that made it.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-table-wrap">
          <table class="pf-table">
            <thead><tr><th>Surface</th><th>Member</th><th>Meaning</th><th>Visible to</th></tr></thead>
            <tbody>
              <tr><td>ConfigurationAdapter</td><td><code>lifetime: "client-workspace"</code></td><td>State belongs to one client graph and ends with that graph.</td><td>Runtime only</td></tr>
              <tr><td>ConfigurationAdapter</td><td><code>commitMode: "read-only"</code></td><td>No operation mutates model state; commit is still present for uniform runners.</td><td>Runtime only</td></tr>
              <tr><td>ConfigurationAdapter</td><td><code>acquire(undefined)</code></td><td>Allocates a distinct lease record and frozen facade.</td><td>Runtime only</td></tr>
              <tr><td>ConfigurationAdapter</td><td><code>release(port)</code></td><td>Rejects foreign/forged ports, invalidates the matching lease, and is defensively idempotent.</td><td>Runtime only</td></tr>
              <tr><td>ConfigurationAdapter</td><td><code>close()</code></td><td>Ends the adapter lifetime, invalidates every open lease, and refuses later acquisition.</td><td>Runtime only</td></tr>
              <tr><td>AcquiredConfigurationPort</td><td><code>getNumber(key)</code></td><td>Checks this lease, then makes exactly one call to the named free model operation.</td><td>Translated runtime consumers</td></tr>
              <tr><td>AcquiredConfigurationPort</td><td><code>commit()</code></td><td>Checks this lease, then succeeds without publication because the model is read-only.</td><td>Runtime runner</td></tr>
            </tbody>
          </table>
        </div>
        <div class="pf-grid-2">
          <article class="pf-callout">
            <h3>Fresh means identity matters</h3>
            <p>Every acquire allocates a new object and lease. A <code>WeakMap</code> proves provenance without adding a hidden property. One release cannot revoke a sibling facade.</p>
          </article>
          <article class="pf-callout">
            <h3>Extraction does not bypass release</h3>
            <p>The closure itself checks its lease before delegating. Saving <code>const read = port.getNumber</code> does not create a callable that survives release or close.</p>
          </article>
        </div>
        <div class="pf-code-list">
          <CodeFile {...MODEL_SOURCES[0]} />
        </div>
      </div>
    </section>

    <section class="pf-section" id="state">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">03 · State and input</span>
        <h2>Stored fields only</h2>
        <p>The server and state constructor close two different boundaries: trustworthy shape, then owned storage.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-grid-2">
          <article class="pf-card">
            <span class="pf-mini-label">Transport boundary</span>
            <h3><code>ClientConfigurationInput</code></h3>
            <p>An exact nested type matching the literal server allowlist. Every one of the 13 values is required and numeric—there is no index signature, arbitrary record, <code>unknown</code>, optional key, or generic getter.</p>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">State boundary</span>
            <h3><code>ConfigurationState</code></h3>
            <p>A flat object containing only readonly numbers. Flattening ensures the constructor copies every leaf instead of retaining a nested object owned by SvelteKit load data.</p>
          </article>
        </div>
        <div class="pf-table-wrap">
          <table class="pf-table">
            <thead><tr><th>Closed key</th><th>Stored field</th><th>Translated for</th></tr></thead>
            <tbody>
              {#each mappings as mapping (mapping[0])}
                <tr><td>{mapping[0]}</td><td><code>{mapping[1]}</code></td><td>{mapping[2]}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="pf-code-list">
          <CodeFile {...MODEL_SOURCES[1]} />
          <CodeFile {...MODEL_SOURCES[2]} />
        </div>
      </div>
    </section>

    <section class="pf-section" id="methods">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">04 · Pure call tree</span>
        <h2>Every function underneath the method</h2>
        <p>There are exactly two production functions in the island, and both receive state explicitly.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-diagram">
          <MermaidDiagram
            source={callDiagram}
            label="Configuration getNumber call tree"
            caption="The port guard is boundary lifecycle logic. The named model decision begins at getNumber and stays inside the model directory."
            minHeight="22rem"
          />
        </div>
        <div class="pf-table-wrap">
          <table class="pf-table">
            <thead><tr><th>Function</th><th>Signature</th><th>Responsibility</th><th>Effects</th></tr></thead>
            <tbody>
              <tr><td>getNumber</td><td><code>(state, key) → number</code></td><td>Public method entry. Establishes the call-tree name and delegates to the supporting selector.</td><td>None</td></tr>
              <tr><td>selectNumber</td><td><code>(state, key) → number</code></td><td>Exhaustive closed-key decision. Reads one stored field or refuses an impossible untyped key.</td><td>None</td></tr>
            </tbody>
          </table>
        </div>
        <div class="pf-code-list">
          <CodeFile {...MODEL_SOURCES[3]} />
          <CodeFile {...MODEL_SOURCES[4]} />
          <CodeFile {...MODEL_SOURCES[5]} />
        </div>
      </div>
    </section>

    <section class="pf-section" id="runtime">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">05 · Runtime binding</span>
        <h2>Where it is created and transformed</h2>
        <p>No product component or sibling model creates configuration state or receives the outer adapter.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-diagram">
          <MermaidDiagram
            source={constructionDiagram}
            label="Configuration runtime construction sequence"
            caption="The one read lease is bounded by try/finally. Downstream models receive their own setting records, not ConfigurationState or ConfigurationAdapter."
            minHeight="39rem"
          />
        </div>
        <div class="pf-steps">
          {#each runtimeWalk as step (step[0])}
            <article class="pf-step">
              <div><strong>{step[1]} <code>{step[0]}</code></strong><p>{step[2]}</p></div>
            </article>
          {/each}
        </div>
        <aside class="pf-callout">
          <h3>The configuration model is not passed downstream</h3>
          <p>Document, presentation, spreadsheet, and workspace constructors now accept their own threshold/stage types. This makes the runtime builder the translation boundary and removes their imports of configuration entirely.</p>
        </aside>
        <div class="pf-code-list">
          <CodeFile {...MODEL_SOURCES[6]} />
          <CodeFile {...MODEL_SOURCES[7]} />
          <CodeFile {...MODEL_SOURCES[8]} />
        </div>
      </div>
    </section>

    <section class="pf-section" id="admission">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">06 · Before runtime</span>
        <h2>The server admits the exact payload</h2>
        <p>Secrets stay out by construction, and configuration defects fail before browser serialization.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-grid-2">
          <article class="pf-card">
            <span class="pf-mini-label">Allowlist</span>
            <h3>A literal output object</h3>
            <p>The route names every published leaf. It cannot accidentally serialize development tokens, provider keys, observability settings, or a new YAML sibling.</p>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">Admission</span>
            <h3>Finite numbers required</h3>
            <p>Missing, string, NaN, and infinite values throw on the server. The client no longer receives an open <code>Record&lt;string, unknown&gt;</code> and asks each consumer to validate independently.</p>
          </article>
        </div>
        <div class="pf-code-list">
          <CodeFile {...MODEL_SOURCES[9]} />
        </div>
      </div>
    </section>

    <section class="pf-section" id="guarantees">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">07 · Evidence</span>
        <h2>What is mechanically guaranteed</h2>
        <p>Static structure and executable lifecycle behavior cover different failure classes.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-guarantee-grid">
          <article class="pf-card"><span class="pf-mini-label">PF-04</span><h3>Field-only state</h3><p>One <code>state.ts</code>, one literal <code>createConfigurationState</code>, no definition class, callable field, getter, setter, proxy, prototype, or hidden property.</p></article>
          <article class="pf-card"><span class="pf-mini-label">PF-05</span><h3>Free operations</h3><p>Every exported method function is free; any state parameter is first; no method imports the port, constructor, index, runtime, another model, or lifecycle surface.</p></article>
          <article class="pf-card"><span class="pf-mini-label">PF-06</span><h3>Exact leases</h3><p>One binding, local imports only, literal adapter metadata, fresh frozen acquired facade, commit present, lifecycle absent, and one-call wrappers around named free methods.</p></article>
          <article class="pf-card"><span class="pf-mini-label">PF-07</span><h3>Runtime-only creation</h3><p>TypeScript symbol analysis finds exactly one production state-constructor call and one binding call, both in <code>runtime/client/models/build.ts</code>.</p></article>
          <article class="pf-card"><span class="pf-mini-label">Unit behavior</span><h3>Lease isolation</h3><p>Tests cover exact keys, owned-state copying, fresh facade identity, frozen shape, read-only commit, extracted calls after release, sibling isolation, idempotent release, forgery, foreign adapters, and close.</p></article>
          <article class="pf-card"><span class="pf-mini-label">Runtime behavior</span><h3>Translation and teardown</h3><p>The builder acquires in one try/finally, commits only after construction, releases on every path, and retains adapter lifetime through <code>ClientModel.close()</code>.</p></article>
        </div>
        <aside class="pf-callout">
          <h3>Deliberate limit</h3>
          <p>This model is immutable and read-only, so it does not yet prove staged-write isolation, conflict handling, atomic publication, or durable recovery. A staged model must be a later vertical slice with focused concurrency and fault tests.</p>
        </aside>
      </div>
    </section>

    <section class="pf-section" id="source">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">08 · Complete source</span>
        <h2>Every file in one place</h2>
        <p>These panes are populated from the actual worktree via Vite raw-source modules; they are not hand-copied examples.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-code-list">
          {#each MODEL_SOURCES as file (file.path)}
            <CodeFile {...file} open={false} />
          {/each}
        </div>
      </div>
    </section>
  </main>
</ReferenceFrame>
