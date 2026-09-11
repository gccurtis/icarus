<script lang="ts">
  import { page } from "$app/state";

  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceHeader from "$development-views/template-reference/components/reference-header.svelte";
  import "$development-views/template-reference/components/reference.css";
  import {
    CHAIN,
    CHAIN_DIAGRAM,
    DEFAULT_RULE,
    LIMITS,
    RESOLUTION_DIAGRAM,
    SETTLED
  } from "$development-views/template-reference/procedures/integration";
  import { hrefOf } from "$development-views/template-reference/procedures/navigation";

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

  const working = CHAIN.filter((link) => link.state === "works").length;
</script>

<div class="tref">
  <ReferenceHeader current="integration" {material} {materials} {onmaterial} />

  <main class="tref-page">
    <header class="tref-mast">
      <div>
        <span class="tref-kicker">04 · Integration</span>
        <h1>End to end with prompts</h1>
        <p class="tref-lede">
          A template is a function and a slot is where it takes an argument. One gesture makes one —
          Templateify, on a prompt or on a run of selected text — and everything after it follows:
          the template keeps exactly those slots, placing it asks about exactly those, and the copy
          reads what was chosen. All {working} links carry, and a template you never templateify
          anything in is simply a copy, which is also correct.
        </p>
      </div>
      <div class="tref-facts">
        <dl>
          <div><dt>Links in the chain</dt><dd>{CHAIN.length} of {CHAIN.length}</dd></div>
          <div><dt>Slots are</dt><dd>Made, never found</dd></div>
          <div><dt>What can become one</dt><dd>A prompt · a selection</dd></div>
          <div><dt>Offered name</dt><dd>Slot 1, Slot 2, …</dd></div>
          <div><dt>Its default</dt><dd>Whatever it already is</dd></div>
        </dl>
      </div>
    </header>

    <nav class="tref-jumps" aria-label="On this page">
      <a href="#chain">The chain</a>
      <a href="#shape">What it looks like</a>
      <a href="#defaults">Which scopes carry over</a>
      <a href="#settled">What was decided</a>
      <a href="#resolution">What happens on placement</a>
      <a href="#limits">Where it stops</a>
    </nav>

    <section class="tref-section" id="chain">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Link by link</span><h2>Eight links, and every one carries</h2></div>
        <p>
          Each row is one thing that has to happen for a prompt written by one person to be answered by
          another. The evidence column names the test that fails if the link breaks.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead>
            <tr><th></th><th>What happens</th><th>The gesture</th><th>What runs</th><th></th><th>Evidence</th></tr>
          </thead>
          <tbody>
            {#each CHAIN as link (link.index)}
              <tr>
                <td class="num">{link.index}</td>
                <td>{link.step}</td>
                <td class="muted">{link.gesture}</td>
                <td class="muted"><code>{link.runs}</code></td>
                <td><span class="tref-badge clean">works</span></td>
                <td class="muted">{link.evidence}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tref-note success">
        <h4>One gesture, and the rest is consequence</h4>
        <p>
          Link 02 is the only one anybody performs on purpose. Everything before it is ordinary
          authoring, and everything after it happens because a slot exists: the template keeps it,
          placing asks about it, resolution fills it, and the copy generates over what was chosen.
          That is what makes placing short — the questions are the ones somebody meant to ask, and a
          document with nine prompts and one slot asks once.
        </p>
      </div>
    </section>

    <section class="tref-section" id="shape">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The shape of it</span><h2>Where each piece runs</h2></div>
        <p>
          Three groups, and the ordering inside the middle one is the whole of the design: the slots
          are read before the body is made portable, because whether a prompt's scope survives is
          exactly what decides whether its slot gets a default.
        </p>
      </div>

      <div class="tref-figure">
        <MermaidDiagram
          source={CHAIN_DIAGRAM}
          label="Authoring a prompt, making a template from it, and placing that template"
          caption="withPrompts sits between them because a template leaves the derived output behind, and the prompt has to be copied onto the block while the link still exists."
          minHeight="20rem"
        />
      </div>
    </section>

    <section class="tref-section" id="defaults">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The rule</span><h2>What a slot defaults to</h2></div>
        <p>
          Whatever the thing already is. Nothing is judged portable or not, because a slot that arrives
          empty is a toll and this design does not charge one.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th>What was templateified</th><th>The slot defaults to</th><th>Because</th></tr></thead>
          <tbody>
            {#each DEFAULT_RULE as row (row.scope)}
              <tr>
                <td>{row.scope}</td>
                <td>{row.carries}</td>
                <td class="muted">{row.because}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tref-note">
        <h4>Nothing is ever red</h4>
        <p>
          A slot always has an answer, because its answer is what the thing already said. Placing a
          template is therefore always one press away from done, and the walk exists for the times you
          want a copy to read something else — which is the only reason you made the slot. The Scope
          control on a prompt is a real control now: it opens the same builder the ask modal does, and
          what it writes is what the slot will offer.
        </p>
      </div>
    </section>

    <section class="tref-section" id="settled">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Settled</span><h2>What was decided, and what it became</h2></div>
        <p>
          Five questions, answered. The previous version of this page listed the first four as open
          forks with recommendations; these are the answers that were given.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th>Question</th><th>Answer</th><th>What it became</th></tr></thead>
          <tbody>
            {#each SETTLED as row (row.question)}
              <tr>
                <td>{row.question}</td>
                <td>{row.answer}</td>
                <td class="muted">{row.became}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="tref-section" id="resolution">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Links 05 and 06</span><h2>What happens when a template is placed</h2></div>
        <p>
          One slot at a time, and the person walking it never has to hold the whole shape in their
          head — the tabs do that.
          <a href={hrefOf(project, "walkthrough")}>Walk it yourself</a> to see the same modal working.
        </p>
      </div>

      <div class="tref-figure">
        <MermaidDiagram
          source={RESOLUTION_DIAGRAM}
          label="What runs between pressing Insert and the new copy appearing"
          caption="The bound resourceSets row is what makes an exclusion expressible at all — a difference cannot be substituted on a prompt's excluding side."
          minHeight="34rem"
        />
      </div>
    </section>

    <section class="tref-section" id="limits">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Where it stops</span><h2>Three things this does not do</h2></div>
        <p>
          None of them blocks anything. Written down so the next person meets them as decisions rather
          than as surprises.
        </p>
      </div>

      <div class="tref-cards">
        {#each LIMITS as limit (limit.title)}
          <article class="tref-card">
            <h3>{limit.title}</h3>
            <p>{limit.detail}</p>
            <p class="tref-meta">{limit.order}</p>
          </article>
        {/each}
      </div>
    </section>
  </main>

  <footer class="tref-footer">
    <div>
      <span>Icarus · templates</span>
      <span>Every link carries</span>
    </div>
    <div>
      <a href={hrefOf(project, "scope")}>← What a slot selects</a>
      <a href={hrefOf(project, "walkthrough")}>Walk it yourself →</a>
    </div>
  </footer>
</div>
