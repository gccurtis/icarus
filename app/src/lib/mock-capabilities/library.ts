/**
 * Collections and launchers: the every-X lists, the New Tab recents, and
 * everything a launcher can make, start from, or bring in.
 *
 * `docs/screen-panel-views/context/library/` and `inspector/library/` are what
 * these serve. Two kinds of door live here and they answer different questions.
 * A collection door answers with what the project already holds. A launcher door
 * answers with draft state a tab is holding for something that does not exist
 * yet — and it is still a door rather than a prop, because the defaults it hands
 * back are the ones the editor will show once **Create** is pressed, and a panel
 * inventing them locally is how the two drift.
 */
import {
  PROJECT,
  RESOURCES,
  byKind,
  type Resource,
  type ResourceKind
} from "$mock-capabilities/cast";
import { read, type Read } from "$mock-capabilities/read";

/* ------------------------------------------------------------------ */
/* Collections                                                         */
/* ------------------------------------------------------------------ */

export type AnalysisRow = {
  readonly id: string;
  readonly name: string;
  readonly chart: "Bar" | "Line" | "Table" | "Area";
  /**
   * When it last ran. A result is not stored, so this describes an artefact that
   * no longer exists — which the Analyses view says out loud rather than hide.
   */
  readonly ran: string;
};

export type ContextRow = {
  readonly id: string;
  readonly name: string;
  readonly rule: string;
  /** Resolved now, not stored. Zero is a real answer and reads as "matches nothing". */
  readonly resolves: number;
};

export type FindingRow = {
  readonly id: string;
  readonly title: string;
  /** The thread it came out of, named as a reader would recognise it. */
  readonly from: string;
  /** What it bears on, when a `ResearchLink` exists. */
  readonly bearsOn?: string;
  readonly acceptedBy: string;
  readonly age: string;
};

export type QuestionRow = {
  readonly id: string;
  readonly title: string;
  readonly status: "Open" | "Investigating" | "Answered";
  /** Absent on a root question. The view nests one level off this. */
  readonly parentId?: string;
};

export type HypothesisRow = {
  readonly id: string;
  readonly title: string;
  readonly assessment: "Untested" | "Testing" | "Supported" | "Ruled out";
};

export type ThreadRow = {
  readonly id: string;
  readonly title: string;
  readonly mode: "Discover" | "Question" | "Hypothesis";
  readonly turns: number;
  /** Answered is a projection of the anchoring question today, not a stored state. */
  readonly state: "open" | "answered";
  readonly activity: string;
  /** Accepted findings this thread produced. */
  readonly findings: number;
};

/**
 * One row of the merged Recent list. `why` is on the row because the list is two
 * lists — what you opened and what changed — and without it a document you have
 * never opened appears under Recent with nothing to explain why.
 */
export type RecentRow = {
  readonly id: string;
  readonly name: string;
  readonly kind: ResourceKind;
  readonly day: "Today" | "Yesterday" | "Earlier";
  readonly age: string;
  readonly why: "You opened it" | "Someone edited it";
  readonly updatedBy: string;
};

export const analyses = (): Read<readonly AnalysisRow[]> =>
  read([
    { id: "an-minutes", name: "Outage minutes by substation", chart: "Bar", ran: "2 minutes ago" },
    { id: "an-cost", name: "Cost per avoided minute", chart: "Bar", ran: "Yesterday" },
    { id: "an-month", name: "Events by month", chart: "Line", ran: "3 days ago" },
    { id: "an-spend", name: "Spend against authorization", chart: "Table", ran: "1 week ago" },
    { id: "an-restore", name: "Restoration time by crew", chart: "Line", ran: "4 hours ago" }
  ]);

export const contexts = (): Read<readonly ContextRow[]> =>
  read([
    {
      id: "cx-not-drafts",
      name: "Everything but drafts",
      rule: "Everything in this project, minus documents marked draft",
      resolves: 211
    },
    {
      id: "cx-regulatory",
      name: "Regulatory corpus",
      rule: "Commission filings and orders, 2019 onward",
      resolves: 34
    },
    {
      id: "cx-field",
      name: "Field reports 2024–25",
      rule: "Connector files under Ops Reports, two winters",
      resolves: 96
    },
    {
      id: "cx-precedents",
      name: "Storm precedents",
      rule: "Filings by other utilities after a named winter storm",
      resolves: 0
    },
    {
      id: "cx-evidence",
      name: "Filing evidence",
      rule: "Everything in this project, minus slide decks",
      resolves: 24
    },
    { id: "cx-accepted", name: "Accepted findings", rule: "Findings, accepted", resolves: 18 }
  ]);

/** What a Context could name, one kind at a time, from the one cast. */
export const resourcesOfKind = (kind: ResourceKind): Read<readonly Resource[]> =>
  read(byKind(kind));

export const findings = (): Read<readonly FindingRow[]> =>
  read([
    {
      id: "f-relay",
      title: "Feeder 12 relay mis-coordinated",
      from: "Why did Feeder 12 fail twice?",
      bearsOn: "Coordination was never redone",
      acceptedBy: "Grid Analyst",
      age: "Yesterday"
    },
    {
      id: "f-saidi",
      title: "Undergrounding cut SAIDI 38%",
      from: "Undergrounding beats vegetation management",
      bearsOn: "Undergrounding pays back inside the authorization",
      acceptedBy: "Grid Analyst",
      age: "6 days ago"
    },
    {
      id: "f-study",
      title: "No coordination study after the 2024 reconductoring",
      from: "Why did Feeder 12 fail twice?",
      bearsOn: "Coordination was never redone",
      acceptedBy: "Mira Jain",
      age: "1 week ago"
    },
    {
      id: "f-class",
      title: "Eastbrook shares the 1978 relay class",
      from: "Is Eastbrook exposed the same way?",
      acceptedBy: "Grid Analyst",
      age: "2 days ago"
    },
    {
      id: "f-veg",
      title: "Vegetation contact explains 11 of 34 winter outages",
      from: "Undergrounding beats vegetation management",
      bearsOn: "Vegetation was the shared cause",
      acceptedBy: "Ana Reyes",
      age: "5 days ago"
    },
    {
      id: "f-peak",
      title: "The 2024 study assumed a 1-in-10 winter peak",
      from: "What did the 2024 study assume?",
      acceptedBy: "Source Checker",
      age: "2 weeks ago"
    }
  ]);

export const questions = (): Read<readonly QuestionRow[]> =>
  read([
    { id: "q-11", title: "Why do feeders fail repeatedly?", status: "Investigating" },
    {
      id: "q-14",
      title: "Why did Feeder 12 fail twice?",
      status: "Investigating",
      parentId: "q-11"
    },
    { id: "q-15", title: "Is Eastbrook exposed the same way?", status: "Open", parentId: "q-11" },
    { id: "q-21", title: "What did undergrounding actually buy?", status: "Investigating" },
    {
      id: "q-22",
      title: "Did SAIDI improve outside Ward 3?",
      status: "Open",
      parentId: "q-21"
    },
    { id: "q-08", title: "What did the 2024 study assume?", status: "Answered" }
  ]);

export const hypotheses = (): Read<readonly HypothesisRow[]> =>
  read([
    { id: "h-3", title: "Coordination was never redone", assessment: "Testing" },
    { id: "h-2", title: "Vegetation was the shared cause", assessment: "Ruled out" },
    {
      id: "h-5",
      title: "Undergrounding pays back inside the authorization",
      assessment: "Testing"
    },
    { id: "h-6", title: "Load growth outran the 2019 rebuild", assessment: "Untested" }
  ]);

export const threads = (): Read<readonly ThreadRow[]> =>
  read([
    {
      id: "th-feeder",
      title: "Why did Feeder 12 fail twice?",
      mode: "Question",
      turns: 3,
      state: "open",
      activity: "Yesterday",
      findings: 2
    },
    {
      id: "th-eastbrook",
      title: "Is Eastbrook exposed the same way?",
      mode: "Question",
      turns: 4,
      state: "open",
      activity: "2 days ago",
      findings: 1
    },
    {
      id: "th-under",
      title: "Undergrounding beats vegetation management",
      mode: "Hypothesis",
      turns: 22,
      state: "open",
      activity: "6 days ago",
      findings: 2
    },
    {
      id: "th-precedents",
      title: "Winter storm precedents",
      mode: "Discover",
      turns: 9,
      state: "open",
      activity: "1 week ago",
      findings: 0
    },
    {
      id: "th-2024",
      title: "What did the 2024 study assume?",
      mode: "Question",
      turns: 6,
      state: "answered",
      activity: "2 weeks ago",
      findings: 2
    },
    {
      id: "th-2019",
      title: "Did the 2019 hardening program hit its targets?",
      mode: "Hypothesis",
      turns: 9,
      state: "answered",
      activity: "3 weeks ago",
      findings: 3
    }
  ]);

export const recents = (): Read<readonly RecentRow[]> =>
  read([
    {
      id: "r-memo",
      name: "Q3 Resilience Memo",
      kind: "document",
      day: "Today",
      age: "4 minutes ago",
      why: "You opened it",
      updatedBy: "Ana Reyes"
    },
    {
      id: "r-cost",
      name: "Outage Cost Model",
      kind: "spreadsheet",
      day: "Today",
      age: "26 minutes ago",
      why: "Someone edited it",
      updatedBy: "Mira Jain"
    },
    {
      id: "r-feeder",
      name: "Why did Feeder 12 fail twice?",
      kind: "research",
      day: "Yesterday",
      age: "Yesterday",
      why: "You opened it",
      updatedBy: "Ana Reyes"
    },
    {
      id: "r-review",
      name: "Interconnect Failure Review",
      kind: "document",
      day: "Yesterday",
      age: "Yesterday",
      why: "Someone edited it",
      updatedBy: "Mira Jain"
    },
    {
      id: "r-board",
      name: "Board Update — October",
      kind: "slides",
      day: "Earlier",
      age: "2 days ago",
      why: "You opened it",
      updatedBy: "Tomas Kaur"
    },
    {
      id: "r-minutes",
      name: "Outage minutes by substation",
      kind: "analysis",
      day: "Earlier",
      age: "3 days ago",
      why: "You opened it",
      updatedBy: "Mira Jain"
    },
    {
      id: "r-nerc",
      name: "NERC-2025-winter-review.pdf",
      kind: "file",
      day: "Earlier",
      age: "4 days ago",
      why: "Someone edited it",
      updatedBy: "SharePoint — Ops Reports"
    },
    {
      id: "r-inventory",
      name: "Substation Inventory",
      kind: "spreadsheet",
      day: "Earlier",
      age: "5 days ago",
      why: "Someone edited it",
      updatedBy: "SharePoint — Ops Reports"
    }
  ]);

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

/** Fixed at creation: what a template makes cannot be changed afterwards. */
export type TemplateTarget = "Document" | "Slide deck" | "Slide" | "Spreadsheet";

/** Stored as scope; the library words it *Project | Global*, a lens *This project | Everywhere*. */
export type TemplateScope = "Project" | "Global";

export type LibraryTemplate = {
  readonly id: string;
  readonly name: string;
  readonly makes: TemplateTarget;
  readonly scope: TemplateScope;
  /** On the row so a list can say "4 variables" without loading the variable list. */
  readonly variables: number;
  readonly updated: string;
  /** Absent until something has been made from it — see `recentlyUsedTemplates`. */
  readonly lastUsed?: string;
  readonly createdBy: string;
  readonly revision: number;
};

export type VariableType = "Text" | "Image" | "Table" | "Generated";

export type TemplateVariable = {
  readonly id: string;
  readonly templateId: string;
  /** What the body references. Not what a person reads — both are needed. */
  readonly key: string;
  readonly label: string;
  readonly type: VariableType;
  readonly required: boolean;
  /** A generated variable is not a question: it becomes this in the result. */
  readonly becomes?: string;
  readonly defaultValue?: string;
};

/**
 * One line of a template preview, drawn from the body rather than a thumbnail —
 * the model has no thumbnail field and the library must not imply one. `variable`
 * is what lets a preview distinguish an opening from ordinary content.
 */
export type PreviewLine = {
  readonly id: string;
  readonly text: string;
  readonly style: "heading" | "body";
  readonly variable: boolean;
};

export type TemplateKind = {
  readonly id: string;
  readonly makes: TemplateTarget;
  readonly blurb: string;
};

const TEMPLATES: readonly LibraryTemplate[] = [
  {
    id: "tp-filing",
    name: "Regulatory filing shell",
    makes: "Document",
    scope: "Project",
    variables: 4,
    updated: "2 weeks ago",
    lastUsed: "3 days ago",
    createdBy: "Mira Jain",
    revision: 6
  },
  {
    id: "tp-storm",
    name: "Storm brief",
    makes: "Document",
    scope: "Project",
    variables: 3,
    updated: "5 weeks ago",
    createdBy: "Ana Reyes",
    revision: 2
  },
  {
    id: "tp-board",
    name: "Board update",
    makes: "Slide deck",
    scope: "Project",
    variables: 2,
    updated: "3 weeks ago",
    lastUsed: "1 week ago",
    createdBy: "Tomas Kaur",
    revision: 4
  },
  {
    id: "tp-ops",
    name: "Weekly ops deck",
    makes: "Slide deck",
    scope: "Project",
    variables: 0,
    updated: "8 weeks ago",
    lastUsed: "Yesterday",
    createdBy: "Tomas Kaur",
    revision: 11
  },
  {
    id: "tp-title",
    name: "Title slide",
    makes: "Slide",
    scope: "Project",
    variables: 1,
    updated: "6 weeks ago",
    createdBy: "Tomas Kaur",
    revision: 1
  },
  {
    id: "tp-cost",
    name: "Cost model skeleton",
    makes: "Spreadsheet",
    scope: "Project",
    variables: 0,
    updated: "9 weeks ago",
    lastUsed: "Today",
    createdBy: "Mira Jain",
    revision: 3
  },
  {
    id: "tp-incident",
    name: "Incident review",
    makes: "Document",
    scope: "Global",
    variables: 0,
    updated: "6 months ago",
    createdBy: "Devi Okonkwo",
    revision: 8
  },
  {
    id: "tp-divider",
    name: "Section divider",
    makes: "Slide",
    scope: "Global",
    variables: 1,
    updated: "7 months ago",
    createdBy: "Devi Okonkwo",
    revision: 2
  }
];

const TEMPLATE_VARIABLES: readonly TemplateVariable[] = [
  {
    id: "tv-docket",
    templateId: "tp-filing",
    key: "filingDocket",
    label: "Docket number",
    type: "Text",
    required: true
  },
  {
    id: "tv-party",
    templateId: "tp-filing",
    key: "filingParty",
    label: "Filing party",
    type: "Text",
    required: true,
    defaultValue: "Northwind Power"
  },
  {
    id: "tv-outages",
    templateId: "tp-filing",
    key: "outageTable",
    label: "Outage record",
    type: "Table",
    required: true
  },
  {
    id: "tv-exec",
    templateId: "tp-filing",
    key: "execSummary",
    label: "Executive summary",
    type: "Generated",
    required: false,
    becomes: "A prompt block in the result"
  },
  {
    id: "tv-storm-name",
    templateId: "tp-storm",
    key: "stormName",
    label: "Storm name",
    type: "Text",
    required: true
  },
  {
    id: "tv-storm-window",
    templateId: "tp-storm",
    key: "stormWindow",
    label: "Dates affected",
    type: "Text",
    required: true
  },
  {
    id: "tv-storm-takeaways",
    templateId: "tp-storm",
    key: "keyTakeaways",
    label: "Key takeaways",
    type: "Generated",
    required: false,
    becomes: "A prompt block in the result"
  },
  {
    id: "tv-quarter",
    templateId: "tp-board",
    key: "quarter",
    label: "Quarter",
    type: "Text",
    required: true,
    defaultValue: "Q4 2026"
  },
  {
    id: "tv-chart",
    templateId: "tp-board",
    key: "headlineChart",
    label: "Headline chart",
    type: "Image",
    required: false
  },
  {
    id: "tv-deck-title",
    templateId: "tp-title",
    key: "deckTitle",
    label: "Deck title",
    type: "Text",
    required: true
  },
  {
    id: "tv-section",
    templateId: "tp-divider",
    key: "sectionName",
    label: "Section name",
    type: "Text",
    required: true
  }
];

export const templates = (): Read<readonly LibraryTemplate[]> => read(TEMPLATES);

export const template = (templateId: string): Read<LibraryTemplate> =>
  read(TEMPLATES.find((row: LibraryTemplate) => row.id === templateId) ?? TEMPLATES[0]);

export const templateKinds = (): Read<readonly TemplateKind[]> =>
  read([
    {
      id: "tk-document",
      makes: "Document",
      blurb: "A paginated body with variables left open."
    },
    { id: "tk-deck", makes: "Slide deck", blurb: "A whole deck: layouts, theme, sections." },
    {
      id: "tk-slide",
      makes: "Slide",
      // A slide template is inserted into an existing deck, never opened as one.
      blurb: "One slide, reusable on its own. Inserted into any deck."
    },
    {
      id: "tk-sheet",
      makes: "Spreadsheet",
      blurb: "One grid of cells holding text and formulas."
    }
  ]);

export const variablesIn = (templateId: string): Read<readonly TemplateVariable[]> =>
  read(
    TEMPLATE_VARIABLES.filter((variable: TemplateVariable) => variable.templateId === templateId)
  );

export const templateVariable = (variableId: string): Read<TemplateVariable> =>
  read(
    TEMPLATE_VARIABLES.find((variable: TemplateVariable) => variable.id === variableId) ??
      TEMPLATE_VARIABLES[0]
  );

export const previewOf = (templateId: string): Read<readonly PreviewLine[]> => {
  void templateId;
  return read([
    { id: "pl-1", text: "Filing to the Commission", style: "heading", variable: false },
    { id: "pl-2", text: "Docket {filingDocket}", style: "body", variable: true },
    {
      id: "pl-3",
      text: "{filingParty} submits this application under §16-108.",
      style: "body",
      variable: true
    },
    { id: "pl-4", text: "Outage record", style: "heading", variable: false },
    { id: "pl-5", text: "{outageTable}", style: "body", variable: true },
    { id: "pl-6", text: "Statutory basis", style: "heading", variable: false }
  ]);
};

/** Changed lately. A different question from used lately, and a different list. */
export const recentlyUpdatedTemplates = (): Read<readonly LibraryTemplate[]> =>
  read(TEMPLATES.slice(0, 3));

/**
 * Used lately. Nothing counts uses — the resource made from a template records
 * its origin — so this is a reverse query over resources, and a template with no
 * `lastUsed` simply never appears.
 */
export const recentlyUsedTemplates = (): Read<readonly LibraryTemplate[]> =>
  read(TEMPLATES.filter((row: LibraryTemplate) => row.lastUsed !== undefined));

/* ------------------------------------------------------------------ */
/* Template authoring                                                  */
/* ------------------------------------------------------------------ */

export type OutlineHeading = {
  readonly id: string;
  readonly text: string;
  readonly level: 1 | 2;
  readonly page: number;
};

export type StyleRow = {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
};

export type PageSetup = {
  readonly paper: "Letter" | "A4";
  readonly orientation: "Portrait" | "Landscape";
  readonly gutters: string;
};

export type InsertOption = {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
};

/** The three kinds of opening a template can leave in its body. */
export type VariableKindOption = {
  readonly id: string;
  readonly name: string;
  readonly makes: VariableType;
  readonly detail: string;
};

/** Content selected while authoring: the document inspector, reused exactly. */
export type BodyEntity = {
  readonly id: string;
  readonly text: string;
  readonly variant: string;
  readonly variants: readonly string[];
  /** The crumb has to say *template*, or authoring looks like editing the result. */
  readonly owner: { readonly kind: "Template"; readonly id: string; readonly name: string };
};

export const outlineIn = (templateId: string): Read<readonly OutlineHeading[]> => {
  void templateId;
  return read([
    { id: "oh-1", text: "Filing to the Commission", level: 1, page: 1 },
    { id: "oh-2", text: "Outage record", level: 1, page: 1 },
    { id: "oh-3", text: "Statutory basis", level: 1, page: 2 },
    { id: "oh-4", text: "Relief requested", level: 1, page: 3 },
    { id: "oh-5", text: "Cost recovery", level: 2, page: 3 },
    { id: "oh-6", text: "Exhibits", level: 1, page: 4 }
  ]);
};

export const stylesIn = (templateId: string): Read<readonly StyleRow[]> => {
  void templateId;
  return read([
    { id: "st-body", name: "Body", detail: "Source Serif · 11 pt · 1.4" },
    { id: "st-h1", name: "Heading 1", detail: "Source Sans · 18 pt · bold" },
    { id: "st-h2", name: "Heading 2", detail: "Source Sans · 14 pt · semibold" },
    { id: "st-quote", name: "Quotation", detail: "Source Serif · 11 pt · indented" }
  ]);
};

export const pageSetupFor = (templateId: string): Read<PageSetup> => {
  void templateId;
  return read({ paper: "Letter", orientation: "Portrait", gutters: "1 in all round" });
};

export const insertBlocks = (): Read<readonly InsertOption[]> =>
  read([
    { id: "ib-text", name: "Text block", detail: "A paragraph in the body style" },
    { id: "ib-heading", name: "Heading", detail: "Starts an outline entry" },
    { id: "ib-table", name: "Table", detail: "Rows and columns, fixed at insert" }
  ]);

export const variableKinds = (): Read<readonly VariableKindOption[]> =>
  read([
    {
      id: "vk-text",
      name: "Text variable",
      makes: "Text",
      detail: "Asked for on a line at instantiation"
    },
    {
      id: "vk-table",
      name: "Table variable",
      makes: "Table",
      detail: "Filled from a project variable or an upload"
    },
    {
      id: "vk-generated",
      name: "Generated variable",
      makes: "Generated",
      // Never a question at instantiation, which is why it is a variable kind
      // rather than an Insert of a prompt block.
      detail: "Becomes a prompt block in the result"
    }
  ]);

export const bodyEntity = (entityId: string): Read<BodyEntity> => {
  void entityId;
  return read({
    id: "be-1",
    text: "Filing to the Commission",
    variant: "Heading 1",
    variants: ["Body", "Heading 1", "Heading 2"],
    owner: { kind: "Template", id: "tp-filing", name: "Regulatory filing shell" }
  });
};

/* ------------------------------------------------------------------ */
/* Using a template                                                    */
/* ------------------------------------------------------------------ */

export type InstantiationAsk = {
  readonly key: string;
  readonly label: string;
  readonly type: VariableType;
  /** What has been supplied so far. "Not set" is the state everything starts in. */
  readonly state: string;
};

export type Instantiation = {
  readonly makes: TemplateTarget;
  readonly called: string;
  readonly into: string;
  readonly asks: readonly InstantiationAsk[];
  /** Not questions. They become prompt blocks, and the section starts collapsed. */
  readonly generated: readonly InstantiationAsk[];
  /**
   * Always false. No body entity carries a variable key, so a supplied value has
   * nowhere to go — which is the one fact this whole form has to admit.
   */
  readonly canCreate: boolean;
  readonly blockedBecause: string;
};

export const useTemplateDraft = (templateId: string): Read<Instantiation> => {
  const chosen = TEMPLATES.find((row: LibraryTemplate) => row.id === templateId) ?? TEMPLATES[0];
  const asked = TEMPLATE_VARIABLES.filter(
    (variable: TemplateVariable) => variable.templateId === chosen.id
  );
  const toAsk = (variable: TemplateVariable): InstantiationAsk => ({
    key: variable.key,
    label: variable.label,
    type: variable.type,
    state: variable.defaultValue ?? "Not set"
  });
  return read({
    makes: chosen.makes,
    called: "Q4 Filing Draft",
    into: PROJECT.name,
    asks: asked.filter((variable: TemplateVariable) => variable.type !== "Generated").map(toAsk),
    generated: asked
      .filter((variable: TemplateVariable) => variable.type === "Generated")
      .map(toAsk),
    canCreate: false,
    blockedBecause: "Nothing in a body records which variable it stands for."
  });
};

/* ------------------------------------------------------------------ */
/* Bringing material in                                                */
/* ------------------------------------------------------------------ */

export type ConnectorRow = {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly state: "Connected" | "Syncing" | "Expired";
  readonly detail: string;
  /** What it stands for in the Resources view: a connector, not 312 rows. */
  readonly files: number;
};

export type ProviderRow = {
  readonly id: string;
  readonly name: string;
  readonly brings: string;
};

export type ConnectorScope = {
  readonly name: string;
  readonly required: boolean;
  readonly granted: boolean;
};

export type ConnectorDetail = {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly purpose: string;
  /** Chosen explicitly. Never inferred from the provider. */
  readonly scopes: readonly ConnectorScope[];
  readonly auth: "Connected" | "Expired" | "Never connected";
  readonly lastSync?: string;
};

export type UploadRow = {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  readonly mime: string;
  readonly percent: number;
  readonly state: "Queued" | "Uploading" | "Extracting" | "Done" | "Failed";
};

/** Progress of the batch, plus what happens after the bytes land. */
export type Ingestion = {
  readonly label: string;
  readonly finished: number;
  readonly total: number;
  readonly then: string;
};

const CONNECTORS: readonly ConnectorRow[] = [
  {
    id: "cn-sharepoint",
    name: "SharePoint — Ops Reports",
    provider: "SharePoint",
    state: "Expired",
    detail: "Authentication expired, reconnect",
    files: 312
  },
  {
    id: "cn-drive",
    name: "Google Drive — Filings",
    provider: "Google Drive",
    state: "Connected",
    detail: "Synced 2 hours ago",
    files: 84
  },
  {
    id: "cn-confluence",
    name: "Confluence — Reliability Engineering",
    provider: "Confluence",
    state: "Syncing",
    detail: "148 of 640 pages",
    files: 148
  }
];

export const connectors = (): Read<readonly ConnectorRow[]> => read(CONNECTORS);

/** Deployment configuration rather than project data — see the spec's open question. */
export const providers = (): Read<readonly ProviderRow[]> =>
  read([
    {
      id: "pv-sharepoint",
      name: "SharePoint",
      brings: "A document library, as external files"
    },
    { id: "pv-drive", name: "Google Drive", brings: "A shared drive or folder" },
    { id: "pv-confluence", name: "Confluence", brings: "A space, page by page" },
    { id: "pv-box", name: "Box", brings: "A folder and everything under it" }
  ]);

export const connector = (connectorId: string): Read<ConnectorDetail> => {
  const row =
    CONNECTORS.find((candidate: ConnectorRow) => candidate.id === connectorId) ?? CONNECTORS[0];
  return read({
    id: row.id,
    name: row.name,
    provider: row.provider,
    purpose: "Sync a document library into the project as external files",
    scopes: [
      { name: "Sites.Read.All", required: true, granted: true },
      { name: "Files.Read.All", required: true, granted: true },
      { name: "User.Read", required: false, granted: false }
    ],
    auth: row.state === "Expired" ? "Expired" : "Connected",
    lastSync: row.state === "Expired" ? "4 days ago" : row.detail
  });
};

export const uploads = (): Read<readonly UploadRow[]> =>
  read([
    {
      id: "up-1",
      name: "storm-log-2026-01.csv",
      size: "1.1 MB",
      mime: "text/csv",
      percent: 100,
      state: "Extracting"
    },
    {
      id: "up-2",
      name: "feeder-12-relay.pdf",
      size: "820 KB",
      mime: "application/pdf",
      percent: 62,
      state: "Uploading"
    },
    {
      id: "up-3",
      name: "substation-photos-ward-3.zip",
      size: "34.6 MB",
      mime: "application/zip",
      percent: 0,
      state: "Queued"
    }
  ]);

export const ingestion = (): Read<Ingestion> =>
  read({
    label: "Uploading 2 of 3",
    finished: 1,
    total: 3,
    then: "Extraction starts on arrival"
  });

/* ------------------------------------------------------------------ */
/* Launchers                                                           */
/* ------------------------------------------------------------------ */

export type EditorKind = {
  readonly id: string;
  readonly name: "Document" | "Slide deck" | "Spreadsheet";
  readonly detail: string;
};

/**
 * Draft state the launcher tab holds. Everything here is thrown away unless
 * **Create** is pressed, and none of it is written before then.
 */
export type DocumentDraft = {
  readonly title: string;
  readonly paper: "Letter" | "A4";
  readonly papers: readonly string[];
  readonly orientation: "Portrait" | "Landscape";
  readonly orientations: readonly string[];
  readonly margins: string;
};

export type DeckDraft = {
  readonly title: string;
  readonly aspect: "16:9" | "4:3";
  readonly aspects: readonly string[];
  /** Shown as a thumbnail, so the choice is visible rather than named. */
  readonly firstSlide: { readonly layout: string; readonly caption: string };
};

export type SpreadsheetDraft = {
  readonly title: string;
};

/** A thing that already exists, and what opening it will do. */
export type RecentItem = {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly updated: string;
  readonly updatedBy: string;
  /** Opening never mints a duplicate tab; this is the sentence that says so. */
  readonly openNote: string;
};

export const editorKinds = (): Read<readonly EditorKind[]> =>
  read([
    { id: "ek-document", name: "Document", detail: "A paginated body" },
    { id: "ek-deck", name: "Slide deck", detail: "Slides on a fixed canvas" },
    { id: "ek-sheet", name: "Spreadsheet", detail: "One grid of cells and formulas" }
  ]);

export const documentDraft = (): Read<DocumentDraft> =>
  read({
    title: "Untitled document",
    paper: "Letter",
    papers: ["Letter", "A4"],
    orientation: "Portrait",
    orientations: ["Portrait", "Landscape"],
    margins: "1 in all round"
  });

export const deckDraft = (): Read<DeckDraft> =>
  read({
    title: "Untitled deck",
    aspect: "16:9",
    aspects: ["16:9", "4:3"],
    firstSlide: { layout: "title-and-body", caption: "Title and body" }
  });

export const spreadsheetDraft = (): Read<SpreadsheetDraft> =>
  read({ title: "Untitled spreadsheet" });

/** Reads well in a *Kind* row: the storage kind, worded as a person would say it. */
export const kindLabel = (kind: ResourceKind): string =>
  ({
    document: "Document",
    slides: "Slide deck",
    spreadsheet: "Spreadsheet",
    research: "Research thread",
    analysis: "Analysis",
    file: "File",
    finding: "Finding",
    connector: "Connector",
    context: "Context",
    template: "Template"
  })[kind];

export const recentItem = (resourceId: string): Read<RecentItem> => {
  const resource =
    RESOURCES.find((candidate: Resource) => candidate.id === resourceId) ?? RESOURCES[0];
  return read({
    id: resource.id,
    title: resource.name,
    kind: kindLabel(resource.kind),
    updated: resource.updated,
    updatedBy: resource.updatedBy,
    openNote: "If it is already open, that tab activates and this launcher closes."
  });
};
