import type { TableNames } from "$convex/_generated/dataModel";
import type { ResourceKind } from "$shared/types/resource";

/**
 * Where each kind's rows live — the one place resolution knows about storage.
 *
 * **`connector` is deliberately absent, and stays absent.** A connector ref
 * means the files that connector brought in, never the connector row: scoping to
 * a source is "answer from the material in our Notion", not "answer from a
 * credential record". So the table `connectors` becomes in pass 8 is not one a
 * set ever selects from.
 *
 * The insertion order is the order `{ op: "project" }` walks in, which is what
 * makes one project resolve to the same list twice.
 */
export const RESOURCE_TABLES = {
  document: "documents",
  slides: "slideDecks",
  spreadsheet: "spreadsheets",
  externalFile: "externalFiles",
  finding: "findings",
  template: "templates"
} as const satisfies Partial<Record<ResourceKind, TableNames>>;

/** The kinds with rows of their own. Every other kind resolves through one of them. */
export type StoredKind = keyof typeof RESOURCE_TABLES;

export const storedKinds = Object.keys(RESOURCE_TABLES) as StoredKind[];

export const isStored = (kind: ResourceKind): kind is StoredKind => kind in RESOURCE_TABLES;
