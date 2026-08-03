import { randomUUID } from "node:crypto";
import type { RichText } from "#rich-text";
import type { Logger } from "#platform/observability/logger.js";
import type { InternalJobsRuntime } from "#utils/jobs/internalRuntime.js";
import {
  CompensationConflictError,
  DeckNotFoundError,
  HistoryPrunedError,
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
    const startedAt = Date.now();
    this.deps.logger.debug("slides.command.started", {
      commandType: request.command.type,
      origin: request.origin
    });
    try {
      const result = await this.dispatchCommand(request);
      this.deps.logger.info("slides.command.completed", {
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
    const deckId = randomUUID();
    const snapshot = createBlankDeckSnapshot({
      title: command.title,
      ...(command.canvas ? { canvas: command.canvas } : {})
    });
    const validation = validateSnapshot(snapshot, this.deps.richText, this.options.limits);
    if (!validation.ok) throw new SlideValidationError(validation.diagnostics);

    const timestamp = this.now();
    const head: DeckHead = {
      id: deckId,
      title: snapshot.title,
      lifecycle: snapshot.lifecycle,
      revision: 1,
      baseSeq: 1,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const result: SlideCommandResult = { type: "deck.created", head };
    const transaction = this.transaction({
      kind: "deck.created",
      deckId,
      revision: 1,
      ...(this.attributedActor(request.actorId)
        ? { actorId: this.attributedActor(request.actorId) as string }
        : {}),
      origin: request.origin,
      operationTypes: ["deck.create"],
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
      origin: request.origin,
      ...(this.attributedActor(request.actorId)
        ? { actorId: this.attributedActor(request.actorId) as string }
        : {}),
      compensation: {
        intent: command.intent,
        targetChangeSetId: command.targetChangeSetId
      }
    });
  }

  /** Logical deletion: retained history and the source transaction remain. */
  private async deleteDeck(
    request: SlideCommandRequest,
    command: Extract<SlideCommand, { type: "deck.delete" }>
  ): Promise<SlideCommandResult> {
    const head = await this.store.getHead(command.deckId);
    if (!head) throw new DeckNotFoundError(command.deckId);
    if (head.revision !== command.expectedRevision) {
      throw new RevisionConflictError(command.deckId, command.expectedRevision, head.revision);
    }

    const timestamp = this.now();
    const revision = head.revision + 1;
    const transaction = this.transaction({
      kind: "deck.deleted",
      deckId: command.deckId,
      revision,
      ...(this.attributedActor(request.actorId)
        ? { actorId: this.attributedActor(request.actorId) as string }
        : {}),
      origin: request.origin,
      operationTypes: ["deck.delete"],
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
    origin: SlideOrigin;
    actorId?: string;
    compensation?: DeckChangeSet["compensation"];
  }): Promise<SlideCommandResult> {
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
      // Rebase overrides the revision check, so it must never do so on no
      // evidence. An operation that claims to touch nothing has told us nothing
      // about whether it still makes sense, and admitting it means the last
      // writer wins silently. Failing closed here means a future operation that
      // forgets to claim an ID degrades to "must be current" rather than
      // "always wins" — which is the failure mode that hid the rename bug.
      if (touched.length === 0) {
        this.deps.logger.warn("slides.mutation.rebase-refused", {
          deckId: input.deckId,
          authoredRevision: input.expectedRevision,
          headRevision: current.head.revision,
          reason: "no-touched-ids",
          operationTypes: input.operations.map((operation) => operation.type)
        });
        throw new RevisionConflictError(
          input.deckId,
          input.expectedRevision,
          current.head.revision
        );
      }
      const intervening = await this.store.getChangeSets(
        input.deckId,
        input.expectedRevision,
        current.head.revision
      );
      const decision = canRebase(touched, intervening);
      if (!decision.allowed) {
        this.deps.logger.debug("slides.mutation.rebase-refused", {
          deckId: input.deckId,
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
    const timestamp = this.now();
    const changeSetId = randomUUID();

    const changeSet: DeckChangeSet = {
      id: changeSetId,
      deckId: input.deckId,
      authoredRevision: input.expectedRevision,
      priorRevision: current.head.revision,
      revision,
      seq: revision,
      origin: input.origin,
      operations: applied.forward,
      inverseOperations: applied.inverse,
      touchedIds: applied.touchedIds,
      ...(input.compensation ? { compensation: input.compensation } : {}),
      createdAt: timestamp
    };
    const head: DeckHead = {
      ...current.head,
      title: applied.snapshot.title,
      lifecycle: applied.snapshot.lifecycle,
      revision,
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
      transaction: this.transaction({
        kind: input.compensation ? "deck.compensated" : "deck.changed",
        deckId: input.deckId,
        revision,
        sourceChangeSetId: changeSetId,
        ...(input.actorId ? { actorId: input.actorId } : {}),
        origin: input.origin,
        operationTypes: input.operations.map((operation) => operation.type),
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

  private transaction(
    input: Omit<DeckCommittedTransaction, "sourceTransactionId">
  ): DeckCommittedTransaction {
    return {
      ...input,
      // Derived from committed state, not random. Exactly one transaction is
      // ever recorded for a given Deck revision, so recomputing this during
      // republication produces the same key and the outbox insert — and
      // Activity's own idempotency — collapse the duplicate.
      sourceTransactionId: `slides:${input.deckId}:${input.revision}:${input.kind}`
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
        revision: transaction.revision,
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
