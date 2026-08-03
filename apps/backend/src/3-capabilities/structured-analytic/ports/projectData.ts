// What Structured Analytic needs from the rest of the project, and nothing more.
//
// Two operations, deliberately: a pull needs values, and a check needs only
// names. Keeping them apart is what makes `check` cheap — it answers "would a
// pull still work" without evaluating a single formula or reading a single row.

import type { FormulaResolverSnapshot } from "#formula";

/**
 * One input's identity, as the project currently sees it.
 *
 * No value: an analytic's inputs are selected by name, and this is the metadata
 * that says whether that name still means what it meant when it was saved.
 */
export interface ProjectEntryMetadata {
  readonly entryId: string;
  readonly displayName: string;
  /** The revision recorded in a pull's receipt. */
  readonly revision: number;
  /**
   * Why this entry cannot currently resolve, when it cannot. Present here so a
   * pull can say "the formula behind Orders is broken" rather than the much
   * less useful "Orders did not resolve".
   */
  readonly issue?: ProjectEntryIssue;
}

export interface ProjectEntryIssue {
  readonly code: string;
  readonly message: string;
}

export interface ProjectData {
  /**
   * The values every input resolves to right now, keyed the way Formula keys
   * them. Built once per pull and handed to the evaluator whole, so every input
   * in one analytic sees the same instant.
   */
  snapshot(): Promise<FormulaResolverSnapshot>;

  /**
   * Identity without value. Used by `check`, and by `create`/`update` to record
   * an input's `entryId` at save time.
   */
  metadata(displayName: string): Promise<ProjectEntryMetadata | undefined>;

  /**
   * The same lookup by recorded id rather than name — the rename repair path.
   * An input whose name no longer resolves but whose `entryId` still does was
   * renamed, not deleted.
   */
  metadataById(entryId: string): Promise<ProjectEntryMetadata | undefined>;
}
