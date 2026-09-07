<script lang="ts">
  import { page } from "$app/state";

  import DiagramBinding from "$development-views/template-reference/components/diagram-binding.svelte";
  import DiagramBuilder from "$development-views/template-reference/components/diagram-builder.svelte";
  import DiagramDifference from "$development-views/template-reference/components/diagram-difference.svelte";
  import ReferenceHeader from "$development-views/template-reference/components/reference-header.svelte";
  import "$development-views/template-reference/components/reference.css";
  import { hrefOf } from "$development-views/template-reference/procedures/navigation";
  import {
    DOORS,
    FORKS,
    GAPS,
    KINDS,
    LIFECYCLE,
    REFUSALS,
    RULES,
    TERMS,
    WORK
  } from "$development-views/template-reference/procedures/scope";

  let {
    material,
    materials = [],
    onmaterial
  }: {
    material?: string;
    materials?: readonly string[];
    onmaterial?: (next: string) => void;
  } = $props();

  const project = $derived(page.params.project ?? "dev-project");

  const areas = $derived([...new Set(WORK.map((item) => item.area))]);
  const newFiles = $derived(WORK.filter((item) => item.status === "new").length);
  const changedFiles = $derived(WORK.length - newFiles);
</script>

<div class="tref">
  <ReferenceHeader current="scope" {material} {materials} {onmaterial} />

  <main class="tref-page">
    <header class="tref-mast">
      <div>
        <span class="tref-kicker">03 · Scope</span>
        <h1>What a variable selects</h1>
        <p class="tref-lede">
          A variable is a hole. What fills it is a group of resources, and until this work that group
          could only be said in the crudest terms: everything, or some kinds, or one of the project's
          named sets. It can now be built term by term, excluded from, and pointed at particular
          resources. This page is how it works and every file it touched.
        </p>
      </div>
      <div class="tref-facts">
        <dl>
          <div><dt>Stored as</dt><dd>A rule, never members</dd></div>
          <div><dt>Named</dt><dd>Only when a person names it</dd></div>
          <div><dt>Built by</dt><dd>One modal, four doors</dd></div>
          <div><dt>Written by</dt><dd>The server, from a rule</dd></div>
          <div><dt>Representation</dt><dd>One optional field, one new one</dd></div>
        </dl>
      </div>
    </header>

    <nav class="tref-jumps" aria-label="On this page">
      <a href="#parameters">Two kinds of parameter</a>
      <a href="#why">Why a row at all</a>
      <a href="#terms">Every term</a>
      <a href="#difference">A set is a difference</a>
      <a href="#anonymous">Named, or bound</a>
      <a href="#builder">The builder</a>
      <a href="#doors">Where it opens</a>
      <a href="#lifecycle">What gets written</a>
      <a href="#rules">Rules and refusals</a>
      <a href="#work">Every file it touched</a>
      <a href="#forks">Eight decisions</a>
      <a href="#missing">What is still missing</a>
    </nav>

    <section class="tref-section" id="parameters">
      <div class="tref-section-head">
        <div><span class="tref-kicker">What a template asks for</span><h2>Two kinds of parameter</h2></div>
        <p>
          A template is a function and these are its parameters. Both are found from the body rather
          than authored, both are declared in one list, and both carry a name, a label and a
          description written by whoever made the template.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead>
            <tr><th>Found because</th><th>Kind</th><th>Answered with</th><th>When</th><th>What happens</th></tr>
          </thead>
          <tbody>
            {#each KINDS as kind (kind.opens)}
              <tr>
                <td>{kind.where}</td>
                <td><code>{kind.opens}</code></td>
                <td>{kind.title}</td>
                <td class="muted">{kind.confirms}</td>
                <td class="muted">{kind.writes}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tref-note attention">
        <h4>A template's parameter is not a variable</h4>
        <p>
          A variable in this application is a named value a formula reads, and it has nothing to do
          with templates. So the atom that holds a hole in a template's prose is a
          <code>template</code> atom, not a variable atom, and it appears nowhere outside a template
          body and the copy that template is edited through. The word is worth guarding: two
          unrelated ideas sharing it is how a vocabulary stops being one.
        </p>
      </div>
    </section>

    <section class="tref-section" id="why">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The load-bearing fact</span><h2>Why a row, and not a bigger rule</h2></div>
        <p>
          The obvious move is to let a variable's default hold a richer rule inline. It does not work, and
          the reason is already in the code rather than in anyone's opinion.
        </p>
      </div>

      <p class="tref-prose">
        Resolving a template substitutes each variable term for what fills it. A variable term can appear
        on either side of a prompt's scope: a prompt may say <em>these, and not those</em>. Substituting
        one term for one term works on both sides. Substituting one term for
        <em>a difference</em> does not, because a difference on the exclude side is not expressible as a
        flat difference. So the resolver refuses it, in as many words:
        <code>a variable answered with exclusions cannot be flattened without changing scope</code>.
      </p>

      <div class="tref-note">
        <h4>Which meant, before this, no exclusions anywhere</h4>
        <p>
          Neither a variable's default nor an answer given at Insert could exclude anything. A builder
          mostly about excluding things would have refused on its first use.
        </p>
        <p>
          A stored row fixes it exactly. The difference lives <b>inside</b> the row; the default and the
          answer hold <b>one</b> term naming it; substitution stays one-for-one and flips sides cleanly.
          The row is not bookkeeping. It is what makes the feature expressible, and the resolver's refusal
          is left exactly where it was, now unreachable from either door.
        </p>
      </div>

      <p class="tref-prose">
        The second reason is narrower and just as firm. A template's scope vocabulary has no way to name a
        particular resource — <code>resources</code> is in the concrete term union and not in the templated
        one. <b>Pick these three findings</b> is unsayable in a template and sayable in a row. The
        indirection is the only path from one to the other.
      </p>
    </section>

    <section class="tref-section" id="terms">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The vocabulary, unchanged</span><h2>Every term a scope can hold</h2></div>
        <p>
          Five terms, and where each is allowed. Nothing in this column set moves; what changes is which of
          them the product can actually produce.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead>
            <tr>
              <th>select</th>
              <th>Reads as</th>
              <th>Picks</th>
              <th>In a template body</th>
              <th>In a variable's default</th>
              <th>In a live resource</th>
            </tr>
          </thead>
          <tbody>
            {#each TERMS as term (term.select)}
              <tr>
                <td><code>{term.select}</code></td>
                <td>{term.reads}</td>
                <td class="muted">{term.picks}</td>
                <td>{term.inABody}</td>
                <td>{term.inADefault}</td>
                <td>{term.inALiveResource}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="tref-section" id="difference">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The arithmetic</span><h2>Every set is a difference</h2></div>
        <p>
          Two flat lists of terms. The included ones are unioned, the excluded ones are unioned, and the
          answer is the first minus the second, computed when the set is read.
        </p>
      </div>

      <figure class="tref-figure">
        <DiagramDifference />
        <figcaption>
          <b>Nothing here is new.</b> This is what <code>resolveResourceSet</code> already did, cycle guard
          and all. What was missing was any surface that could build the left-hand side.
        </figcaption>
      </figure>
    </section>

    <section class="tref-section" id="anonymous">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The change of stance</span><h2>Named, or bound</h2></div>
        <p>
          A set stopped being a thing people curate and became a value a variable holds. Both still exist,
          and the only difference between them is whether a person gave it a name.
        </p>
      </div>

      <figure class="tref-figure">
        <DiagramBinding />
        <figcaption>
          <b>Two rows in one table.</b> A named row is a project subject: listed, offerable, and protected
          from deletion while anything names it. A bound row is invisible, owned, and deleted with its
          owner.
        </figcaption>
      </figure>

      <p class="tref-prose">
        The stance matters because the alternative is worse in a specific way. If every chosen scope had to
        be named, the Contexts panel would fill with rows called <em>Source material for Readiness brief</em>,
        each used once, each impossible to delete without reading a refusal, and each offered to the next
        person who opens a builder. Anonymity is not a shortcut; it is what keeps the named list worth
        reading.
      </p>
    </section>

    <section class="tref-section" id="builder">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The thing itself</span><h2>The builder</h2></div>
        <p>
          One modal. It edits a rule and knows nothing about templates, variables, or which of its four
          callers opened it. The mock below is what shipped, drawn rather than screenshotted so it stays
          readable at any width.
        </p>
      </div>

      <figure class="tref-figure">
        <DiagramBuilder />
        <figcaption>
          <b>Two modals, and never a third.</b> The ask lists every parameter and holds Insert while any
          words are missing; a value opens the builder, which is two tabs and, inside one, two panes.
        </figcaption>
      </figure>
    </section>

    <section class="tref-section" id="doors">
      <div class="tref-section-head">
        <div><span class="tref-kicker">One modal, four callers</span><h2>Where it opens</h2></div>
        <p>
          Two doors set a default, two give an answer, and the fifth is the Contexts panel, which is the
          same modal with a name field above it.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead>
            <tr><th>Where</th><th>Control</th><th>Title</th><th>Confirms</th><th>What it writes</th></tr>
          </thead>
          <tbody>
            {#each DOORS as door (door.where)}
              <tr>
                <td>{door.where}</td>
                <td><code>{door.opens}</code></td>
                <td class="muted">{door.title}</td>
                <td>{door.confirms}</td>
                <td class="muted">{door.writes}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="tref-section" id="lifecycle">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Step by step</span><h2>What gets written, and when</h2></div>
        <p>
          Nothing is written until the call that was going to be made anyway. The builder itself never
          talks to the server.
        </p>
      </div>

      <div class="tref-lanes">
        <div class="head"></div>
        <div class="head">Person</div>
        <div class="head">Client</div>
        <div class="head">Capability</div>
        <div class="head">Rows afterwards</div>
        {#each LIFECYCLE as step (step.index)}
          <div class="step"><span>{step.index}</span><b>{step.title}</b></div>
          <div>{step.person}</div>
          <div>{step.client}</div>
          <div>{step.server}</div>
          <div class="rows">{step.rows}</div>
        {/each}
      </div>
    </section>

    <section class="tref-section" id="rules">
      <div class="tref-section-head">
        <div><span class="tref-kicker">What holds</span><h2>Rules, and what gets refused</h2></div>
        <p>Eight rules. Most are already true; the ones about naming and ownership are the new ones.</p>
      </div>

      <div class="tref-cards">
        {#each RULES as rule (rule.rule)}
          <article class="tref-card">
            <h3>{rule.rule}</h3>
            <p>{rule.because}</p>
          </article>
        {/each}
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th>When</th><th>The answer</th><th>Where</th></tr></thead>
          <tbody>
            {#each REFUSALS as row (row.when)}
              <tr><td>{row.when}</td><td><code>{row.answer}</code></td><td class="muted">{row.where}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="tref-section" id="work">
      <div class="tref-section-head">
        <div><span class="tref-kicker">What it cost</span><h2>Every file it touched</h2></div>
        <p>
          {WORK.length} entries across {areas.length} areas: {newFiles} new and {changedFiles} changed. Paths
          are relative to <code>app/src/lib</code> unless they say otherwise. A trailing slash is a
          procedure folder, which is a file, its validator and its tests.
        </p>
      </div>

      {#each areas as area (area)}
        <div class="group">
          <h3 class="group-head">{area}</h3>
          <div class="tref-scroll">
            <table class="tref-table">
              <thead><tr><th>Path</th><th>Status</th><th>What changes</th></tr></thead>
              <tbody>
                {#each WORK.filter((item) => item.area === area) as item (item.path)}
                  <tr>
                    <td><code>{item.path}</code></td>
                    <td><span class="tref-badge {item.status === 'new' ? 'new' : 'changed'}">{item.status}</span></td>
                    <td class="muted">{item.work}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}

      <div class="tref-note success">
        <h4>Three files that do not change, and that is the design working</h4>
        <p>
          <code>data/behavior/templates/scopes.ts</code> keeps refusing a difference, and the row is what
          keeps it from ever seeing one. <code>data/behavior/templates/portable.ts</code> keeps stripping
          set and resource terms out of a body, because a template is still a function rather than a value.
          <code>data/types/content/content-block.ts</code> already types a prompt's scope as either a
          concrete or a templated set, so a body needs no new shape.
        </p>
      </div>
    </section>

    <section class="tref-section" id="forks">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Settled</span><h2>Eight decisions, and how each landed</h2></div>
        <p>
          Each was open when this was a plan. Three of them landed somewhere other than where the plan
          expected, and those are the ones worth reading.
        </p>
      </div>

      {#each FORKS as fork (fork.index)}
        <article class="tref-change fork">
          <span>{fork.index}</span>
          <div>
            <h3>{fork.question}</h3>
            <p>{fork.because}</p>
          </div>
          <div class="state after"><span>Built</span>{fork.recommended}</div>
          <div class="state before"><span>Otherwise</span>{fork.alternative}<em>{fork.cost}</em></div>
        </article>
      {/each}
    </section>

    <section class="tref-section" id="missing">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The order of things</span><h2>What is still missing</h2></div>
        <p>
          The plan is derived outputs and prompt blocks onto main, then this. That order is right, and
          these are the pieces each one has to bring for templates to work end to end.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th>Missing</th><th>What it is</th><th>When</th></tr></thead>
          <tbody>
            {#each GAPS as gap (gap.title)}
              <tr><td>{gap.title}</td><td class="muted">{gap.detail}</td><td>{gap.order}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tref-note attention">
        <h4>One thing the sequence assumes that is not obviously true</h4>
        <p>
          Variables are found from prompt scopes. Until prompt blocks exist, the only way a variable comes
          into being is by inserting a template that already has one, which means a template made on main
          from a fresh document will have no variables and the builder will have nothing to open on. The
          order still works, but this piece has to land <b>with</b> prompt blocks rather than after them,
          or the first thing anyone sees is an empty Variables band.
        </p>
      </div>
    </section>
  </main>

  <footer class="tref-footer">
    <div>
      <span>Icarus · templates</span>
      <span>work/template-features</span>
    </div>
    <div>
      <a href={hrefOf(project, "system")}>How templates work →</a>
      <a href={hrefOf(project, "changes")}>What changed →</a>
      <a href={`/app/${project}`}>Open the app</a>
    </div>
  </footer>
</div>

<style>
  .group { margin-top: 2.5rem; }

  .group-head {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: 10px;
    font-weight: 750;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .fork .state { display: grid; gap: .15rem; align-content: start; font-size: 12.5px; }
  .fork .state em { color: var(--token-ink-muted); font-size: 11.5px; font-style: normal; }
</style>
