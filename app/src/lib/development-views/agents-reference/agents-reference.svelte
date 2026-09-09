<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import Flow from "$development-views/agents-reference/components/flow.svelte";
  import LiveStage from "$development-views/agents-reference/components/live-stage.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import Questions from "$development-views/agents-reference/components/questions.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { PAGES, hrefOf, pageOf, referenceRoot } from "$development-views/agents-reference/procedures/navigation";
  import { PHASES } from "$development-views/agents-reference/procedures/plan";
  import { QUESTIONS } from "$development-views/agents-reference/procedures/questions";

  let { project }: { project: string } = $props();

  const page = pageOf("overview");
  const root = $derived(referenceRoot(project));

  const panes = [
    {
      n: 1,
      title: "The rail: Personas first, then five lists",
      body: "Personas lands first: the roster, where a click opens the lens. Tasks and Automations list and route, with the manual rules a section of the second; none of them restates the centre, none narrows it, and none explains itself in a note."
    },
    {
      n: 2,
      title: "The centre: create, activity, and one table",
      body: "Four things to make on the left, what agents have done on the right, and under both the one table of tasks with a persona filter beside type and state. Every filter starts on Any, the Persona column is always there, and no band carries a count."
    },
    {
      n: 3,
      title: "The inspector: the last thing chosen",
      body: "A persona, a task, an automation, a tool grant or one thing an agent did, read closely. The persona lens edits its name and description; the tool lens toggles the grant on whichever thing it came from."
    }
  ];

  const rules = [
    { n: 1, title: "A task is a run", body: "It starts when it is created and is running, pending review or finished. Success or failure is the agent's to say in its outputs. An automation is a rule that makes tasks; a manual one is fired by hand." },
    { n: 2, title: "Click inspects, double-click opens", body: "A single click on a persona, task, automation or activity entry fills the inspector and leaves the table where it was. Only a double click moves the centre. A chat is the one exception: a click opens its tab." },
    { n: 3, title: "One filter, one handle", body: "The persona filter over the table is the library's own. It starts on Any every time the library is shown, and the rail inspects without narrowing." },
    { n: 4, title: "Nothing runs an agent", body: "Create and Run now write a real task row that waits for a runner. The plan, the outputs and the questions are the runner's to write; the surfaces read them and let a person answer or reject, steer, stop or mark reviewed." },
    { n: 5, title: "Everything saves", body: "Names, descriptions, sections, scopes, tools, instructions, triggers and enabled all write through the agents capability with a revision check." },
    { n: 6, title: "A scope and tools are defaults, then choices", body: "A persona carries both as defaults. A task or automation starts from them and may set its own; until it does, it reads whatever the persona reads, and the surface says so." },
    { n: 7, title: "No band says x of y", body: "What a band holds is visible in its rows. The one number a band shows is the zero on a task's Outputs, so an empty band reads as empty rather than unloaded." },
    { n: 8, title: "Nothing is deleted while named", body: "A persona named by anything and an automation that has fired each refuse removal and say why. Off is the safe removal for a rule." }
  ];

  const choice = [
    { actor: "Persona row", action: "Click inspects the persona. The table does not move.", artifact: "inspect(\"agents.persona\", { kind: \"persona\", id })" },
    { actor: "Task row", action: "Click inspects the task; the filter stays put.", artifact: "inspect(\"agents.task\", { kind: \"task\", id })" },
    { actor: "Task row", action: "Double click opens the task surface on it.", artifact: "showContent(\"agents.task\", id)" },
    { actor: "Activity entry", action: "Click opens the activity lens on what an agent did.", artifact: "inspect(\"agents.activity\", { kind: \"activity\", id })" },
    { actor: "Chat row", action: "Click opens the chat in its own research tab.", artifact: "open({ category: \"research\", content: \"research.thread\", resourceId })" },
    { actor: "Back", action: "Returns to the library with every filter on Any.", artifact: "showContent(\"agents.library\")" }
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="glance"
    kicker="The category, live"
    title="Three panes, one filter, nothing pretending to run"
    lede="This is the built category in one frame: the real rail, the real library and the real lenses over the seeded project. Click a persona in the rail, a task row, an activity entry; double-click to open; use Back on the surfaces. Every edit you make here is written to the store."
  >
    <Noted scope="figure" label="The workbench">
      <LiveStage label="agents · library" />
    </Noted>
    <Callouts items={panes} scope="pane" />
  </ReferenceSection>

  <ReferenceSection
    id="pages"
    kicker="The suite"
    title="Fifteen pages, in three groups"
    lede="Pages one to seven stage the built agents surfaces. Eight to eleven are the research chat as it was built: the rebase, the intelligence layer, Explore live, and what a response is made of. Twelve to fifteen are the specifications — personas, tasks, automations and research chat whole — each one state, then behaviour, then every procedure step by step, then the execution flow."
  >
    <div class="ar-cards">
      {#each PAGES.filter((candidate) => candidate.slug !== "overview") as candidate (candidate.slug)}
        <a href={hrefOf(root, candidate)}>
          <span class="ar-index">{candidate.index} · {candidate.eyebrow}</span>
          <h3>{candidate.label}</h3>
          <p>{candidate.lede}</p>
          <span class="ar-foot">Open →</span>
        </a>
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="rules"
    kicker="Rules the category keeps"
    title="Eight things every page agrees on"
    lede="A page that broke one of these would be arguing with the others. They are listed once here and assumed everywhere else."
  >
    <Callouts items={rules} scope="rule" />
  </ReferenceSection>

  <ReferenceSection
    id="choice"
    kicker="Navigation"
    title="How a choice moves through the panes"
    lede="There is no centre switcher. You get to a persona by choosing a persona and to a task by choosing a task, and the library's persona filter is the library's own, never remembered past the surface."
  >
    <Noted scope="figure" label="Choice flow">
      <Flow label="How a choice moves" steps={choice} />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="build"
    kicker="Build order"
    title="Five phases done, one left"
    lede="Rows before doors, doors before read models, read models before surfaces. The file plan on the backend page lists every file under its phase."
  >
    <SpecTable
      label="Build phases"
      columns={["Phase", "Produces", "Proves"]}
      rows={PHASES.map((phase) => [`${phase.n} · ${phase.title}`, phase.produces, phase.proves])}
      noted="phase"
    />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks"
    title="Thirty-four decisions, each still open"
    lede="Every place the review left a choice is here with the page it lives on and what was built. The last nineteen come from the rebase, the research chat and writing the specifications. Answer by number. Each is what I would do, not what was agreed."
  >
    <Questions questions={QUESTIONS} showPage {root} />
  </ReferenceSection>
</ReferenceShell>
