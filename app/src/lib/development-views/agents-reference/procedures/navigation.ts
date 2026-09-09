import type { PageRecord, PageSlug } from "$development-views/agents-reference/types";

export const referenceRoot = (project: string): string => `/demo/${project}/reference/agents`;

export const PAGES: readonly PageRecord[] = [
  {
    slug: "overview",
    index: "00",
    label: "Overview",
    path: "",
    title: "Agents, end to end.",
    eyebrow: "The Agents category, built",
    lede: "One category with three panes: the personas and the lists in the rail, one task table in the centre, and a lens on whatever was last chosen. Every page here stages the real surfaces over the real store, so what you click here is what the app does.",
    readout: [
      { label: "Content surfaces", value: "4" },
      { label: "Context panels", value: "3" },
      { label: "Inspector lenses", value: "5" },
      { label: "Capability procedures", value: "17" },
      { label: "Open forks", value: "34" },
      { label: "Runs an agent", value: "No" }
    ]
  },
  {
    slug: "context",
    index: "01",
    label: "Context",
    path: "/context",
    title: "The rail: personas, tasks, automations.",
    eyebrow: "Context panels",
    lede: "Three panels, none of them a restatement of the centre, none of them narrowing it, and none of them explaining itself in a note. Personas lands first because the persona is what the rest of the category is keyed on. Manual work is a section of Automations rather than a panel of its own.",
    readout: [
      { label: "Panels", value: "3" },
      { label: "Landing", value: "Personas" },
      { label: "Keys retired", value: "11" },
      { label: "Keys added", value: "0" }
    ]
  },
  {
    slug: "inspector",
    index: "02",
    label: "Inspector",
    path: "/inspector",
    title: "The lenses: one thing, read closely.",
    eyebrow: "Inspector panels",
    lede: "Five lenses for the five selectable things. A persona's definition sections are disclosures inside its lens rather than lenses of their own, there is no run lens because a task is a run, and one thing an agent did has a lens of its own.",
    readout: [
      { label: "Lenses", value: "5" },
      { label: "Editable in the lens", value: "name · description · grants · enabled" },
      { label: "Keys retired", value: "11" },
      { label: "Keys added", value: "1" }
    ]
  },
  {
    slug: "library",
    index: "03",
    label: "Library",
    path: "/library",
    title: "The library: create, activity, and the tasks.",
    eyebrow: "Content surface · agents.library",
    lede: "The shape Project Overview keeps: four things to make on the left, what agents have done on the right, and under both the one table the category is for, with a persona filter beside the type and state filters, every one starting on Any.",
    readout: [
      { label: "Bands", value: "3" },
      { label: "Create", value: "persona · task · automation" },
      { label: "Task columns", value: "6" },
      { label: "Sorts", value: "4, each with a direction" }
    ]
  },
  {
    slug: "persona",
    index: "04",
    label: "Persona",
    path: "/persona",
    title: "The persona: static data, edited in place.",
    eyebrow: "Content surface · agents.persona",
    lede: "A thin band, then the head with the face, the name and the actions. The definition on the left and what it may reach on the right, then one band for its tasks, its rules and its chats.",
    readout: [
      { label: "Bands", value: "3" },
      { label: "Definition sections", value: "5" },
      { label: "Defaults", value: "scope · tools" },
      { label: "Writes through", value: "updatePersona" }
    ]
  },
  {
    slug: "task",
    index: "05",
    label: "Task",
    path: "/task",
    title: "The task: what was asked, and what came of it.",
    eyebrow: "Content surface · agents.task",
    lede: "The instruction in full, the plan as a table whose right header is the percentage done, the questions as tabs with the agent's options and Other, the outputs, what it may reach, and the thread in its own territory with a composer that sends.",
    readout: [
      { label: "States", value: "running · pending review · finished" },
      { label: "Percentage", value: "from the plan" },
      { label: "Questions", value: "options · Other · Answer · Reject" },
      { label: "Runs anything", value: "No" }
    ]
  },
  {
    slug: "automation",
    index: "06",
    label: "Automation",
    path: "/automation",
    title: "The automation: a rule that makes tasks.",
    eyebrow: "Content surface · agents.automation",
    lede: "When it fires, whom it asks, what it says, and what it has fired. Four trigger cards with their parameters, a searchable persona picker beside the instruction, and a scope and tools relative to the persona's defaults.",
    readout: [
      { label: "Trigger kinds", value: "4" },
      { label: "Do this", value: "picker · prompt" },
      { label: "Run now", value: "makes one task" },
      { label: "Writes through", value: "updateAutomation" }
    ]
  },
  {
    slug: "backend",
    index: "07",
    label: "Backend",
    path: "/backend",
    title: "The backend: rows, doors and refusals.",
    eyebrow: "Representation · capability · seed",
    lede: "Six tables, one capability with seventeen procedures, and a seed for the Grid Resilience cast. Every write checks a revision, every refusal is an ordinary answer, and nothing starts an agent.",
    readout: [
      { label: "Tables", value: "6" },
      { label: "Procedures", value: "17" },
      { label: "Seed files", value: "6" },
      { label: "Runner", value: "Out of scope" }
    ]
  },
  {
    slug: "rebase",
    index: "08",
    label: "Rebase",
    path: "/rebase",
    title: "The rebase: nothing collided, and everything moved.",
    eyebrow: "Migration · onto work/derived-output-architecture",
    lede: "The category was one commit. It was replayed onto twenty-one commits of semantic overlay and derived output work and landed without a single conflict. That is the uninteresting half. The interesting half is what is now underneath it: an intelligence port, sixteen agent tools, a two-lane overlay and six new tables, none of which the category reads yet.",
    readout: [
      { label: "Conflicts", value: "0" },
      { label: "Commits replayed", value: "1" },
      { label: "Commits underneath", value: "21" },
      { label: "Files that arrived", value: "236" },
      { label: "Files both sides touched", value: "4" },
      { label: "Issues to resolve", value: "5" }
    ]
  },
  {
    slug: "intelligence",
    index: "09",
    label: "Intelligence",
    path: "/intelligence",
    title: "The intelligence layer, and the doors a chat needs.",
    eyebrow: "Model port · capability · procedures",
    lede: "One method on one port, an agent loop that runs inside it, and a grounded synthesis that already proves the shape. What chat adds is a turn that is a row, a persona's grants translated into a tool set, and a queue that survives a reload. Nothing here needs a new provider.",
    readout: [
      { label: "Port methods", value: "1" },
      { label: "Runtime tools today", value: "16" },
      { label: "Persona grants", value: "6" },
      { label: "Procedures to add", value: "7" },
      { label: "Rounds per turn", value: "Per call" },
      { label: "Streams today", value: "No" }
    ]
  },
  {
    slug: "explore",
    index: "10",
    label: "Explore",
    path: "/explore",
    title: "Explore: what you asked on top, the answer below.",
    eyebrow: "Research chat · built and answering",
    lede: "Built, wired to OpenRouter and answering from this project's own documents. The question sits at the top with how long ago and what it could see, the rest of the plane is the answer, and the composer holds the bottom. Threads and Turns are the left panels; findings and sources are the lens.",
    readout: [
      { label: "Modes shown", value: "3" },
      { label: "Modes wired", value: "1" },
      { label: "Tools the model has", value: "5" },
      { label: "Tools a person toggles", value: "1, and it is unbuilt" },
      { label: "Model", value: "moonshotai/kimi-k2.5" },
      { label: "A turn costs", value: "about a third of a cent" }
    ]
  },
  {
    slug: "response",
    index: "11",
    label: "Response",
    path: "/response",
    title: "The response: not text in, text out.",
    eyebrow: "Research chat · what an answer is made of",
    lede: "An answer is a list of blocks, and today every one of them happens to be a paragraph. The point of building it that way now is that a table, a chart or a slide is then a block the plane draws rather than a rewrite of the plane. Every block above prose is made by a tool call, which is what makes it checkable.",
    readout: [
      { label: "Block kinds today", value: "3 drawn, 5 stored" },
      { label: "Made by", value: "A tool call, always" },
      { label: "Actions on a block", value: "Add · Open" },
      { label: "Charts", value: "Not built" },
      { label: "Unknown block", value: "Says so, never blank" },
      { label: "Prose measure", value: "One column, 70ch" }
    ]
  },
  {
    slug: "personas",
    index: "12",
    label: "Personas",
    path: "/personas",
    title: "The persona: one row, and the root of what anyone can see.",
    eyebrow: "Specification · state, behaviour, procedures",
    lede: "A persona is a name, five sections of definition, a scope, a set of tool grants and a revision. It is also the visibility root of the whole agents system: a persona nobody can see hides every task, rule and chat that names it. This page is the row, the six procedures over it, and every step each one takes.",
    readout: [
      { label: "Fields", value: "11" },
      { label: "Definition sections", value: "5" },
      { label: "Procedures", value: "6" },
      { label: "Inherited at creation", value: "tools, never scope" },
      { label: "Refusals", value: "not-found · stale · in-use" },
      { label: "Project-gated", value: "Always" }
    ]
  },
  {
    slug: "tasks",
    index: "13",
    label: "Tasks",
    path: "/tasks",
    title: "The task: a run with no runner.",
    eyebrow: "Specification · state, behaviour, procedures",
    lede: "A task is a run: it starts when it is created and is running, pending review or finished. Every field a runner would write already has its shape and every one of them is empty, because nothing dispatches. This page is that shape, the procedures that exist, and precisely what a runner would have to do.",
    readout: [
      { label: "Fields", value: "18" },
      { label: "Procedures", value: "5" },
      { label: "Written by a runner", value: "plan · outputs · questions" },
      { label: "Dispatches", value: "Nothing" },
      { label: "Progress", value: "Derived, never stored" },
      { label: "Conversation", value: "threads and threadParts" }
    ]
  },
  {
    slug: "automations",
    index: "14",
    label: "Automations",
    path: "/automations",
    title: "The automation: a rule that makes tasks.",
    eyebrow: "Specification · state, behaviour, procedures",
    lede: "Four trigger kinds, one persona, one instruction, and a count of what it has fired. Run now makes a real task from the saved rule. Nothing else fires it, because there is no scheduler and no event dispatch, so three of the four kinds have never fired on their own.",
    readout: [
      { label: "Trigger kinds", value: "4" },
      { label: "Fire on their own", value: "0" },
      { label: "Procedures", value: "5" },
      { label: "Run now", value: "Makes one task" },
      { label: "Off is the safe removal", value: "Yes" },
      { label: "Refusals", value: "not-found · stale · in-use · invalid-state" }
    ]
  },
  {
    slug: "research-chat",
    index: "15",
    label: "Research chat",
    path: "/research-chat",
    title: "Research chat, whole: state, procedures, execution.",
    eyebrow: "Specification · a system of its own",
    lede: "Not part of the agents system. It shares the conversation primitive and nothing else, and the persona is the one seam where the two are meant to meet. This page is the four tables, the seven procedures with every step each performs, and the order in which one question becomes an answer.",
    readout: [
      { label: "Tables", value: "4, two of them its own" },
      { label: "Procedures", value: "5 remote, 2 internal" },
      { label: "Tools", value: "6" },
      { label: "Store writes per turn", value: "6, none during the loop" },
      { label: "Shares with agents", value: "threads and threadParts" },
      { label: "Steering", value: "None yet" }
    ]
  },
  {
    slug: "second-rebase",
    index: "16",
    label: "Rebase II",
    path: "/second-rebase",
    title: "The second rebase: a rewritten base, and six ways to stop.",
    eyebrow: "Operations · every conflict, and how it was addressed",
    lede: "The base was not extended, it was rebased onto three new commits on main and came back with different hashes. This page is what that cost: the two commits replayed, the three files git stopped on, the three more that only typecheck, the lint and the suite could see, and the hundred and fourteen findings that were worked off rather than excused.",
    readout: [
      { label: "Commits replayed", value: "2" },
      { label: "Commits underneath", value: "37, 21 of them rewritten" },
      { label: "Conflicts git found", value: "3" },
      { label: "Conflicts it did not", value: "3" },
      { label: "Lint findings", value: "129 · all 114 fixed · 0 held" },
      { label: "Baseline entries", value: "285, down from 300" }
    ]
  }
];

export const pageOf = (slug: PageSlug): PageRecord =>
  PAGES.find((page) => page.slug === slug) ?? PAGES[0];

export const hrefOf = (root: string, page: PageRecord): string => `${root}${page.path}`;
