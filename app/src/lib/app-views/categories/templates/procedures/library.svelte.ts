/**
 * The reactive sample read model shared by the template library, context view
 * and inspector.
 *
 * These rows deliberately stay outside representation: scope, last-used
 * history, descriptions and tags are not all represented yet. The mutations
 * below are session-local procedures so the mock behaves like one coherent
 * library without pretending that an unsupported write has been persisted.
 */

export type TemplateTarget = "Document" | "Slide deck" | "Spreadsheet";
export type TemplateScope = "Project" | "Shared" | "Personal";

export type TemplateVariable = {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly description: string;
  readonly type: "Text" | "Table" | "Image" | "Generated text";
  readonly required: boolean;
};

export type LibraryTemplate = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly makes: TemplateTarget;
  readonly scope: TemplateScope;
  readonly tags: readonly string[];
  readonly variables: readonly TemplateVariable[];
  readonly createdBy: string;
  readonly revision: number;
  readonly updated: string;
  readonly updatedAge: number;
  readonly lastUsed?: string;
  readonly lastUsedAge?: number;
};

export type TemplateLibrarySummary = {
  readonly total: number;
  readonly project: number;
  readonly shared: number;
  readonly personal: number;
  readonly documents: number;
  readonly slideDecks: number;
  readonly spreadsheets: number;
};

const variable = (
  template: string,
  name: string,
  label: string,
  type: TemplateVariable["type"],
  required: boolean,
  description = `${label} supplied when the template is used.`
): TemplateVariable => ({
  id: `${template}:${name}`,
  name,
  label,
  description,
  type,
  required
});

const INITIAL_TEMPLATES: LibraryTemplate[] = [
  {
    id: "tp-filing",
    name: "Regulatory filing shell",
    description: "A filing structure with docket, party and outage evidence placeholders.",
    makes: "Document",
    scope: "Project",
    tags: ["Regulatory", "External reporting"],
    variables: [
      variable("tp-filing", "filingDocket", "Filing docket", "Text", true),
      variable("tp-filing", "filingParty", "Filing party", "Text", true),
      variable("tp-filing", "outageTable", "Outage table", "Table", true),
      variable(
        "tp-filing",
        "executiveSummary",
        "Executive summary",
        "Generated text",
        false,
        "An optional generated synopsis of the filing evidence."
      )
    ],
    createdBy: "Mira Okonkwo",
    revision: 7,
    updated: "2 weeks ago",
    updatedAge: 20_160,
    lastUsed: "3 days ago",
    lastUsedAge: 4_320
  },
  {
    id: "tp-storm",
    name: "Storm brief",
    description: "A concise response brief for an active weather event.",
    makes: "Document",
    scope: "Project",
    tags: ["Incident response", "Briefing"],
    variables: [
      variable("tp-storm", "eventName", "Event name", "Text", true),
      variable("tp-storm", "impactArea", "Impact area", "Text", true),
      variable(
        "tp-storm",
        "statusSummary",
        "Status summary",
        "Generated text",
        false,
        "A generated summary of the latest response status."
      )
    ],
    createdBy: "Ana Duarte",
    revision: 3,
    updated: "5 weeks ago",
    updatedAge: 50_400,
    lastUsed: "2 weeks ago",
    lastUsedAge: 20_160
  },
  {
    id: "tp-board",
    name: "Board update",
    description: "A board-ready narrative with a headline and one supporting chart.",
    makes: "Slide deck",
    scope: "Project",
    tags: ["Leadership", "Briefing"],
    variables: [
      variable("tp-board", "reportingPeriod", "Reporting period", "Text", true),
      variable(
        "tp-board",
        "headlineChart",
        "Headline chart",
        "Image",
        false,
        "An optional chart or graphic used on the opening slide."
      )
    ],
    createdBy: "Tomás Lindqvist",
    revision: 5,
    updated: "3 weeks ago",
    updatedAge: 30_240,
    lastUsed: "1 week ago",
    lastUsedAge: 10_080
  },
  {
    id: "tp-ops",
    name: "Weekly ops deck",
    description: "The recurring project deck for operational status and decisions.",
    makes: "Slide deck",
    scope: "Project",
    tags: ["Operations", "Leadership"],
    variables: [],
    createdBy: "Mira Okonkwo",
    revision: 11,
    updated: "8 weeks ago",
    updatedAge: 80_640,
    lastUsed: "Yesterday",
    lastUsedAge: 1_440
  },
  {
    id: "tp-executive-deck",
    name: "Executive update deck",
    description: "A concise branded deck for a project-level executive update.",
    makes: "Slide deck",
    scope: "Personal",
    tags: ["Presentation", "Brand"],
    variables: [variable("tp-executive-deck", "deckTitle", "Deck title", "Text", true)],
    createdBy: "Priya Raghunathan",
    revision: 2,
    updated: "6 weeks ago",
    updatedAge: 60_480,
    lastUsed: "4 weeks ago",
    lastUsedAge: 40_320
  },
  {
    id: "tp-cost",
    name: "Cost model skeleton",
    description: "A clean workbook scaffold for comparing intervention costs.",
    makes: "Spreadsheet",
    scope: "Project",
    tags: ["Finance", "Planning"],
    variables: [],
    createdBy: "Tomás Lindqvist",
    revision: 6,
    updated: "9 weeks ago",
    updatedAge: 90_720,
    lastUsed: "Today",
    lastUsedAge: 0
  },
  {
    id: "tp-incident",
    name: "Incident review",
    description: "A shared retrospective for cause, impact and corrective actions.",
    makes: "Document",
    scope: "Shared",
    tags: ["Incident response", "Review"],
    variables: [],
    createdBy: "Arne Bakker",
    revision: 9,
    updated: "6 months ago",
    updatedAge: 262_800,
    lastUsed: "5 months ago",
    lastUsedAge: 219_000
  },
  {
    id: "tp-review-deck",
    name: "Sectioned review deck",
    description: "A personal review deck with branded section breaks.",
    makes: "Slide deck",
    scope: "Personal",
    tags: ["Presentation", "Review"],
    variables: [variable("tp-review-deck", "sectionName", "Section name", "Text", true)],
    createdBy: "Ana Duarte",
    revision: 1,
    updated: "7 months ago",
    updatedAge: 306_600,
    lastUsed: "6 months ago",
    lastUsedAge: 262_800
  },
  {
    id: "tp-decision",
    name: "Decision memo",
    description: "A short decision record with alternatives, evidence and a recommendation.",
    makes: "Document",
    scope: "Project",
    tags: ["Decision", "Leadership"],
    variables: [
      variable("tp-decision", "decisionOwner", "Decision owner", "Text", true),
      variable("tp-decision", "alternatives", "Alternatives", "Table", true),
      variable(
        "tp-decision",
        "recommendation",
        "Recommendation",
        "Generated text",
        false,
        "An optional recommendation generated from the listed alternatives."
      )
    ],
    createdBy: "Priya Raghunathan",
    revision: 4,
    updated: "4 weeks ago",
    updatedAge: 40_320,
    lastUsed: "3 weeks ago",
    lastUsedAge: 30_240
  },
  {
    id: "tp-capacity",
    name: "Capacity forecast",
    description: "A shared workbook for monthly demand and staffing forecasts.",
    makes: "Spreadsheet",
    scope: "Shared",
    tags: ["Operations", "Planning"],
    variables: [
      variable("tp-capacity", "forecastPeriod", "Forecast period", "Text", true),
      variable("tp-capacity", "demandTable", "Demand table", "Table", true)
    ],
    createdBy: "Mira Okonkwo",
    revision: 2,
    updated: "7 weeks ago",
    updatedAge: 70_560,
    lastUsed: "6 weeks ago",
    lastUsedAge: 60_480
  }
];

let templates = $state<LibraryTemplate[]>(INITIAL_TEMPLATES);
let mockSerial = 0;

const nextMockId = (kind: string): string => {
  mockSerial += 1;
  return `tp-${kind}-${mockSerial}`;
};

/** Every template visible to the current library scope. */
export const templatesIn = (projectId: string): readonly LibraryTemplate[] => {
  void projectId;
  return templates;
};

/** One selected template, if that id belongs to this library. */
export const templateIn = (
  projectId: string,
  templateId: string | undefined
): LibraryTemplate | undefined =>
  templateId === undefined
    ? undefined
    : templatesIn(projectId).find((template) => template.id === templateId);

/** The bounded usage shelf, newest use first. */
export const recentTemplatesIn = (
  projectId: string,
  limit = 10
): readonly (LibraryTemplate & { readonly lastUsed: string; readonly lastUsedAge: number })[] =>
  templatesIn(projectId)
    .filter(
      (
        template
      ): template is LibraryTemplate & {
        readonly lastUsed: string;
        readonly lastUsedAge: number;
      } => template.lastUsed !== undefined && template.lastUsedAge !== undefined
    )
    .toSorted((a, b) => a.lastUsedAge - b.lastUsedAge)
    .slice(0, Math.max(0, limit));

/** Counts used by the library overview context. */
export const templateLibrarySummaryIn = (projectId: string): TemplateLibrarySummary => {
  const rows = templatesIn(projectId);
  const count = (predicate: (template: LibraryTemplate) => boolean): number =>
    rows.filter(predicate).length;

  return {
    total: rows.length,
    project: count((template) => template.scope === "Project"),
    shared: count((template) => template.scope === "Shared"),
    personal: count((template) => template.scope === "Personal"),
    documents: count((template) => template.makes === "Document"),
    slideDecks: count((template) => template.makes === "Slide deck"),
    spreadsheets: count((template) => template.makes === "Spreadsheet")
  };
};

/** Replace one template's description for this browser session. */
export const updateTemplateDescription = (
  projectId: string,
  templateId: string,
  description: string
): boolean => {
  const index = templatesIn(projectId).findIndex((template) => template.id === templateId);
  if (index < 0) return false;
  templates[index] = { ...templates[index], description: description.trim() };
  return true;
};

/** Add one unique tag to a template for this browser session. */
export const addTemplateTag = (projectId: string, templateId: string, tag: string): boolean => {
  const value = tag.trim();
  const index = templatesIn(projectId).findIndex((template) => template.id === templateId);
  if (value === "" || index < 0) return false;

  const row = templates[index];
  if (row.tags.some((candidate) => candidate.toLocaleLowerCase() === value.toLocaleLowerCase())) {
    return false;
  }

  templates[index] = { ...row, tags: [...row.tags, value] };
  return true;
};

/** Duplicate one template as an independent session-local row. */
export const duplicateTemplate = (
  projectId: string,
  templateId: string
): LibraryTemplate | undefined => {
  const source = templateIn(projectId, templateId);
  if (source === undefined) return undefined;

  const id = nextMockId("copy");
  const copy: LibraryTemplate = {
    ...source,
    id,
    name: `${source.name} copy`,
    tags: [...source.tags],
    variables: source.variables.map((entry) => ({ ...entry, id: `${id}:${entry.name}` })),
    createdBy: "You",
    revision: 1,
    updated: "Today",
    updatedAge: 0,
    lastUsed: undefined,
    lastUsedAge: undefined
  };
  templates.unshift(copy);
  return copy;
};

/** Remove one template from the session-local library. */
export const removeTemplate = (projectId: string, templateId: string): boolean => {
  const index = templatesIn(projectId).findIndex((template) => template.id === templateId);
  if (index < 0) return false;
  templates.splice(index, 1);
  return true;
};

/** Create an empty template of one supported kind for this browser session. */
export const createTemplate = (
  projectId: string,
  makes: TemplateTarget
): LibraryTemplate => {
  void projectId;
  const id = nextMockId("new");
  const name = {
    Document: "Untitled document template",
    "Slide deck": "Untitled slide deck template",
    Spreadsheet: "Untitled spreadsheet template"
  }[makes];
  const template: LibraryTemplate = {
    id,
    name,
    description: `A new ${makes.toLocaleLowerCase()} template.`,
    makes,
    scope: "Project",
    tags: [],
    variables: [],
    createdBy: "You",
    revision: 1,
    updated: "Today",
    updatedAge: 0
  };
  templates.unshift(template);
  return template;
};
