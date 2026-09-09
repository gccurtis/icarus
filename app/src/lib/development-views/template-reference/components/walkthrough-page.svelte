<script lang="ts">
  import { page } from "$app/state";

  import { PromptTemplate } from "$authored-components/prompt-template";
  import { TemplateAnswers } from "$authored-components/template-answers";
  import ReferenceHeader from "$development-views/template-reference/components/reference-header.svelte";
  import "$development-views/template-reference/components/reference.css";
  import { hrefOf } from "$development-views/template-reference/procedures/navigation";
  import {
    STAGES,
    answerRowsFrom,
    holesFrom,
    scopeWords,
    type WalkPrompt
  } from "$development-views/template-reference/procedures/walkthrough";

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

  /**
   * The whole system, driven rather than described.
   *
   * Every control below is the component the application ships, with this
   * page's own state behind it. Change a name here and the template's hole list
   * changes, and so does what placing it asks — because the same pure functions
   * that run in the capability run here.
   */
  let prompts = $state<WalkPrompt[]>([
    {
      id: "p1",
      asks: "Summarize what happened, the customer impact, and the current operating state.",
      name: "",
      description: "",
      scope: "project"
    },
    {
      id: "p2",
      asks: "List the decisions still open, and who is waiting on each.",
      name: "open_decisions",
      description: "Which threads the list is drawn from",
      scope: "kinds"
    },
    {
      id: "p3",
      asks: "Quote the three most load-bearing findings, with their sources.",
      name: "",
      description: "",
      scope: "set"
    }
  ]);

  let chosen = $state<Record<string, string>>({});
  let words = $state<Record<string, string>>({});
  let stage = $state(0);

  const holes = $derived(holesFrom(prompts));
  const rows = $derived(answerRowsFrom(holes, chosen, words));
  const missing = $derived(rows.filter((row) => row.missing).length);
  const questions = $derived(Object.fromEntries(holes.map((hole) => [hole.name, hole.asks])));

  const rename = (id: string, name: string) => {
    prompts = prompts.map((prompt) => (prompt.id === id ? { ...prompt, name } : prompt));
  };

  const describe = (id: string, description: string) => {
    prompts = prompts.map((prompt) => (prompt.id === id ? { ...prompt, description } : prompt));
  };

  /** The builder is a modal in the app; here it cycles, because the point is the consequence. */
  const cycleScope = (id: string) => {
    const order = ["project", "kinds", "set"] as const;
    prompts = prompts.map((prompt) =>
      prompt.id === id
        ? { ...prompt, scope: order[(order.indexOf(prompt.scope) + 1) % order.length] }
        : prompt
    );
  };

  const answer = (key: string) => {
    chosen = { ...chosen, [key]: chosen[key] === "chosen" ? "" : "chosen" };
  };

  const reset = (key: string) => {
    const { [key]: _gone, ...rest } = chosen;
    chosen = rest;
  };
</script>

<div class="tref">
  <ReferenceHeader current="walkthrough" {material} {materials} {onmaterial} />

  <main class="tref-page">
    <header class="tref-mast">
      <div>
        <span class="tref-kicker">06 · Driven</span>
        <h1>Walk it yourself</h1>
        <p class="tref-lede">
          Three prompts, written the way anybody writes them. Name them or leave them; scope them or
          leave them; then watch the template that comes out and place it. Every control here is the
          component the application ships, and the hole list beneath them is computed by the same pure
          functions the capability runs — so the consequences are real even though nothing is saved.
        </p>
      </div>
      <div class="tref-facts">
        <dl>
          <div><dt>Prompts</dt><dd>{prompts.length}</dd></div>
          <div><dt>Holes</dt><dd>{holes.length}</dd></div>
          <div><dt>With a default</dt><dd>{holes.filter((hole) => hole.fallback !== undefined).length}</dd></div>
          <div><dt>Still needing an answer</dt><dd>{missing}</dd></div>
          <div><dt>Saved anywhere</dt><dd>Nothing</dd></div>
        </dl>
      </div>
    </header>

    <nav class="tref-jumps" aria-label="On this page">
      <a href="#author">1 · Write the prompts</a>
      <a href="#made">2 · Make the template</a>
      <a href="#place">3 · Place it</a>
      <a href="#stages">The same thing in words</a>
    </nav>

    <section class="tref-section" id="author">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Step one</span><h2>Write the prompts</h2></div>
        <p>
          Each card is a prompt block's Template section, exactly as it appears in the inspector.
          The name is offered rather than asked for. The context button cycles here; in the editor it
          opens the scope builder.
        </p>
      </div>

      <div class="authoring">
        {#each prompts as prompt, index (prompt.id)}
          <article class="prompt">
            <blockquote>
              <span>Prompt {index + 1} asks</span>
              <p>{prompt.asks}</p>
            </blockquote>
            <PromptTemplate
              name={prompt.name}
              offered={`Prompt ${index + 1}`}
              description={prompt.description}
              context={scopeWords(prompt.scope)}
              settled={prompt.scope !== "set"}
              onname={(next) => rename(prompt.id, next)}
              ondescription={(next) => describe(prompt.id, next)}
              oncontext={() => cycleScope(prompt.id)}
            />
          </article>
        {/each}
      </div>
    </section>

    <section class="tref-section" id="made">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Step two</span><h2>Make the template</h2></div>
        <p>
          Nothing is pressed. Saving turns every prompt into one hole, keeps the scope as its default
          when the scope means the same thing anywhere, and drops the generated answer on the way in.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead>
            <tr><th>Hole</th><th>Stands for</th><th>Its prompt</th><th>Default</th></tr>
          </thead>
          <tbody>
            {#each holes as hole (hole.name)}
              <tr>
                <td><code>{hole.name}</code></td>
                <td class="muted">{hole.description === "" ? "—" : hole.description}</td>
                <td class="muted">{hole.asks}</td>
                <td class:none={hole.fallback === undefined}>
                  {hole.fallback ?? "Nothing — it has to be answered"}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tref-note" class:success={missing === 0} class:attention={missing > 0}>
        <h4>{missing === 0 ? "This template places with one press" : `${missing} hole needs an answer`}</h4>
        <p>
          {missing === 0
            ? "Every hole carries a default, so whoever places it can accept everything as it stands. That is the common case, and it is free."
            : "A prompt that read one of the project's named sets cannot carry that over, so its hole arrives empty. Cycle its context above to see the template become placeable."}
        </p>
      </div>
    </section>

    <section class="tref-section" id="place">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Step three</span><h2>Place it</h2></div>
        <p>
          This is the ask modal itself. Use the tabs, or Previous and Next; a red tab is a hole that
          still needs words. Pressing a scope opens the builder in the application — here it just
          toggles between the default and something chosen, so the tag and the rule move.
        </p>
      </div>

      <div class="modal">
        <header>
          <b>Insert “Incident one-pager”</b>
          <p>One hole at a time. The tabs say which still need words.</p>
        </header>
        <div class="modal-body">
          <TemplateAnswers
            {rows}
            prompts={questions}
            onscope={answer}
            ontext={(key, next) => (words = { ...words, [key]: next })}
            onreset={reset}
            onaccept={() => (stage = STAGES.length - 1)}
          />
        </div>
      </div>
    </section>

    <section class="tref-section" id="stages">
      <div class="tref-section-head">
        <div><span class="tref-kicker">In words</span><h2>The same thing, said once</h2></div>
        <p>Five moments, and what each one leaves behind.</p>
      </div>

      {#each STAGES as step, index (step.title)}
        <article class="tref-change" class:reached={index <= stage}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.what}</p>
          </div>
          <div class="state before"><span>Runs</span><p>{step.runs}</p></div>
          <div class="state after"><span>Leaves</span><p>{step.leaves}</p></div>
        </article>
      {/each}
    </section>
  </main>

  <footer class="tref-footer">
    <div>
      <span>Icarus · templates</span>
      <span>Nothing here is saved</span>
    </div>
    <div>
      <a href={hrefOf(project, "integration")}>← End to end with prompts</a>
      <a href={hrefOf(project, "rebase")}>Where it meets the base</a>
    </div>
  </footer>
</div>

<style>
  .authoring {
    display: grid;
    gap: 1.5rem;
    margin-top: 2rem;
    grid-template-columns: repeat(auto-fit, minmax(min(20rem, 100%), 1fr));
  }

  .prompt {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 8px;
    background: var(--token-surface-panel);
  }

  .prompt blockquote {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0;
    padding-inline-start: 0.9rem;
    border-inline-start: 2px solid var(--token-border-strong);
  }

  .prompt blockquote span {
    color: var(--token-ink-muted);
    font-size: 9.5px;
    font-weight: 750;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .prompt blockquote p {
    margin: 0;
    color: var(--token-ink-primary);
    font-size: 13px;
    line-height: 1.5;
  }

  .none {
    color: var(--token-color-danger-text);
  }

  .modal {
    max-width: 46rem;
    margin-top: 2rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 10px;
    background: var(--token-surface-elevated);
    overflow: hidden;
  }

  .modal header {
    padding: 1.1rem 1.4rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel);
  }

  .modal header b {
    display: block;
    font-size: 14px;
  }

  .modal header p {
    margin: 0.2rem 0 0;
    color: var(--token-ink-muted);
    font-size: 12px;
  }

  .modal-body {
    padding: 1.4rem;
  }

  .tref-change.reached > span {
    color: var(--token-color-success-text);
  }
</style>
