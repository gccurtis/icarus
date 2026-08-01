import type {
  DocumentAttempt,
  DocumentBase,
  DocumentChangeSet,
  DocumentCommittedFact,
  DocumentDelegatedCommandClaim,
  DocumentHead,
  DocumentStageReceipt,
  DocumentSubmissionReceipt,
  FormulaEvaluationAttempt,
  PromptCreationAttempt,
  PromptOutputOwnership,
  PromptRefreshAttempt
} from "../domain/model.js";
import type { DocumentIdentityLedgerEntry } from "../domain/identities.js";
import { canonicalize } from "../domain/canonical.js";

export type SQLiteRow = Record<string, unknown>;

export const encodeJson = (value: unknown): Buffer =>
  Buffer.from(canonicalize(value));

export const decodeJson = <T>(value: unknown): T => {
  if (typeof value === "string") return JSON.parse(value) as T;
  if (value instanceof Uint8Array) {
    return JSON.parse(Buffer.from(value).toString("utf8")) as T;
  }
  throw new Error("Invalid JSON value read from the Document store");
};

const optionalJson = <T>(value: unknown): T | undefined =>
  value === null || value === undefined ? undefined : decodeJson<T>(value);

export const rowToHead = (row: SQLiteRow): DocumentHead => ({
  id: row.id as string,
  title: row.title as string,
  lifecycle: row.lifecycle as DocumentHead["lifecycle"],
  revision: Number(row.revision),
  baseSeq: Number(row.base_seq),
  semanticDigest: row.semantic_digest as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToBase = (row: SQLiteRow): DocumentBase => ({
  representationVersion: 1,
  documentId: row.document_id as string,
  baseSeq: Number(row.base_seq),
  snapshot: decodeJson<DocumentBase["snapshot"]>(row.snapshot_json),
  semanticDigest: row.semantic_digest as string,
  createdAt: row.created_at as string
});

export const rowToChangeSet = (row: SQLiteRow): DocumentChangeSet => {
  const compensationIntent = row.compensation_intent as
    | "undo"
    | "redo"
    | null;
  const compensationTarget = row.compensation_target_change_set_id as
    | string
    | null;

  return {
    id: row.id as string,
    documentId: row.document_id as string,
    clientRequestId: row.client_request_id as string,
    requestDigest: row.request_digest as string,
    authoredRevision: Number(row.authored_revision),
    priorRevision: Number(row.prior_revision),
    revision: Number(row.revision),
    seq: Number(row.seq),
    origin: row.origin as DocumentChangeSet["origin"],
    operations: decodeJson<DocumentChangeSet["operations"]>(row.operations_json),
    inverseOperations: decodeJson<DocumentChangeSet["inverseOperations"]>(
      row.inverse_operations_json
    ),
    touchedIds: decodeJson<string[]>(row.touched_ids_json),
    ...(compensationIntent && compensationTarget
      ? {
          compensation: {
            intent: compensationIntent,
            targetChangeSetId: compensationTarget
          }
        }
      : {}),
    semanticDigest: row.semantic_digest as string,
    createdAt: row.created_at as string
  };
};

export const rowToSubmission = (row: SQLiteRow): DocumentSubmissionReceipt => ({
  documentId: row.document_id as string,
  requestId: row.request_id as string,
  requestDigest: row.request_digest as string,
  result: decodeJson<DocumentSubmissionReceipt["result"]>(row.result_json),
  createdAt: row.created_at as string
});

export const rowToIdentityLedgerEntry = (
  row: SQLiteRow
): DocumentIdentityLedgerEntry => ({
  documentId: row.document_id as string,
  id: row.identity_id as string,
  kind: row.identity_kind as DocumentIdentityLedgerEntry["kind"],
  state: row.state as DocumentIdentityLedgerEntry["state"],
  firstRevision: Number(row.first_revision),
  lastTransitionRevision: Number(row.last_transition_revision),
  ...((row.tombstoned_revision as number | null) !== null
    ? { tombstonedRevision: Number(row.tombstoned_revision) }
    : {})
});

export const rowToDelegatedCommandClaim = (
  row: SQLiteRow
): DocumentDelegatedCommandClaim => ({
  documentId: row.document_id as string,
  requestId: row.request_id as string,
  requestDigest: row.request_digest as string,
  kind: row.command_kind as DocumentDelegatedCommandClaim["kind"],
  targetOutputId: row.target_output_id as string,
  state: row.state as DocumentDelegatedCommandClaim["state"],
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToCommittedFact = (row: SQLiteRow): DocumentCommittedFact => ({
  factId: row.fact_id as string,
  kind: row.fact_kind as DocumentCommittedFact["kind"],
  documentId: row.document_id as string,
  revision: Number(row.revision),
  ...((row.change_set_id as string | null) !== null
    ? { changeSetId: row.change_set_id as string }
    : {}),
  ...((row.actor_id as string | null) !== null
    ? { actorId: row.actor_id as string }
    : {}),
  origin: row.origin as DocumentCommittedFact["origin"],
  operationTypes: decodeJson<string[]>(row.operation_types),
  semanticDigest: row.semantic_digest as string,
  occurredAt: row.occurred_at as string
});

interface AttemptStorageParts {
  frozenJson: Buffer;
  candidateJson: Buffer | null;
  diagnosticJson: Buffer | null;
}

export const attemptToStorageParts = (
  attempt: DocumentAttempt
): AttemptStorageParts => {
  let frozen: Record<string, unknown>;
  let candidate: Record<string, unknown>;

  switch (attempt.kind) {
    case "prompt-create":
      frozen = {
        styleId: attempt.styleId,
        presentation: attempt.presentation,
        placement: attempt.placement,
        definition: attempt.definition
      };
      candidate = {
        candidateOutputId: attempt.candidateOutputId,
        candidateHeadRevision: attempt.candidateHeadRevision
      };
      break;
    case "prompt-refresh":
      frozen = {
        promptBlockId: attempt.promptBlockId,
        outputId: attempt.outputId,
        frozenAppliedRevision: attempt.frozenAppliedRevision
      };
      candidate = {
        candidateHeadRevision: attempt.candidateHeadRevision
      };
      break;
    case "formula-evaluation":
      frozen = {
        atomId: attempt.atomId,
        originChangeSetId: attempt.originChangeSetId,
        frozenExpression: attempt.frozenExpression,
        frozenExpressionDigest: attempt.frozenExpressionDigest
      };
      candidate = {
        resolverSnapshotDigest: attempt.resolverSnapshotDigest,
        candidateOperations: attempt.candidateOperations
      };
      break;
  }

  const hasCandidate = Object.values(candidate).some(
    (value) => value !== undefined
  );

  return {
    frozenJson: encodeJson(frozen),
    candidateJson: hasCandidate ? encodeJson(candidate) : null,
    diagnosticJson: attempt.diagnostic
      ? encodeJson(attempt.diagnostic)
      : null
  };
};

const attemptBase = (row: SQLiteRow) => ({
  id: row.id as string,
  documentId: row.document_id as string,
  clientRequestId: row.client_request_id as string,
  requestDigest: row.request_digest as string,
  blockId: row.block_id as string,
  frozenDocumentRevision: Number(row.frozen_document_revision),
  state: row.state as DocumentAttempt["state"],
  ...((row.settled_change_set_id as string | null) !== null
    ? { settledChangeSetId: row.settled_change_set_id as string }
    : {}),
  ...(optionalJson<DocumentAttempt["diagnostic"]>(row.diagnostic_json)
    ? {
        diagnostic: optionalJson<DocumentAttempt["diagnostic"]>(
          row.diagnostic_json
        )
      }
    : {}),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToAttempt = (row: SQLiteRow): DocumentAttempt => {
  const frozen = decodeJson<Record<string, unknown>>(row.frozen_json);
  const candidate =
    optionalJson<Record<string, unknown>>(row.candidate_json) ?? {};

  switch (row.kind as DocumentAttempt["kind"]) {
    case "prompt-create":
      return {
        ...attemptBase(row),
        kind: "prompt-create",
        ...frozen,
        ...candidate
      } as PromptCreationAttempt;
    case "prompt-refresh":
      return {
        ...attemptBase(row),
        kind: "prompt-refresh",
        ...frozen,
        ...candidate
      } as PromptRefreshAttempt;
    case "formula-evaluation":
      return {
        ...attemptBase(row),
        kind: "formula-evaluation",
        ...frozen,
        ...candidate
      } as FormulaEvaluationAttempt;
    default:
      throw new Error(`Unknown Document attempt kind: ${String(row.kind)}`);
  }
};

export const rowToStageReceipt = (row: SQLiteRow): DocumentStageReceipt => ({
  attemptId: row.attempt_id as string,
  stage: row.stage as DocumentStageReceipt["stage"],
  idempotencyKey: row.idempotency_key as string,
  requestDigest: row.request_digest as string,
  state: row.state as DocumentStageReceipt["state"],
  ...(optionalJson<unknown>(row.result_json) !== undefined
    ? { result: optionalJson<unknown>(row.result_json) }
    : {}),
  ...(optionalJson<DocumentStageReceipt["diagnostic"]>(row.diagnostic_json)
    ? {
        diagnostic: optionalJson<DocumentStageReceipt["diagnostic"]>(
          row.diagnostic_json
        )
      }
    : {}),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToPromptOutputOwnership = (
  row: SQLiteRow
): PromptOutputOwnership => ({
  outputId: row.output_id as string,
  documentId: row.document_id as string,
  blockId: row.block_id as string,
  ...((row.creation_attempt_id as string | null) !== null
    ? { creationAttemptId: row.creation_attempt_id as string }
    : {}),
  state: row.state as PromptOutputOwnership["state"],
  ...((row.attached_revision as number | null) !== null
    ? { attachedRevision: Number(row.attached_revision) }
    : {}),
  ...((row.detached_revision as number | null) !== null
    ? { detachedRevision: Number(row.detached_revision) }
    : {}),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});
