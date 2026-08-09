import type {
  DeckBase,
  DeckChangeSet,
  DeckCommittedTransaction,
  DeckHead,
  FormulaEvaluationAttempt,
  PromptCreationAttempt,
  PromptOutputOwnership,
  PromptRefreshAttempt,
  PromptSite,
  SlideAttempt,
  SlideStageReceipt
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
  throw new Error("Invalid JSON value read from the Slides store");
};

const optionalJson = <T>(value: unknown): T | undefined =>
  value === null || value === undefined ? undefined : decodeJson<T>(value);

export const rowToHead = (row: SQLiteRow): DeckHead => ({
  id: row.id as string,
  title: row.title as string,
  lifecycle: row.lifecycle as DeckHead["lifecycle"],
  revision: Number(row.revision),
  baseSeq: Number(row.base_seq),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToBase = (row: SQLiteRow): DeckBase => ({
  representationVersion: 1,
  deckId: row.deck_id as string,
  baseSeq: Number(row.base_seq),
  snapshot: decodeJson<DeckBase["snapshot"]>(row.snapshot_json),
  createdAt: row.created_at as string
});

export const rowToChangeSet = (row: SQLiteRow): DeckChangeSet => {
  const compensationIntent = row.compensation_intent as "undo" | "redo" | null;
  const compensationTarget = row.compensation_target_change_set_id as string | null;

  return {
    id: row.id as string,
    deckId: row.deck_id as string,
    authoredRevision: Number(row.authored_revision),
    priorRevision: Number(row.prior_revision),
    revision: Number(row.revision),
    seq: Number(row.seq),
    origin: row.origin as DeckChangeSet["origin"],
    operations: decodeJson<DeckChangeSet["operations"]>(row.operations_json),
    inverseOperations: decodeJson<DeckChangeSet["inverseOperations"]>(
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
    createdAt: row.created_at as string
  };
};

export const rowToIdentityLedgerEntry = (row: SQLiteRow): SlideIdentityLedgerEntry => ({
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

export const rowToCommittedTransaction = (row: SQLiteRow): DeckCommittedTransaction => ({
  sourceTransactionId: row.source_transaction_id as string,
  kind: row.transaction_kind as DeckCommittedTransaction["kind"],
  deckId: row.deck_id as string,
  revision: Number(row.revision),
  ...((row.source_change_set_id as string | null) !== null
    ? { sourceChangeSetId: row.source_change_set_id as string }
    : {}),
  ...((row.actor_id as string | null) !== null
    ? { actorId: row.actor_id as string }
    : {}),
  origin: row.origin as DeckCommittedTransaction["origin"],
  operationTypes: decodeJson<string[]>(row.operation_types),
  ...((row.compensation_intent as string | null) !== null &&
  (row.compensation_target_change_set_id as string | null) !== null
    ? {
        compensation: {
          intent: row.compensation_intent as "undo" | "redo",
          targetChangeSetId: row.compensation_target_change_set_id as string
        }
      }
    : {}),
  occurredAt: row.occurred_at as string
});

/**
 * The stored address of a prompt site.
 *
 * Document keys ownership on a bare block id. A Slides site is a container plus
 * an element (plus a cell), so it needs a composite key — and it must be a
 * *string*, because the uniqueness constraint that enforces one output per live
 * site is a SQL UNIQUE. The container is part of the key, not decoration: two
 * planes may hold elements with the same ID.
 */
export const promptSiteKey = (site: PromptSite): string => {
  const container =
    site.container.kind === "slide"
      ? `slide:${site.container.slideId}`
      : site.container.kind === "master"
        ? `master:${site.container.masterId}`
        : `layout:${site.container.layoutId}`;
  return site.kind === "table-cell"
    ? `table-cell:${container}:${site.elementId}:${site.cellId}`
    : `element-body:${container}:${site.elementId}`;
};

interface AttemptStorageParts {
  siteKey: string;
  frozenJson: Buffer;
  candidateJson: Buffer | null;
  diagnosticJson: Buffer | null;
}

export const attemptToStorageParts = (attempt: SlideAttempt): AttemptStorageParts => {
  let siteKey: string;
  let frozen: Record<string, unknown>;
  let candidate: Record<string, unknown>;

  switch (attempt.kind) {
    case "prompt-create":
      siteKey = promptSiteKey(attempt.site);
      frozen = { target: attempt.target, site: attempt.site, definition: attempt.definition };
      candidate = {
        candidateOutputId: attempt.candidateOutputId,
        candidateHeadRevision: attempt.candidateHeadRevision
      };
      break;
    case "prompt-refresh":
      siteKey = promptSiteKey(attempt.site);
      frozen = {
        site: attempt.site,
        outputId: attempt.outputId,
        frozenAppliedRevision: attempt.frozenAppliedRevision
      };
      candidate = { candidateHeadRevision: attempt.candidateHeadRevision };
      break;
    case "formula-evaluation":
      // A formula atom is addressed by a Rich Content target, which is wider
      // than a prompt site — it also reaches chart labels and Slide notes.
      siteKey = `formula:${attempt.atomId}`;
      frozen = {
        target: attempt.target,
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

  const hasCandidate = Object.values(candidate).some((value) => value !== undefined);

  return {
    siteKey,
    frozenJson: encodeJson(frozen),
    candidateJson: hasCandidate ? encodeJson(candidate) : null,
    diagnosticJson: attempt.diagnostic ? encodeJson(attempt.diagnostic) : null
  };
};

const attemptBase = (row: SQLiteRow) => ({
  id: row.id as string,
  deckId: row.deck_id as string,
  frozenDeckRevision: Number(row.frozen_deck_revision),
  state: row.state as SlideAttempt["state"],
  ...((row.settled_change_set_id as string | null) !== null
    ? { settledChangeSetId: row.settled_change_set_id as string }
    : {}),
  ...(optionalJson<SlideAttempt["diagnostic"]>(row.diagnostic_json)
    ? { diagnostic: optionalJson<SlideAttempt["diagnostic"]>(row.diagnostic_json) }
    : {}),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToAttempt = (row: SQLiteRow): SlideAttempt => {
  const frozen = decodeJson<Record<string, unknown>>(row.frozen_json);
  const candidate = optionalJson<Record<string, unknown>>(row.candidate_json) ?? {};

  switch (row.kind as SlideAttempt["kind"]) {
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
      throw new Error(`Unknown Slides attempt kind: ${String(row.kind)}`);
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
    ? { diagnostic: optionalJson<SlideStageReceipt["diagnostic"]>(row.diagnostic_json) }
    : {}),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToPromptOutputOwnership = (row: SQLiteRow): PromptOutputOwnership => ({
  outputId: row.output_id as string,
  deckId: row.deck_id as string,
  site: decodeJson<PromptSite>(row.site_json),
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
