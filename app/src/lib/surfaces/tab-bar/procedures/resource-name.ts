import type { TableName } from "$representation/store/tables";
import { readStore } from "$model/client/workspace-state";

/**
 * The field for each table a tab may ask this surface to name.
 * Omitted tables are internal representation state, not tab resources.
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
  templates: null,
  templateVersions: null,
  threadParts: null,
  threads: null,
  users: "displayName",
  variables: "name",
  workspaceRevisions: null,
  workspaceSnapshots: null
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
