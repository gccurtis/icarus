// DerivedOutputStore — sync persistence interface for Derived Outputs.
// Pattern follows DataStore and ContextStore.

import type {
  DerivedOutput,
  DerivedOutputRevision,
  RefreshAttempt
} from "./domain/model.js";

export interface DerivedOutputStore {
  // ── Output CRUD ──────────────────────────────────────────────────────────
  getOutput(id: string): DerivedOutput | null;
  insertOutput(output: DerivedOutput): void;
  updateOutputHead(id: string, headRevision: number): void;
  updateOutputDefinition(
    id: string,
    prompt: string,
    contextEntriesJson: string,
    stabilisationText: string,
    definitionRevision: number
  ): void;
  updateOutputFreshness(
    id: string,
    state: string,
    lastCheckedAt: string,
    staleSince: string | null,
    diagnosticCode: string | null,
    diagnosticMessage: string | null
  ): void;
  deleteOutput(id: string): void;

  // ── Revision CRUD ────────────────────────────────────────────────────────
  getRevision(outputId: string, revision: number): DerivedOutputRevision | null;
  getHeadRevision(outputId: string): DerivedOutputRevision | null;
  insertRevision(revision: DerivedOutputRevision): void;

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
}