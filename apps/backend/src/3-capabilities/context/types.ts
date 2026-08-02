// Context capability types.
// ContextEntry is defined in knowledge/types.ts (the platform layer that needs it).
// Context imports it from there to avoid duplicating the atom.

import type { ContextEntry } from "#platform/knowledge/types.js";

export type { ContextEntry };

export interface ContextRecord {
  readonly id: string;
  readonly displayName: string;
  readonly description?: string;
  readonly entries: ContextEntry[];     // unordered set; deduplicated on write
  /** When true, excluded from list() unless includePrivate is set. Fixed at creation. */
  readonly private: boolean;
  readonly revision: number;            // monotone counter starting at 1
  readonly createdAt: string;           // ISO-8601
  readonly updatedAt: string;
  readonly deletedAt?: string;          // soft-delete
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
