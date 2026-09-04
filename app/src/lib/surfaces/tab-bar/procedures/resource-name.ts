import type { TableName } from "$representation/store/tables";
import { read } from "$capabilities/store/index.remote";

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
  externalFiles: "name",
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
  templateVersions: "name",
  threadParts: null,
  threads: null,
  users: "displayName",
  variables: "name",
  workspaceRevisions: null,
  workspaceSnapshots: null
};

const isTable = (value: string): value is TableName => Object.hasOwn(NAMED_FIELD, value);

/** Ids are minted `<table>:<n>`. */
const tableOf = (id: string): TableName | undefined => {
  const [table] = id.split(":");
  return table !== undefined && isTable(table) ? table : undefined;
};

/** What a row is called. `…` while the read is out, `Disconnected` when it answers empty. */
export const nameOf = (id: string): string => {
  const table = tableOf(id);
  const field = table === undefined ? undefined : NAMED_FIELD[table];
  if (table === undefined || field == null) return "Disconnected";

  const answer = read({ path: `${table}.${id}.${field}` });
  if (!answer.ready) return "…";

  const found = answer.current;
  return found?.kind === "field" && typeof found.value === "string" ? found.value : "Disconnected";
};
