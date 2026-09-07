import type { PageRecord, PageSlug } from "$development-views/agents-reference/types";

export const referenceRoot = (project: string): string => `/app/${project}/reference/agents`;

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
      { label: "Open forks", value: "15" },
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
  }
];

export const pageOf = (slug: PageSlug): PageRecord =>
  PAGES.find((page) => page.slug === slug) ?? PAGES[0];

export const hrefOf = (root: string, page: PageRecord): string => `${root}${page.path}`;
