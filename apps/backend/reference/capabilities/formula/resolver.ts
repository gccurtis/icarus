// FormulaResolverSnapshot — the immutable value contract between
// Formula consumers and the engine.

import type { FormulaValue } from "./value.js";
import type { BoundFormulaReference } from "./ast.js";

export interface ProjectScope {
  readonly userId: string;
  readonly projectId: string;
}

export interface ResolvedFormulaBinding {
  readonly reference: BoundFormulaReference;
  readonly displayName: string;
  readonly normalizedLookupKey: string;
  readonly value: FormulaValue;
  readonly ownerRevision: number | string;
  readonly valueDigest: string;
}

export interface ResolverSourceRevision {
  readonly sourceId: string;
  readonly revision: number | string;
}

export interface FormulaResolverSnapshot {
  readonly id: string;
  readonly scope: ProjectScope;
  /** Keyed by normalizedLookupKey (typically lowercase display name). */
  readonly bindings: ReadonlyMap<string, ResolvedFormulaBinding>;
  readonly snapshotDigest: string;
  readonly createdFrom: readonly ResolverSourceRevision[];
}

/** Normalize a display name for lookup (case-insensitive). */
export function normalizeKey(name: string): string {
  return name.toLowerCase();
}
