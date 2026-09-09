<script lang="ts">
  import { page } from "$app/state";

  import MermaidDiagram from "$development-components/mermaid-diagram.svelte";
  import ReferenceHeader from "$development-views/template-reference/components/reference-header.svelte";
  import "$development-views/template-reference/components/reference.css";
  import {
    CHAIN,
    CHAIN_DIAGRAM,
    FORKS,
    RESOLUTION_DIAGRAM,
    WALKTHROUGH
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

  const STATE_WORDS: Record<string, string> = {
    works: "works",
    stub: "a stub",
    missing: "missing"
  };

  const working = CHAIN.filter((link) => link.state === "works").length;
  const open = CHAIN.filter((link) => link.state !== "works");
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
          to meet. This page walks the whole chain — write a prompt, save the thing as a template, be
          asked what the prompt should read, answer, and get a copy that reads it — and says exactly
          which links carry weight today. {working} of the {CHAIN.length} do. One is a control wired to
          nothing, and one has never been built.
        </p>
      </div>
      <div class="tref-facts">
        <dl>
          <div><dt>Links in the chain</dt><dd>{CHAIN.length}</dd></div>
          <div><dt>Working</dt><dd>{working}</dd></div>
          <div><dt>Open</dt><dd>{open.length}</dd></div>
          <div><dt>Forks to settle</dt><dd>{FORKS.length}</dd></div>
          <div><dt>Blocking</dt><dd>Link 04 only</dd></div>
        </dl>
      </div>
    </header>

    <nav class="tref-jumps" aria-label="On this page">
      <a href="#chain">The chain</a>
      <a href="#shape">What it looks like</a>
      <a href="#gap">The one open link</a>
      <a href="#forks">What has to be decided</a>
      <a href="#resolution">What already happens on placement</a>
      <a href="#walk">Walk it yourself</a>
    </nav>

    <section class="tref-section" id="chain">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Link by link</span><h2>Seven links, five of them carrying</h2></div>
        <p>
          Each row is one thing that has to happen for a prompt written by one person to be answered by
          another. The evidence column names the test that would fail if the link broke — or, for the
          two that are open, the code or test that pins what happens instead.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead>
            <tr><th></th><th>What happens</th><th>The gesture</th><th>What runs</th><th>State</th><th>Evidence</th></tr>
          </thead>
          <tbody>
            {#each CHAIN as link (link.index)}
              <tr>
                <td class="num">{link.index}</td>
                <td>{link.step}</td>
                <td class="muted">{link.gesture}</td>
                <td class="muted"><code>{link.runs}</code></td>
                <td>
                  <span
                    class="tref-badge"
                    class:clean={link.state === "works"}
                    class:known={link.state !== "works"}
                  >{STATE_WORDS[link.state]}</span>
                </td>
                <td class="muted">{link.evidence}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="tref-section" id="shape">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The shape of it</span><h2>Where the chain breaks</h2></div>
        <p>
          Everything solid is built and covered. The two dashed nodes are the open link and what happens
          instead of it: a template made from an authored prompt keeps that prompt's own sources, so
          every copy reads what the author read and nobody is asked anything.
        </p>
      </div>

      <div class="tref-figure">
        <MermaidDiagram
          source={CHAIN_DIAGRAM}
          label="The chain from an authored prompt to a filled copy, with the missing link drawn dashed"
          caption="Solid: built and covered by a test. Dashed: the Scope control that writes nothing, and the copy you get because of it."
          minHeight="20rem"
        />
      </div>
    </section>

    <section class="tref-section" id="gap">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Link 04</span><h2>The one open link, exactly</h2></div>
        <p>
          It is worth stating precisely, because everything on either side of it works and it would be
          easy to think the chain is whole.
        </p>
      </div>

      <div class="tref-cards">
        <article class="tref-card">
          <h3>What a prompt carries</h3>
          <p>
            A prompt block has an optional <code>scope</code>. Written in the editor, it is settled —
            the whole project — because the inspector's Scope control offers that and nothing else.
          </p>
        </article>
        <article class="tref-card">
          <h3>What declaring looks for</h3>
          <p>
            <code>declaredFor</code> walks the body for prompt scopes holding
            <code>{"{ select: \"hole\", name }"}</code> and declares one hole per name found. A settled
            scope holds no such term.
          </p>
        </article>
        <article class="tref-card">
          <h3>So what happens</h3>
          <p>
            The template is made, the prompt is carried, the generated answer is dropped — and the hole
            list is empty. Placing it asks nothing, and every copy reads the author's own sources.
          </p>
        </article>
      </div>

      <div class="tref-note attention">
        <h4>This is pinned, not merely observed</h4>
        <p>
          <code>capabilities/templates/test/unit/answers.test.ts</code> holds a case named <b>keeps an
          authored prompt scope settled, and so declares no hole for it</b>. It builds a document whose
          only block is a prompt scoped to the whole project, makes a template from it, and asserts that
          <code>holes</code> is empty and the scope came through unchanged. When link 04 is built, that
          test is what changes — which is the point of writing it down rather than leaving the gap to be
          rediscovered.
        </p>
      </div>

      <div class="tref-note">
        <h4>Why the term exists at all, if nothing writes it</h4>
        <p>
          <code>{"{ select: \"hole\" }"}</code> is not speculative. A template that already holds one —
          from the seed, or from inserting a template into a working copy, which keeps the terms rather
          than resolving them — flows through the entire rest of the chain today. The hole is asked for,
          answered, normalised, resolved and read. What is missing is only the gesture that puts the
          first one there.
        </p>
      </div>
    </section>

    <section class="tref-section" id="forks">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Not settled</span><h2>What has to be decided before link 04 is built</h2></div>
        <p>
          Three questions, each with the answer I would give and what it costs to answer otherwise.
          None of them is settled, and none should be treated as settled because it is written here.
        </p>
      </div>

      {#each FORKS as fork (fork.index)}
        <article class="tref-change">
          <span>{fork.index}</span>
          <div>
            <h3>{fork.question}</h3>
            <p>{fork.because}</p>
          </div>
          <div class="state after"><span>Recommended</span><p>{fork.recommended}</p></div>
          <div class="state before"><span>Instead</span><p>{fork.alternative} — {fork.cost}</p></div>
        </article>
      {/each}
    </section>

    <section class="tref-section" id="resolution">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Links 05 and 06</span><h2>What already happens when a template is placed</h2></div>
        <p>
          This half of the chain is finished and covered. It is worth reading before deciding link 04,
          because it says what a hole has to be for the rest to work: a name, and nothing else.
        </p>
      </div>

      <div class="tref-figure">
        <MermaidDiagram
          source={RESOLUTION_DIAGRAM}
          label="What runs between pressing Insert and the new copy appearing"
          caption="Every step here is built. The bound resourceSets row is what makes an exclusion expressible at all — a difference cannot be substituted on a prompt's excluding side."
          minHeight="34rem"
        />
      </div>
    </section>

    <section class="tref-section" id="walk">
      <div class="tref-section-head">
        <div><span class="tref-kicker">In the app</span><h2>Walk it yourself</h2></div>
        <p>
          Six steps in the running application, starting from what is seeded. The last one is where the
          walk stops, and stopping there is the finding rather than a mistake in the instructions.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th></th><th>Do this</th><th>You should see</th></tr></thead>
          <tbody>
            {#each WALKTHROUGH as step (step.index)}
              <tr>
                <td class="num">{step.index}</td>
                <td>{step.does}</td>
                <td class="muted">{step.sees}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tref-note success">
        <h4>What the suite walks without you</h4>
        <p>
          Six browser cases cover this ground from a clean seed: inserting a template and answering
          every hole, saving a document as a template and setting a hole's default scope, making a text
          hole with Create hole and finding its atom in the prose, saving one slide as a deck template,
          making and counting a project's resource sets, and building a default that excludes something
          and reading it back as the rule. They run against the system Chromium because the bundled
          headless shell cannot load its libraries here.
        </p>
      </div>
    </section>
  </main>

  <footer class="tref-footer">
    <div>
      <span>Icarus · templates</span>
      <span>Link 04 is open</span>
    </div>
    <div>
      <a href={hrefOf(project, "scope")}>← What a hole selects</a>
      <a href={hrefOf(project, "rebase")}>Where it meets the base →</a>
    </div>
  </footer>
</div>
