/**
 * One project, told the same way everywhere.
 *
 * Every mock door draws its people, agents and resources from here, so a name in
 * the Mentions panel is the same person as the avatar in the comment lens and the
 * *Updated by* cell in the work table. Sample content that disagrees with itself
 * across three panels is worse than no sample content — it makes a reviewer chase
 * a bug that does not exist.
 *
 * The project is a winter-storm hardening case for a utility's rate filing. It
 * was chosen because it needs all of it: documents, a deck, a spreadsheet with
 * real arithmetic in it, research with sources, agents doing work, and a
 * connector that is broken.
 */

export type PersonId = "mira" | "ana" | "tomas" | "devi";
export type AgentId = "grid-analyst" | "filing-editor" | "source-checker";

export type Person = {
  readonly id: PersonId;
  readonly name: string;
  readonly email: string;
  readonly role: "Owner" | "Editor" | "Viewer";
  readonly joinedAt: string;
  /** Absent when they are not in the project right now. */
  readonly at?: string;
};

export type Agent = {
  readonly id: AgentId;
  readonly name: string;
  readonly purpose: string;
  /** Who owns it: one person, a set of people, or the project itself. */
  readonly scope: "Personal" | "Shared" | "Project";
};

export type ResourceKind =
  | "document"
  | "slides"
  | "spreadsheet"
  | "research"
  | "analysis"
  | "file"
  | "finding"
  | "connector"
  | "context"
  | "template";

export type Resource = {
  readonly id: string;
  readonly name: string;
  readonly kind: ResourceKind;
  readonly updated: string;
  readonly updatedBy: string;
};

export const PROJECT = {
  id: "northwind",
  name: "Northwind Grid Resilience",
  description: "Winter-storm hardening case for the 2026 rate filing.",
  createdAt: "12 Mar 2026",
  filingDeadline: "14 Nov 2026"
} as const;

export const PEOPLE: readonly Person[] = [
  {
    id: "mira",
    name: "Mira Jain",
    email: "mira.jain@northwind.example",
    role: "Owner",
    joinedAt: "12 Mar 2026",
    at: "Outage Cost Model"
  },
  {
    id: "ana",
    name: "Ana Reyes",
    email: "ana.reyes@northwind.example",
    role: "Editor",
    joinedAt: "14 Mar 2026",
    at: "Q3 Resilience Memo"
  },
  {
    id: "tomas",
    name: "Tomas Kaur",
    email: "tomas.kaur@northwind.example",
    role: "Editor",
    joinedAt: "2 Apr 2026"
  },
  {
    id: "devi",
    name: "Devi Okonkwo",
    email: "devi.okonkwo@northwind.example",
    role: "Viewer",
    joinedAt: "19 Jun 2026"
  }
];

/** The viewer. Every "you" in a panel is this person. */
export const VIEWER = PEOPLE[1];

/**
 * A selection's id as a person's, where it names one.
 *
 * A selection carries a plain string, because the model has no opinion about
 * what kinds of thing exist. A lens about a person needs a `PersonId`, and the
 * only honest way across is to ask whether anybody answers to it.
 */
export const asPersonId = (id: string | undefined): PersonId | undefined =>
  PEOPLE.find((person) => person.id === id)?.id;

export const AGENTS: readonly Agent[] = [
  {
    id: "grid-analyst",
    name: "Grid Analyst",
    purpose: "Reads field data and relay logs; refuses to speculate past the record.",
    scope: "Project"
  },
  {
    id: "filing-editor",
    name: "Filing Editor",
    purpose: "Turns findings into filing prose in the commission's register.",
    scope: "Shared"
  },
  {
    id: "source-checker",
    name: "Source Checker",
    purpose: "Verifies that a claim is carried by the source it cites.",
    scope: "Personal"
  }
];

export const RESOURCES: readonly Resource[] = [
  {
    id: "r-memo",
    name: "Q3 Resilience Memo",
    kind: "document",
    updated: "4 minutes ago",
    updatedBy: "Ana Reyes"
  },
  {
    id: "r-review",
    name: "Interconnect Failure Review",
    kind: "document",
    updated: "Yesterday",
    updatedBy: "Mira Jain"
  },
  {
    id: "r-filing",
    name: "Regulatory Filing Draft",
    kind: "document",
    updated: "3 days ago",
    updatedBy: "Filing Editor"
  },
  {
    id: "r-board",
    name: "Board Update — October",
    kind: "slides",
    updated: "2 days ago",
    updatedBy: "Tomas Kaur"
  },
  {
    id: "r-options",
    name: "Storm Hardening Options",
    kind: "slides",
    updated: "1 week ago",
    updatedBy: "Mira Jain"
  },
  {
    id: "r-cost",
    name: "Outage Cost Model",
    kind: "spreadsheet",
    updated: "26 minutes ago",
    updatedBy: "Mira Jain"
  },
  {
    id: "r-inventory",
    name: "Substation Inventory",
    kind: "spreadsheet",
    updated: "5 days ago",
    updatedBy: "SharePoint — Ops Reports"
  },
  {
    id: "r-feeder",
    name: "Why did Feeder 12 fail twice?",
    kind: "research",
    updated: "Yesterday",
    updatedBy: "Ana Reyes"
  },
  {
    id: "r-minutes",
    name: "Outage minutes by substation",
    kind: "analysis",
    updated: "3 days ago",
    updatedBy: "Mira Jain"
  },
  {
    id: "r-nerc",
    name: "NERC-2025-winter-review.pdf",
    kind: "file",
    updated: "4 days ago",
    updatedBy: "SharePoint — Ops Reports"
  },
  {
    id: "r-saidi",
    name: "Undergrounding cut SAIDI 38%",
    kind: "finding",
    updated: "6 days ago",
    updatedBy: "Grid Analyst"
  },
  {
    id: "r-relay",
    name: "Feeder 12 relay mis-coordinated",
    kind: "finding",
    updated: "Yesterday",
    updatedBy: "Grid Analyst"
  }
];

/** Reads well in a *who* column: a person, an agent, or a machine. */
export const actorName = (id: string): string =>
  PEOPLE.find((person) => person.id === id)?.name ??
  AGENTS.find((agent) => agent.id === id)?.name ??
  id;

export const byKind = (kind: ResourceKind): readonly Resource[] =>
  RESOURCES.filter((resource) => resource.kind === kind);
