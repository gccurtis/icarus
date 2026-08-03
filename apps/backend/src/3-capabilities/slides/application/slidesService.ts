import { randomUUID } from "node:crypto";
import type { RichText } from "#rich-text";
import type { Logger } from "#platform/observability/logger.js";
import type { InternalJobsRuntime } from "#utils/jobs/internalRuntime.js";
import { canonicalDigest, digestSnapshot } from "../domain/canonical.js";
import {
  CompensationConflictError,
  DeckNotFoundError,
  HistoryPrunedError,
  IdempotencyMismatchError,
  RevisionConflictError,
  SlideOperationError,
  SlideValidationError
} from "../domain/errors.js";
import { computeSlideIdentityTransitions, collectSlideIdentities } from "../domain/identities.js";
import type {
  DeckChangeSet,
  DeckCommittedTransaction,
  DeckHead,
  DeckSnapshot,
  SlideCommand,
  SlideCommandRequest,
  SlideCommandResult,
  SlideInternalJobIntent,
  SlideOperation,
  SlideOptions,
  SlideOrigin,
  SlideQueryRequest,
  SlideQueryResult
} from "../domain/model.js";
import { canRebase } from "../domain/rebase.js";
import {
  applyOperations,
  applyWithoutValidation,
  computeTouchedIds
} from "../domain/reducer.js";
import { validateSnapshot } from "../domain/validation.js";
import type { SlideActivityPublisher } from "../ports/activityPublisher.js";
import type { DeckMutationCommit, SlidesStore } from "../ports/slidesStore.js";
import { createBlankDeckSnapshot } from "./createService.js";

export interface SlideClock {
  now(): string;
}

export interface SlideDependencies {
  richText: RichText;
  jobs: InternalJobsRuntime<SlideInternalJobIntent>;
  logger: Logger;
  clock?: SlideClock;
  attribution?: { actorId: string };
  /** Optional post-commit delivery path for the local Activity outbox. */
  activityPublisher?: SlideActivityPublisher;
}

export interface SlidesCapability {
  command(request: SlideCommandRequest): Promise<SlideCommandResult>;
  query(request: SlideQueryRequest): Promise<SlideQueryResult>;
  compact(deckId: string): Promise<boolean>;
  /** Retry delivery for outbox rows left unpublished after a failure or restart. */
  publishPendingActivity(limit?: number): Promise<number>;
}

/**
 * Reserved for the request IDs the capability generates for itself when a
 * settle stage submits on a caller's behalf. Claimed now rather than in Phase 5
 * so a caller cannot already be depending on the namespace by then.
 */
const INTERNAL_REQUEST_PREFIX = "$slides-internal$:";

/** Operations that would write a `prompt` text source through the public path. */
const introducesPromptSource = (operation: SlideOperation): boolean => {
  if (operation.type === "prompt.apply-derived-output") return true;
  if (operation.type === "text-source.set") return operation.source.kind === "prompt";
  if (operation.type === "element.insert" || operation.type === "element.replace") {
    const element = operation.element;
    if (element.kind === "text") return element.body.kind === "prompt";
    if (element.kind === "table") {
      return element.table.cells.some((cell) => cell.body.kind === "prompt");
    }
    return false;
  }
  if (operation.type === "slide.insert") {
    return Object.values(operation.slide.elements).some((element) => {
      if (element.kind === "text") return element.body.kind === "prompt";
      if (element.kind === "table") {
        return element.table.cells.some((cell) => cell.body.kind === "prompt");
      }
      return false;
    });
  }
  if (operation.type === "table.insert-row" || operation.type === "table.insert-column") {
    return operation.cells.some((cell) => cell.body.kind === "prompt");
  }
  return false;
};

const compactionIntent = (head: DeckHead): SlideInternalJobIntent => ({
  type: "slides.compact",
  deckId: head.id,
  idempotencyKey: `slides:compact:${head.id}:${head.revision}`
});

class SlidesService implements SlidesCapability {
  constructor(
    private readonly store: SlidesStore,
    private readonly deps: SlideDependencies,
    private readonly options: SlideOptions
  ) {}

  private now(): string {
    return this.deps.clock?.now() ?? new Date().toISOString();
  }

  private attributedActor(requestActorId?: string): string | undefined {
    return requestActorId ?? this.deps.attribution?.actorId;
  }

  async command(request: SlideCommandRequest): Promise<SlideCommandResult> {
    if (request.requestId.startsWith(INTERNAL_REQUEST_PREFIX)) {
      throw new SlideOperationError("Request ID uses a reserved Slides namespace");
    }
    const startedAt = Date.now();
    this.deps.logger.debug("slides.command.started", {
      requestId: request.requestId,
      commandType: request.command.type,
      origin: request.origin
    });
    try {
      const result = await this.dispatchCommand(request);
      this.deps.logger.info("slides.command.completed", {
        requestId: request.requestId,
        commandType: request.command.type,
        origin: request.origin,
        resultType: result.type,
        durationMs: Date.now() - startedAt
      });
      return result;
    } catch (error) {
      // The service warns because it cannot know the caller's severity; the
      // wiring layer decides error-vs-warn from the status it computes.
      this.deps.logger.warn("slides.command.failed", {
        requestId: request.requestId,
        commandType: request.command.type,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt
      });
      throw error;
    }
  }

  private dispatchCommand(request: SlideCommandRequest): Promise<SlideCommandResult> {
    switch (request.command.type) {
      case "deck.create":
        return this.create(request);
      case "deck.submit":
        return this.submitDeck(request);
      case "deck.compensate":
        return this.compensate(request);
      case "deck.delete":
        return this.deleteDeck(request, request.command);
      case "deck.purge":
        return this.purgeDeck(request.command.deckId);
      default:
        // Prompt and formula commands arrive in Phase 5 and 6. Refusing by name
        // is better than a generic fallthrough: the decoder already accepted
        // them, so the caller is entitled to know it is a gap, not a typo.
        throw new SlideOperationError(
          `Slides command is not implemented yet: ${request.command.type}`
        );
    }
  }

  async query(request: SlideQueryRequest): Promise<SlideQueryResult> {
    const startedAt = Date.now();
    const query = request.query;
    const result = await (async (): Promise<SlideQueryResult> => {
      switch (query.type) {
        case "deck.list": {
          const page = await this.store.listHeads(query.cursor, query.lifecycle);
          return {
            type: "deck.listed",
            items: page.items,
            ...(page.nextCursor ? { nextCursor: page.nextCursor } : {})
          };
        }
        case "deck.load": {
          const loaded = await this.loadSnapshot(query.deckId, query.revision);
          return {
            type: "deck.loaded",
            head: loaded.head,
            snapshot: loaded.snapshot,
            // Empty until Phase 5: a prompt source resolves its text here, and
            // no Deck can hold one yet.
            promptRevisions: []
          };
        }
        case "deck.history": {
          const page = await this.store.listChangeSets(query.deckId, query.cursor, query.limit);
          if (page.items.length === 0 && !(await this.store.hasResource(query.deckId))) {
            throw new DeckNotFoundError(query.deckId);
          }
          return {
            type: "deck.history",
            items: page.items,
            ...(page.nextCursor ? { nextCursor: page.nextCursor } : {})
          };
        }
        case "deck.attempt": {
          const attempt = await this.store.getAttempt(query.deckId, query.attemptId);
          if (!attempt) throw new DeckNotFoundError(query.deckId);
          return { type: "deck.attempt", attempt };
        }
      }
    })();
    this.deps.logger.debug("slides.query.completed", {
      requestId: request.requestId,
      queryType: query.type,
      resultType: result.type,
      durationMs: Date.now() - startedAt
    });
    return result;
  }

  // ── Commands ───────────────────────────────────────────────────────────

  private async create(request: SlideCommandRequest): Promise<SlideCommandResult> {
    if (request.command.type !== "deck.create") {
      throw new SlideOperationError("Invalid create command");
    }
    const command = request.command;
    const digest = canonicalDigest(command);
    // Keyed by request ID alone: a retry has no Deck ID to look up with,
    // because the ID below is allocated rather than supplied.
    const prior = await this.store.getCreateSubmission(request.requestId);
    if (prior) {
      return this.replayReceipt(prior.requestDigest, digest, request.requestId, prior.result);
    }

    const deckId = randomUUID();
    const snapshot = createBlankDeckSnapshot({
      title: command.title,
      ...(command.canvas ? { canvas: command.canvas } : {})
    });
    const validation = validateSnapshot(snapshot, this.deps.richText, this.options.limits);
    if (!validation.ok) throw new SlideValidationError(validation.diagnostics);

    const timestamp = this.now();
    const semanticDigest = digestSnapshot(snapshot);
    const head: DeckHead = {
      id: deckId,
      title: snapshot.title,
      lifecycle: snapshot.lifecycle,
      revision: 1,
      baseSeq: 1,
      semanticDigest,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const result: SlideCommandResult = { type: "deck.created", head };
    const transaction = this.transaction({
      kind: "deck.created",
      sourceRequestId: request.requestId,
      deckId,
      revision: 1,
      ...(this.attributedActor(request.actorId)
        ? { actorId: this.attributedActor(request.actorId) as string }
        : {}),
      origin: request.origin,
      operationTypes: ["deck.create"],
      sourceSemanticDigest: semanticDigest,
      occurredAt: timestamp
    });

    await this.store.commitCreation({
      head,
      identities: collectSlideIdentities(snapshot),
      base: {
        representationVersion: 1,
        deckId,
        baseSeq: 1,
        snapshot,
        semanticDigest,
        createdAt: timestamp
      },
      // Both receipts, one transaction. The create receipt makes the create
      // replayable by request ID; the Deck-keyed one keeps the request-ID reuse
      // guard working for later commands on this Deck.
      receipt: {
        deckId,
        requestId: request.requestId,
        requestDigest: digest,
        result,
        createdAt: timestamp
      },
      createReceipt: {
        requestId: request.requestId,
        deckId,
        requestDigest: digest,
        result,
        createdAt: timestamp
      },
      transaction
    });
    await this.publishActivityTransaction(transaction);
    return result;
  }

  private async submitDeck(request: SlideCommandRequest): Promise<SlideCommandResult> {
    if (request.command.type !== "deck.submit") {
      throw new SlideOperationError("Invalid submit command");
    }
    const command = request.command;
    if (command.operations.length === 0) {
      throw new SlideOperationError("A submission requires at least one operation");
    }
    // A prompt source names a Derived Output, and the ownership row that says
    // Slides owns it is written by the creation pipeline. Letting a caller
    // write one directly would produce a source pointing at an output nothing
    // owns — invisible to the detach diff, and unresolvable on load.
    const forged = command.operations.find(introducesPromptSource);
    if (forged) {
      throw new SlideOperationError(
        `A prompt source is created through prompt.create.request, not ${forged.type}`
      );
    }
    return this.mutate({
      deckId: command.deckId,
      expectedRevision: command.expectedRevision,
      operations: command.operations,
      requestId: request.requestId,
      origin: request.origin,
      ...(this.attributedActor(request.actorId)
        ? { actorId: this.attributedActor(request.actorId) as string }
        : {})
    });
  }

  private async compensate(request: SlideCommandRequest): Promise<SlideCommandResult> {
    if (request.command.type !== "deck.compensate") {
      throw new SlideOperationError("Invalid compensation command");
    }
    const command = request.command;
    const requestDigest = canonicalDigest(command);
    const prior = await this.store.getSubmission(command.deckId, request.requestId);
    if (prior) {
      return this.replayReceipt(
        prior.requestDigest,
        requestDigest,
        request.requestId,
        prior.result
      );
    }
    const current = await this.loadSnapshot(command.deckId);
    if (current.head.revision !== command.expectedRevision) {
      throw new RevisionConflictError(
        command.deckId,
        command.expectedRevision,
        current.head.revision
      );
    }
    const target = await this.store.getChangeSet(command.deckId, command.targetChangeSetId);
    if (!target) {
      throw new CompensationConflictError(
        command.targetChangeSetId,
        "Target ChangeSet is unavailable"
      );
    }
    const intervening = await this.store.getChangeSets(
      command.deckId,
      target.revision,
      current.head.revision
    );
    // Compensation replays a stored inverse, so it is only sound if the history
    // between the target and the head is complete — a pruned gap means the
    // inverse would be applied to a state it was never computed against.
    if (
      intervening.length !== current.head.revision - target.revision ||
      intervening.some((changeSet, index) => changeSet.revision !== target.revision + index + 1)
    ) {
      throw new CompensationConflictError(
        command.targetChangeSetId,
        "ChangeSet cannot be compensated because intervening history has been pruned"
      );
    }
    const decision = canRebase(target.touchedIds, intervening);
    if (!decision.allowed) {
      throw new CompensationConflictError(
        command.targetChangeSetId,
        `Compensation conflicts on: ${decision.conflictingIds.join(", ")}`
      );
    }
    return this.mutate({
      deckId: command.deckId,
      expectedRevision: current.head.revision,
      operations: target.inverseOperations,
      requestId: request.requestId,
      origin: request.origin,
      ...(this.attributedActor(request.actorId)
        ? { actorId: this.attributedActor(request.actorId) as string }
        : {}),
      compensation: {
        intent: command.intent,
        targetChangeSetId: command.targetChangeSetId
      },
      requestDigest
    });
  }

  /** Logical deletion: retained history and the source transaction remain. */
  private async deleteDeck(
    request: SlideCommandRequest,
    command: Extract<SlideCommand, { type: "deck.delete" }>
  ): Promise<SlideCommandResult> {
    const requestDigest = canonicalDigest(command);
    const prior = await this.store.getSubmission(command.deckId, request.requestId);
    if (prior) {
      return this.replayReceipt(
        prior.requestDigest,
        requestDigest,
        request.requestId,
        prior.result
      );
    }
    const head = await this.store.getHead(command.deckId);
    if (!head) throw new DeckNotFoundError(command.deckId);
    if (head.revision !== command.expectedRevision) {
      throw new RevisionConflictError(command.deckId, command.expectedRevision, head.revision);
    }

    const timestamp = this.now();
    const revision = head.revision + 1;
    const transaction = this.transaction({
      kind: "deck.deleted",
      sourceRequestId: request.requestId,
      deckId: command.deckId,
      revision,
      ...(this.attributedActor(request.actorId)
        ? { actorId: this.attributedActor(request.actorId) as string }
        : {}),
      origin: request.origin,
      operationTypes: ["deck.delete"],
      sourceSemanticDigest: head.semanticDigest,
      occurredAt: timestamp
    });
    const deletedRevision = await this.store.deleteDeck(
      command.deckId,
      timestamp,
      transaction
    );
    if (deletedRevision === null) throw new DeckNotFoundError(command.deckId);
    await this.publishActivityTransaction(transaction);
    return { type: "deck.deleted", deckId: command.deckId, revision: deletedRevision };
  }

  private async purgeDeck(deckId: string): Promise<SlideCommandResult> {
    if (!(await this.store.hasResource(deckId))) throw new DeckNotFoundError(deckId);
    await this.store.purgeDeck(deckId);
    return { type: "deck.purged", deckId };
  }

  // ── The mutation path ──────────────────────────────────────────────────

  private async mutate(input: {
    deckId: string;
    expectedRevision: number;
    operations: SlideOperation[];
    requestId: string;
    origin: SlideOrigin;
    actorId?: string;
    compensation?: DeckChangeSet["compensation"];
    requestDigest?: string;
  }): Promise<SlideCommandResult> {
    const requestValue = {
      deckId: input.deckId,
      expectedRevision: input.expectedRevision,
      operations: input.operations,
      compensation: input.compensation
    };
    const requestDigest = input.requestDigest ?? canonicalDigest(requestValue);
    const prior = await this.store.getSubmission(input.deckId, input.requestId);
    if (prior) {
      return this.replayReceipt(
        prior.requestDigest,
        requestDigest,
        input.requestId,
        prior.result
      );
    }

    const current = await this.loadSnapshot(input.deckId);
    if (input.expectedRevision > current.head.revision) {
      throw new RevisionConflictError(
        input.deckId,
        input.expectedRevision,
        current.head.revision
      );
    }

    // Rebase admission. A submission authored against an older revision is
    // accepted when nothing it touches has moved since — the touched IDs are
    // computed against the revision the caller actually saw, then checked
    // against every ChangeSet that has landed after it.
    if (input.expectedRevision < current.head.revision) {
      const authored = (await this.loadSnapshot(input.deckId, input.expectedRevision)).snapshot;
      const touched = computeTouchedIds(authored, input.operations);
      const intervening = await this.store.getChangeSets(
        input.deckId,
        input.expectedRevision,
        current.head.revision
      );
      const decision = canRebase(touched, intervening);
      if (!decision.allowed) {
        this.deps.logger.debug("slides.mutation.rebase-refused", {
          deckId: input.deckId,
          requestId: input.requestId,
          authoredRevision: input.expectedRevision,
          headRevision: current.head.revision,
          conflictingIds: decision.conflictingIds
        });
        throw new RevisionConflictError(
          input.deckId,
          input.expectedRevision,
          current.head.revision
        );
      }
      this.deps.logger.debug("slides.mutation.rebased", {
        deckId: input.deckId,
        requestId: input.requestId,
        authoredRevision: input.expectedRevision,
        headRevision: current.head.revision,
        interveningCount: intervening.length
      });
    }

    // Applied to the CURRENT snapshot, not the authored one: rebase decides
    // whether the edit is still meaningful, and then it lands on the head.
    const applied = applyOperations(
      current.snapshot,
      input.operations,
      this.deps.richText,
      this.options.limits
    );
    const revision = current.head.revision + 1;
    applied.snapshot.revision = revision;
    const semanticDigest = digestSnapshot(applied.snapshot);
    const timestamp = this.now();
    const changeSetId = randomUUID();

    const changeSet: DeckChangeSet = {
      id: changeSetId,
      deckId: input.deckId,
      clientRequestId: input.requestId,
      requestDigest,
      authoredRevision: input.expectedRevision,
      priorRevision: current.head.revision,
      revision,
      seq: revision,
      origin: input.origin,
      operations: applied.forward,
      inverseOperations: applied.inverse,
      touchedIds: applied.touchedIds,
      ...(input.compensation ? { compensation: input.compensation } : {}),
      semanticDigest,
      createdAt: timestamp
    };
    const head: DeckHead = {
      ...current.head,
      title: applied.snapshot.title,
      lifecycle: applied.snapshot.lifecycle,
      revision,
      semanticDigest,
      updatedAt: timestamp
    };
    const result: SlideCommandResult = { type: "deck.changed", changeSet };

    const commit: DeckMutationCommit = {
      expectedRevision: current.head.revision,
      head,
      changeSet,
      identityTransitions: computeSlideIdentityTransitions(current.snapshot, applied.snapshot),
      // Reactivating a tombstoned identity is legal only when an exact inverse
      // is putting it back, which is what compensation is.
      identityReactivation: input.compensation ? "same-kind-compensation" : "forbid",
      receipt: {
        deckId: input.deckId,
        requestId: input.requestId,
        requestDigest,
        result,
        createdAt: timestamp
      },
      transaction: this.transaction({
        kind: input.compensation ? "deck.compensated" : "deck.changed",
        sourceRequestId: input.requestId,
        deckId: input.deckId,
        revision,
        sourceChangeSetId: changeSetId,
        ...(input.actorId ? { actorId: input.actorId } : {}),
        origin: input.origin,
        operationTypes: input.operations.map((operation) => operation.type),
        sourceSemanticDigest: semanticDigest,
        ...(input.compensation ? { compensation: input.compensation } : {}),
        occurredAt: timestamp
      })
    };

    if (!(await this.store.commitMutation(commit))) {
      throw new RevisionConflictError(
        input.deckId,
        current.head.revision,
        (await this.store.getHead(input.deckId))?.revision ?? -1
      );
    }
    if (applied.formulaChanges.length > 0) {
      // Phase 6 turns these into evaluation attempts. Until then the atom is
      // stored as authored and simply carries no settled value, which is a
      // visible gap rather than a silent one.
      this.deps.logger.info("slides.formula.settlement-deferred", {
        deckId: input.deckId,
        changeSetId,
        atomCount: applied.formulaChanges.length
      });
    }
    await this.publishActivityTransaction(commit.transaction);
    if (head.revision - head.baseSeq >= this.options.history.retainedChangeSetCount) {
      await this.dispatch(compactionIntent(head));
    }
    return result;
  }

  // ── History ────────────────────────────────────────────────────────────

  async compact(deckId: string): Promise<boolean> {
    const current = await this.loadSnapshot(deckId);
    const cutoffRevision = Math.max(
      1,
      current.head.revision - this.options.history.retainedChangeSetCount
    );
    const cutoff = cutoffRevision === current.head.revision
      ? current
      : await this.loadSnapshot(deckId, cutoffRevision);
    const createdAt = this.now();

    const cutoffAppended = await this.store.appendBaseIfHead(deckId, current.head.revision, {
      representationVersion: 1,
      deckId,
      baseSeq: cutoffRevision,
      snapshot: cutoff.snapshot,
      semanticDigest: digestSnapshot(cutoff.snapshot),
      createdAt
    });
    if (!cutoffAppended) {
      this.deps.logger.debug("slides.compaction.skipped", { deckId, cutoffRevision });
      return false;
    }

    const appended = cutoffRevision === current.head.revision
      ? true
      : await this.store.appendBaseIfHead(deckId, current.head.revision, {
          representationVersion: 1,
          deckId,
          baseSeq: current.head.revision,
          snapshot: current.snapshot,
          semanticDigest: current.head.semanticDigest,
          createdAt
        });
    if (appended) {
      await this.store.pruneHistory(
        deckId,
        this.options.history.retainedBaseCount,
        this.options.history.retainedChangeSetCount,
        this.options.history.retainedTerminalAttemptCount
      );
    }
    this.deps.logger.info("slides.compaction.completed", { deckId, cutoffRevision, appended });
    return appended;
  }

  async publishPendingActivity(limit?: number): Promise<number> {
    const pending = await this.store.listUnpublishedTransactions(limit);
    let published = 0;
    for (const transaction of pending) {
      if (await this.publishActivityTransaction(transaction)) published += 1;
    }
    if (pending.length > 0) {
      this.deps.logger.info("slides.activity.republished", {
        attempted: pending.length,
        published
      });
    }
    return published;
  }

  // ── Internals ──────────────────────────────────────────────────────────

  /**
   * Rebuild a snapshot from the nearest Base plus every ChangeSet after it. A
   * gap in that run means the requested revision is no longer reconstructable,
   * which is a pruned-history answer rather than a not-found one.
   */
  private async loadSnapshot(
    deckId: string,
    revision?: number
  ): Promise<{ head: DeckHead; snapshot: DeckSnapshot }> {
    const current = await this.store.getHead(deckId);
    if (!current && revision === undefined) throw new DeckNotFoundError(deckId);
    const target = revision ?? (current as DeckHead).revision;
    if (!Number.isSafeInteger(target) || target < 1) {
      throw new HistoryPrunedError(deckId, target);
    }
    const head = current?.revision === target
      ? current
      : await this.store.getHistoricalHead(deckId, target);
    if (!head) {
      if (!(await this.store.hasResource(deckId))) throw new DeckNotFoundError(deckId);
      throw new HistoryPrunedError(deckId, target);
    }
    const base = await this.store.getBaseAtOrBefore(deckId, target);
    if (!base) throw new HistoryPrunedError(deckId, target);

    let snapshot = structuredClone(base.snapshot);
    const changes = await this.store.getChangeSets(deckId, base.baseSeq, target);
    let expected = base.baseSeq + 1;
    for (const changeSet of changes) {
      if (changeSet.revision !== expected) throw new HistoryPrunedError(deckId, target);
      snapshot = applyWithoutValidation(snapshot, changeSet.operations, this.deps.richText);
      snapshot.revision = changeSet.revision;
      expected += 1;
    }
    if (target >= base.baseSeq && expected !== target + 1) {
      throw new HistoryPrunedError(deckId, target);
    }
    const validation = validateSnapshot(snapshot, this.deps.richText, this.options.limits);
    if (!validation.ok) throw new SlideValidationError(validation.diagnostics);
    return { head, snapshot };
  }

  /**
   * A retry of the same request replays its stored result. A retry of the same
   * request ID with *different* input is a client bug, not a replay, and saying
   * so is the only way the caller finds out.
   */
  private replayReceipt(
    storedDigest: string,
    requestDigest: string,
    requestId: string,
    result: SlideCommandResult
  ): SlideCommandResult {
    if (storedDigest !== requestDigest) throw new IdempotencyMismatchError(requestId);
    this.deps.logger.info("slides.command.replayed", {
      requestId,
      resultType: result.type
    });
    return result;
  }

  private transaction(
    input: Omit<DeckCommittedTransaction, "sourceTransactionId">
  ): DeckCommittedTransaction {
    return {
      ...input,
      // Derived, not random: a retry that reaches this point again produces the
      // same key, and the outbox insert is ON CONFLICT DO NOTHING.
      sourceTransactionId: `slides:${input.deckId}:${input.sourceRequestId}:${input.kind}`
    };
  }

  /**
   * Source state is already committed when this runs. A delivery failure stays
   * in the local outbox for `publishPendingActivity()` rather than changing the
   * accepted command result.
   */
  private async publishActivityTransaction(
    transaction: DeckCommittedTransaction
  ): Promise<boolean> {
    const publisher = this.deps.activityPublisher;
    if (!publisher) return false;
    try {
      await publisher.publish(transaction);
      await this.store.markTransactionPublished(transaction.sourceTransactionId, this.now());
      return true;
    } catch (error) {
      this.deps.logger.warn("slides.activity.publish-failed", {
        sourceTransactionId: transaction.sourceTransactionId,
        deckId: transaction.deckId,
        sourceRequestId: transaction.sourceRequestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  private async dispatch(intent: SlideInternalJobIntent): Promise<void> {
    try {
      await this.deps.jobs.dispatch(intent);
    } catch (error) {
      // The Deck is already committed; a failed dispatch delays compaction and
      // nothing else, so it must not fail the caller's command.
      this.deps.logger.warn("slides.internal-job.dispatch-failed", {
        intentType: intent.type,
        idempotencyKey: intent.idempotencyKey,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const createSlidesCapability = (
  store: SlidesStore,
  dependencies: SlideDependencies,
  options: SlideOptions
): SlidesCapability => new SlidesService(store, dependencies, options);
