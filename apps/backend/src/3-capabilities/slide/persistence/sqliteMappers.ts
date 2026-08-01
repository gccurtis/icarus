import type {
  DeckHead,
  PromptContentCreationAttempt,
  PromptContentOutputOwnership,
  PromptContentRefreshAttempt,
  SlideAttempt,
  SlideBase,
  SlideChangeSet,
  SlideCommittedFact,
  SlideDelegatedCommandClaim,
  SlideStageReceipt,
  SlideSubmissionReceipt
} from "../domain/model.js";
import type { SlideIdentityLedgerEntry } from "../domain/identities.js";
import { canonicalize } from "../domain/canonical.js";

export type SQLiteRow = Record<string, unknown>;

export const encodeJson = (value: unknown): Buffer =>
  Buffer.from(canonicalize(value));

export const decodeJson = <T>(value: unknown): T => {
  if (typeof value === "string") return JSON.parse(value) as T;
  if (value instanceof Uint8Array) {
    return JSON.parse(Buffer.from(value).toString("utf8")) as T;
  }
  throw new Error("Invalid JSON value read from the Slide store");
};

const optionalJson = <T>(value: unknown): T | undefined =>
  value === null || value === undefined ? undefined : decodeJson<T>(value);

export const rowToHead = (row: SQLiteRow): DeckHead => ({
  id: row.id as string,
  title: row.title as string,
  lifecycle: row.lifecycle as DeckHead["lifecycle"],
  revision: Number(row.revision),
  baseSeq: Number(row.base_seq),
  semanticDigest: row.semantic_digest as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToBase = (row: SQLiteRow): SlideBase => ({
  representationVersion: 1,
  deckId: row.deck_id as string,
  baseSeq: Number(row.base_seq),
  snapshot: decodeJson<SlideBase["snapshot"]>(row.snapshot_json),
  semanticDigest: row.semantic_digest as string,
  createdAt: row.created_at as string
});

export const rowToChangeSet = (row: SQLiteRow): SlideChangeSet => {
  const compensationIntent = row.compensation_intent as
    | "undo"
    | "redo"
    | null;
  const compensationTarget = row.compensation_target_change_set_id as
    | string
    | null;

  return {
    id: row.id as string,
    deckId: row.deck_id as string,
    clientRequestId: row.client_request_id as string,
    requestDigest: row.request_digest as string,
    authoredRevision: Number(row.authored_revision),
    priorRevision: Number(row.prior_revision),
    revision: Number(row.revision),
    seq: Number(row.seq),
    origin: row.origin as SlideChangeSet["origin"],
    operations: decodeJson<SlideChangeSet["operations"]>(row.operations_json),
    inverseOperations: decodeJson<SlideChangeSet["inverseOperations"]>(
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

export const rowToSubmission = (row: SQLiteRow): SlideSubmissionReceipt => ({
  deckId: row.deck_id as string,
  requestId: row.request_id as string,
  requestDigest: row.request_digest as string,
  result: decodeJson<SlideSubmissionReceipt["result"]>(row.result_json),
  createdAt: row.created_at as string
});

export const rowToIdentityLedgerEntry = (
  row: SQLiteRow
): SlideIdentityLedgerEntry => ({
  deckId: row.deck_id as string,
  id: row.identity_id as string,
  kind: row.identity_kind as SlideIdentityLedgerEntry["kind"],
  state: row.state as SlideIdentityLedgerEntry["state"],
  firstRevision: Number(row.first_revision),
  lastTransitionRevision: Number(row.last_transition_revision),
  ...((row.tombstoned_revision as number | null) !== null
    ? { tombstonedRevision: Number(row.tombstoned_revision) }
    : {})
});

export const rowToDelegatedCommandClaim = (
  row: SQLiteRow
): SlideDelegatedCommandClaim => ({
  deckId: row.deck_id as string,
  requestId: row.request_id as string,
  requestDigest: row.request_digest as string,
  kind: row.command_kind as SlideDelegatedCommandClaim["kind"],
  targetOutputId: row.target_output_id as string,
  state: row.state as SlideDelegatedCommandClaim["state"],
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToCommittedFact = (row: SQLiteRow): SlideCommittedFact => ({
  factId: row.fact_id as string,
  kind: row.fact_kind as SlideCommittedFact["kind"],
  deckId: row.deck_id as string,
  revision: Number(row.revision),
  ...((row.change_set_id as string | null) !== null
    ? { changeSetId: row.change_set_id as string }
    : {}),
  ...((row.actor_id as string | null) !== null
    ? { actorId: row.actor_id as string }
    : {}),
  origin: row.origin as SlideCommittedFact["origin"],
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
  attempt: SlideAttempt
): AttemptStorageParts => {
  let frozen: Record<string, unknown>;
  let candidate: Record<string, unknown>;

  switch (attempt.kind) {
    case "prompt-content-create":
      frozen = {
        frame: attempt.frame,
        transform: attempt.transform,
        styleId: attempt.styleId,
        presentation: attempt.presentation,
        textBox: attempt.textBox,
        placement: attempt.placement,
        definition: attempt.definition
      };
      candidate = {
        candidateOutputId: attempt.candidateOutputId,
        candidateHeadRevision: attempt.candidateHeadRevision
      };
      break;
    case "prompt-content-refresh":
      frozen = {
        outputId: attempt.outputId,
        frozenAppliedRevision: attempt.frozenAppliedRevision
      };
      candidate = {
        candidateHeadRevision: attempt.candidateHeadRevision
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
  deckId: row.deck_id as string,
  clientRequestId: row.client_request_id as string,
  requestDigest: row.request_digest as string,
  slideId: row.slide_id as string,
  shapeId: row.shape_id as string,
  frozenDeckRevision: Number(row.frozen_deck_revision),
  state: row.state as SlideAttempt["state"],
  ...((row.settled_change_set_id as string | null) !== null
    ? { settledChangeSetId: row.settled_change_set_id as string }
    : {}),
  ...(optionalJson<SlideAttempt["diagnostic"]>(row.diagnostic_json)
    ? {
        diagnostic: optionalJson<SlideAttempt["diagnostic"]>(
          row.diagnostic_json
        )
      }
    : {}),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToAttempt = (row: SQLiteRow): SlideAttempt => {
  const frozen = decodeJson<Record<string, unknown>>(row.frozen_json);
  const candidate =
    optionalJson<Record<string, unknown>>(row.candidate_json) ?? {};

  switch (row.kind as SlideAttempt["kind"]) {
    case "prompt-content-create":
      return {
        ...attemptBase(row),
        kind: "prompt-content-create",
        ...frozen,
        ...candidate
      } as PromptContentCreationAttempt;
    case "prompt-content-refresh":
      return {
        ...attemptBase(row),
        kind: "prompt-content-refresh",
        ...frozen,
        ...candidate
      } as PromptContentRefreshAttempt;
    default:
      throw new Error(`Unknown Slide attempt kind: ${String(row.kind)}`);
  }
};

export const rowToStageReceipt = (row: SQLiteRow): SlideStageReceipt => ({
  attemptId: row.attempt_id as string,
  stage: row.stage as SlideStageReceipt["stage"],
  idempotencyKey: row.idempotency_key as string,
  requestDigest: row.request_digest as string,
  state: row.state as SlideStageReceipt["state"],
  ...(optionalJson<unknown>(row.result_json) !== undefined
    ? { result: optionalJson<unknown>(row.result_json) }
    : {}),
  ...(optionalJson<SlideStageReceipt["diagnostic"]>(row.diagnostic_json)
    ? {
        diagnostic: optionalJson<SlideStageReceipt["diagnostic"]>(
          row.diagnostic_json
        )
      }
    : {}),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToPromptOutputOwnership = (
  row: SQLiteRow
): PromptContentOutputOwnership => ({
  outputId: row.output_id as string,
  deckId: row.deck_id as string,
  slideId: row.slide_id as string,
  shapeId: row.shape_id as string,
  ...((row.creation_attempt_id as string | null) !== null
    ? { creationAttemptId: row.creation_attempt_id as string }
    : {}),
  state: row.state as PromptContentOutputOwnership["state"],
  ...((row.attached_revision as number | null) !== null
    ? { attachedRevision: Number(row.attached_revision) }
    : {}),
  ...((row.detached_revision as number | null) !== null
    ? { detachedRevision: Number(row.detached_revision) }
    : {}),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});
