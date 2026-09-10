import type { Area, Phase, PlannedFile } from "$development-views/agents-reference/types";

export const AREA_LABEL: Record<Area, string> = {
  representation: "Representation",
  seed: "Seed",
  capability: "Capability",
  components: "Components",
  views: "Views",
  shell: "Shell",
  docs: "Docs"
};

export const PHASES: readonly Phase[] = [
  {
    n: 1,
    title: "Rows and fixtures",
    produces: "A task that is a run, an automations table, a tool catalogue, a scope on a task and a rule, and six seed files for the Grid Resilience cast.",
    proves: "The seed loads, the store reads every table, and the vocabulary check passes."
  },
  {
    n: 2,
    title: "The agents capability",
    produces: "Seventeen scoped procedures behind one index: four reads and thirteen writes with revision checks.",
    proves: "Unit tests cover the refusals and every write refreshes the library query key."
  },
  {
    n: 3,
    title: "Read model",
    produces: "The procedures the panes share and the trigger and tool vocabulary the leaves may reach.",
    proves: "Sort, filter and progress derivation are unit tested."
  },
  {
    n: 4,
    title: "Rail, lenses and surfaces",
    produces: "Three context panels, five lenses and four content surfaces, all reading the capability and writing through it.",
    proves: "Click inspects, double-click opens, every filter starts on Any, edits survive a reload."
  },
  {
    n: 5,
    title: "Vocabulary and docs",
    produces: "The agents rail down to its six entries, retired keys removed, both agents documents rewritten to describe what is built.",
    proves: "Lint and category-keys are clean, and the placeholder never draws for a key that exists."
  },
  {
    n: 6,
    title: "What remains",
    produces: "A runner that writes plans, outputs and questions; a research surface that reads the chat it was opened on; skills, when conditional steps are worth designing.",
    proves: "Not started. Every row these would write already has its shape."
  }
];

export const FILES: readonly PlannedFile[] = [
  { path: "app/src/lib/representation/data/types/agents/agent-task.ts", status: "modify", area: "representation", phase: 1, purpose: "AgentTaskState, PlanStep, TaskOutput, TaskQuestion and TaskOrigin replace the status and prompt fields; a question carries the agent's options and can be rejected." },
  { path: "app/src/lib/representation/data/types/agents/automation.ts", status: "create", area: "representation", phase: 1, purpose: "The four trigger kinds and their parameters." },
  { path: "app/src/lib/representation/data/types/agents/tool.ts", status: "create", area: "representation", phase: 1, purpose: "The closed ToolId union and a tool's reach." },
  { path: "app/src/lib/representation/data/behavior/agents/tools.ts", status: "create", area: "representation", phase: 1, purpose: "The tool catalogue and the defaults." },
  { path: "app/src/lib/representation/data/behavior/agents/triggers.ts", status: "create", area: "representation", phase: 1, purpose: "Trigger labels, sentences and the origin summary, shared by client and server." },
  { path: "app/src/lib/representation/data/behavior/agents/plan.ts", status: "create", area: "representation", phase: 1, purpose: "Progress derived from a plan; the open questions." },
  { path: "app/src/lib/representation/data/behavior/agents/messages.ts", status: "create", area: "representation", phase: 1, purpose: "A text message and the text of one." },
  { path: "app/src/lib/representation/store/tables.ts", status: "modify", area: "representation", phase: 1, purpose: "agentTasks reshaped; automations join; a task and a rule gain an optional scope." },
  { path: "app/seed/personas.json", status: "create", area: "seed", phase: 1, purpose: "Four personas for Grid Resilience 2027." },
  { path: "app/seed/agentTasks.json", status: "create", area: "seed", phase: 1, purpose: "Seventeen tasks across the states, with plans, outputs and two open questions with options." },
  { path: "app/seed/automations.json", status: "create", area: "seed", phase: 1, purpose: "Eight rules across the four trigger kinds, one of them off." },
  { path: "app/seed/researchThreads.json", status: "create", area: "seed", phase: 1, purpose: "Five persona-backed research chats." },
  { path: "app/seed/threads.json", status: "create", area: "seed", phase: 1, purpose: "One thread per task and per chat." },
  { path: "app/seed/threadParts.json", status: "create", area: "seed", phase: 1, purpose: "The messages of every thread." },
  { path: "app/src/lib/capabilities/agents/index.remote.ts", status: "create", area: "capability", phase: 2, purpose: "The one crossing: five queries and sixteen commands, each command refreshing what it changed." },
  { path: "app/src/lib/capabilities/agents/types/agents.ts", status: "create", area: "capability", phase: 2, purpose: "Closed projections and every input and result." },
  { path: "app/src/lib/capabilities/agents/api/shared/validation.ts", status: "create", area: "capability", phase: 2, purpose: "Bounded names, instructions, triggers, sets, casts, sections, steps and attachments." },
  { path: "app/src/lib/capabilities/agents/api/shared/projection.ts", status: "create", area: "capability", phase: 2, purpose: "Visibility, items, details and the library." },
  { path: "app/src/lib/capabilities/agents/api/shared/threads.ts", status: "create", area: "capability", phase: 2, purpose: "Opening a thread and appending to one." },
  { path: "app/src/lib/capabilities/agents/api/*/", status: "create", area: "capability", phase: 2, purpose: "Seventeen procedures, each gated and validated first." },
  { path: "app/src/lib/capabilities/agents/test/unit/agents.test.ts", status: "create", area: "capability", phase: 2, purpose: "Reads, writes and every refusal reason against a temporary store." },
  { path: "app/seed/activity.json", status: "modify", area: "seed", phase: 1, purpose: "Eight activity rows from and about agents, for the library's Activity band." },
  { path: "app/src/lib/app-views/categories/agents/procedures/library.svelte.ts", status: "create", area: "views", phase: 3, purpose: "Remote reads projected for the panes, navigation, and single-flight writes." },
  { path: "app/src/lib/app-views/categories/agents/procedures/vocabulary.ts", status: "create", area: "views", phase: 3, purpose: "The representation vocabulary the leaves may reach." },
  { path: "app/src/lib/app-views/categories/agents/procedures/agents.ts", status: "delete", area: "views", phase: 3, purpose: "The static mock the capability replaces." },
  { path: "app/src/lib/app-views/categories/agents/components/", status: "create", area: "views", phase: 4, purpose: "The thin band, the surface head, the name input, the band tabs, the task table and its filters, the scope editor, the tool switches, the definition sections, the persona picker, the trigger editor and the thread feed, each reading the capability by id." },
  { path: "app/src/lib/app-views/categories/agents/content/", status: "modify", area: "views", phase: 4, purpose: "Library, persona, task and automation rewritten." },
  { path: "app/src/lib/app-views/categories/agents/context/", status: "create", area: "views", phase: 4, purpose: "Personas, tasks, automations." },
  { path: "app/src/lib/app-views/categories/agents/inspector/", status: "create", area: "views", phase: 4, purpose: "Activity, persona, task, automation, tool." },
  { path: "app/src/lib/representation/data/types/workspace/views.ts", status: "modify", area: "shell", phase: 5, purpose: "Three context keys and five inspector keys for agents; twenty-five retired." },
  { path: "app/src/lib/representation/data/behavior/workspace/opening.ts", status: "modify", area: "shell", phase: 5, purpose: "The agents rail lands on Personas." },
  { path: "app/src/lib/surfaces/context/procedures/rail-entries.ts", status: "modify", area: "shell", phase: 5, purpose: "Labels and icons for the three entries." },
  { path: "app/src/lib/capabilities/agents/agents.md", status: "create", area: "docs", phase: 5, purpose: "What each procedure answers and refuses." },
  { path: "app/src/lib/app-views/categories/agents/agents.md", status: "modify", area: "docs", phase: 5, purpose: "Rewritten to describe the four surfaces, three panels and five lenses that exist." }
];

export const filesIn = (phase: number): readonly PlannedFile[] =>
  FILES.filter((file) => file.phase === phase);
