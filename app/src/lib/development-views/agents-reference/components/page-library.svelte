<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import LiveStage from "$development-views/agents-reference/components/live-stage.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import Questions from "$development-views/agents-reference/components/questions.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import { questionsFor } from "$development-views/agents-reference/procedures/questions";

  let { project }: { project: string } = $props();

  const page = pageOf("library");

  const callouts = [
    { n: 1, title: "Header", body: "Agents, and the one sentence that explains why personas, tasks and automations share a screen, set at the far end and aligned right the way Templates does it. No actions up here; making things is the Create band's job." },
    { n: 2, title: "Create", body: "Four pills, stacked, in the order you would reach for them: persona, task, automation, skill. A persona is created at once under a working name and opened. A task opens the form, because it starts running when it exists. An automation is created switched off and opened, so nothing fires before it is written. Skill is quiet and does nothing: skills are not built." },
    { n: 3, title: "Activity", body: "What agents have done: every activity row whose actor is an agent, newest first, four entries tall; more scroll inside. A click opens the activity lens, which names the persona and the thing acted on and can open it." },
    { n: 4, title: "Search, filters and sort", body: "Search reaches titles and persona names. Persona, Type and State are selects, and every one of them starts on Any each time the library is shown; nothing about the filter is remembered. The sort names itself and carries its direction inside the same frame." },
    { n: 5, title: "The task table", body: "Task, Persona, State, Progress, Started, Started by. The Persona column stays whatever the filter says, and a persona in it opens its lens. Progress is the percentage from the plan, or No plan yet. Started by is the person, or what fired the rule: the schedule, the edit or the new resource. Click inspects; double-click opens. It scrolls inside the band, and no band carries a count." }
  ];

  const gestures = [
    ["Click a persona in the rail", "The persona lens opens. The table does not move.", "agents.persona"],
    ["Choose a persona in the filter", "The table narrows. The inspector keeps whatever it held.", "—"],
    ["Choose Any persona", "The filter clears.", "—"],
    ["Click a task row", "The task lens opens. The filter stays.", "agents.task"],
    ["Double-click a task row", "The task surface opens on it.", "agents.task surface"],
    ["Click an activity entry", "The activity lens opens on it.", "agents.activity"],
    ["Press a Create pill", "A persona is created and opened; task opens its form; an automation is created off and opened; skill does nothing.", "persona · task · automation surface"],
    ["Back, on any surface", "The library, with every filter on Any.", "agents.library"]
  ];

  const columns = [
    ["Task", "The title, with a count of open questions when there are any", "A to Z"],
    ["Persona", "Face and name, whatever the filter says; opens the persona lens", "no sort; use the filter"],
    ["State", "Running · Pending review · Finished", "needs you first"],
    ["Progress", "The percentage from the plan, or No plan yet", "no"],
    ["Started", "When it started", "newest first, the default"],
    ["Started by", "A person, or what fired the rule: the schedule, the edit, the new resource", "no"]
  ];

  const controls = [
    ["Search", "Task titles and persona names", "Text", "—"],
    ["Persona", "Any persona, then every persona; starts on Any", "Select", "—"],
    ["Type", "Any type, then Once and the four trigger kinds", "Select", "—"],
    ["State", "Any state, then the three states", "Select", "—"],
    ["Order", "Started · Task · Type · State", "Select in a shared frame", "the direction button beside it"],
    ["Direction", "Reads as the order's own words: Newest first, A to Z, Needs you first", "Icon button", "—"],
    ["Clear", "Resets search, type and state at once", "In the no-matches state", "—"]
  ];

  const states = [
    ["No persona yet", "nothing-yet", "Persona is the first thing to make. The table stands empty."],
    ["Persona with no tasks", "nothing-yet", "Nothing handed to it yet."],
    ["Filters match nothing", "no-matches", "One Clear resets search, type and state together."],
    ["Nothing has happened", "nothing-yet", "The Activity band says so and waits."],
    ["Library loading", "loading", "One ScreenEmpty for the whole surface; no spinner per band."],
    ["Capability refused or failed", "error", "The message and a Retry, as the templates library does."]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="live"
    kicker="The surface, live"
    title="Create, Activity, and the table"
    lede="The real library over the seeded project, with the real rail and lenses beside it. Everything you click here does what it does in the app, and everything you create is written."
  >
    <Noted scope="figure" label="Library workbench">
      <LiveStage label="agents.library" height="48rem" />
    </Noted>
    <Callouts items={callouts} />
  </ReferenceSection>

  <ReferenceSection
    id="gestures"
    kicker="Behaviour"
    title="Eight gestures, one state each"
    lede="A click never moves the centre and a double click always does. The persona filter is the library's own and starts on Any every time; the rail inspects and never narrows."
  >
    <SpecTable label="Gestures" columns={["Gesture", "What happens", "Key"]} rows={gestures} mono={[2]} noted="gesture" />
  </ReferenceSection>

  <ReferenceSection
    id="table"
    kicker="The table contract"
    title="Six columns, four sorts, four narrowings"
    lede="The Persona column is always there. With a persona chosen every row repeats it, which is the point: the table says what it is showing without a count over it."
  >
    <SpecTable label="Columns" columns={["Column", "Shows", "Sorts"]} rows={columns} noted="column" />
    <SpecTable label="Controls" columns={["Control", "Reaches", "Shape", "Beside it"]} rows={controls} noted="control" />
  </ReferenceSection>

  <ReferenceSection
    id="states"
    kicker="States"
    title="What a band says when it holds nothing"
    lede="A screen never used and a filter that hid everything are different situations, and the empty state names which."
  >
    <SpecTable label="Empty and loading states" columns={["State", "Kind", "Says"]} rows={states} pills={[1]} noted="state" />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions the library raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("library")} />
  </ReferenceSection>
</ReferenceShell>
