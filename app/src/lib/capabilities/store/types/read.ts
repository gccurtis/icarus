import type { TableName, TableRow } from "$model/server/store/index.server";

export type ReadInput = { readonly path: string };

type Projection<T extends TableName, K extends keyof TableRow<T>> = Readonly<
  Pick<TableRow<T>, "_id" | "_creationTime" | K>
>;

/** The complete and deliberately small row vocabulary exposed by generic read. */
export type ProjectedRows = {
  activity: Projection<"activity", "projectId" | "actor" | "actorLabel" | "verb" | "target">;
  agentTasks: Projection<"agentTasks", "projectId" | "title" | "personaId">;
  comments: Projection<
    "comments",
    "projectId" | "threadId" | "blocks" | "mentions" | "author"
  >;
  commentThreads: Projection<
    "commentThreads",
    | "projectId"
    | "target"
    | "within"
    | "quote"
    | "resolution"
    | "createdBy"
    | "updatedAt"
  >;
  connectors: Projection<"connectors", "projectId" | "name">;
  documents: Projection<"documents", "projectId" | "title">;
  findings: Projection<"findings", "projectId" | "title">;
  hypotheses: Projection<"hypotheses", "projectId" | "statement">;
  memberships: Projection<"memberships", "projectId" | "userId" | "role">;
  personas: Projection<"personas", "projectId" | "name">;
  projects: Projection<"projects", "name" | "description">;
  questions: Projection<"questions", "projectId" | "text">;
  researchThreads: Projection<"researchThreads", "projectId" | "title">;
  resourceSets: Projection<"resourceSets", "projectId" | "name">;
  slideDecks: Projection<"slideDecks", "projectId" | "title">;
  spreadsheets: Projection<"spreadsheets", "projectId" | "title">;
  users: Projection<"users", "displayName">;
  variables: Projection<"variables", "projectId" | "name" | "value">;
};

export type ReadableTable = keyof ProjectedRows;
export type ProjectedRow<T extends ReadableTable> = ProjectedRows[T];

/**
 * Unlike the model's `Found`, these table and row variants promise only the
 * compatibility projection above. Field values remain unknown until a caller
 * checks them, just as they did for the underlying path reader.
 */
export type ProjectedFound = {
  [T in ReadableTable]:
    | { readonly table: T; readonly kind: "table"; readonly rows: readonly ProjectedRows[T][] }
    | { readonly table: T; readonly kind: "row"; readonly row: ProjectedRows[T] }
    | {
        readonly table: T;
        readonly kind: "field";
        readonly fields: readonly string[];
        readonly value: unknown;
      };
}[ReadableTable];

/** `null` rather than `undefined`: a remote function's answer is JSON. */
export type ReadResult = ProjectedFound | null;
