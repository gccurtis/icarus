<script lang="ts">
  import { page } from "$app/state";

  import DiagramPanel from "$development-views/template-reference/components/diagram-panel.svelte";
  import DiagramRows from "$development-views/template-reference/components/diagram-rows.svelte";
  import DiagramSaves from "$development-views/template-reference/components/diagram-saves.svelte";
  import DiagramScope from "$development-views/template-reference/components/diagram-scope.svelte";
  import DiagramVerbs from "$development-views/template-reference/components/diagram-verbs.svelte";
  import ReferenceHeader from "$development-views/template-reference/components/reference-header.svelte";
  import "$development-views/template-reference/components/reference.css";
  import { LIFECYCLE, NOUNS, REFUSALS, RULES, STRIPPED, VERBS } from "$development-views/template-reference/procedures/system";
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
</script>

<div class="tref">
  <ReferenceHeader current="system" {material} {materials} {onmaterial} />

  <main class="tref-page">
    <header class="tref-mast">
      <div>
        <span class="tref-kicker">01 · The system</span>
        <h1>How templates work</h1>
        <p class="tref-lede">
          A template is the project's saved original. You keep a copy of something you have, you ask for a
          copy of it somewhere else, and you change the original by editing a copy of it. Everything below
          is those three sentences, said precisely.
        </p>
      </div>
      <div class="tref-facts">
        <dl>
          <div><dt>Belongs to</dt><dd>One project</dd></div>
          <div><dt>Edited through</dt><dd>One shared working copy</dd></div>
          <div><dt>Placed by</dt><dd>Insert · Use</dd></div>
          <div><dt>Variables come from</dt><dd>Prompt scopes in the body</dd></div>
          <div><dt>Links back</dt><dd>None, in either direction</dd></div>
        </dl>
      </div>
    </header>

    <nav class="tref-jumps" aria-label="On this page">
      <a href="#verbs">The three verbs</a>
      <a href="#saves">Two saves</a>
      <a href="#nouns">Every word</a>
      <a href="#rows">Where it lives</a>
      <a href="#lifecycle">Step by step</a>
      <a href="#variables">Variables and scope</a>
      <a href="#portable">What a template may not carry</a>
      <a href="#panels">The panels</a>
      <a href="#rules">Rules and refusals</a>
    </nav>

    <section class="tref-section" id="verbs">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The shape of it</span><h2>Three verbs, and nothing else</h2></div>
        <p>
          Templates were real before this work; what was missing was a way to edit one, a way to say what a
          variable selects, and a way to pull one into something already open. All three are the same act
          seen from different sides: making a copy.
        </p>
      </div>

      <figure class="tref-figure">
        <DiagramVerbs />
        <figcaption>
          <b>Read it as a copy machine with one rule:</b> the template's body changes on exactly one arrow.
          Everything else reads the template or writes somewhere else.
        </figcaption>
      </figure>

      <div class="tref-cards">
        {#each VERBS as verb (verb.name)}
          <article class="tref-card">
            <h3>{verb.name}</h3>
            <p>{verb.gesture}</p>
            <p><b>Does</b> — {verb.does}</p>
            <p><b>Leaves</b> — {verb.leaves}</p>
            <span class="tref-meta">{verb.procedure}</span>
          </article>
        {/each}
      </div>
    </section>

    <section class="tref-section" id="saves">
      <div class="tref-section-head">
        <div><span class="tref-kicker">The question everyone asks</span><h2>Two saves, two meanings</h2></div>
        <p>
          The editor already saves. A working copy is an ordinary document, so every keystroke is flushed
          the way it always is — and none of that reaches the template. The Templates panel's
          <b>Save</b>, beside Discard, is the separate gesture that says: publish this now.
        </p>
      </div>

      <figure class="tref-figure">
        <DiagramSaves />
        <figcaption>
          <b>Yes, you have to press it.</b> The editor's own saving keeps your work safe on the copy;
          the template moves only when you ask. It is refused while anything is still unflushed, because
          the server reads the copy's leader snapshot rather than your screen.
        </figcaption>
      </figure>

      <p class="tref-prose">
        The same asymmetry answers the collaboration question. Two people editing a template land in the
        same working copy and see each other through the editor's ordinary sync; if both press Save to
        template, the second is refused as <code>stale</code>, re-reads the revision, and saves the copy
        they both already see. Nothing is silently overwritten and nothing is merged twice.
      </p>
    </section>

    <section class="tref-section" id="nouns">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Vocabulary</span><h2>Every word, defined once</h2></div>
        <p>
          Nine nouns carry the whole feature. Each says what it is, what it is on disk, and — where it
          matters — what it is not, because most of the confusion is a word doing two jobs.
        </p>
      </div>

      <div class="tref-cards">
        {#each NOUNS as noun (noun.term)}
          <article class="tref-card">
            <h3>{noun.term} {#if noun.aka}<span>· also “{noun.aka}”</span>{/if}</h3>
            <p>{noun.says}</p>
            {#if noun.not}<p class="tref-not">{noun.not}</p>{/if}
            <span class="tref-meta">{noun.onDisk}</span>
          </article>
        {/each}
      </div>
    </section>

    <section class="tref-section" id="rows">
      <div class="tref-section-head">
        <div><span class="tref-kicker">On disk</span><h2>Where a template lives</h2></div>
        <p>
          Three groups of rows, and the working copy is the only one that needed a new table. The scratch
          resource is an ordinary document or deck, which is why the editors, the runtime and the change
          ledger work on it without knowing what it is.
        </p>
      </div>
      <div class="tref-figure"><DiagramRows /></div>
    </section>

    <section class="tref-section" id="lifecycle">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Step by step</span><h2>What happens, in order</h2></div>
        <p>
          Each row is one thing a person does. The columns are where the consequence lands: the panel in
          front of them, the procedure on the server, and the rows that exist afterwards.
        </p>
      </div>

      <div class="tref-lanes">
        <div class="head"></div>
        <div class="head">Person</div>
        <div class="head">Editor and panel</div>
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

    <section class="tref-section" id="variables">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Holes and what fills them</span><h2>Variables and scope</h2></div>
        <p>
          A variable is a hole a prompt punched. Saving a template declares exactly the names the body's
          prompt scopes use — which is why the panels let you describe a variable and set its scope, and
          never let you add or remove one.
        </p>
      </div>

      <figure class="tref-figure">
        <DiagramScope />
        <figcaption>
          <b>Resolution, in order.</b> Because the last step always answers, a template can always be
          placed; the one refusal is a name the template never declared.
        </figcaption>
      </figure>

      <div class="tref-note">
        <h4>Where the names come from today, and where they will come from</h4>
        <p>
          A body carries a variable when a prompt's scope holds <code>{"{ select: \"variable\", name }"}</code>.
          Prompt blocks are not built yet, so today that happens when a template that already has one is
          inserted into a working copy: the terms are kept as holes and the inserted template's variables
          join this one's.
        </p>
        <p>
          The agreed shape for when prompt blocks land is pull-based: making a template walks the prompts
          it found and asks what each one's scope should be, and two prompts may point at the same
          variable. Nothing about the model here changes when that arrives — it only starts declaring
          variables on its own.
        </p>
      </div>

      <p class="tref-prose">
        A <b>resource set</b> — “Winter filings”, “Field evidence” — is a named selection of the project's
        things, made in Project Overview's Contexts panel. Those are the names in the Insert modal's
        dropdown, offered beside “everything in the project” and the five kinds. A set that a variable's
        default names cannot be deleted while it does.
      </p>
    </section>

    <section class="tref-section" id="portable">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Value to function</span><h2>What a template may not carry</h2></div>
        <p>
          A template converts a value into a function, so the parts of a body that point at one particular
          thing are stripped when it becomes a template. This holds inside one project as much as across
          two: what is removed is the binding, not the shape.
        </p>
      </div>

      <div class="tref-scroll">
        <table class="tref-table">
          <thead><tr><th>Dropped</th><th>What survives</th></tr></thead>
          <tbody>
            {#each STRIPPED as row (row.item)}
              <tr><td>{row.item}</td><td>{row.keeps}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="tref-note">
        <h4>The project-neutral form is a real state, drawn as one</h4>
        <p>
          A formula atom in a template keeps its expression and has no <code>formulaId</code>; a prompt keeps
          its text and has no generated output. The document editor draws an unbound formula with a dashed
          outline and says so on hover, so a person reading a template can see which parts are waiting to be
          bound rather than wondering why a number looks stale.
        </p>
        <p>
          Every save says what it dropped, in words — “Dropped 2 links to things in the project.” — so the
          loss is never silent. Comments are stripped the same way: a working copy refuses to take a thread
          at all.
        </p>
      </div>
    </section>

    <section class="tref-section" id="panels">
      <div class="tref-section-head">
        <div><span class="tref-kicker">What a person sees</span><h2>The Templates panel, both states</h2></div>
        <p>
          One panel per editor, in the same place on both rails, in one of two states depending on whether
          what is open is a template's working copy. Everything is drawn from the shipped panel and overlay
          vocabularies — no new components exist for any of this.
        </p>
      </div>

      <div class="tref-figure"><DiagramPanel /></div>

      <p class="tref-prose">
        Project Overview carries the third panel, <b>Contexts</b>, where resource sets are made and
        counted; the templates library carries the fourth surface, the inspector, where a template's name,
        description, tags and variables are read and Use, Edit, Duplicate and Delete sit in one row.
      </p>
    </section>

    <section class="tref-section" id="rules">
      <div class="tref-section-head">
        <div><span class="tref-kicker">Invariants</span><h2>Rules that always hold, and every refusal</h2></div>
        <p>
          The rules are what the design will not trade away. The refusals are what a person can actually
          run into, each answered as a value with a reason rather than thrown as an error.
        </p>
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

      <div class="tref-note attention">
        <h4>Not built yet</h4>
        <p>
          Prompt blocks that pick a variable; images stored with a template so they travel; making a new
          formula instance for a project-neutral atom; and opening a spreadsheet template for editing,
          which waits on the spreadsheet editor. Each is listed with a recommendation on
          <a href={hrefOf(project, "changes")}>What changed</a>.
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
      <a href={hrefOf(project, "changes")}>What changed →</a>
      <a href={`/app/${project}`}>Open the app</a>
    </div>
  </footer>
</div>
