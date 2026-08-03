// Derived Outputs domain types.
// A Derived Output is a prompt-driven answer with evidence provenance.

import type { ContextEntry } from "#context/types.js";

export type DerivedOutputKind = "prompt"; // extensible: future kinds are additive

// ─── Identity ───────────────────────────────────────────────────────────────

export interface DerivedOutput {
  readonly id: string;                  // random 16-byte hex
  readonly kind: DerivedOutputKind;
  readonly revision: number;            // current resource revision
  readonly definition: DerivedOutputDefinition;
  readonly headRevision: number;        // 0 until first successful refresh
  readonly freshness: DerivedOutputFreshness;
  readonly createdAt: string;           // ISO-8601
  readonly updatedAt: string;           // ISO-8601
}

// ─── Definition (mutable) ───────────────────────────────────────────────────

export interface DerivedOutputDefinition {
  /** The user's question or prompt. */
  readonly prompt: string;

  /** Scope for Knowledge retrieval. Empty = everything in the project lattice. */
  readonly contextEntries: ContextEntry[];

  /**
   * Prior output text used to stabilise refreshes.
   *
   * On first run this is empty. After the first successful revision, the
   * answer text becomes the stabilisation text. The user may hand-edit it
   * through the definition update endpoint.
   */
  readonly stabilisationText: string;

  /** Incremented on every definition update. Used as an optimistic lock. */
  readonly definitionRevision: number;
}

// ─── Revision (immutable) ───────────────────────────────────────────────────

export interface DerivedOutputRevision {
  readonly outputId: string;
  readonly revision: number;            // 1-based, monotonic — never reused
  readonly definitionRevision: number;  // frozen at generation time
  readonly content: string;             // the answer text
  readonly evidence: DerivedEvidence[]; // ranked most → least informative
  readonly status: DerivedOutputStatus;
  readonly createdAt: string;           // ISO-8601
}

export type DerivedOutputStatus =
  | "ok"            // answer produced with grounding
  | "insufficient"  // grounding did not support an answer
  | "contradiction"; // grounding conflicted on the requested point

// ─── Evidence ───────────────────────────────────────────────────────────────

/**
 * One piece of grounded information the model used. Carries enough identity
 * for the frontend to render a link to the actual resource. The model
 * produces this list as part of the structured synthesis output.
 */
export interface DerivedEvidence {
  /** The resource's stable ID. */
  readonly resourceId: string;

  /** Kind string so the frontend knows what type of link to render. */
  readonly resourceKind: string;

  /** The resource revision at read time, if known. */
  readonly resourceRevision?: number;

  /**
   * The exact span of the resource that was informative.
   *
   * For Knowledge lattice retrieval, this is a UTF-16 code-unit range, which
   * is the coordinate system used by JavaScript string slicing in Knowledge.
   * For `read` tool calls, this is a line-range span.
   */
  readonly span: DerivedEvidenceSpan;

  /**
   * The Knowledge sourceId this evidence came from, when it originated from
   * a retrieval call (plan queries or the `retrieve` tool). This is the
   * identifier Knowledge uses internally. It exists so staleness propagation
   * can cross-reference changed sources against their derived outputs.
   */
  readonly sourceId?: string;

  /** 1 = most informative. The array is ordered; ties are allowed. */
  readonly relevanceRank: number;

  /** One sentence from the model describing how this informed the answer. */
  readonly contribution: string;
}

export type DerivedEvidenceSpan =
  | DerivedTextSpan    // from Knowledge lattice retrieval
  | DerivedLineSpan;   // from read tool calls

export interface DerivedTextSpan {
  readonly kind: "characters";
  readonly start: number;  // UTF-16 code-unit offset, inclusive
  readonly end: number;    // UTF-16 code-unit offset, exclusive
}

/** @deprecated Use DerivedTextSpan; Knowledge has never emitted byte offsets. */
export type DerivedByteSpan = DerivedTextSpan;

export interface DerivedLineSpan {
  readonly kind: "lines";
  readonly startLine: number;  // 1-based, inclusive
  readonly endLine: number;    // 1-based, inclusive
}

// ─── Freshness ──────────────────────────────────────────────────────────────

/**
 * A cached signal. Updated by lattice change events and refresh lifecycle.
 * Recomputing it would require re-running the full pipeline.
 */
export interface DerivedOutputFreshness {
  readonly state: "current" | "stale" | "refreshing" | "failed";
  readonly lastCheckedAt: string | null;
  readonly staleSince?: string;
  readonly diagnostic?: {
    readonly code: string;
    readonly message: string;
  };
}

// ─── Resource reference (held by other capabilities) ───────────────────────

/**
 * What a Document, or any future host capability, stores to reference a
 * Derived Output.
 */
export interface DerivedOutputRef {
  readonly outputId: string;
  readonly appliedRevision: number;
}

// ─── Request / Response ────────────────────────────────────────────────────

export interface DeclareDerivedOutputRequest {
  readonly prompt: string;
  readonly contextEntries?: ContextEntry[];
  readonly stabilisationText?: string;
}

export interface DeclareDerivedOutputOptions {
  /** Project-scoped, caller-namespaced identity for retry-safe declaration. */
  readonly idempotencyKey: string;
}

export interface RefreshDerivedOutputOptions {
  /** Project-scoped, caller-namespaced identity for retry-safe refresh. */
  readonly idempotencyKey: string;
}

export interface UpdateDefinitionRequest {
  readonly prompt: string;
  readonly contextEntries: ContextEntry[];
  readonly stabilisationText: string;
  readonly expectedDefinitionRevision: number;
}

export interface UpdateDerivedOutputDefinitionOptions {
  /** Project-scoped, caller-namespaced identity for retry-safe definition updates. */
  readonly idempotencyKey: string;
}

export interface DerivedRefreshResult {
  readonly output: DerivedOutput;
  readonly revision?: DerivedOutputRevision; // present when new revision was published
  readonly skipped: boolean;                 // true when nothing changed
}

// ─── Refresh Attempt (operational record) ──────────────────────────────────

export interface RefreshAttempt {
  readonly id: string;
  readonly outputId: string;
  readonly frozenDefinitionRevision: number;
  readonly frozenContextDigest: string;
  readonly candidateRevision?: number;
  readonly candidateStatus?: DerivedOutputStatus;
  readonly settled: boolean;
  readonly discardedReason?: string;
  readonly usagePromptTokens: number;
  readonly usageCompletionTokens: number;
  readonly usageTotalTokens: number;
  readonly usageReasoningTokens: number;
  readonly startedAt: string;
  readonly completedAt?: string;
}

// ─── Change Operations ─────────────────────────────────────────────────────

export type DerivedOutputChangeOperation =
  | { type: "declare"; output: DerivedOutput }
  | { type: "update-definition"; outputId: string; definition: DerivedOutputDefinition }
  | { type: "begin-refresh"; outputId: string; frozenDefinitionRevision: number }
  | { type: "publish-revision"; outputId: string; revision: DerivedOutputRevision }
  | { type: "mark-stale"; outputId: string; reason: string }
  | { type: "mark-failed"; outputId: string; diagnostic: { code: string; message: string } }
  | { type: "delete"; outputId: string };

// ─── Error classes ─────────────────────────────────────────────────────────

export class DerivedOutputNotFoundError extends Error {
  constructor(public readonly outputId: string) {
    super(`Derived output not found: ${outputId}`);
    this.name = "DerivedOutputNotFoundError";
  }
}

export class DerivedOutputConflictError extends Error {
  constructor(public readonly outputId: string) {
    super(`Derived output conflict: ${outputId}`);
    this.name = "DerivedOutputConflictError";
  }
}

/**
 * A refresh was asked for on an output whose definition names no sources.
 *
 * Not a retrieval that found nothing — that is an ordinary `insufficient`
 * answer. This is an output that could never find anything, because it was
 * declared without a scope or its Context Variable was never bound. It used to
 * be treated as "the whole project", which turned a configuration mistake into
 * a confident answer drawn from everything.
 */
export class DerivedOutputEmptyScopeError extends Error {
  constructor(public readonly outputId: string) {
    super(
      `Derived output ${outputId} names no context to ground on. ` +
      "Name the resources to search, or the project itself."
    );
    this.name = "DerivedOutputEmptyScopeError";
  }
}

export class DerivedOutputIdempotencyConflictError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super("Derived output declaration key was reused with different input");
    this.name = "DerivedOutputIdempotencyConflictError";
  }
}

export class DerivedOutputRefreshIdempotencyConflictError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super("Derived output refresh key was reused with different input");
    this.name = "DerivedOutputRefreshIdempotencyConflictError";
  }
}

export class DerivedOutputDefinitionUpdateIdempotencyConflictError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super("Derived output definition-update key was reused with different input");
    this.name = "DerivedOutputDefinitionUpdateIdempotencyConflictError";
  }
}

export class StaleDefinitionRevisionError extends Error {
  constructor(
    public readonly outputId: string,
    public readonly expected: number,
    public readonly actual: number
  ) {
    super(
      `Stale definition revision for ${outputId}: expected ${expected}, got ${actual}`
    );
    this.name = "StaleDefinitionRevisionError";
  }
}
