// DerivedOutputStore — sync persistence interface for Derived Outputs.
// Pattern follows DataStore and ContextStore.

import type {
  DerivedOutput,
  DerivedOutputRevision,
  DerivedRefreshResult,
  RefreshAttempt
} from "./domain/model.js";
import type { Usage } from "#platform/intelligence/types.js";

export interface SettleRefreshInput {
  readonly attemptId: string;
  readonly outputId: string;
  readonly expectedDefinitionRevision: number;
  readonly expectedHeadRevision: number;
  readonly expectedKnowledgeGeneration: number;
  readonly revision: DerivedOutputRevision;
  readonly usage: Usage;
  readonly completedAt: string;
  readonly fallbackOutput: DerivedOutput;
  readonly idempotencyKey?: string;
}

export type SettleRefreshState =
  | "published"
  | "definition_changed"
  | "head_changed"
  | "knowledge_changed"
  | "output_deleted";

export interface SettleRefreshResult {
  readonly state: SettleRefreshState;
  readonly output: DerivedOutput | null;
  readonly result: DerivedRefreshResult;
}

export interface FailRefreshInput {
  readonly attemptId: string;
  readonly outputId: string;
  readonly expectedDefinitionRevision: number;
  readonly expectedHeadRevision: number;
  readonly expectedKnowledgeGeneration: number;
  readonly diagnosticCode: string;
  readonly diagnosticMessage: string;
  readonly usage: Usage;
  readonly completedAt: string;
  readonly fallbackOutput: DerivedOutput;
  readonly idempotencyKey?: string;
}

export interface FailRefreshResult {
  readonly state: "failed" | Exclude<SettleRefreshState, "published">;
  readonly output: DerivedOutput | null;
  readonly result: DerivedRefreshResult;
}

export interface DerivedOutputDeclarationClaim {
  readonly output: DerivedOutput;
  readonly requestDigest: string;
  readonly created: boolean;
}

export interface DerivedOutputRefreshClaim {
  readonly requestDigest: string;
  readonly result?: DerivedRefreshResult;
  readonly created: boolean;
}

export interface DerivedOutputDefinitionUpdateClaim {
  readonly requestDigest: string;
  readonly result?: DerivedOutput;
  readonly created: boolean;
}

export interface UpdateOutputDefinitionInput {
  readonly outputId: string;
  readonly expectedDefinitionRevision: number;
  readonly prompt: string;
  readonly contextEntriesJson: string;
  readonly stabilisationText: string;
  readonly updatedAt: string;
  readonly idempotencyKey?: string;
}

export type UpdateOutputDefinitionResult =
  | { readonly state: "updated"; readonly output: DerivedOutput }
  | { readonly state: "not_found" }
  | { readonly state: "stale"; readonly actualDefinitionRevision: number };

export interface KnowledgeInvalidationResult {
  readonly generation: number;
  readonly outputsMarkedStale: number;
}

export interface DerivedOutputStore {
  // ── Output CRUD ──────────────────────────────────────────────────────────
  getOutput(id: string): DerivedOutput | null;
  insertOutput(output: DerivedOutput): void;
  claimDeclaration(
    candidate: DerivedOutput,
    idempotencyKey: string,
    requestDigest: string
  ): DerivedOutputDeclarationClaim;
  claimRefresh(
    outputId: string,
    idempotencyKey: string,
    requestDigest: string,
    createdAt: string
  ): DerivedOutputRefreshClaim;
  claimDefinitionUpdate(
    outputId: string,
    idempotencyKey: string,
    requestDigest: string,
    createdAt: string
  ): DerivedOutputDefinitionUpdateClaim;
  updateOutputDefinition(
    input: UpdateOutputDefinitionInput
  ): UpdateOutputDefinitionResult;
  deleteOutput(id: string, deletedAt: string): number | null;
  purgeOutput(id: string): void;
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;

  // ── Knowledge invalidation ──────────────────────────────────────────────
  getKnowledgeGeneration(): number;
  markAllOutputsStaleForKnowledgeChange(
    changedAt: string
  ): KnowledgeInvalidationResult;

  // ── Revision CRUD ────────────────────────────────────────────────────────
  getRevision(outputId: string, revision: number): DerivedOutputRevision | null;
  getHeadRevision(outputId: string): DerivedOutputRevision | null;

  // ── Refresh attempts ─────────────────────────────────────────────────────
  insertAttempt(attempt: RefreshAttempt): void;
  updateAttemptResult(
    id: string,
    candidateRevision: number | null,
    candidateStatus: string | null,
    settled: boolean,
    discardedReason: string | null,
    usagePromptTokens: number,
    usageCompletionTokens: number,
    usageTotalTokens: number,
    usageReasoningTokens: number,
    completedAt: string
  ): void;

  /** Compare, publish, update freshness, and settle the attempt atomically. */
  settleRefresh(input: SettleRefreshInput): SettleRefreshResult;

  /** Record a failed computation without overwriting a newer refresh state. */
  failRefresh(input: FailRefreshInput): FailRefreshResult;

  close(): void;
}
