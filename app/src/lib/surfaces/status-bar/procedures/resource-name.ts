import type { TableName } from "$representation/store/tables";
import { readTemplate } from "$capabilities/templates/index.remote";
import { readStore } from "$model/client/workspace-state";

/**
 * The field for each table this surface may be asked to name.
 * Omitted tables are internal representation state, not status-bar resources.
 */
const NAMED_FIELD: Partial<Record<TableName, string | null>> = {
  activity: null,
  agentTasks: "title",
  comments: null,
  commentThreads: null,
  connectors: "name",
  dataBackReferences: null,
  derivedOutputs: null,
  documentChangeSets: null,
  documents: "title",
  documentSnapshots: null,
  findings: "title",
  formulas: null,
  hypotheses: "statement",
  memberships: null,
  personas: "name",
  personaThreads: "title",
  projects: "name",
  questions: "text",
  researchThreads: "title",
  resourceSets: "name",
  sheetCells: null,
  slideDeckChangeSets: null,
  slideDecks: "title",
  slideDeckSnapshots: null,
  spreadsheetChangeSets: null,
  spreadsheets: "title",
  spreadsheetSnapshots: null,
  templates: "name",
  templateVersions: null,
  threadParts: null,
  threads: null,
  users: "displayName",
  variables: "name",
  workspaceRevisions: null,
  workspaceSnapshots: null
};

/**
 * What to call a table on the one always-visible line.
 *
 * Partial: a table with no word here shows no kind, and the bar draws the name
 * alone. Filling in all thirty-five would be inventing a word for rows that
 * cannot be the subject of a tab.
 */
const KIND_WORD: Partial<Record<TableName, string>> = {
  agentTasks: "Task",
  connectors: "Connector",
  documents: "Document",
  findings: "Finding",
  hypotheses: "Hypothesis",
  personas: "Persona",
  questions: "Question",
  researchThreads: "Research",
  slideDecks: "Deck",
  spreadsheets: "Spreadsheet",
  templates: "Template"
};

const isTable = (value: string): value is TableName => Object.hasOwn(NAMED_FIELD, value);

/** Resource ids keep the table before one opaque suffix. */
const tableOf = (id: string): TableName | undefined => {
  const [table] = id.split(":");
  return table !== undefined && isTable(table) ? table : undefined;
};

/** What a row is called. `…` while the read is out, `Disconnected` when it answers empty. */
export const nameOf = (id: string): string => {
  const table = tableOf(id);
  if (table === "templates") {
    const answer = readTemplate({ templateId: id });
    if (!answer.ready) return "…";

    const found = answer.current;
    if (found === null) return "Disconnected";
    return "unavailable" in found ? "Unavailable template" : found.name;
  }
  const field = table === undefined ? undefined : NAMED_FIELD[table];
  if (table === undefined || field == null) return "Disconnected";

  const answer = readStore(table);
  if (!answer.ready) return "…";

  const found = answer.current;
  if (found?.kind !== "table" || found.table !== table) return "Disconnected";

  const row = found.rows.find((candidate) => candidate._id === id);
  const value = (row as unknown as Record<string, unknown> | undefined)?.[field];
  return typeof value === "string" ? value : "Disconnected";
};

/** The word for what kind of thing an id names, where there is one. */
export const kindOf = (id: string): string | undefined => {
  const table = tableOf(id);
  return table === undefined ? undefined : KIND_WORD[table];
};
