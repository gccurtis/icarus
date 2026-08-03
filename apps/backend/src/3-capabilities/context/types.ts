// Context capability types.
// ContextEntry is defined in knowledge/types.ts (the platform layer that needs it).
// Context imports it from there to avoid duplicating the atom.

import type { ContextEntry } from "#platform/knowledge/types.js";
import {
  PROJECT_CONTEXT_KIND,
  PROJECT_CONTEXT_ENTRY,
  isProjectEntry
} from "#platform/knowledge/types.js";

export type { ContextEntry };

/**
 * Re-exported from the platform layer, where the atom itself lives, so every
 * capability keeps naming the project through `#context` as it does for
 * `ContextEntry`.
 *
 * Every other kind is opaque to Context — a reference some other capability
 * knows how to locate. This one is not a reference at all: it is a *rule*,
 * expanded at resolve time into whatever the project currently holds. A
 * materialised "everything" is stale the moment anything is added; a rule is
 * not.
 */
export { PROJECT_CONTEXT_KIND, PROJECT_CONTEXT_ENTRY, isProjectEntry };

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
