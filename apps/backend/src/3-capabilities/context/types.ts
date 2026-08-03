// Context capability types.
// ContextEntry is defined in knowledge/types.ts (the platform layer that needs it).
// Context imports it from there to avoid duplicating the atom.

import type { ContextEntry } from "#platform/knowledge/types.js";

export type { ContextEntry };

/**
 * The one `kind` that names the project itself rather than a resource in it.
 *
 * Every other kind is opaque to Context — it is a resource reference that some
 * other capability knows how to locate. This one is not a reference at all: it
 * is a *rule*, expanded at resolve time into whatever the project currently
 * holds. That is the whole point. A materialised "everything" is stale the
 * moment anything is added; a rule is not.
 */
export const PROJECT_CONTEXT_KIND = "project";

/**
 * The canonical spelling. `id` is fixed at `"*"` because a Context store is
 * built from exactly one `projectId` — there is no second project to name, so
 * there is nothing for the `id` to distinguish.
 */
export const PROJECT_CONTEXT_ENTRY: ContextEntry = {
  id: "*",
  kind: PROJECT_CONTEXT_KIND
};

/**
 * Matches on `kind` alone. A caller who writes some other `id` still meant the
 * project — there is only one — and treating it as an ordinary leaf instead
 * would resolve it to nothing, which is the silent-empty-scope failure this
 * capability is supposed to make impossible.
 */
export const isProjectEntry = (entry: ContextEntry): boolean =>
  entry.kind === PROJECT_CONTEXT_KIND;

export interface ContextRecord {
  readonly id: string;
  readonly displayName: string;
  readonly description?: string;
  readonly entries: ContextEntry[];     // unordered set; deduplicated on write
  /**
   * Subtracted from the expansion of `entries` **at resolve time**, never at
   * write time. That is what makes "the whole project, less these five" stay
   * correct as the project changes: neither side is materialised.
   *
   * Nested `kind: "context"` excludes are expanded before subtraction, so
   * "everything except what that Context holds" tracks that Context too.
   *
   * Absent and empty mean the same thing.
   */
  readonly excludes?: ContextEntry[];
  /** When true, excluded from list() unless includePrivate is set. Fixed at creation. */
  readonly private: boolean;
  readonly revision: number;            // monotone counter starting at 1
  readonly createdAt: string;           // ISO-8601
  readonly updatedAt: string;
}

/**
 * How Context learns what "the project" currently contains. Injected at wiring
 * time by `1-init`, which is the only layer that sees both Context and the
 * resource capabilities.
 *
 * Context deliberately does not know what a project holds — every other kind
 * stays opaque to it, and this port keeps that true by making membership
 * somebody else's answer rather than Context's knowledge.
 */
export interface ProjectMembershipPort {
  /**
   * Every resource currently in the project, spelled the same way a caller
   * would spell one in `entries` or `excludes`. The spelling has to match, or
   * an exclusion silently fails to subtract.
   */
  listProjectEntries(): Promise<ContextEntry[]>;
}

export class ContextNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Context not found: ${id}`);
    this.name = "ContextNotFoundError";
  }
}

export class ContextConflictError extends Error {
  constructor(public readonly displayName: string) {
    super(`Context '${displayName}' already exists`);
    this.name = "ContextConflictError";
  }
}

export class StaleContextError extends Error {
  constructor(
    public readonly id: string,
    public readonly current: number,
    public readonly expected: number
  ) {
    super(`Stale revision for context ${id}: expected ${expected}, current ${current}`);
    this.name = "StaleContextError";
  }
}

export class ContextValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason: string
  ) {
    super(`${field}: ${reason}`);
    this.name = "ContextValidationError";
  }
}
