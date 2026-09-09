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
          A template is a function and a prompt is what reads the project, so the two were always going
          to meet. Write a prompt, save the thing as a template, be asked what that prompt should read
          this time, answer, and get a copy that reads it. All {working} links carry. Nothing is
          declared, nothing is wired up by hand, and a template made without a single thought about
          templates still asks the right question.
        </p>
      </div>
      <div class="tref-facts">
        <dl>
          <div><dt>Links in the chain</dt><dd>{CHAIN.length} of {CHAIN.length}</dd></div>
          <div><dt>Holes per prompt</dt><dd>One, always</dd></div>
          <div><dt>Declaring needed</dt><dd>None</dd></div>
          <div><dt>Offered name</dt><dd>Prompt 1, Prompt 2, …</dd></div>
          <div><dt>Can hold a placement up</dt><dd>Empty words, no default</dd></div>
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
        <div><span class="tref-kicker">Link by link</span><h2>Seven links, and every one carries</h2></div>
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
        <h4>The gesture column is the point</h4>
        <p>
          Two of the seven links have no gesture at all. Making a template turns every prompt into a
          hole because that is what saving means, and the copy reads what was chosen because that is
          what a resolved body is. The Template section on a prompt is worth opening — a name somebody
          will recognise, and a sentence saying what they are choosing — but nothing breaks if nobody
          ever does.
        </p>
      </div>
    </section>

    <section class="tref-section" id="shape">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The shape of it</span><h2>Where each piece runs</h2></div>
        <p>
          Three groups, and the ordering inside the middle one is the whole of the design: the holes
          are read before the body is made portable, because whether a prompt's scope survives is
          exactly what decides whether its hole gets a default.
        </p>
      </div>

      <div class="tref-figure">
        <MermaidDiagram
          source={CHAIN_DIAGRAM}
          label="Authoring a prompt, making a template from it, and placing that template"
          caption="withAsks sits between them because a template leaves the derived output behind, and the question has to be copied onto the block while the link still exists."
          minHeight="20rem"
        />
      </div>
    </section>

    <section class="tref-section" id="defaults">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The rule</span><h2>Which scopes carry over, and which do not</h2></div>
        <p>
          A hole with a default can be left alone; a hole without one has to be answered. The line is
          whether the scope means the same thing in a project that has never been seen.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th>The prompt read</th><th>The hole defaults to</th><th>Because</th></tr></thead>
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
        <h4>Why this makes the common case free</h4>
        <p>
          Nobody scopes a prompt today: the base's Scope control offers one option and writes nothing,
          so every prompt written in the editor reads the whole project. Under this rule every one of
          those becomes a hole that already has an answer — so a person can write four prompts, save a
          template, place it, and press Accept all defaults without ever making a decision. The rule
          only starts asking things of you at the point where you started asking things of the project.
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
          One hole at a time, and the person walking it never has to hold the whole shape in their
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
      <a href={hrefOf(project, "scope")}>← What a hole selects</a>
      <a href={hrefOf(project, "walkthrough")}>Walk it yourself →</a>
    </div>
  </footer>
</div>
