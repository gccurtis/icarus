import { randomUUID } from "node:crypto";
import type { FormulaDiagnostic, FormulaEngine } from "#formula";
import { formatFormulaValue, toWire } from "#formula";
import type { Logger } from "#platform/observability/logger.js";
import type { RichText, RichTextOperation } from "#rich-text";
import {
  isRetryableInternalJobAdmissionError,
  type InternalJobsRuntime
} from "#utils/jobs/internalRuntime.js";
import {
  canonicalDigest,
  digestFormulaExpression,
  digestSnapshot
} from "../domain/canonical.js";
import {
  CompensationConflictError,
  DocumentAlreadyExistsError,
  DocumentAttemptNotFoundError,
  DocumentNotFoundError,
  DocumentOperationError,
  DocumentPlacementError,
  DocumentStaleAttemptError,
  DocumentStyleReferenceError,
  DocumentValidationError,
  HistoryPrunedError,
  IdempotencyMismatchError,
  RevisionConflictError
} from "../domain/errors.js";
import {
  collectDocumentIdentities,
  computeDocumentIdentityTransitions
} from "../domain/identities.js";
import type {
  DocumentAttempt,
  DocumentBlock,
  DocumentChangeSet,
  DocumentCommand,
  DocumentCommandRequest,
  DocumentCommandResult,
  DocumentCommittedFact,
  DocumentDelegatedCommandClaim,
  DocumentHead,
  DocumentInternalJobIntent,
  DocumentOperation,
  DocumentOptions,
  DocumentQueryRequest,
  DocumentQueryResult,
  DocumentSnapshot,
  DocumentStageReceipt,
  FormulaEvaluationAttempt,
  PromptCreationAttempt,
  PromptOutputOwnership,
  PromptRefreshAttempt
} from "../domain/model.js";
import { canRebase } from "../domain/rebase.js";
import {
  applyOperations,
  applyWithoutValidation,
  computeTouchedIds
} from "../domain/reducer.js";
import { findBlock, forEachBlock } from "../domain/tree.js";
import { validateSnapshot } from "../domain/validation.js";
import type { DocumentDerivedOutputs } from "../ports/derivedOutputs.js";
import type { DocumentFormulaResolver } from "../ports/formulaResolver.js";
import type {
  DocumentMutationCommit,
  DocumentStore,
  PromptOwnershipTransition
} from "../ports/documentStore.js";
import { createBlankSnapshot } from "./createService.js";

export interface DocumentDependencies {
  richText: RichText;
  formula: FormulaEngine;
  formulaResolver: DocumentFormulaResolver;
  derivedOutputs: DocumentDerivedOutputs;
  jobs: InternalJobsRuntime<DocumentInternalJobIntent>;
  logger: Logger;
  attribution?: { actorId: string };
}

export interface DocumentCapability {
  command(request: DocumentCommandRequest): Promise<DocumentCommandResult>;
  query(request: DocumentQueryRequest): Promise<DocumentQueryResult>;
  computePromptCreation(attemptId: string): Promise<void>;
  settlePromptCreation(attemptId: string): Promise<void>;
  computePromptRefresh(attemptId: string): Promise<void>;
  settlePromptRefresh(attemptId: string): Promise<void>;
  computeFormulaEvaluation(attemptId: string): Promise<void>;
  settleFormulaEvaluation(attemptId: string): Promise<void>;
  recoverPendingAttempts(): Promise<number>;
  compact(documentId: string): Promise<boolean>;
}

const now = (): string => new Date().toISOString();
const INTERNAL_REQUEST_PREFIX = "$document-internal$:";
const STAGE_RETRY_DELAYS_MS = [10, 50] as const;
const DISPATCH_RETRY_INITIAL_DELAY_MS = 25;
const DISPATCH_RETRY_MAX_DELAY_MS = 2_000;

const waitForRetry = async (delayMs: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
};

interface PendingDispatch {
  intent: DocumentInternalJobIntent;
  retryCount: number;
  timer: ReturnType<typeof setTimeout>;
}

const internalRequestId = (...parts: string[]): string =>
  `${INTERNAL_REQUEST_PREFIX}${parts.join(":")}`;

const blockContainsPrompt = (block: DocumentBlock): boolean => {
  if (block.kind === "prompt") return true;
  if (block.kind === "callout") return rowsContainPrompt(block.rows);
  if (block.kind === "list") {
    const visitItems = (items: typeof block.list.items): boolean =>
      items.some((item) => rowsContainPrompt(item.rows) || visitItems(item.children));
    return visitItems(block.list.items);
  }
  if (block.kind === "table") {
    return block.table.cells.some((cell) => rowsContainPrompt(cell.rows));
  }
  return false;
};

const rowsContainPrompt = (rows: DocumentSnapshot["rows"]): boolean =>
  rows.some((row) => row.blocks.some(blockContainsPrompt));

const introducesPrompt = (operation: DocumentOperation): boolean => {
  switch (operation.type) {
    case "block.insert":
    case "block.replace":
      return blockContainsPrompt(operation.block);
    case "row.insert":
      return rowsContainPrompt([operation.row]);
    case "list.insert-item": {
      const visit = (item: typeof operation.item): boolean =>
        rowsContainPrompt(item.rows) || item.children.some(visit);
      return visit(operation.item);
    }
    case "table.insert-row":
    case "table.insert-column":
      return operation.cells.some((cell) => rowsContainPrompt(cell.rows));
    default:
      return false;
  }
};

const promptReferences = (snapshot: DocumentSnapshot): Map<string, string> => {
  const refs = new Map<string, string>();
  forEachBlock(snapshot, (block) => {
    if (block.kind === "prompt") refs.set(block.id, block.output.outputId);
  });
  return refs;
};

const isPromptSettlementConflict = (error: unknown): boolean =>
  error instanceof DocumentOperationError ||
  error instanceof DocumentPlacementError ||
  error instanceof DocumentStyleReferenceError ||
  error instanceof DocumentValidationError ||
  error instanceof RevisionConflictError;

const attemptIntent = (
  attempt: DocumentAttempt,
  stage: "compute" | "settle"
): DocumentInternalJobIntent => ({
  type: `document.${attempt.kind === "prompt-create"
    ? "prompt.create"
    : attempt.kind === "prompt-refresh"
      ? "prompt.refresh"
      : "formula.evaluate"}.${stage}` as DocumentInternalJobIntent["type"],
  attemptId: attempt.id,
  idempotencyKey: `document:${attempt.id}:${stage}`
} as DocumentInternalJobIntent);

const compactionIntent = (head: DocumentHead): DocumentInternalJobIntent => ({
  type: "document.compact",
  documentId: head.id,
  idempotencyKey: `document:compact:${head.id}:${head.revision}`
});

const intentLogContext = (
  intent: DocumentInternalJobIntent
): { attemptId: string } | { documentId: string } =>
  "attemptId" in intent
    ? { attemptId: intent.attemptId }
    : { documentId: intent.documentId };

class DocumentService implements DocumentCapability {
  private readonly pendingDispatches = new Map<string, PendingDispatch>();

  constructor(
    private readonly store: DocumentStore,
    private readonly deps: DocumentDependencies,
    private readonly options: DocumentOptions
  ) {}

  private attributedActor(requestActorId?: string): string | undefined {
    return this.deps.attribution?.actorId ?? requestActorId;
  }

  async command(request: DocumentCommandRequest): Promise<DocumentCommandResult> {
    if (request.requestId.startsWith(INTERNAL_REQUEST_PREFIX)) {
      throw new DocumentOperationError("Request ID uses a reserved Document namespace");
    }
    const start = performance.now();
    try {
      await this.assertDelegatedRequestReuse(request);
      switch (request.command.type) {
        case "document.create":
          return await this.create(request);
        case "document.submit":
          return await this.submit(request);
        case "document.compensate":
          return await this.compensate(request);
        case "prompt.create.request":
          return await this.requestPromptCreation(request);
        case "prompt.update-definition":
          return await this.updatePromptDefinition(request);
        case "prompt.refresh.request":
          return await this.requestPromptRefresh(request);
        case "formula.evaluate.request":
          return await this.requestFormulaEvaluation(request);
      }
    } finally {
      this.deps.logger.debug("document.command", {
        type: request.command.type,
        requestId: request.requestId,
        durationMs: Math.round(performance.now() - start)
      });
    }
  }

  async query(request: DocumentQueryRequest): Promise<DocumentQueryResult> {
    switch (request.query.type) {
      case "document.list": {
        const page = await this.store.listHeads(
          request.query.cursor,
          request.query.lifecycle,
          100
        );
        return { type: "document.listed", ...page };
      }
      case "document.load": {
        const { head, snapshot } = await this.loadSnapshot(
          request.query.documentId,
          request.query.revision
        );
        const promptRevisions = [];
        const refs = promptReferences(snapshot);
        for (const outputId of refs.values()) {
          const block = [...refs.entries()].find(([, id]) => id === outputId);
          if (!block) continue;
          const location = findBlock(snapshot, block[0]);
          if (!location || location.block.kind !== "prompt") continue;
          const revision = await this.deps.derivedOutputs.getRevision(
            outputId,
            location.block.output.appliedRevision
          );
          if (revision) promptRevisions.push(revision);
        }
        return { type: "document.loaded", head, snapshot, promptRevisions };
      }
      case "document.history": {
        const head = await this.store.getHead(request.query.documentId);
        if (!head) throw new DocumentNotFoundError(request.query.documentId);
        const page = await this.store.listChangeSets(
          request.query.documentId,
          request.query.cursor,
          request.query.limit
        );
        return { type: "document.history", ...page };
      }
      case "document.attempt": {
        const attempt = await this.store.getAttempt(
          request.query.documentId,
          request.query.attemptId
        );
        if (!attempt) throw new DocumentAttemptNotFoundError(request.query.attemptId);
        return { type: "document.attempt", attempt };
      }
    }
  }

  private async create(request: DocumentCommandRequest): Promise<DocumentCommandResult> {
    if (request.command.type !== "document.create") throw new DocumentOperationError("Invalid create command");
    const command = request.command;
    const digest = canonicalDigest(command);
    const prior = await this.store.getSubmission(command.documentId, request.requestId);
    if (prior) return this.replayReceipt(prior.requestDigest, digest, request.requestId, prior.result);
    if (await this.store.getHead(command.documentId)) throw new DocumentAlreadyExistsError(command.documentId);

    const snapshot = createBlankSnapshot({
      title: command.title,
      pageLayout: command.pageLayout,
      styles: command.styles
    });
    const validation = validateSnapshot(snapshot, this.deps.richText, this.options.limits);
    if (!validation.ok) throw new DocumentValidationError(validation.diagnostics);
    const timestamp = now();
    const semanticDigest = digestSnapshot(snapshot);
    const head: DocumentHead = {
      id: command.documentId,
      title: snapshot.title,
      lifecycle: snapshot.lifecycle,
      revision: 0,
      baseSeq: 0,
      semanticDigest,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const result: DocumentCommandResult = { type: "document.created", head };
    await this.store.commitCreation({
      head,
      identities: collectDocumentIdentities(snapshot),
      base: {
        representationVersion: 1,
        documentId: command.documentId,
        baseSeq: 0,
        snapshot,
        semanticDigest,
        createdAt: timestamp
      },
      receipt: {
        documentId: command.documentId,
        requestId: request.requestId,
        requestDigest: digest,
        result,
        createdAt: timestamp
      },
      fact: this.fact({
        kind: "document.created",
        documentId: command.documentId,
        revision: 0,
        actorId: this.attributedActor(request.actorId),
        origin: request.origin,
        operationTypes: ["document.create"],
        semanticDigest,
        occurredAt: timestamp
      })
    });
    return result;
  }

  private async submit(request: DocumentCommandRequest): Promise<DocumentCommandResult> {
    if (request.command.type !== "document.submit") throw new DocumentOperationError("Invalid submit command");
    if (request.command.operations.length === 0) throw new DocumentOperationError("A submission requires at least one operation");
    if (request.command.operations.some(introducesPrompt)) {
      throw new DocumentOperationError("Prompt Blocks must be created through prompt.create.request");
    }
    if (request.command.operations.some((operation) => operation.type === "prompt.apply-derived-output")) {
      throw new DocumentOperationError("Derived Output adoption is internal settlement only");
    }
    return this.mutate({
      documentId: request.command.documentId,
      expectedRevision: request.command.expectedRevision,
      operations: request.command.operations,
      requestId: request.requestId,
      origin: request.origin,
      actorId: this.attributedActor(request.actorId),
      allowPromptOperations: false,
      requestDigest: canonicalDigest(request.command)
    });
  }

  private async mutate(input: {
    documentId: string;
    expectedRevision: number;
    operations: DocumentOperation[];
    requestId: string;
    origin: DocumentCommandRequest["origin"];
    actorId?: string;
    allowPromptOperations: boolean;
    compensation?: DocumentChangeSet["compensation"];
    settleAttempt?: DocumentAttempt;
    requestDigest?: string;
  }): Promise<DocumentCommandResult> {
    const requestValue = {
      documentId: input.documentId,
      expectedRevision: input.expectedRevision,
      operations: input.operations,
      compensation: input.compensation
    };
    const requestDigest = input.requestDigest ?? canonicalDigest(requestValue);
    const prior = await this.store.getSubmission(input.documentId, input.requestId);
    if (prior) return this.replayReceipt(prior.requestDigest, requestDigest, input.requestId, prior.result);

    const current = await this.loadSnapshot(input.documentId);
    if (input.expectedRevision > current.head.revision) {
      throw new RevisionConflictError(input.documentId, input.expectedRevision, current.head.revision);
    }
    let authored = current.snapshot;
    if (input.expectedRevision < current.head.revision) {
      authored = (await this.loadSnapshot(input.documentId, input.expectedRevision)).snapshot;
      const touched = computeTouchedIds(authored, input.operations);
      const intervening = await this.store.getChangeSets(
        input.documentId,
        input.expectedRevision,
        current.head.revision
      );
      const decision = canRebase(touched, intervening);
      if (!decision.allowed) {
        throw new RevisionConflictError(input.documentId, input.expectedRevision, current.head.revision);
      }
    }

    if (!input.allowPromptOperations && input.operations.some(introducesPrompt)) {
      throw new DocumentOperationError("Prompt Blocks require the dedicated creation workflow");
    }
    const applied = applyOperations(
      current.snapshot,
      input.operations,
      this.deps.richText,
      this.options.limits
    );
    const revision = current.head.revision + 1;
    applied.snapshot.revision = revision;
    const semanticDigest = digestSnapshot(applied.snapshot);
    const timestamp = now();
    const changeSetId = randomUUID();
    const changeSet: DocumentChangeSet = {
      id: changeSetId,
      documentId: input.documentId,
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
    const head: DocumentHead = {
      ...current.head,
      title: applied.snapshot.title,
      lifecycle: applied.snapshot.lifecycle,
      revision,
      semanticDigest,
      updatedAt: timestamp
    };
    const result: DocumentCommandResult = { type: "document.changed", changeSet };
    const formulaAttempts = applied.formulaChanges.map((change): FormulaEvaluationAttempt => ({
      id: randomUUID(),
      kind: "formula-evaluation",
      documentId: input.documentId,
      clientRequestId: internalRequestId(
        "formula-attempt",
        changeSetId,
        change.blockId,
        change.atomId
      ),
      requestDigest: canonicalDigest(change),
      blockId: change.blockId,
      atomId: change.atomId,
      originChangeSetId: changeSetId,
      frozenDocumentRevision: revision,
      frozenExpression: change.expression,
      frozenExpressionDigest: digestFormulaExpression(change.expression),
      state: "requested",
      createdAt: timestamp,
      updatedAt: timestamp
    }));
    const settleAttempt = input.settleAttempt
      ? { ...input.settleAttempt, state: "settled" as const, settledChangeSetId: changeSetId, updatedAt: timestamp }
      : undefined;
    const commit: DocumentMutationCommit = {
      expectedRevision: current.head.revision,
      head,
      changeSet,
      identityTransitions: computeDocumentIdentityTransitions(
        current.snapshot,
        applied.snapshot
      ),
      identityReactivation: input.compensation
        ? "same-kind-compensation"
        : "forbid",
      receipt: {
        documentId: input.documentId,
        requestId: input.requestId,
        requestDigest,
        result,
        createdAt: timestamp
      },
      fact: this.fact({
        kind: input.compensation ? "document.compensated" : "document.changed",
        documentId: input.documentId,
        revision,
        changeSetId,
        actorId: input.actorId,
        origin: input.origin,
        operationTypes: input.operations.map((operation) => operation.type),
        semanticDigest,
        occurredAt: timestamp
      }),
      attempts: formulaAttempts,
      ...(settleAttempt ? { attemptUpdates: [settleAttempt] } : {}),
      promptOwnershipTransitions: this.promptOwnershipTransitions(
        input.documentId,
        current.snapshot,
        applied.snapshot,
        revision,
        timestamp,
        input.settleAttempt
      )
    };
    if (!await this.store.commitMutation(commit)) {
      throw new RevisionConflictError(input.documentId, current.head.revision, (await this.store.getHead(input.documentId))?.revision ?? -1);
    }
    for (const attempt of formulaAttempts) await this.dispatch(attemptIntent(attempt, "compute"));
    if (
      head.revision - head.baseSeq >=
      this.options.history.retainedChangeSetCount
    ) {
      await this.dispatch(compactionIntent(head));
    }
    return result;
  }

  private promptOwnershipTransitions(
    documentId: string,
    before: DocumentSnapshot,
    after: DocumentSnapshot,
    revision: number,
    at: string,
    settleAttempt?: DocumentAttempt
  ): PromptOwnershipTransition[] {
    const previous = promptReferences(before);
    const next = promptReferences(after);
    const transitions: PromptOwnershipTransition[] = [];
    for (const [blockId, outputId] of previous) {
      if (!next.has(blockId) || next.get(blockId) !== outputId) {
        transitions.push({ outputId, documentId, blockId, state: "detached", detachedRevision: revision, at });
      }
    }
    for (const [blockId, outputId] of next) {
      if (!previous.has(blockId) || previous.get(blockId) !== outputId) {
        transitions.push({
          outputId,
          documentId,
          blockId,
          state: "attached",
          attachedRevision: revision,
          ...(settleAttempt?.kind === "prompt-create" ? { creationAttemptId: settleAttempt.id } : {}),
          at
        });
      }
    }
    return transitions;
  }

  private async compensate(request: DocumentCommandRequest): Promise<DocumentCommandResult> {
    if (request.command.type !== "document.compensate") throw new DocumentOperationError("Invalid compensation command");
    const command = request.command;
    const requestDigest = canonicalDigest(command);
    const prior = await this.store.getSubmission(command.documentId, request.requestId);
    if (prior) {
      return this.replayReceipt(
        prior.requestDigest,
        requestDigest,
        request.requestId,
        prior.result
      );
    }
    const current = await this.loadSnapshot(command.documentId);
    if (current.head.revision !== command.expectedRevision) {
      throw new RevisionConflictError(command.documentId, command.expectedRevision, current.head.revision);
    }
    const target = await this.store.getChangeSet(command.documentId, command.targetChangeSetId);
    if (!target) throw new CompensationConflictError(command.targetChangeSetId, "Target ChangeSet is unavailable");
    const intervening = await this.store.getChangeSets(command.documentId, target.revision, current.head.revision);
    if (
      intervening.length !== current.head.revision - target.revision ||
      intervening.some(
        (changeSet, index) => changeSet.revision !== target.revision + index + 1
      )
    ) {
      throw new CompensationConflictError(
        command.targetChangeSetId,
        "ChangeSet cannot be compensated because intervening history has been pruned"
      );
    }
    const decision = canRebase(target.touchedIds, intervening);
    if (!decision.allowed) {
      throw new CompensationConflictError(command.targetChangeSetId, `Compensation conflicts on: ${decision.conflictingIds.join(", ")}`);
    }
    return this.mutate({
      documentId: command.documentId,
      expectedRevision: current.head.revision,
      operations: target.inverseOperations,
      requestId: request.requestId,
      origin: request.origin,
      actorId: this.attributedActor(request.actorId),
      allowPromptOperations: true,
      compensation: { intent: command.intent, targetChangeSetId: command.targetChangeSetId },
      requestDigest
    });
  }

  private async requestPromptCreation(request: DocumentCommandRequest): Promise<DocumentCommandResult> {
    if (request.command.type !== "prompt.create.request") throw new DocumentOperationError("Invalid Prompt creation command");
    const command = request.command;
    const requestDigest = canonicalDigest(command);
    const receipt = await this.store.getSubmission(command.documentId, request.requestId);
    if (receipt) {
      return this.replayReceipt(
        receipt.requestDigest,
        requestDigest,
        request.requestId,
        receipt.result
      );
    }
    const existing = await this.store.getAttemptByRequest(command.documentId, "prompt-create", request.requestId);
    if (existing) {
      if (existing.requestDigest !== requestDigest) throw new IdempotencyMismatchError(request.requestId);
      return { type: "prompt.create-requested", attemptId: existing.id };
    }
    const current = await this.loadSnapshot(command.documentId);
    if (current.head.revision !== command.expectedRevision) {
      throw new RevisionConflictError(command.documentId, command.expectedRevision, current.head.revision);
    }
    if (findBlock(current.snapshot, command.blockId)) throw new DocumentOperationError(`Block already exists: ${command.blockId}`);
    if (
      await this.store.getPromptCreationAttemptByBlock(command.documentId, command.blockId) ||
      await this.store.getPromptOutputOwnershipByBlock(command.documentId, command.blockId)
    ) {
      throw new DocumentOperationError(`Block identity is already reserved: ${command.blockId}`);
    }
    applyOperations(current.snapshot, [{
      type: "block.insert",
      block: { kind: "divider", id: command.blockId, styleId: command.styleId, presentation: command.presentation },
      placement: command.placement
    }], this.deps.richText, this.options.limits);
    const timestamp = now();
    const attempt: PromptCreationAttempt = {
      id: randomUUID(),
      kind: "prompt-create",
      documentId: command.documentId,
      clientRequestId: request.requestId,
      requestDigest,
      blockId: command.blockId,
      frozenDocumentRevision: current.head.revision,
      styleId: command.styleId,
      presentation: command.presentation,
      placement: command.placement,
      definition: {
        prompt: command.prompt,
        contextEntries: command.contextEntries,
        stabilisationText: command.stabilisationText
      },
      state: "requested",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const result: DocumentCommandResult = {
      type: "prompt.create-requested",
      attemptId: attempt.id
    };
    await this.store.createAttemptWithSubmission(attempt, {
      documentId: command.documentId,
      requestId: request.requestId,
      requestDigest,
      result,
      createdAt: timestamp
    });
    await this.dispatch(attemptIntent(attempt, "compute"));
    return result;
  }

  private async updatePromptDefinition(
    request: DocumentCommandRequest
  ): Promise<DocumentCommandResult> {
    if (request.command.type !== "prompt.update-definition") {
      throw new DocumentOperationError("Invalid Prompt definition-update command");
    }
    const command = request.command;
    const requestDigest = canonicalDigest(command);
    const receipt = await this.store.getSubmission(command.documentId, request.requestId);
    if (receipt) {
      return this.replayReceipt(
        receipt.requestDigest,
        requestDigest,
        request.requestId,
        receipt.result
      );
    }

    let claim = await this.store.getDelegatedCommandClaim(
      command.documentId,
      request.requestId
    );
    if (!claim) {
      const { snapshot } = await this.loadSnapshot(command.documentId);
      const block = findBlock(snapshot, command.promptBlockId)?.block;
      if (!block || block.kind !== "prompt") {
        throw new DocumentOperationError(
          `Prompt Block not found: ${command.promptBlockId}`
        );
      }
      const timestamp = now();
      const claimResult = await this.store.claimDelegatedCommand({
        documentId: command.documentId,
        requestId: request.requestId,
        requestDigest,
        kind: "prompt.update-definition",
        targetOutputId: block.output.outputId,
        state: "pending",
        createdAt: timestamp,
        updatedAt: timestamp
      });
      if (claimResult.type === "receipt") {
        return this.replayReceipt(
          claimResult.receipt.requestDigest,
          requestDigest,
          request.requestId,
          claimResult.receipt.result
        );
      }
      claim = claimResult.claim;
    }
    this.assertSameDelegatedRequest(claim, request);

    const output = await this.deps.derivedOutputs.updateDefinition(claim.targetOutputId, {
      prompt: command.prompt,
      contextEntries: command.contextEntries,
      stabilisationText: command.stabilisationText,
      expectedDefinitionRevision: command.expectedDefinitionRevision
    }, {
      idempotencyKey: `document:prompt-definition:${canonicalDigest({
        documentId: command.documentId,
        requestId: request.requestId
      })}`
    });
    const result: DocumentCommandResult = {
      type: "prompt.definition-updated",
      output
    };
    await this.store.completeDelegatedCommand(claim, {
      documentId: command.documentId,
      requestId: request.requestId,
      requestDigest,
      result,
      createdAt: now()
    });
    return result;
  }

  private async assertDelegatedRequestReuse(
    request: DocumentCommandRequest
  ): Promise<void> {
    const claim = await this.store.getDelegatedCommandClaim(
      request.command.documentId,
      request.requestId
    );
    if (claim) this.assertSameDelegatedRequest(claim, request);
  }

  private assertSameDelegatedRequest(
    claim: DocumentDelegatedCommandClaim,
    request: DocumentCommandRequest
  ): void {
    if (
      request.command.type !== claim.kind ||
      canonicalDigest(request.command) !== claim.requestDigest
    ) {
      throw new IdempotencyMismatchError(request.requestId);
    }
  }

  private async requestPromptRefresh(request: DocumentCommandRequest): Promise<DocumentCommandResult> {
    if (request.command.type !== "prompt.refresh.request") throw new DocumentOperationError("Invalid Prompt refresh command");
    const command = request.command;
    const requestDigest = canonicalDigest(command);
    const receipt = await this.store.getSubmission(command.documentId, request.requestId);
    if (receipt) {
      return this.replayReceipt(
        receipt.requestDigest,
        requestDigest,
        request.requestId,
        receipt.result
      );
    }
    const existing = await this.store.getAttemptByRequest(command.documentId, "prompt-refresh", request.requestId);
    if (existing) {
      if (existing.requestDigest !== requestDigest) throw new IdempotencyMismatchError(request.requestId);
      return { type: "prompt.refresh-requested", attemptId: existing.id };
    }
    const current = await this.loadSnapshot(command.documentId);
    if (current.head.revision !== command.expectedRevision) {
      throw new RevisionConflictError(command.documentId, command.expectedRevision, current.head.revision);
    }
    const block = findBlock(current.snapshot, command.promptBlockId)?.block;
    if (!block || block.kind !== "prompt") throw new DocumentOperationError(`Prompt Block not found: ${command.promptBlockId}`);
    const timestamp = now();
    const attempt: PromptRefreshAttempt = {
      id: randomUUID(),
      kind: "prompt-refresh",
      documentId: command.documentId,
      clientRequestId: request.requestId,
      requestDigest,
      blockId: block.id,
      promptBlockId: block.id,
      outputId: block.output.outputId,
      frozenAppliedRevision: block.output.appliedRevision,
      frozenDocumentRevision: current.head.revision,
      state: "requested",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const result: DocumentCommandResult = {
      type: "prompt.refresh-requested",
      attemptId: attempt.id
    };
    await this.store.createAttemptWithSubmission(attempt, {
      documentId: command.documentId,
      requestId: request.requestId,
      requestDigest,
      result,
      createdAt: timestamp
    });
    await this.dispatch(attemptIntent(attempt, "compute"));
    return result;
  }

  private async requestFormulaEvaluation(request: DocumentCommandRequest): Promise<DocumentCommandResult> {
    if (request.command.type !== "formula.evaluate.request") throw new DocumentOperationError("Invalid Formula request");
    const command = request.command;
    const requestDigest = canonicalDigest(command);
    const receipt = await this.store.getSubmission(command.documentId, request.requestId);
    if (receipt) {
      return this.replayReceipt(
        receipt.requestDigest,
        requestDigest,
        request.requestId,
        receipt.result
      );
    }
    const existing = await this.store.getAttemptByRequest(command.documentId, "formula-evaluation", request.requestId);
    if (existing) {
      if (existing.requestDigest !== requestDigest) throw new IdempotencyMismatchError(request.requestId);
      return { type: "formula.evaluate-requested", attemptId: existing.id };
    }
    const current = await this.loadSnapshot(command.documentId);
    const block = findBlock(current.snapshot, command.blockId)?.block;
    const atom = block && (block.kind === "text" || block.kind === "code" || block.kind === "quote")
      ? block.content.atoms.find((candidate) => candidate.id === command.formulaAtomId)
      : undefined;
    if (!atom || atom.kind !== "formula") throw new DocumentOperationError(`Formula atom not found: ${command.formulaAtomId}`);
    const timestamp = now();
    const attempt: FormulaEvaluationAttempt = {
      id: randomUUID(),
      kind: "formula-evaluation",
      documentId: command.documentId,
      clientRequestId: request.requestId,
      requestDigest,
      blockId: command.blockId,
      atomId: atom.id,
      frozenDocumentRevision: current.head.revision,
      frozenExpression: atom.expression,
      frozenExpressionDigest: digestFormulaExpression(atom.expression),
      state: "requested",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const result: DocumentCommandResult = {
      type: "formula.evaluate-requested",
      attemptId: attempt.id
    };
    await this.store.createAttemptWithSubmission(attempt, {
      documentId: command.documentId,
      requestId: request.requestId,
      requestDigest,
      result,
      createdAt: timestamp
    });
    await this.dispatch(attemptIntent(attempt, "compute"));
    return result;
  }

  async computePromptCreation(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "compute", "prompt-create", async (attempt) => {
      const output = await this.deps.derivedOutputs.declare({
        prompt: attempt.definition.prompt,
        contextEntries: attempt.definition.contextEntries,
        stabilisationText: attempt.definition.stabilisationText
      }, { idempotencyKey: `document:prompt-create:${attempt.id}` });
      const ownership: PromptOutputOwnership = {
        outputId: output.id,
        documentId: attempt.documentId,
        blockId: attempt.blockId,
        creationAttemptId: attempt.id,
        state: "pending",
        createdAt: now(),
        updatedAt: now()
      };
      await this.store.registerPendingPromptOutput(ownership);
      const refreshed = await this.deps.derivedOutputs.refresh(output.id, {
        idempotencyKey: `document:prompt-create:${attempt.id}:refresh`
      });
      if (refreshed.output.headRevision <= 0) {
        await this.store.updatePromptOutputOwnership({
          outputId: output.id,
          documentId: attempt.documentId,
          blockId: attempt.blockId,
          creationAttemptId: attempt.id,
          state: "detached",
          at: now()
        });
        await this.store.updateAttempt({
          ...attempt,
          state: "failed",
          candidateOutputId: output.id,
          diagnostic: { code: "initial_refresh_failed", message: "The dedicated Derived Output did not publish a first revision" },
          updatedAt: now()
        });
        return;
      }
      const updated: PromptCreationAttempt = {
        ...attempt,
        state: "proposed",
        candidateOutputId: output.id,
        candidateHeadRevision: refreshed.output.headRevision,
        updatedAt: now()
      };
      await this.store.updateAttempt(updated);
      await this.dispatch(attemptIntent(updated, "settle"));
    });
  }

  async settlePromptCreation(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "settle", "prompt-create", async (attempt) => {
      if (!attempt.candidateOutputId || !attempt.candidateHeadRevision) {
        throw new DocumentStaleAttemptError(attempt.id, "Prompt creation has no candidate output revision");
      }
      const current = await this.loadSnapshot(attempt.documentId);
      try {
        await this.mutate({
          documentId: attempt.documentId,
          expectedRevision: current.head.revision,
          operations: [{
            type: "block.insert",
            block: {
              kind: "prompt",
              id: attempt.blockId,
              styleId: attempt.styleId,
              presentation: attempt.presentation,
              output: {
                outputId: attempt.candidateOutputId,
                appliedRevision: attempt.candidateHeadRevision
              }
            },
            placement: attempt.placement
          }],
          requestId: internalRequestId("prompt-create", attempt.id, "settle"),
          origin: "automation",
          allowPromptOperations: true,
          settleAttempt: attempt
        });
      } catch (error) {
        if (!isPromptSettlementConflict(error)) throw error;
        await this.store.updatePromptOutputOwnership({
          outputId: attempt.candidateOutputId,
          documentId: attempt.documentId,
          blockId: attempt.blockId,
          creationAttemptId: attempt.id,
          state: "detached",
          at: now()
        });
        await this.markStale(attempt, error);
      }
    });
  }

  async computePromptRefresh(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "compute", "prompt-refresh", async (attempt) => {
      const result = await this.deps.derivedOutputs.refresh(attempt.outputId, {
        idempotencyKey: `document:prompt-refresh:${attempt.id}:refresh`
      });
      if (result.output.headRevision <= attempt.frozenAppliedRevision) {
        await this.store.updateAttempt({ ...attempt, state: "unchanged", updatedAt: now() });
        return;
      }
      const updated: PromptRefreshAttempt = {
        ...attempt,
        state: "proposed",
        candidateHeadRevision: result.output.headRevision,
        updatedAt: now()
      };
      await this.store.updateAttempt(updated);
      await this.dispatch(attemptIntent(updated, "settle"));
    });
  }

  async settlePromptRefresh(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "settle", "prompt-refresh", async (attempt) => {
      if (!attempt.candidateHeadRevision) throw new DocumentStaleAttemptError(attempt.id, "Prompt refresh has no candidate revision");
      const current = await this.loadSnapshot(attempt.documentId);
      const block = findBlock(current.snapshot, attempt.promptBlockId)?.block;
      if (!block || block.kind !== "prompt" ||
          block.output.outputId !== attempt.outputId ||
          block.output.appliedRevision !== attempt.frozenAppliedRevision) {
        await this.markStale(attempt, new Error("Prompt Block changed before refresh settlement"));
        return;
      }
      await this.mutate({
        documentId: attempt.documentId,
        expectedRevision: current.head.revision,
        operations: [{
          type: "prompt.apply-derived-output",
          blockId: attempt.blockId,
          output: { outputId: attempt.outputId, appliedRevision: attempt.candidateHeadRevision }
        }],
        requestId: internalRequestId("prompt-refresh", attempt.id, "settle"),
        origin: "automation",
        allowPromptOperations: true,
        settleAttempt: attempt
      });
    });
  }

  async computeFormulaEvaluation(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "compute", "formula-evaluation", async (attempt) => {
      const parsed = this.deps.formula.parse({
        source: attempt.frozenExpression,
        languageVersion: "formula/v1"
      });
      let operations: RichTextOperation[];
      let resolverSnapshotDigest: string | undefined;
      if (!parsed.ok || !parsed.value) {
        operations = [this.formulaDiagnosticOperation(attempt.atomId, parsed.diagnostics?.[0], attempt.frozenExpression)];
      } else {
        const resolver = await this.deps.formulaResolver.buildSnapshot();
        resolverSnapshotDigest = resolver.snapshotDigest;
        const evaluated = this.deps.formula.evaluate({ expression: parsed.value, resolver });
        if (!evaluated.ok || !evaluated.value) {
          operations = [this.formulaDiagnosticOperation(attempt.atomId, evaluated.diagnostics?.[0], attempt.frozenExpression)];
        } else {
          operations = [{
            type: "apply-formula-settlement",
            atomId: attempt.atomId,
            settlement: {
              acceptedValue: toWire(evaluated.value.value),
              displayText: formatFormulaValue(evaluated.value.value)
            }
          }];
        }
      }
      const updated: FormulaEvaluationAttempt = {
        ...attempt,
        state: "proposed",
        resolverSnapshotDigest,
        candidateOperations: operations,
        updatedAt: now()
      };
      await this.store.updateAttempt(updated);
      await this.dispatch(attemptIntent(updated, "settle"));
    });
  }

  async settleFormulaEvaluation(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "settle", "formula-evaluation", async (attempt) => {
      if (!attempt.candidateOperations) throw new DocumentStaleAttemptError(attempt.id, "Formula evaluation has no candidate operations");
      const current = await this.loadSnapshot(attempt.documentId);
      const block = findBlock(current.snapshot, attempt.blockId)?.block;
      const atom = block && (block.kind === "text" || block.kind === "code" || block.kind === "quote")
        ? block.content.atoms.find((candidate) => candidate.id === attempt.atomId)
        : undefined;
      if (!atom || atom.kind !== "formula" || digestFormulaExpression(atom.expression) !== attempt.frozenExpressionDigest) {
        await this.markStale(attempt, new Error("Formula atom changed before settlement"));
        return;
      }
      const intervening = await this.store.getChangeSets(
        attempt.documentId,
        attempt.frozenDocumentRevision,
        current.head.revision
      );
      if (intervening.some((changeSet) => changeSet.touchedIds.includes(attempt.atomId))) {
        await this.markStale(attempt, new Error("Formula expression was touched after evaluation froze"));
        return;
      }
      await this.mutate({
        documentId: attempt.documentId,
        expectedRevision: current.head.revision,
        operations: [{ type: "rich-text.apply", blockId: attempt.blockId, operations: attempt.candidateOperations }],
        requestId: internalRequestId("formula-evaluation", attempt.id, "settle"),
        origin: "automation",
        allowPromptOperations: true,
        settleAttempt: attempt
      });
    });
  }

  private formulaDiagnosticOperation(
    atomId: string,
    diagnostic: FormulaDiagnostic | undefined,
    expression: string
  ): RichTextOperation {
    return {
      type: "apply-formula-settlement",
      atomId,
      settlement: {
        displayText: `{{${expression}}}`,
        diagnostic: {
          code: diagnostic?.code ?? "evaluation_error",
          message: diagnostic?.message ?? "Formula evaluation failed",
          ...(diagnostic?.span ? {
            sourceRange: {
              start: diagnostic.span.startByte,
              end: diagnostic.span.endByte
            }
          } : {})
        }
      }
    };
  }

  private async runStage<K extends DocumentAttempt["kind"]>(
    attemptId: string,
    stage: "compute" | "settle",
    kind: K,
    work: (attempt: Extract<DocumentAttempt, { kind: K }>) => Promise<void>
  ): Promise<void> {
    const attempt = await this.store.getAttemptById(attemptId);
    if (!attempt) throw new DocumentAttemptNotFoundError(attemptId);
    if (attempt.kind !== kind) throw new DocumentOperationError(`Attempt ${attemptId} has wrong kind`);
    if (["settled", "unchanged", "stale", "failed"].includes(attempt.state)) return;
    const timestamp = now();
    const receipt: DocumentStageReceipt = {
      attemptId,
      stage,
      idempotencyKey: `document:${attemptId}:${stage}`,
      requestDigest: canonicalDigest({ attemptId, stage, kind, frozen: attempt.requestDigest }),
      state: "running",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const claim = await this.store.claimStage(receipt);
    if (claim !== "claimed") return;

    try {
      if (stage === "compute" && attempt.state === "requested") {
        await this.retryStageAction(
          attemptId,
          stage,
          kind,
          "start",
          () => this.store.updateAttempt({
            ...attempt,
            state: "computing",
            updatedAt: now()
          })
        );
      }
      await this.retryStageAction(
        attemptId,
        stage,
        kind,
        "work",
        () => work(attempt as Extract<DocumentAttempt, { kind: K }>)
      );
    } catch (error) {
      const diagnostic = {
        code: "stage_failed",
        message: error instanceof Error ? error.message : String(error)
      };

      try {
        await this.retryStageAction(
          attemptId,
          stage,
          kind,
          "record-failure",
          async () => {
            const latest = await this.store.getAttemptById(attemptId);
            const timestamp = now();
            const failedReceipt: DocumentStageReceipt = {
              ...receipt,
              state: "failed",
              diagnostic,
              updatedAt: timestamp
            };
            if (
              kind === "prompt-create" &&
              latest?.kind === "prompt-create" &&
              !["settled", "unchanged", "stale"].includes(latest.state)
            ) {
              await this.store.failPromptCreationStage({
                attempt: {
                  ...latest,
                  state: "failed",
                  diagnostic,
                  updatedAt: timestamp
                },
                receipt: failedReceipt
              });
              return;
            }

            await this.store.failStage(failedReceipt);
            if (latest && !["settled", "unchanged", "stale"].includes(latest.state)) {
              await this.store.updateAttempt({
                ...latest,
                state: "failed",
                diagnostic,
                updatedAt: timestamp
              });
            }
          }
        );
      } catch (recordError) {
        this.deps.logger.error("document.internal-stage.failure-record-pending", {
          attemptId,
          stage,
          kind,
          errorName: recordError instanceof Error ? recordError.name : "UnknownError",
          errorMessage: recordError instanceof Error
            ? recordError.message
            : String(recordError)
        });
      }
      throw error;
    }

    try {
      await this.retryStageAction(
        attemptId,
        stage,
        kind,
        "complete",
        () => this.store.completeStage({
          ...receipt,
          state: "completed",
          updatedAt: now()
        })
      );
    } catch (error) {
      // The stage effect succeeded. Keep the attempt non-terminal and the
      // receipt running so startup recovery can safely finish the receipt.
      this.deps.logger.error("document.internal-stage.completion-pending", {
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
    kind: DocumentAttempt["kind"],
    phase: "start" | "work" | "record-failure" | "complete",
    action: () => Promise<T>
  ): Promise<T> {
    for (let retryIndex = 0; ; retryIndex += 1) {
      try {
        return await action();
      } catch (error) {
        const delayMs = STAGE_RETRY_DELAYS_MS[retryIndex];
        if (delayMs === undefined) throw error;
        this.deps.logger.warn("document.internal-stage.retrying", {
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

  private async markStale(attempt: DocumentAttempt, error: unknown): Promise<void> {
    await this.store.updateAttempt({
      ...attempt,
      state: "stale",
      diagnostic: {
        code: "stale_attempt",
        message: error instanceof Error ? error.message : String(error)
      },
      updatedAt: now()
    });
  }

  async recoverPendingAttempts(): Promise<number> {
    await this.store.recoverInterruptedStages(now());
    const attempts = await this.store.listRecoverableAttempts();
    for (const attempt of attempts) {
      await this.dispatch(attemptIntent(attempt, attempt.state === "proposed" ? "settle" : "compute"));
    }
    return attempts.length;
  }

  async compact(documentId: string): Promise<boolean> {
    const current = await this.loadSnapshot(documentId);
    const cutoffRevision = Math.max(
      0,
      current.head.revision - this.options.history.retainedChangeSetCount
    );
    const cutoff = cutoffRevision === current.head.revision
      ? current
      : await this.loadSnapshot(documentId, cutoffRevision);
    const createdAt = now();
    const cutoffAppended = await this.store.appendBaseIfHead(
      documentId,
      current.head.revision,
      {
        representationVersion: 1,
        documentId,
        baseSeq: cutoffRevision,
        snapshot: cutoff.snapshot,
        semanticDigest: digestSnapshot(cutoff.snapshot),
        createdAt
      }
    );
    if (!cutoffAppended) return false;

    const appended = cutoffRevision === current.head.revision
      ? true
      : await this.store.appendBaseIfHead(documentId, current.head.revision, {
          representationVersion: 1,
          documentId,
          baseSeq: current.head.revision,
          snapshot: current.snapshot,
          semanticDigest: current.head.semanticDigest,
          createdAt
        });
    if (appended) {
      await this.store.pruneHistory(
        documentId,
        this.options.history.retainedBaseCount,
        this.options.history.retainedChangeSetCount,
        this.options.history.retainedTerminalAttemptCount
      );
    }
    return appended;
  }

  private async loadSnapshot(
    documentId: string,
    revision?: number
  ): Promise<{ head: DocumentHead; snapshot: DocumentSnapshot }> {
    const head = await this.store.getHead(documentId);
    if (!head) throw new DocumentNotFoundError(documentId);
    const target = revision ?? head.revision;
    if (!Number.isSafeInteger(target) || target < 0 || target > head.revision) {
      throw new HistoryPrunedError(documentId, target);
    }
    const base = await this.store.getBaseAtOrBefore(documentId, target);
    if (!base) throw new HistoryPrunedError(documentId, target);
    let snapshot = structuredClone(base.snapshot);
    const changes = await this.store.getChangeSets(documentId, base.baseSeq, target);
    let expected = base.baseSeq + 1;
    for (const changeSet of changes) {
      if (changeSet.revision !== expected) throw new HistoryPrunedError(documentId, target);
      snapshot = applyWithoutValidation(snapshot, changeSet.operations, this.deps.richText);
      snapshot.revision = changeSet.revision;
      expected += 1;
    }
    if (target >= base.baseSeq && expected !== target + 1) throw new HistoryPrunedError(documentId, target);
    const validation = validateSnapshot(snapshot, this.deps.richText, this.options.limits);
    if (!validation.ok) throw new DocumentValidationError(validation.diagnostics);
    return { head, snapshot };
  }

  private replayReceipt(
    storedDigest: string,
    requestDigest: string,
    requestId: string,
    result: DocumentCommandResult
  ): DocumentCommandResult {
    if (storedDigest !== requestDigest) throw new IdempotencyMismatchError(requestId);
    return result;
  }

  private fact(
    input: Omit<DocumentCommittedFact, "factId">
  ): DocumentCommittedFact {
    return { ...input, factId: randomUUID() };
  }

  private async dispatch(intent: DocumentInternalJobIntent): Promise<void> {
    if (this.pendingDispatches.has(intent.idempotencyKey)) return;
    try {
      await this.deps.jobs.dispatch(intent);
    } catch (error) {
      this.handleDispatchFailure(intent, error, 0);
    }
  }

  private handleDispatchFailure(
    intent: DocumentInternalJobIntent,
    error: unknown,
    retryCount: number
  ): void {
    const retryable = isRetryableInternalJobAdmissionError(error);
    this.deps.logger.warn("document.internal-job.dispatch-pending", {
      intentType: intent.type,
      ...intentLogContext(intent),
      retryCount,
      retryable,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    if (!retryable) return;
    this.scheduleDispatchRetry(intent, retryCount + 1);
  }

  private scheduleDispatchRetry(
    intent: DocumentInternalJobIntent,
    retryCount: number
  ): void {
    if (this.pendingDispatches.has(intent.idempotencyKey)) return;
    const delayMs = Math.min(
      DISPATCH_RETRY_INITIAL_DELAY_MS * (2 ** Math.min(retryCount - 1, 16)),
      DISPATCH_RETRY_MAX_DELAY_MS
    );
    const timer = setTimeout(() => {
      void this.retryPendingDispatch(intent.idempotencyKey);
    }, delayMs);
    timer.unref();
    this.pendingDispatches.set(intent.idempotencyKey, {
      intent,
      retryCount,
      timer
    });
  }

  private async retryPendingDispatch(idempotencyKey: string): Promise<void> {
    const pending = this.pendingDispatches.get(idempotencyKey);
    if (!pending) return;
    try {
      await this.deps.jobs.dispatch(pending.intent);
      this.pendingDispatches.delete(idempotencyKey);
      this.deps.logger.info("document.internal-job.dispatch-recovered", {
        intentType: pending.intent.type,
        ...intentLogContext(pending.intent),
        retryCount: pending.retryCount
      });
    } catch (error) {
      this.pendingDispatches.delete(idempotencyKey);
      this.handleDispatchFailure(pending.intent, error, pending.retryCount);
    }
  }
}

export const createDocumentCapability = (
  store: DocumentStore,
  dependencies: DocumentDependencies,
  options: DocumentOptions
): DocumentCapability => new DocumentService(store, dependencies, options);
