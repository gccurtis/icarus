/**
 * The project as a whole: what is in it, who is in it, what has happened, and
 * what cannot proceed.
 *
 * `docs/screen-panel-views/context/project/` and `inspector/project/` are what
 * these serve. Every list here is a project-scoped query, never a stored array on
 * the project — which is the rule Project Overview keeps, and is why these are
 * doors rather than a single blob.
 */
import { PEOPLE, PROJECT, RESOURCES, type Person, type Resource } from "$mock-capabilities/cast";
import { read, type Read } from "$mock-capabilities/read";

export type ProjectRecord = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly createdAt: string;
  readonly archived: boolean;
  readonly counts: { readonly resources: number; readonly people: number };
};

/** One recorded event, for the Activity view and its lens. */
export type ActivityEntry = {
  readonly id: string;
  readonly actor: string;
  readonly verb: string;
  readonly subject: string;
  readonly day: "Today" | "Yesterday" | "Earlier";
  readonly at: string;
};

/** Agent work, by state. Waiting is unqualified on purpose — see the spec. */
export type TaskRow = {
  readonly id: string;
  readonly title: string;
  readonly agent: string;
  readonly state: "waiting" | "running" | "failed" | "completed";
  readonly detail: string;
  readonly age: string;
};

/** Only what genuinely cannot proceed. Empty is the normal state. */
export type HealthIssue = {
  readonly id: string;
  readonly group: "Connectors" | "Extraction" | "Automations";
  readonly title: string;
  readonly detail: string;
  readonly tone: "danger" | "attention";
};

export type SavedContext = {
  readonly id: string;
  readonly name: string;
  readonly rule: string;
  readonly resolves: number;
};

export type TemplateRow = {
  readonly id: string;
  readonly name: string;
  readonly makes: "Document" | "Slide deck" | "Slide" | "Spreadsheet";
  readonly scope: "Project" | "Global";
  readonly variables: number;
};

/** A project variable, exactly as the name manager stores it: a value. */
export type Variable = {
  readonly id: string;
  readonly name: string;
  readonly key: string;
  readonly type:
    | "text"
    | "number"
    | "logic"
    | "date"
    | "null"
    | "list"
    | "record"
    | "table"
    | "function"
    | "range";
  /** What a formula gets when it runs. Shown inline where it is short enough. */
  readonly value: string;
  /** A bounded prefix, for the things too large to show. */
  readonly preview?: string;
  readonly order: number;
};

export const project = (): Read<ProjectRecord> =>
  read({
    id: PROJECT.id,
    name: PROJECT.name,
    description: PROJECT.description,
    createdAt: PROJECT.createdAt,
    archived: false,
    counts: { resources: RESOURCES.length, people: PEOPLE.length }
  });

export const resources = (): Read<readonly Resource[]> => read(RESOURCES);

export const people = (): Read<readonly Person[]> => read(PEOPLE);

export const activity = (): Read<readonly ActivityEntry[]> =>
  read([
    {
      id: "ev-1",
      actor: "Ana Reyes",
      verb: "edited",
      subject: "Q3 Resilience Memo",
      day: "Today",
      at: "4 minutes ago"
    },
    {
      id: "ev-2",
      actor: "Grid Analyst",
      verb: "accepted a finding in",
      subject: "Why did Feeder 12 fail twice?",
      day: "Today",
      at: "1 hour ago"
    },
    {
      id: "ev-3",
      actor: "Mira Jain",
      verb: "changed C2 in",
      subject: "Outage Cost Model",
      day: "Today",
      at: "26 minutes ago"
    },
    {
      id: "ev-4",
      actor: "Tomas Kaur",
      verb: "added slide 4 to",
      subject: "Board Update — October",
      day: "Yesterday",
      at: "16:20"
    },
    {
      id: "ev-5",
      actor: "SharePoint — Ops Reports",
      verb: "synced",
      subject: "NERC-2025-winter-review.pdf",
      day: "Earlier",
      at: "4 days ago"
    }
  ]);

export const tasks = (): Read<readonly TaskRow[]> =>
  read([
    {
      id: "t-1",
      title: "Summarise overnight outage reports",
      agent: "Grid Analyst",
      state: "running",
      detail: "Step 3 of 5",
      age: "12m"
    },
    {
      id: "t-2",
      title: "Draft the reliability section",
      agent: "Filing Editor",
      state: "waiting",
      detail: "Waiting",
      age: "2h"
    },
    {
      id: "t-3",
      title: "Check citations in the filing draft",
      agent: "Source Checker",
      state: "failed",
      detail: "The connector could not be read",
      age: "1d"
    },
    {
      id: "t-4",
      title: "Cluster the winter-storm findings",
      agent: "Grid Analyst",
      state: "completed",
      detail: "18 findings clustered",
      age: "2d"
    }
  ]);

export const health = (): Read<readonly HealthIssue[]> =>
  read([
    {
      id: "h-1",
      group: "Connectors",
      title: "SharePoint — Ops Reports",
      detail: "Authentication expired, reconnect",
      tone: "danger"
    },
    {
      id: "h-2",
      group: "Extraction",
      title: "NERC-2025-winter-review.pdf",
      detail: "No text layer to extract",
      tone: "attention"
    },
    {
      id: "h-3",
      group: "Automations",
      title: "Nightly filing digest",
      detail: "Could not start — the agent it asks for was deleted",
      tone: "danger"
    }
  ]);

export const savedContexts = (): Read<readonly SavedContext[]> =>
  read([
    {
      id: "sc-1",
      name: "Filing evidence",
      rule: "Everything in this project, minus slide decks",
      resolves: 24
    },
    {
      id: "sc-2",
      name: "Field data only",
      rule: "Spreadsheets and connector files",
      resolves: 9
    },
    { id: "sc-3", name: "Accepted findings", rule: "Findings, accepted", resolves: 18 }
  ]);

export const templates = (): Read<readonly TemplateRow[]> =>
  read([
    {
      id: "tp-1",
      name: "Regulatory filing shell",
      makes: "Document",
      scope: "Project",
      variables: 4
    },
    { id: "tp-2", name: "Board update", makes: "Slide deck", scope: "Project", variables: 2 },
    { id: "tp-3", name: "Cost model", makes: "Spreadsheet", scope: "Global", variables: 0 },
    { id: "tp-4", name: "Section divider", makes: "Slide", scope: "Global", variables: 1 }
  ]);

export const variables = (): Read<readonly Variable[]> =>
  read([
    {
      id: "v-1",
      name: "outageEvents",
      key: "outageevents",
      type: "table",
      value: "table",
      preview: "4,182 rows · 13 fields",
      order: 1
    },
    {
      id: "v-2",
      name: "substations",
      key: "substations",
      type: "table",
      value: "table",
      preview: "41 rows · 8 fields",
      order: 2
    },
    {
      id: "v-3",
      name: "hardeningBudget",
      key: "hardeningbudget",
      type: "number",
      value: "46,000,000",
      order: 3
    },
    {
      id: "v-4",
      name: "filingDeadline",
      key: "filingdeadline",
      type: "date",
      value: "14 Nov 2026",
      order: 4
    },
    {
      id: "v-5",
      name: "filingParty",
      key: "filingparty",
      type: "text",
      value: "Northwind Power",
      order: 5
    },
    {
      id: "v-6",
      name: "avoidedMinutes",
      key: "avoidedminutes",
      type: "function",
      value: "function",
      preview: "table → table",
      order: 6
    },
    {
      id: "v-7",
      name: "feederWindow",
      key: "feederwindow",
      type: "range",
      value: "Outages!A1:D400",
      order: 7
    }
  ]);

/** The three things Tables covers, the five Values does, and Functions alone. */
export const variableFamily = (type: Variable["type"]): "tables" | "values" | "functions" =>
  type === "function" ? "functions" : type === "table" || type === "record" || type === "list" ? "tables" : "values";
