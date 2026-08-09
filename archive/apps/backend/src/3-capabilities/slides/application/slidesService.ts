import { randomUUID } from "node:crypto";
import type { DerivedOutputRevision } from "#derived-outputs";
import type { RichText } from "#rich-text";
import type { Logger } from "#platform/observability/logger.js";
import type { InternalJobsRuntime } from "#utils/jobs/internalRuntime.js";
import {
  CompensationConflictError,
  DeckNotFoundError,
  HistoryPrunedError,
  RevisionConflictError,
  SlideAttemptNotFoundError,
  SlideIdentityReuseError,
  SlideOperationError,
  SlidePlacementError,
  SlideStaleAttemptError,
  SlideStyleReferenceError,
  SlideTokenReferenceError,
  SlideValidationError
} from "../domain/errors.js";
import { findTextSource, promptSiteKey, promptSites } from "../domain/elements.js";
import { computeSlideIdentityTransitions, collectSlideIdentities } from "../domain/identities.js";
import type {
  DeckChangeSet,
  DeckCommittedTransaction,
  DeckHead,
  DeckSnapshot,
  ElementContainerRef,
  PromptCreateTarget,
  PromptCreationAttempt,
  PromptRefreshAttempt,
  PromptSite,
  SlideAttempt,
  SlideCommand,
  SlideCommandRequest,
  SlideCommandResult,
  SlideElement,
  SlideInternalJobIntent,
  SlideOperation,
  SlideOptions,
  SlideOrigin,
  SlideQueryRequest,
  SlideQueryResult,
  SlideStageReceipt,
  TextElement
} from "../domain/model.js";
import { canonicalDigest } from "../domain/canonical.js";
import { deckOutline } from "../domain/outline.js";
import { canRebase } from "../domain/rebase.js";
import {
  applyOperations,
  applyWithoutValidation,
  computeTouchedIds
} from "../domain/reducer.js";
import { validateSnapshot } from "../domain/validation.js";
import type { SlideActivityPublisher } from "../ports/activityPublisher.js";
import type { SlideDerivedOutputs } from "../ports/derivedOutputs.js";
import type {
  DeckMutationCommit,
  PromptOwnershipTransition,
  SlidesStore
} from "../ports/slidesStore.js";
import { createBlankDeckSnapshot } from "./createService.js";

export interface SlideClock {
  now(): string;
}

export interface SlideDependencies {
  richText: RichText;
  jobs: InternalJobsRuntime<SlideInternalJobIntent>;
  logger: Logger;
  derivedOutputs: SlideDerivedOutputs;
  clock?: SlideClock;
  attribution?: { actorId: string };
  /** Optional post-commit delivery path for the local Activity outbox. */
  activityPublisher?: SlideActivityPublisher;
}

export interface SlidesCapability {
  command(request: SlideCommandRequest): Promise<SlideCommandResult>;
  query(request: SlideQueryRequest): Promise<SlideQueryResult>;
  compact(deckId: string): Promise<boolean>;
  computePromptCreation(attemptId: string): Promise<void>;
  settlePromptCreation(attemptId: string): Promise<void>;
  computePromptRefresh(attemptId: string): Promise<void>;
  settlePromptRefresh(attemptId: string): Promise<void>;
  /** Re-dispatch attempts a restart left mid-flight. Called once at startup. */
  recoverPendingAttempts(): Promise<number>;
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

const TERMINAL_ATTEMPT_STATES = ["settled", "unchanged", "stale", "failed"];

/** Delays between retries of a stage bookkeeping action. Length is the cap. */
const STAGE_RETRY_DELAYS_MS = [50, 200, 1_000];

const waitForRetry = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const attemptIntent = (
  attempt: SlideAttempt,
  stage: "compute" | "settle"
): SlideInternalJobIntent =>
  ({
    type: `slides.${
      attempt.kind === "prompt-create"
        ? "prompt.create"
        : attempt.kind === "prompt-refresh"
          ? "prompt.refresh"
          : "formula.evaluate"
    }.${stage}`,
    attemptId: attempt.id,
    idempotencyKey: `slides:${attempt.id}:${stage}`
  }) as SlideInternalJobIntent;

/**
 * Matched by name rather than `instanceof`, exactly as Document does it.
 * `ports/derivedOutputs.ts` imports nothing at runtime, and importing the
 * concrete error class to identify it would make this the one place Slides
 * links against another capability's implementation — for a check that only
 * needs to answer "already gone?".
 */
const isNotFound = (error: unknown): boolean =>
  error instanceof Error && error.name === "DerivedOutputNotFoundError";

/**
 * Settlement lost a race with an ordinary edit rather than breaking.
 *
 * The site can be deleted, relocated, restyled, or have its Layout slot removed
 * while the model is running. Every one of those is a legitimate edit, so the
 * attempt goes stale — it is not a fault, and it must not be retried.
 */
const isPromptSettlementConflict = (error: unknown): boolean =>
  error instanceof SlideOperationError ||
  error instanceof SlidePlacementError ||
  error instanceof SlideValidationError ||
  error instanceof SlideStyleReferenceError ||
  error instanceof SlideTokenReferenceError ||
  error instanceof SlideIdentityReuseError ||
  error instanceof RevisionConflictError;

/** Every live prompt source, keyed by its site. The input to the detach diff. */
const promptReferences = (snapshot: DeckSnapshot): Map<string, string> => {
  const references = new Map<string, string>();
  for (const entry of promptSites(snapshot)) {
    references.set(promptSiteKey(entry.site), entry.outputId);
  }
  return references;
};

/** The site a reference key came from, so a transition can carry it back. */
const promptSitesByKey = (snapshot: DeckSnapshot): Map<string, PromptSite> => {
  const sites = new Map<string, PromptSite>();
  for (const entry of promptSites(snapshot)) sites.set(promptSiteKey(entry.site), entry.site);
  return sites;
};

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
      case "prompt.create.request":
        return this.requestPromptCreation(request);
      case "prompt.update-definition":
        return this.updatePromptDefinition(request);
      case "prompt.refresh.request":
        return this.requestPromptRefresh(request);
      default:
        // Formula evaluation arrives in Phase 6. Refusing by name is better than
        // a generic fallthrough: the decoder already accepted it, so the caller
        // is entitled to know it is a gap, not a typo.
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
            promptRevisions: await this.resolvePromptRevisions(loaded.snapshot)
          };
        }
        case "deck.outline": {
          const loaded = await this.loadSnapshot(query.deckId, query.revision);
          return {
            type: "deck.outline",
            deckId: query.deckId,
            revision: loaded.head.revision,
            text: deckOutline(loaded.snapshot)
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

  // ── Prompt sources ─────────────────────────────────────────────────────

  /**
   * Freeze a prompt creation and hand the caller an attempt id.
   *
   * Nothing is written into the Deck here. The element the prompt will occupy
   * does not exist until settlement, which is what makes the whole thing
   * cancellable: an attempt that never settles leaves no trace in the snapshot.
   */
  private async requestPromptCreation(
    request: SlideCommandRequest
  ): Promise<SlideCommandResult> {
    if (request.command.type !== "prompt.create.request") {
      throw new SlideOperationError("Invalid prompt-creation command");
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

    // The site is decided here, before any model call, because it is the key
    // everything downstream dedupes and revalidates on. For `new-text-element`
    // that means allocating the element id now: the caller names placement,
    // never an identifier, and settlement needs an address to aim at.
    const elementId = command.target.kind === "new-text-element"
      ? randomUUID()
      : command.target.site.elementId;
    const site: PromptSite = command.target.kind === "new-text-element"
      ? { kind: "element-body", container: command.target.container, elementId }
      : command.target.site;

    if (command.target.kind === "new-text-element") {
      // Prove the placement before spending an LLM call, the way Document
      // dry-runs a throwaway divider. A slot that rejects a text element, or a
      // parent group that does not exist, should fail now and not after the
      // model has answered.
      applyOperations(
        current.snapshot,
        [{
          type: "element.insert",
          container: command.target.container,
          element: this.promptTextElement(
            command.target,
            elementId,
            this.placementProbeBody(elementId)
          )
        }],
        this.deps.richText,
        this.options.limits
      );
    } else {
      const existing = findTextSource(current.snapshot, site);
      if (!existing) {
        throw new SlideOperationError(
          `Prompt site does not resolve to a text surface: ${promptSiteKey(site)}`
        );
      }
      if (existing.kind === "prompt") {
        throw new SlideOperationError(
          `Prompt site already holds a prompt source: ${promptSiteKey(site)}`
        );
      }
    }

    // A detached row is a record of an output that was given back — by an undo,
    // or by a settlement that lost — and it does not hold the site.
    const bound = await this.store.getPromptOutputOwnershipBySite(command.deckId, site);
    if (bound && bound.state !== "detached") {
      throw new SlideOperationError(
        `Prompt site is already bound to a Derived Output: ${promptSiteKey(site)}`
      );
    }

    const timestamp = this.now();
    const definition = {
      prompt: command.prompt,
      contextEntries: command.contextEntries,
      stabilisationText: command.stabilisationText
    };

    // Two "prompt this site" requests while one is in flight are the same
    // request. A terminal attempt is history and does not block a new one — the
    // snapshot check above is the authority on whether the site is free.
    const live = await this.store.getLivePromptAttemptBySite(
      command.deckId,
      "prompt-create",
      site
    );
    if (live) return { type: "prompt.create-requested", attemptId: live.id, site };

    const attempt: PromptCreationAttempt = {
      id: randomUUID(),
      kind: "prompt-create",
      deckId: command.deckId,
      target: command.target,
      site,
      definition,
      frozenDeckRevision: current.head.revision,
      state: "requested",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.createAttempt(attempt);
    this.deps.logger.info("slides.attempt.requested", {
      attemptId: attempt.id,
      kind: attempt.kind,
      deckId: attempt.deckId,
      siteKey: promptSiteKey(site)
    });
    await this.dispatch(attemptIntent(attempt, "compute"));
    return { type: "prompt.create-requested", attemptId: attempt.id, site };
  }

  /** The element a `new-text-element` target becomes, with a caller-chosen body. */
  private promptTextElement(
    target: Extract<PromptCreateTarget, { kind: "new-text-element" }>,
    elementId: string,
    body: TextElement["body"]
  ): SlideElement {
    return {
      id: elementId,
      kind: "text",
      zIndex: 0,
      placement: target.placement,
      locked: false,
      hidden: false,
      ...(target.styleId ? { styleId: target.styleId } : {}),
      ...(target.parentGroupId ? { parentGroupId: target.parentGroupId } : {}),
      body
    };
  }

  /**
   * Stand-in content for the placement dry-run.
   *
   * Document probes with a `divider`, which carries no content at all. Every
   * Slides element that can hold a prompt holds Rich Content, and Rich Content
   * must have at least one atom — so the probe needs a body, and it is thrown
   * away with the cloned snapshot the moment the check returns.
   */
  private placementProbeBody(elementId: string): TextElement["body"] {
    return {
      kind: "rich",
      content: { atoms: [{ id: `${elementId}-probe`, kind: "text", text: "probe" }], marks: [] }
    };
  }

  private async updatePromptDefinition(
    request: SlideCommandRequest
  ): Promise<SlideCommandResult> {
    if (request.command.type !== "prompt.update-definition") {
      throw new SlideOperationError("Invalid prompt definition-update command");
    }
    const command = request.command;
    const { snapshot } = await this.loadSnapshot(command.deckId);
    const source = findTextSource(snapshot, command.site);
    if (!source || source.kind !== "prompt") {
      throw new SlideOperationError(
        `Prompt site does not hold a prompt source: ${promptSiteKey(command.site)}`
      );
    }
    const output = await this.deps.derivedOutputs.updateDefinition(
      source.output.outputId,
      {
        prompt: command.prompt,
        contextEntries: command.contextEntries,
        stabilisationText: command.stabilisationText,
        expectedDefinitionRevision: command.expectedDefinitionRevision
      },
      {
        // Derived Outputs is idempotent on this key, and the key is derived
        // from the site and the definition revision being replaced — so a
        // retry of the same edit replays instead of applying twice.
        idempotencyKey: `slides:prompt-definition:${command.deckId}:${promptSiteKey(
          command.site
        )}:${command.expectedDefinitionRevision}`
      }
    );
    return { type: "prompt.definition-updated", output };
  }

  private async requestPromptRefresh(
    request: SlideCommandRequest
  ): Promise<SlideCommandResult> {
    if (request.command.type !== "prompt.refresh.request") {
      throw new SlideOperationError("Invalid prompt-refresh command");
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
    const source = findTextSource(current.snapshot, command.site);
    if (!source || source.kind !== "prompt") {
      throw new SlideOperationError(
        `Prompt site does not hold a prompt source: ${promptSiteKey(command.site)}`
      );
    }

    // Two "refresh this site" requests while one is in flight are the same
    // request, whatever the caller called them. This is the honest dedupe key
    // now that no request id exists to reuse.
    const live = await this.store.getLivePromptAttemptBySite(
      command.deckId,
      "prompt-refresh",
      command.site
    );
    if (live) return { type: "prompt.refresh-requested", attemptId: live.id };

    const timestamp = this.now();
    const attempt: PromptRefreshAttempt = {
      id: randomUUID(),
      kind: "prompt-refresh",
      deckId: command.deckId,
      site: command.site,
      outputId: source.output.outputId,
      frozenAppliedRevision: source.output.appliedRevision,
      frozenDeckRevision: current.head.revision,
      state: "requested",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.store.createAttempt(attempt);
    this.deps.logger.info("slides.attempt.requested", {
      attemptId: attempt.id,
      kind: attempt.kind,
      deckId: attempt.deckId,
      siteKey: promptSiteKey(command.site)
    });
    await this.dispatch(attemptIntent(attempt, "compute"));
    return { type: "prompt.refresh-requested", attemptId: attempt.id };
  }

  // ── The mutation path ──────────────────────────────────────────────────

  private async mutate(input: {
    deckId: string;
    expectedRevision: number;
    operations: SlideOperation[];
    origin: SlideOrigin;
    actorId?: string;
    compensation?: DeckChangeSet["compensation"];
    /** Marked settled in the same transaction as the ChangeSet it produced. */
    settleAttempt?: SlideAttempt;
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
    const settleAttempt = input.settleAttempt
      ? {
          ...input.settleAttempt,
          state: "settled" as const,
          settledChangeSetId: changeSetId,
          updatedAt: timestamp
        }
      : undefined;

    const commit: DeckMutationCommit = {
      expectedRevision: current.head.revision,
      head,
      changeSet,
      identityTransitions: computeSlideIdentityTransitions(current.snapshot, applied.snapshot),
      // Reactivating a tombstoned identity is legal only when an exact inverse
      // is putting it back, which is what compensation is.
      identityReactivation: input.compensation ? "same-kind-compensation" : "forbid",
      ...(settleAttempt ? { attemptUpdates: [settleAttempt] } : {}),
      promptOwnershipTransitions: this.promptOwnershipTransitions(
        input.deckId,
        current.snapshot,
        applied.snapshot,
        revision,
        timestamp,
        input.settleAttempt
      ),
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
    if (settleAttempt) {
      this.deps.logger.info("slides.attempt.settled", {
        attemptId: settleAttempt.id,
        kind: settleAttempt.kind,
        deckId: input.deckId,
        settledChangeSetId: changeSetId
      });
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

  // ── Prompt stages ──────────────────────────────────────────────────────

  async computePromptCreation(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "compute", "prompt-create", async (attempt) => {
      const output = await this.deps.derivedOutputs.declare(
        {
          prompt: attempt.definition.prompt,
          contextEntries: attempt.definition.contextEntries,
          stabilisationText: attempt.definition.stabilisationText
        },
        { idempotencyKey: `slides:prompt-create:${attempt.id}` }
      );
      // Registered before the refresh, so a crash between the two leaves a
      // pending row naming an output Slides owns rather than an orphan.
      await this.store.registerPendingPromptOutput({
        outputId: output.id,
        deckId: attempt.deckId,
        site: attempt.site,
        creationAttemptId: attempt.id,
        state: "pending",
        createdAt: this.now(),
        updatedAt: this.now()
      });
      const refreshed = await this.deps.derivedOutputs.refresh(output.id, {
        idempotencyKey: `slides:prompt-create:${attempt.id}:refresh`
      });
      if (refreshed.output.headRevision <= 0) {
        // Declared but never answered. There is nothing to put in the Deck, so
        // the output is detached rather than left bound to a site it never
        // reached.
        await this.store.updatePromptOutputOwnership({
          outputId: output.id,
          deckId: attempt.deckId,
          site: attempt.site,
          creationAttemptId: attempt.id,
          state: "detached",
          at: this.now()
        });
        await this.store.updateAttempt({
          ...attempt,
          state: "failed",
          candidateOutputId: output.id,
          diagnostic: {
            code: "initial_refresh_failed",
            message: "The dedicated Derived Output did not publish a first revision"
          },
          updatedAt: this.now()
        });
        this.deps.logger.info("slides.attempt.failed", {
          attemptId: attempt.id,
          kind: attempt.kind,
          deckId: attempt.deckId,
          diagnosticCode: "initial_refresh_failed"
        });
        return;
      }
      const proposed: PromptCreationAttempt = {
        ...attempt,
        state: "proposed",
        candidateOutputId: output.id,
        candidateHeadRevision: refreshed.output.headRevision,
        updatedAt: this.now()
      };
      await this.store.updateAttempt(proposed);
      this.deps.logger.info("slides.attempt.proposed", {
        attemptId: proposed.id,
        kind: proposed.kind,
        deckId: proposed.deckId
      });
      await this.dispatch(attemptIntent(proposed, "settle"));
    });
  }

  async settlePromptCreation(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "settle", "prompt-create", async (attempt) => {
      if (!attempt.candidateOutputId || !attempt.candidateHeadRevision) {
        throw new SlideStaleAttemptError(
          attempt.id,
          "Prompt creation has no candidate output revision"
        );
      }
      const current = await this.loadSnapshot(attempt.deckId);
      const source: TextElement["body"] = {
        kind: "prompt",
        output: {
          outputId: attempt.candidateOutputId,
          appliedRevision: attempt.candidateHeadRevision
        }
      };

      // Revalidated here, not trusted from freeze. A bound Layout slot can be
      // deleted, the container can go, or the surface can have been converted
      // to a prompt by something else while the model was running.
      const stale = this.promptCreationStaleness(current.snapshot, attempt);
      if (stale) {
        await this.detachCandidate(attempt);
        await this.markStale(attempt, new Error(stale));
        return;
      }

      const operations: SlideOperation[] = attempt.target.kind === "new-text-element"
        ? [{
            type: "element.insert",
            container: attempt.target.container,
            element: this.promptTextElement(attempt.target, attempt.site.elementId, source)
          }]
        : [{ type: "text-source.set", target: attempt.site, source }];

      try {
        await this.mutate({
          deckId: attempt.deckId,
          expectedRevision: current.head.revision,
          operations,
          origin: "automation",
          settleAttempt: attempt
        });
      } catch (error) {
        if (!isPromptSettlementConflict(error)) throw error;
        await this.detachCandidate(attempt);
        await this.markStale(attempt, error);
      }
    });
  }

  /**
   * The four ways a frozen creation stops making sense, in the order they are
   * cheapest to check. Returning a reason rather than a boolean means the
   * attempt's diagnostic says which one fired.
   */
  private promptCreationStaleness(
    snapshot: DeckSnapshot,
    attempt: PromptCreationAttempt
  ): string | undefined {
    if (attempt.target.kind === "new-text-element") {
      // The element is created by settlement, so the only failure that matters
      // here is the container having gone; the insert itself proves the rest.
      const existing = findTextSource(snapshot, attempt.site);
      if (existing) return "The element identity the attempt reserved is already taken";
      return undefined;
    }
    const source = findTextSource(snapshot, attempt.site);
    if (!source) return "The prompt site no longer resolves to a text surface";
    if (source.kind === "prompt") {
      return "The prompt site already holds a prompt source";
    }
    return undefined;
  }

  async computePromptRefresh(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "compute", "prompt-refresh", async (attempt) => {
      const result = await this.deps.derivedOutputs.refresh(attempt.outputId, {
        idempotencyKey: `slides:prompt-refresh:${attempt.id}:refresh`
      });
      if (result.output.headRevision <= attempt.frozenAppliedRevision) {
        // Not a failure: the output re-derived to the same answer, so there is
        // nothing to write and the Deck should not take a revision for it.
        await this.store.updateAttempt({ ...attempt, state: "unchanged", updatedAt: this.now() });
        this.deps.logger.info("slides.attempt.unchanged", {
          attemptId: attempt.id,
          kind: attempt.kind,
          deckId: attempt.deckId
        });
        return;
      }
      const proposed: PromptRefreshAttempt = {
        ...attempt,
        state: "proposed",
        candidateHeadRevision: result.output.headRevision,
        updatedAt: this.now()
      };
      await this.store.updateAttempt(proposed);
      this.deps.logger.info("slides.attempt.proposed", {
        attemptId: proposed.id,
        kind: proposed.kind,
        deckId: proposed.deckId
      });
      await this.dispatch(attemptIntent(proposed, "settle"));
    });
  }

  async settlePromptRefresh(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "settle", "prompt-refresh", async (attempt) => {
      if (!attempt.candidateHeadRevision) {
        throw new SlideStaleAttemptError(attempt.id, "Prompt refresh has no candidate revision");
      }
      const current = await this.loadSnapshot(attempt.deckId);
      const stale = this.promptRefreshStaleness(current.snapshot, attempt);
      if (stale) {
        await this.markStale(attempt, new Error(stale));
        return;
      }
      try {
        await this.mutate({
          deckId: attempt.deckId,
          expectedRevision: current.head.revision,
          operations: [{
            type: "prompt.apply-derived-output",
            site: attempt.site,
            output: {
              outputId: attempt.outputId,
              appliedRevision: attempt.candidateHeadRevision
            }
          }],
          origin: "automation",
          settleAttempt: attempt
        });
      } catch (error) {
        if (!isPromptSettlementConflict(error)) throw error;
        await this.markStale(attempt, error);
      }
    });
  }

  /**
   * The four staleness cases for a refresh. The last one is the one that is easy
   * to miss and the one that matters most: it is what catches a concurrent
   * refresh, or an undo, landing between freeze and settlement.
   */
  private promptRefreshStaleness(
    snapshot: DeckSnapshot,
    attempt: PromptRefreshAttempt
  ): string | undefined {
    const source = findTextSource(snapshot, attempt.site);
    if (!source) return "The prompt site no longer resolves to a text surface";
    if (source.kind !== "prompt") return "The prompt site no longer holds a prompt source";
    if (source.output.outputId !== attempt.outputId) {
      return "The prompt site holds a different Derived Output";
    }
    if (source.output.appliedRevision !== attempt.frozenAppliedRevision) {
      return "The prompt site has moved off the revision the attempt froze";
    }
    return undefined;
  }

  /** Give back the output a settlement could not place. */
  private async detachCandidate(attempt: PromptCreationAttempt): Promise<void> {
    if (!attempt.candidateOutputId) return;
    await this.store.updatePromptOutputOwnership({
      outputId: attempt.candidateOutputId,
      deckId: attempt.deckId,
      site: attempt.site,
      creationAttemptId: attempt.id,
      state: "detached",
      at: this.now()
    });
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

  async recoverPendingAttempts(): Promise<number> {
    await this.store.recoverInterruptedStages(this.now());
    const attempts = await this.store.listRecoverableAttempts();
    for (const attempt of attempts) {
      // A proposed attempt already has its candidate; anything earlier has to
      // recompute. Re-dispatching compute for a proposed attempt would spend a
      // second model call for an answer already in hand.
      await this.dispatch(
        attemptIntent(attempt, attempt.state === "proposed" ? "settle" : "compute")
      );
    }
    this.deps.logger.info("slides.recovery.completed", { recoveredCount: attempts.length });
    return attempts.length;
  }

  // ── Internals ──────────────────────────────────────────────────────────

  /**
   * The shared spine of every stage: claim it, run it, and record the outcome.
   *
   * The claim is what makes an at-least-once job queue safe here — a redelivery
   * of the same stage sees `running` or `completed` and returns rather than
   * spending a second model call.
   */
  private async runStage<K extends SlideAttempt["kind"]>(
    attemptId: string,
    stage: "compute" | "settle",
    kind: K,
    work: (attempt: Extract<SlideAttempt, { kind: K }>) => Promise<void>
  ): Promise<void> {
    const attempt = await this.store.getAttemptById(attemptId);
    if (!attempt) throw new SlideAttemptNotFoundError(attemptId);
    if (attempt.kind !== kind) {
      throw new SlideOperationError(`Slides attempt ${attemptId} has the wrong kind`);
    }
    if (TERMINAL_ATTEMPT_STATES.includes(attempt.state)) return;

    const timestamp = this.now();
    const receipt: SlideStageReceipt = {
      attemptId,
      stage,
      idempotencyKey: `slides:${attemptId}:${stage}`,
      requestDigest: canonicalDigest({ attemptId, stage, kind }),
      state: "running",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if ((await this.store.claimStage(receipt)) !== "claimed") return;

    try {
      if (stage === "compute" && attempt.state === "requested") {
        await this.retryStageAction(attemptId, stage, kind, "start", () =>
          this.store.updateAttempt({ ...attempt, state: "computing", updatedAt: this.now() })
        );
        this.deps.logger.info("slides.attempt.computing", {
          attemptId,
          kind,
          deckId: attempt.deckId
        });
      }
      await this.retryStageAction(attemptId, stage, kind, "work", () =>
        work(attempt as Extract<SlideAttempt, { kind: K }>)
      );
    } catch (error) {
      const diagnostic = {
        code: "stage_failed",
        message: error instanceof Error ? error.message : String(error)
      };
      try {
        await this.retryStageAction(attemptId, stage, kind, "record-failure", async () => {
          const latest = await this.store.getAttemptById(attemptId);
          const failedReceipt: SlideStageReceipt = {
            ...receipt,
            state: "failed",
            diagnostic,
            updatedAt: this.now()
          };
          // A prompt-create failure flips two rows that are one fact, so it goes
          // through the atomic path; everything else can write them separately.
          if (
            kind === "prompt-create" &&
            latest &&
            !TERMINAL_ATTEMPT_STATES.includes(latest.state)
          ) {
            await this.store.failPromptCreationStage({
              attempt: { ...latest, state: "failed", diagnostic, updatedAt: this.now() },
              receipt: failedReceipt
            });
            return;
          }
          await this.store.failStage(failedReceipt);
          if (latest && !TERMINAL_ATTEMPT_STATES.includes(latest.state)) {
            await this.store.updateAttempt({
              ...latest,
              state: "failed",
              diagnostic,
              updatedAt: this.now()
            });
          }
        });
      } catch (recordError) {
        // The failure is real but unrecorded. Leaving the receipt `running`
        // means startup recovery finishes it rather than losing it.
        this.deps.logger.error("slides.internal-stage.failure-record-pending", {
          attemptId,
          stage,
          kind,
          errorName: recordError instanceof Error ? recordError.name : "UnknownError",
          errorMessage:
            recordError instanceof Error ? recordError.message : String(recordError)
        });
        throw error;
      }
      this.deps.logger.info("slides.attempt.failed", {
        attemptId,
        kind,
        deckId: attempt.deckId,
        diagnosticCode: diagnostic.code,
        errorMessage: diagnostic.message
      });
      throw error;
    }

    try {
      await this.retryStageAction(attemptId, stage, kind, "complete", () =>
        this.store.completeStage({ ...receipt, state: "completed", updatedAt: this.now() })
      );
    } catch (error) {
      // The stage effect landed. Keep the attempt non-terminal and the receipt
      // running so recovery can finish the bookkeeping safely.
      this.deps.logger.error("slides.internal-stage.completion-pending", {
        attemptId,
        stage,
        kind,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async retryStageAction<T>(
    attemptId: string,
    stage: "compute" | "settle",
    kind: SlideAttempt["kind"],
    phase: "start" | "work" | "record-failure" | "complete",
    action: () => Promise<T>
  ): Promise<T> {
    for (let retryIndex = 0; ; retryIndex += 1) {
      try {
        return await action();
      } catch (error) {
        const delayMs = STAGE_RETRY_DELAYS_MS[retryIndex];
        if (delayMs === undefined) throw error;
        this.deps.logger.warn("slides.internal-stage.retrying", {
          attemptId,
          stage,
          kind,
          phase,
          retryNumber: retryIndex + 1,
          delayMs,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        await waitForRetry(delayMs);
      }
    }
  }

  private async markStale(attempt: SlideAttempt, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.store.updateAttempt({
      ...attempt,
      state: "stale",
      diagnostic: { code: "stale_attempt", message },
      updatedAt: this.now()
    });
    this.deps.logger.info("slides.attempt.stale", {
      attemptId: attempt.id,
      kind: attempt.kind,
      deckId: attempt.deckId,
      errorMessage: message
    });
  }

  /**
   * Which outputs this mutation bound and which it let go, from the difference
   * between the snapshots. Deleting a prompt source **detaches** rather than
   * destroys, because compensation can put the source back and re-attach it.
   */
  private promptOwnershipTransitions(
    deckId: string,
    before: DeckSnapshot,
    after: DeckSnapshot,
    revision: number,
    at: string,
    settleAttempt?: SlideAttempt
  ): PromptOwnershipTransition[] {
    const previous = promptReferences(before);
    const next = promptReferences(after);
    const previousSites = promptSitesByKey(before);
    const nextSites = promptSitesByKey(after);
    const transitions: PromptOwnershipTransition[] = [];

    for (const [key, outputId] of previous) {
      if (next.get(key) === outputId) continue;
      const site = previousSites.get(key);
      if (!site) continue;
      transitions.push({
        outputId,
        deckId,
        site,
        state: "detached",
        detachedRevision: revision,
        at
      });
    }
    for (const [key, outputId] of next) {
      if (previous.get(key) === outputId) continue;
      const site = nextSites.get(key);
      if (!site) continue;
      transitions.push({
        outputId,
        deckId,
        site,
        state: "attached",
        attachedRevision: revision,
        ...(settleAttempt?.kind === "prompt-create"
          ? { creationAttemptId: settleAttempt.id }
          : {}),
        at
      });
    }
    return transitions;
  }

  /**
   * The settled text for every prompt source, fetched on read.
   *
   * Generated text never enters the snapshot — the source holds a reference and
   * nothing else — so this is where it becomes visible.
   */
  private async resolvePromptRevisions(
    snapshot: DeckSnapshot
  ): Promise<DerivedOutputRevision[]> {
    const revisions: DerivedOutputRevision[] = [];
    for (const entry of promptSites(snapshot)) {
      // 0 means declared but never answered, so there is no revision to fetch
      // and asking for it would be a lookup guaranteed to miss.
      if (entry.appliedRevision === 0) continue;
      try {
        const revision = await this.deps.derivedOutputs.getRevision(
          entry.outputId,
          entry.appliedRevision
        );
        if (revision) revisions.push(revision);
      } catch (error) {
        // A load must not fail because one output was reaped. The source stays
        // in the snapshot and simply resolves to nothing.
        if (!isNotFound(error)) throw error;
        this.deps.logger.warn("slides.prompt.output-missing", {
          outputId: entry.outputId,
          appliedRevision: entry.appliedRevision,
          siteKey: promptSiteKey(entry.site)
        });
      }
    }
    return revisions;
  }

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
