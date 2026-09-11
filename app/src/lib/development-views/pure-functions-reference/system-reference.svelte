<script lang="ts">
  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceFrame from "$development-views/pure-functions-reference/components/reference-frame.svelte";
  import {
    CAPABILITY_FILES,
    CHECKERS,
    COMPONENT_FILES,
    MODEL_FILES
  } from "$development-views/pure-functions-reference/data/system";

  const dependencyDiagram = `flowchart LR
    E[Browser event or remote request] --> R[Runtime boundary]
    R -->|owned data + narrow ports| I[Pure island]
    I -->|named calls| P[Explicit port]
    P --> R
    R --> M[Model adapter]
    M --> S[(Singleton state)]
    M --> O[Free model operation]
    O --> S

    classDef boundary fill:#2d2925,stroke:#b77b55,color:#fff
    classDef pure fill:#eff4ec,stroke:#4e7b5d,color:#172019
    classDef state fill:#eee8df,stroke:#8c7761,color:#211d18
    class R,M,P boundary
    class I,O pure
    class S state`;

  const invocationDiagram = `sequenceDiagram
    autonumber
    participant C as Client
    participant G as Remote gateway
    participant A as Authority resolver
    participant V as Invocation runner
    participant M as Model adapters
    participant T as Transformer
    participant P as Pure capability
    C->>G: caller input + route target
    G->>A: authenticate + resolve scope
    A-->>G: immutable scope grant
    G->>G: capability-local admission
    G->>V: registry entry + grant + admitted input
    V->>M: acquire declared subset
    M-->>V: fresh frozen ports
    V->>T: context + exact acquired subset
    T-->>V: local context + local ports
    V->>P: context, ports, input
    P-->>V: data-only result
    V->>M: commit successful work
    V->>M: release in reverse order (finally)
    V-->>G: encoded result
    G-->>C: remote result`;

  const lifecycleDiagram = `stateDiagram-v2
    [*] --> Open: acquire()
    Open --> Open: operation
    Open --> Open: commit() / fresh epoch
    Open --> Failed: operation or commit fault
    Open --> Released: release()
    Failed --> Released: release()
    Released --> Released: defensive second release
    Released --> Refused: operation / commit
    Refused --> [*]
    note right of Open
      A distinct frozen facade
      per successful acquisition
    end note`;
</script>

<svelte:head>
  <title>Pure islands system contract · Icarus</title>
  <meta
    name="description"
    content="The complete Icarus pure-islands architecture contract and its sixteen static enforcement layers."
  />
</svelte:head>

<ReferenceFrame page="system">
  <main class="pf-page">
    <header class="pf-hero">
      <div>
        <span class="pf-eyebrow">System contract · enforcement map</span>
        <h1>Authority enters through <em>one edge.</em></h1>
        <p class="pf-lede">
          Capabilities, model operations, and component procedures become closed pure islands.
          Runtime creates state, binds authority, translates interfaces, and owns every acquire,
          commit, release, and remote crossing.
        </p>
        <div class="pf-status-row">
          <span class="pf-status">16 checkers implemented</span>
          <span class="pf-status">mutation proofs passing at checker handoff</span>
          <span class="pf-status migration">product migration in progress</span>
        </div>
      </div>
      <dl class="pf-hero-aside">
        <div><dt>Normative contract</dt><dd>21 settled decisions</dd></div>
        <div><dt>Pure regions</dt><dd>3 island families</dd></div>
        <div><dt>Model lifetime</dt><dd>acquire · commit · release</dd></div>
        <div><dt>First completed slice</dt><dd>client/configuration</dd></div>
      </dl>
    </header>

    <section class="pf-section" id="meaning">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">01 · Meaning</span>
        <h2>Pure means no hidden authority</h2>
        <p>The contract is stricter than “easy to unit test,” and more practical than mathematical immutability.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-section-copy">
          <p>
            An authority-pure function receives every state value and every effectful capability
            explicitly. It may read or mutate an explicit state parameter and may call mutating
            members on an explicit port. It may not discover a singleton, clock, random source,
            framework context, I/O implementation, or model adapter.
          </p>
        </div>
        <div class="pf-grid-3">
          <article class="pf-card pf-card-accent">
            <span class="pf-mini-label">Capability island</span>
            <h3>Local vocabulary</h3>
            <p>Every type and function stays below one capability directory. Runtime translates external models into its exact context and ports.</p>
          </article>
          <article class="pf-card pf-card-accent">
            <span class="pf-mini-label">Model method island</span>
            <h3>State first</h3>
            <p>Stored fields live in <code>state.ts</code>. Derived behavior is a free call such as <code>getBody(runtime)</code>, never an attached getter.</p>
          </article>
          <article class="pf-card pf-card-accent">
            <span class="pf-mini-label">Procedure island</span>
            <h3>Effects outside</h3>
            <p>Owner-local procedures make decisions. Adapters transform ports and effects bind browser or framework lifecycle outside the island.</p>
          </article>
        </div>
        <div class="pf-diagram">
          <MermaidDiagram
            source={dependencyDiagram}
            label="Pure island dependency flow"
            caption="Only runtime crosses from ambient authority into an island. The island can act through a supplied port but cannot acquire one."
            minHeight="25rem"
          />
        </div>
      </div>
    </section>

    <section class="pf-section" id="boundaries">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">02 · Boundaries</span>
        <h2>What may cross</h2>
        <p>Exact data and narrow callable ports cross. Broad bags, live state, and lifecycle authority do not.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-grid-2">
          <article class="pf-card">
            <span class="pf-mini-label">Data-only</span>
            <h3>Owned finite values</h3>
            <p>Primitives, null, exact plain records, readonly arrays, and explicitly reviewed copied containers. No callbacks, accessors, promises, streams, subscriptions, controllers, or infrastructure handles.</p>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">Ports</span>
            <h3>Opaque named calls</h3>
            <p>Only statically declared members may be called. Enumeration, descriptor/prototype inspection, reflective dispatch, <code>call</code>, <code>apply</code>, <code>bind</code>, spreads, and computed service names are forbidden.</p>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">Imports</span>
            <h3>Owner closure</h3>
            <p>Capabilities import only themselves. Model methods import their own methods, state, and local pure types. Component procedures import their own procedures and declared owner-local pure types.</p>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">Async</span>
            <h3>Structured lifetime</h3>
            <p>Every promise comes from an explicit port or local pure function and is awaited or returned through the current chain. No timers, floating promises, detached callbacks, generators, or background streams.</p>
          </article>
        </div>
        <aside class="pf-callout">
          <h3>The critical distinction</h3>
          <p><strong>Mutating through an explicit port is allowed.</strong> The impurity is not “a write occurred”; it is “the function secretly found the authority to perform one.” Runtime supplies that authority and owns its lifetime.</p>
        </aside>
      </div>
    </section>

    <section class="pf-section" id="filesystem">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">03 · Filesystem</span>
        <h2>The target shape</h2>
        <p>The directory graph makes ownership reviewable before reading implementation details.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-architecture-grid">
          <article class="pf-card">
            <span class="pf-mini-label">Model</span>
            <h3>State + operations + port</h3>
            <div class="pf-table-wrap">
              <table class="pf-table"><tbody>{#each MODEL_FILES as row (row[0])}<tr><td>{row[0]}</td><td>{row[1]}</td></tr>{/each}</tbody></table>
            </div>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">Capability</span>
            <h3>Self-contained domain unit</h3>
            <div class="pf-table-wrap">
              <table class="pf-table"><tbody>{#each CAPABILITY_FILES as row (row[0])}<tr><td>{row[0]}</td><td>{row[1]}</td></tr>{/each}</tbody></table>
            </div>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">Component owner</span>
            <h3>Decision separate from binding</h3>
            <div class="pf-table-wrap">
              <table class="pf-table"><tbody>{#each COMPONENT_FILES as row (row[0])}<tr><td>{row[0]}</td><td>{row[1]}</td></tr>{/each}</tbody></table>
            </div>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">Runtime</span>
            <h3>Composition and crossings</h3>
            <pre class="pf-tree">runtime/
├── client/models/{`{build.ts, types.ts}`}
├── client/procedures/invoke.ts
├── server/models/
├── server/authority/
├── server/capabilities/
│   ├── gateway.server.ts
│   ├── invoke.server.ts
│   ├── registry.server.ts
│   └── adapters/
└── remote/capabilities.remote.ts</pre>
          </article>
        </div>
      </div>
    </section>

    <section class="pf-section" id="model-lifecycle">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">04 · Model lifetime</span>
        <h2>Adapter outside, port inside</h2>
        <p>The outer adapter never reaches domain code. A fresh acquired facade is the only callable surface a consumer receives.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-grid-2">
          <article class="pf-card">
            <span class="pf-mini-label">Outer adapter · runtime only</span>
            <h3><code>lifetime</code> + <code>commitMode</code></h3>
            <p>Exposes <code>acquire()</code>, <code>release()</code>, and optionally process <code>close()</code>. It may close over one singleton state and explicitly supplied infrastructure.</p>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">Acquired model port · per use</span>
            <h3>Operations + <code>commit()</code></h3>
            <p>A newly allocated frozen facade with exact enumerable own members. It contains no state, adapter, acquire, release, close, symbol, accessor, or inherited custom authority.</p>
          </article>
        </div>
        <div class="pf-diagram">
          <MermaidDiagram
            source={lifecycleDiagram}
            label="Acquired model port state machine"
            caption="Release never commits. Staged models publish only through commit; read-only and immediate models document their commit no-op or checkpoint semantics."
            minHeight="28rem"
          />
        </div>
        <div class="pf-table-wrap">
          <table class="pf-table">
            <thead><tr><th>Mode</th><th>Operation</th><th>commit()</th><th>release()</th></tr></thead>
            <tbody>
              <tr><td>staged</td><td>Mutates lease-owned stage</td><td>Atomically publishes the epoch; starts a fresh one</td><td>Discards the open epoch</td></tr>
              <tr><td>immediate</td><td>May perform explicit irreversible I/O</td><td>Checkpoint or documented no-op</td><td>Releases resources; does not promise rollback</td></tr>
              <tr><td>read-only</td><td>Contains no mutation operations</td><td>No-op while the lease is open</td><td>Invalidates and releases the lease</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="pf-section" id="gateway">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">05 · Capability runtime</span>
        <h2>One authenticated crossing</h2>
        <p>Authentication, admission, transformation, work, commit, and release are separate named responsibilities.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-diagram">
          <MermaidDiagram
            source={invocationDiagram}
            label="Remote capability invocation sequence"
            caption="Caller input can name a target but never proves identity, membership, scope, or resource ownership."
            minHeight="38rem"
          />
        </div>
        <div class="pf-steps">
          <article class="pf-step"><div><strong>Gateway establishes authority</strong><p>Authenticates the principal, resolves an immutable server-derived scope grant, and never trusts caller identity fields.</p></div></article>
          <article class="pf-step"><div><strong>Admission establishes data</strong><p>The capability-local validator copies raw transport into exact owned input and rejects prototypes, accessors, symbols, hidden or unexpected members.</p></div></article>
          <article class="pf-step"><div><strong>Registry establishes dependencies</strong><p>One static record names the operation, model subset, transformer, commit policy, admission, entry, and remote exposure.</p></div></article>
          <article class="pf-step"><div><strong>Runner establishes lifetime</strong><p>Acquires each declared model at most once, commits only successful work, and releases every acquisition in reverse order in <code>finally</code>.</p></div></article>
        </div>
      </div>
    </section>

    <section class="pf-section" id="checkers">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">06 · Enforcement</span>
        <h2>Sixteen independent proofs</h2>
        <p>No checker suppression and no new baseline debt. Each checker also has an adversarial one-file mutation that must be rejected.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-table-wrap">
          <table class="pf-table">
            <thead><tr><th>ID</th><th>Checker</th><th>Guarantee</th><th>How it proves it</th></tr></thead>
            <tbody>
              {#each CHECKERS as checker (checker.id)}
                <tr>
                  <td>{checker.id}<br /><span class="pf-area">{checker.area}</span></td>
                  <td><code>{checker.checker}</code></td>
                  <td>{checker.guarantee}</td>
                  <td>{checker.proof}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <aside class="pf-callout">
          <h3>Static proof has an explicit edge</h3>
          <p>The checkers can prove filesystem, syntax, symbol, dependency, signature, manifest, and visible lifecycle structure. Runtime tests still own concurrency, isolation, rollback, recovery, exact fault precedence, and real authorization race behavior.</p>
        </aside>
      </div>
    </section>

    <section class="pf-section" id="implementation">
      <header class="pf-section-head sticky">
        <span class="pf-kicker">07 · Implementation inventory</span>
        <h2>What exists today</h2>
        <p>The checker layer is complete; the product is being migrated one vertical slice at a time.</p>
      </header>
      <div class="pf-section-body">
        <div class="pf-metric-grid">
          <article class="pf-metric"><strong>16</strong><span>new no-baseline checker contracts</span></article>
          <article class="pf-metric"><strong>3</strong><span>filesystem-derived island families</span></article>
          <article class="pf-metric"><strong>1</strong><span>model migrated end to end</span></article>
        </div>
        <div class="pf-grid-2">
          <article class="pf-card">
            <span class="pf-mini-label">Shared analysis foundation</span>
            <h3>Resolver + AST + graph</h3>
            <p><code>scripts/lint/shared/pure-islands.mjs</code>, <code>pure-island-graph.mjs</code>, <code>pure-contract.mjs</code>, <code>typescript-program.mjs</code>, and <code>capability-registry.mjs</code> give the checks one view of ownership and symbols.</p>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">Adversarial evidence</span>
            <h3>Mutation suite</h3>
            <p><code>scripts/test/mutations/pure-functions.mjs</code> attempts package escape, globals, attached methods, lifecycle leaks, broad contracts, registry drift, release omissions, effect smuggling, and generator regression.</p>
          </article>
          <article class="pf-card">
            <span class="pf-mini-label">Positive language evidence</span>
            <h3>Legal constructs stay legal</h3>
            <p>The checker tests retain reviewed deterministic intrinsics, explicit state mutation, explicit mutating ports, structured awaits, copied data, and closed local command types.</p>
          </article>
          <article class="pf-card pf-card-accent">
            <span class="pf-mini-label">Current vertical slice</span>
            <h3>Client configuration</h3>
            <p>Field-only state, closed numeric input/key types, two pure functions, exact read-only leases, runtime-only construction, and server-side transport admission are implemented and documented on the companion page.</p>
            <div class="pf-pill-row"><a class="pf-pill" href="/demo/pure-functions/configuration">Open converted model</a></div>
          </article>
        </div>
      </div>
    </section>
  </main>
</ReferenceFrame>
