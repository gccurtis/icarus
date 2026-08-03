import { randomUUID } from "node:crypto";
import type { ContextEntry } from "#context";
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
  DocumentAttemptNotFoundError,
  DocumentNotFoundError,
  DocumentOperationError,
  DocumentPlacementError,
  DocumentStaleAttemptError,
  DocumentContextVariableNotFoundError,
  DocumentStyleReferenceError,
  DocumentTemplateModeError,
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
  DocumentCommittedTransaction,
  DocumentHead,
  DocumentInternalJobIntent,
  DocumentOperation,
  DocumentOptions,
  DocumentQueryRequest,
  DocumentQueryResult,
  DocumentSnapshot,
  DocumentStageReceipt,
  FormulaEvaluationAttempt,
  PromptBlock,
  PromptCreationAttempt,
  PromptOutputOwnership,
  PromptRefreshAttempt
} from "../domain/model.js";
import { canRebase } from "../domain/rebase.js";
import {
  applyOperations,
  applyWithoutValidation,
  normalizeVariableName,
  resolvePromptContext,
  resolvePromptContextIfBound,
  computeTouchedIds
} from "../domain/reducer.js";
import { findBlock, forEachBlock } from "../domain/tree.js";
import { validateSnapshot } from "../domain/validation.js";
import type { DocumentDerivedOutputs } from "../ports/derivedOutputs.js";
import type { DocumentActivityPublisher } from "../ports/activityPublisher.js";
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
  /** Optional post-commit delivery path for the local Activity outbox. */
  activityPublisher?: DocumentActivityPublisher;
}

/**
 * Document's half of Templates' `TemplatableResource`.
 *
 * Declared here, not imported from Templates: neither capability imports the
 * other, and `1-init` is the only place that sees both. The shapes match
 * structurally, which is what makes `templateResources.register(document)`
 * typecheck with no wrapper.
 *
 * Every method here is the **internal** path. None goes through `command` or
 * `query`, so none is subject to the template-mode seal — that is precisely how
 * Templates reaches a sealed Document when nothing else can.
 */
export interface DocumentTemplateRuntime {
  readonly kind: "document";
  duplicate(input: {
    sourceResourceId: string;
    name?: string;
    idempotencyKey: string;
  }): Promise<{ resourceId: string }>;
  markAsTemplate(input: { resourceId: string }): Promise<void>;
  applyBindings(input: {
    resourceId: string;
    contextBindings: Readonly<Record<string, { target?: ContextEntry }>>;
    idempotencyKey: string;
  }): Promise<void>;
  submit(input: {
    resourceId: string;
    operations: unknown;
    idempotencyKey: string;
  }): Promise<void>;
  load(input: { resourceId: string }): Promise<unknown>;
  listSealedResources(): Promise<Array<{ resourceId: string; sealedAt: string }>>;
  logicalDelete(input: { resourceId: string; idempotencyKey: string }): Promise<void>;
  purge(input: { resourceId: string; idempotencyKey: string }): Promise<void>;
}

export interface DocumentCapability extends DocumentTemplateRuntime {
  command(request: DocumentCommandRequest): Promise<DocumentCommandResult>;
  query(request: DocumentQueryRequest): Promise<DocumentQueryResult>;
  computePromptCreation(attemptId: string): Promise<void>;
  settlePromptCreation(attemptId: string): Promise<void>;
  computePromptRefresh(attemptId: string): Promise<void>;
  settlePromptRefresh(attemptId: string): Promise<void>;
  computeFormulaEvaluation(attemptId: string): Promise<void>;
  settleFormulaEvaluation(attemptId: string): Promise<void>;
  recoverPendingAttempts(): Promise<number>;
  /** Retry delivery for source rows left unpublished after a failure or restart. */
  publishPendingActivity(limit?: number): Promise<number>;
  compact(documentId: string): Promise<boolean>;
  pruneHistory(cutoff: string): Promise<number>;
  purgeExpired(cutoff: string): Promise<number>;
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

/**
 * Every live Prompt Block, in document order. Returns the Blocks themselves so a
 * caller can rewrite them in place — `duplicate` re-points each one at a freshly
 * declared output.
 */
const collectPromptBlocks = (snapshot: DocumentSnapshot): PromptBlock[] => {
  const blocks: PromptBlock[] = [];
  forEachBlock(snapshot, (block) => {
    if (block.kind === "prompt") blocks.push(block);
  });
  return blocks;
};

const promptReferences = (snapshot: DocumentSnapshot): Map<string, string> => {
  const refs = new Map<string, string>();
  forEachBlock(snapshot, (block) => {
    if (block.kind === "prompt") refs.set(block.id, block.output.outputId);
  });
  return refs;
};

/**
 * Matched by name rather than `instanceof` on purpose.
 *
 * Document's dependency on Derived Outputs is types-only — `ports/derivedOutputs.ts`
 * imports nothing at runtime. Importing the concrete error class to identify it
 * would make this the one place Document links against another capability's
 * implementation, for a check that only needs to answer "already gone?".
 */
const isNotFound = (error: unknown): boolean =>
  error instanceof Error && error.name === "DerivedOutputNotFoundError";

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

/**
 * Which Document a public command or query addresses, if any.
 *
 * Structural rather than a per-type list on purpose: this is what lets the seal
 * check be written once. A command added later either names a `documentId` — and
 * is sealed automatically — or names none, and cannot reach a sealed Document to
 * begin with. `document.create` and `document.list` are the two that name none.
 */
const addressedDocumentId = (
  operation: DocumentCommand | DocumentQueryRequest["query"]
): string | undefined =>
  "documentId" in operation && typeof operation.documentId === "string"
    ? operation.documentId
    : undefined;

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
    await this.assertNotSealed(
      addressedDocumentId(request.command),
      request.command.type,
      request.requestId
    );
    const start = performance.now();
    try {
      switch (request.command.type) {
        case "document.create":
          return await this.create(request);
        case "document.delete":
          return await this.deleteDocument(request);
        case "document.purge":
          return await this.purgeDocument(request);
        case "document.submit":
          return await this.submitDocument(request);
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
    await this.assertNotSealed(addressedDocumentId(request.query), request.query.type);
    const start = performance.now();
    try {
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
            // 0 means declared but never answered, so there is no revision to
            // fetch. Asking for it would be a lookup guaranteed to miss.
            if (location.block.output.appliedRevision === 0) continue;
            const revision = await this.deps.derivedOutputs.getRevision(
              outputId,
              location.block.output.appliedRevision
            );
            if (revision) promptRevisions.push(revision);
          }
          return { type: "document.loaded", head, snapshot, promptRevisions };
        }
        case "document.history": {
          if (!(await this.store.hasResource(request.query.documentId))) {
            throw new DocumentNotFoundError(request.query.documentId);
          }
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
    } finally {
      this.deps.logger.debug("document.query.completed", {
        type: request.query.type,
        durationMs: Math.round(performance.now() - start)
      });
    }
  }

  /**
   * One indexed lookup per addressed command, which is the price of "sealed by
   * default". Templates does not pay it: it holds this runtime object and calls
   * `duplicate`/`submit`/`load` directly, which is the internal path rather than
   * the public one.
   */
  private async assertNotSealed(
    documentId: string | undefined,
    surface: string,
    requestId?: string
  ): Promise<void> {
    if (documentId === undefined) return;
    const head = await this.store.getHead(documentId);
    if (!head?.isTemplate) return;
    // Warn, not debug. A request reaching a sealed Document means a caller holds
    // an ID it should never have been handed, and that is worth seeing without
    // turning debug on.
    this.deps.logger.warn("document.template-mode.refused", {
      documentId,
      surface,
      ...(requestId !== undefined ? { requestId } : {})
    });
    throw new DocumentTemplateModeError(documentId);
  }

  // ─── Templates runtime ──────────────────────────────────────────────────────
  //
  // Document does not know what a template is for. It knows how to copy itself,
  // how to go private, and how to bind its own variables. Templates decides when.

  readonly kind = "document" as const;

  /**
   * A pure copy: new ID, same content, new Derived Outputs. No template
   * awareness and no bindings applied — Templates calls `markAsTemplate` and
   * `applyBindings` afterwards, which is what lets registration and
   * instantiation be the same procedure differing by one call.
   */
  async duplicate(input: {
    sourceResourceId: string;
    name?: string;
    idempotencyKey: string;
  }): Promise<{ resourceId: string }> {
    const startedAt = performance.now();
    // The Templates key *is* the create-receipt key, so a retried registration
    // replays this copy instead of making a second one. That is the whole retry
    // story for the cross-capability call.
    const prior = await this.store.getCreateSubmission(input.idempotencyKey);
    if (prior) {
      this.deps.logger.info("document.duplicate.replayed", {
        sourceDocumentId: input.sourceResourceId,
        documentId: prior.documentId,
        idempotencyKey: input.idempotencyKey
      });
      return { resourceId: prior.documentId };
    }
    this.deps.logger.debug("document.duplicate.started", {
      sourceDocumentId: input.sourceResourceId,
      idempotencyKey: input.idempotencyKey,
      renamed: input.name !== undefined
    });

    const { head: source, snapshot: sourceSnapshot } =
      await this.loadSnapshot(input.sourceResourceId);
    const documentId = randomUUID();
    const timestamp = now();

    const snapshot: DocumentSnapshot = {
      ...structuredClone(sourceSnapshot),
      revision: 1,
      title: input.name ?? sourceSnapshot.title
    };

    // One new Derived Output per Prompt Block. Not optional: one live Prompt
    // Block owns one dedicated output, so the copy cannot point at the source's.
    const declared: PromptOutputOwnership[] = [];
    for (const block of collectPromptBlocks(snapshot)) {
      // The prompt text carries over; the answer does not. A copy inherits what
      // to ask, and asks it fresh.
      const source = await this.deps.derivedOutputs.get(block.output.outputId);
      const output = await this.deps.derivedOutputs.declare({
        prompt: source?.definition.prompt ?? "",
        contextEntries: resolvePromptContextIfBound(snapshot, block.context),
        stabilisationText: source?.definition.stabilisationText ?? ""
      }, { idempotencyKey: `${input.idempotencyKey}:${block.id}` });
      // appliedRevision 0: declared, never answered. Legal since change 0, and
      // the reason it had to be — every Prompt Block in a fresh copy is here.
      block.output = { outputId: output.id, appliedRevision: 0 };
      declared.push({
        outputId: output.id,
        documentId,
        blockId: block.id,
        creationAttemptId: input.idempotencyKey,
        state: "attached",
        attachedRevision: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }

    const validation = validateSnapshot(snapshot, this.deps.richText, this.options.limits);
    if (!validation.ok) throw new DocumentValidationError(validation.diagnostics);
    const semanticDigest = digestSnapshot(snapshot);
    const head: DocumentHead = {
      id: documentId,
      title: snapshot.title,
      lifecycle: snapshot.lifecycle,
      // A copy is an ordinary Document. Sealing is a separate instruction, and
      // instantiation never gives it — which is the only difference between the
      // two procedures.
      isTemplate: false,
      revision: 1,
      baseSeq: 1,
      semanticDigest,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const result: DocumentCommandResult = { type: "document.created", head };
    const receipt = {
      documentId,
      requestId: input.idempotencyKey,
      requestDigest: canonicalDigest({ duplicate: input.sourceResourceId, key: input.idempotencyKey }),
      result,
      createdAt: timestamp
    };

    await this.store.commitCreation({
      head,
      identities: collectDocumentIdentities(snapshot),
      base: { documentId, baseSeq: 1, snapshot, semanticDigest, createdAt: timestamp },
      receipt,
      createReceipt: { ...receipt },
      promptOutputs: declared,
      transaction: this.transaction({
        kind: "document.created",
        sourceRequestId: input.idempotencyKey,
        documentId,
        revision: 1,
        origin: "automation",
        operationTypes: ["document.create"],
        sourceSemanticDigest: semanticDigest,
        occurredAt: timestamp
      })
    });

    this.deps.logger.info("document.duplicated", {
      sourceDocumentId: source.id,
      sourceRevision: source.revision,
      documentId,
      promptOutputs: declared.length,
      contextVariables: snapshot.contextVariables.length,
      // How many copied variables have no target. Nonzero is expected when
      // copying a template and a red flag when copying anything else.
      unboundVariables: snapshot.contextVariables.filter((v) => !v.target).length,
      renamed: input.name !== undefined,
      idempotencyKey: input.idempotencyKey,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return { resourceId: documentId };
  }

  async markAsTemplate(input: { resourceId: string }): Promise<void> {
    const head = await this.store.getHead(input.resourceId);
    if (!head) {
      this.deps.logger.warn("document.mark-as-template.not-found", {
        documentId: input.resourceId
      });
      throw new DocumentNotFoundError(input.resourceId);
    }
    if (head.isTemplate) {
      // Not an error — the operation is a set-to-true — but worth seeing,
      // because a second call means a retry got this far twice.
      this.deps.logger.debug("document.mark-as-template.already-sealed", {
        documentId: input.resourceId
      });
      return;
    }
    await this.store.markAsTemplate(input.resourceId);
    this.deps.logger.info("document.marked-as-template", {
      documentId: input.resourceId,
      revision: head.revision
    });
  }

  /**
   * Binds this Document's own Context Variables **by name**, then re-points the
   * Derived Output definition of every Prompt Block the change touched.
   *
   * Two writes rather than one, and in this order, because they live in two
   * capabilities: the variable is Document's state and the grounding is Derived
   * Outputs'. Committing the variable first means a crash in between leaves the
   * declaration correct and an output stale — which the next refresh corrects —
   * rather than an output grounded on a target the Document does not hold.
   */
  async applyBindings(input: {
    resourceId: string;
    contextBindings: Readonly<Record<string, { target?: ContextEntry }>>;
    idempotencyKey: string;
  }): Promise<void> {
    const { head, snapshot } = await this.loadSnapshot(input.resourceId);
    const byName = new Map(
      snapshot.contextVariables.map((variable) => [normalizeVariableName(variable.name), variable])
    );

    const operations: DocumentOperation[] = [];
    const changed = new Set<string>();
    for (const [name, binding] of Object.entries(input.contextBindings)) {
      const variable = byName.get(normalizeVariableName(name));
      // A binding naming a variable this Document does not have is a caller
      // error, not something to ignore: the template's declaration and its
      // backing content would silently disagree from then on.
      if (!variable) {
        // The declaration and the backing content are about to disagree
        // permanently if this is ignored, so it is an error and it is logged as
        // one — with what the Document *does* have, because the usual cause is a
        // renamed variable rather than a typo.
        this.deps.logger.warn("document.apply-bindings.unknown-variable", {
          documentId: input.resourceId,
          requested: name,
          available: snapshot.contextVariables.map((candidate) => candidate.name),
          idempotencyKey: input.idempotencyKey
        });
        throw new DocumentContextVariableNotFoundError(input.resourceId, name);
      }
      operations.push({
        type: "context-variable.update",
        variable: {
          id: variable.id,
          name: variable.name,
          ...(binding.target !== undefined ? { target: binding.target } : {})
        }
      });
      changed.add(variable.id);
    }
    if (operations.length === 0) {
      this.deps.logger.debug("document.apply-bindings.empty", {
        documentId: input.resourceId,
        idempotencyKey: input.idempotencyKey
      });
      return;
    }

    const startedAt = performance.now();
    await this.mutate({
      documentId: input.resourceId,
      expectedRevision: head.revision,
      operations,
      requestId: internalRequestId("apply-bindings", input.idempotencyKey),
      origin: "automation",
      allowPromptOperations: false
    });

    const { snapshot: bound } = await this.loadSnapshot(input.resourceId);
    let rebound = 0;
    let stillUnbound = 0;
    for (const block of collectPromptBlocks(bound)) {
      if (block.context.kind !== "variable" || !changed.has(block.context.variableId)) continue;
      const output = await this.deps.derivedOutputs.get(block.output.outputId);
      if (!output) {
        // The Block references an output that no longer exists. Not fatal here
        // — the rebind is best-effort and the Block is already broken — but it
        // is exactly the orphan class the GC sweep looks for.
        this.deps.logger.warn("document.apply-bindings.missing-output", {
          documentId: input.resourceId,
          blockId: block.id,
          outputId: block.output.outputId
        });
        continue;
      }
      const contextEntries = resolvePromptContextIfBound(bound, block.context);
      if (contextEntries.length === 0) stillUnbound += 1;
      await this.deps.derivedOutputs.updateDefinition(block.output.outputId, {
        prompt: output.definition.prompt,
        contextEntries,
        stabilisationText: output.definition.stabilisationText,
        expectedDefinitionRevision: output.definition.definitionRevision
      }, { idempotencyKey: `${input.idempotencyKey}:rebind:${block.id}` });
      rebound += 1;
    }

    this.deps.logger.info("document.bindings-applied", {
      documentId: input.resourceId,
      variables: operations.length,
      // Bound and unbound counted separately: an unbound result is normal on a
      // template and means a Prompt Block that cannot run until instantiation.
      promptBlocksRebound: rebound,
      promptBlocksLeftUnbound: stillUnbound,
      idempotencyKey: input.idempotencyKey,
      durationMs: Math.round(performance.now() - startedAt)
    });
  }

  /** Pass-through edit. The operations are the caller's, decoded by Templates' caller. */
  async submit(input: {
    resourceId: string;
    operations: unknown;
    idempotencyKey: string;
  }): Promise<void> {
    const operations = input.operations as DocumentOperation[];
    if (!Array.isArray(operations) || operations.length === 0) {
      // The payload crossed the port as `unknown`, so this is the first place
      // anything checks its shape. Log what arrived — a malformed template edit
      // is otherwise invisible between two capabilities.
      this.deps.logger.warn("document.template-submit.invalid-operations", {
        documentId: input.resourceId,
        received: Array.isArray(input.operations) ? "empty array" : typeof input.operations,
        idempotencyKey: input.idempotencyKey
      });
      throw new DocumentOperationError("A template submission requires at least one operation");
    }
    const startedAt = performance.now();
    const { head } = await this.loadSnapshot(input.resourceId);
    await this.mutate({
      documentId: input.resourceId,
      expectedRevision: head.revision,
      operations,
      requestId: internalRequestId("template-submit", input.idempotencyKey),
      origin: "automation",
      // A template is fully editable, prompts included. `template.update` is the
      // only path here, so the usual public-surface restriction does not apply.
      allowPromptOperations: true
    });
    this.deps.logger.info("document.template-submitted", {
      documentId: input.resourceId,
      priorRevision: head.revision,
      operations: operations.length,
      operationTypes: [...new Set(operations.map((operation) => operation.type))],
      idempotencyKey: input.idempotencyKey,
      durationMs: Math.round(performance.now() - startedAt)
    });
  }

  async listSealedResources(): Promise<Array<{ resourceId: string; sealedAt: string }>> {
    return this.store.listSealedResources();
  }

  async load(input: { resourceId: string }): Promise<unknown> {
    const startedAt = performance.now();
    const { head, snapshot } = await this.loadSnapshot(input.resourceId);
    this.deps.logger.debug("document.template-loaded", {
      documentId: input.resourceId,
      revision: head.revision,
      isTemplate: head.isTemplate,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return { head, snapshot };
  }

  async logicalDelete(input: { resourceId: string; idempotencyKey: string }): Promise<void> {
    this.deps.logger.info("document.template-logical-delete", {
      documentId: input.resourceId,
      idempotencyKey: input.idempotencyKey
    });
    await this.deleteDocument({
      requestId: internalRequestId("template-delete", input.idempotencyKey),
      origin: "automation",
      command: { type: "document.delete", documentId: input.resourceId }
    } as DocumentCommandRequest);
  }

  async purge(input: { resourceId: string; idempotencyKey: string }): Promise<void> {
    this.deps.logger.info("document.template-purge", {
      documentId: input.resourceId,
      idempotencyKey: input.idempotencyKey
    });
    await this.purgeDocument({
      requestId: internalRequestId("template-purge", input.idempotencyKey),
      origin: "automation",
      command: { type: "document.purge", documentId: input.resourceId }
    } as DocumentCommandRequest);
  }

  async publishPendingActivity(limit?: number): Promise<number> {
    if (!this.deps.activityPublisher) return 0;
    const transactions = await this.store.listUnpublishedTransactions(limit);
    let published = 0;
    for (const transaction of transactions) {
      if (await this.publishActivityTransaction(transaction)) published += 1;
    }
    return published;
  }

  private async create(request: DocumentCommandRequest): Promise<DocumentCommandResult> {
    if (request.command.type !== "document.create") throw new DocumentOperationError("Invalid create command");
    const command = request.command;
    const digest = canonicalDigest(command);
    // Keyed by request id alone: a retry has no document id to look up with,
    // because the id below is allocated rather than supplied.
    const prior = await this.store.getCreateSubmission(request.requestId);
    if (prior) return this.replayReceipt(prior.requestDigest, digest, request.requestId, prior.result);

    const documentId = randomUUID();

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
      id: documentId,
      title: snapshot.title,
      lifecycle: snapshot.lifecycle,
      // Never at creation. A Document becomes a template only by being copied
      // and then marked, which is Templates' decision and not a caller's.
      isTemplate: false,
      revision: 1,
      baseSeq: 1,
      semanticDigest,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const result: DocumentCommandResult = { type: "document.created", head };
    const transaction = this.transaction({
      kind: "document.created",
      sourceRequestId: request.requestId,
      documentId,
      revision: 1,
      actorId: this.attributedActor(request.actorId),
      origin: request.origin,
      operationTypes: ["document.create"],
      sourceSemanticDigest: semanticDigest,
      occurredAt: timestamp
    });
    await this.store.commitCreation({
      head,
      identities: collectDocumentIdentities(snapshot),
      base: {
        documentId,
        baseSeq: 1,
        snapshot,
        semanticDigest,
        createdAt: timestamp
      },
      // Both receipts, one transaction. The create receipt makes the create
      // replayable by request id; the document-keyed one keeps the request-id
      // reuse guard working for later commands on this document.
      receipt: {
        documentId,
        requestId: request.requestId,
        requestDigest: digest,
        result,
        createdAt: timestamp
      },
      createReceipt: {
        requestId: request.requestId,
        documentId,
        requestDigest: digest,
        result,
        createdAt: timestamp
      },
      transaction
    });
    await this.publishActivityTransaction(transaction);
    return result;
  }

  /** Logical deletion: history and the source transaction remain retained. */
  private async deleteDocument(
    request: DocumentCommandRequest
  ): Promise<DocumentCommandResult> {
    if (request.command.type !== "document.delete") {
      throw new DocumentOperationError("Invalid delete command");
    }
    const { documentId, expectedRevision } = request.command;
    const startedAt = performance.now();

    const head = await this.store.getHead(documentId);
    if (!head) {
      const replay = await this.store.getCommittedTransactionByRequest(
        documentId,
        request.requestId
      );
      if (replay?.kind === "document.deleted") {
        return { type: "document.deleted", documentId, revision: replay.revision };
      }
      throw new DocumentNotFoundError(documentId);
    }
    if (head.revision !== expectedRevision) {
      throw new RevisionConflictError(documentId, head.revision, expectedRevision);
    }
    // Derived Outputs live in another capability's store, so the cascade cannot
    // reach them — it only clears the ownership rows that point at them. They
    // are removed first, before anything is destroyed, so a failure here leaves
    // the document intact and the command retryable.
    const owned = await this.store.listPromptOutputsForDocument(documentId);
    for (const ownership of owned) {
      try {
        await this.deps.derivedOutputs.delete(ownership.outputId);
      } catch (error) {
        // Already gone is the expected outcome on a retry after a partial run.
        if (!isNotFound(error)) throw error;
      }
    }

    const deletedAt = now();
    const transaction = this.transaction({
      kind: "document.deleted",
      sourceRequestId: request.requestId,
      documentId,
      revision: head.revision + 1,
      actorId: this.attributedActor(request.actorId),
      origin: request.origin,
      operationTypes: ["document.delete"],
      sourceSemanticDigest: head.semanticDigest,
      occurredAt: deletedAt
    });

    const deletionRevision = await this.store.deleteDocument(
      documentId,
      deletedAt,
      transaction
    );
    if (deletionRevision === null) throw new DocumentNotFoundError(documentId);
    await this.publishActivityTransaction(transaction);

    this.deps.logger.info("document.deleted", {
      documentId,
      revision: deletionRevision,
      derivedOutputsDeleted: owned.length,
      requestId: request.requestId,
      durationMs: Math.round(performance.now() - startedAt)
    });

    return { type: "document.deleted", documentId, revision: deletionRevision };
  }

  private async purgeDocument(
    request: DocumentCommandRequest
  ): Promise<DocumentCommandResult> {
    if (request.command.type !== "document.purge") {
      throw new DocumentOperationError("Invalid purge command");
    }
    const documentId = request.command.documentId;
    await this.purgeRetainedDocument(documentId);
    this.deps.logger.info("document.purged", { documentId, requestId: request.requestId });
    return { type: "document.purged", documentId };
  }

  private async purgeRetainedDocument(documentId: string): Promise<void> {
    for (const outputId of await this.store.listRetainedPromptOutputIds(documentId)) {
      try {
        await this.deps.derivedOutputs.purge(outputId);
      } catch (error) {
        if (!(error instanceof Error && error.name === "ResourceHistoryNotFoundError")) {
          throw error;
        }
      }
    }
    await this.store.purgeDocument(documentId);
  }

  private async submitDocument(request: DocumentCommandRequest): Promise<DocumentCommandResult> {
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
      transaction: this.transaction({
        kind: input.compensation ? "document.compensated" : "document.changed",
        sourceRequestId: input.requestId,
        documentId: input.documentId,
        revision,
        sourceChangeSetId: changeSetId,
        actorId: input.actorId,
        origin: input.origin,
        operationTypes: input.operations.map((operation) => operation.type),
        sourceSemanticDigest: semanticDigest,
        ...(input.compensation ? { compensation: input.compensation } : {}),
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
    if (settleAttempt) {
      this.deps.logger.info("document.attempt.settled", {
        attemptId: settleAttempt.id,
        kind: settleAttempt.kind,
        documentId: input.documentId,
        settledChangeSetId: changeSetId
      });
    }
    await this.publishActivityTransaction(commit.transaction);
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
        context: command.context,
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
    this.deps.logger.info("document.attempt.requested", {
      attemptId: attempt.id,
      kind: attempt.kind,
      documentId: attempt.documentId
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

    const { snapshot } = await this.loadSnapshot(command.documentId);
    const block = findBlock(snapshot, command.promptBlockId)?.block;
    if (!block || block.kind !== "prompt") {
      throw new DocumentOperationError(
        `Prompt Block not found: ${command.promptBlockId}`
      );
    }

    // Derived Outputs is idempotent on this key alone, so a retry after a
    // crash between this call and recordSubmission below simply replays the
    // already-completed result rather than reapplying the definition twice.
    const output = await this.deps.derivedOutputs.updateDefinition(block.output.outputId, {
      prompt: command.prompt,
      // The Block's own context, not the caller's. A definition update edits the
      // prompt text; re-pointing is `prompt.set-context`, and letting both do it
      // gave two answers to "what is this grounded on" that nothing reconciled.
      contextEntries: resolvePromptContext(snapshot, block.context),
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
    await this.store.recordSubmission({
      documentId: command.documentId,
      requestId: request.requestId,
      requestDigest,
      result,
      createdAt: now()
    });
    return result;
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
    this.deps.logger.info("document.attempt.requested", {
      attemptId: attempt.id,
      kind: attempt.kind,
      documentId: attempt.documentId
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
    this.deps.logger.info("document.attempt.requested", {
      attemptId: attempt.id,
      kind: attempt.kind,
      documentId: attempt.documentId
    });
    await this.dispatch(attemptIntent(attempt, "compute"));
    return result;
  }

  async computePromptCreation(attemptId: string): Promise<void> {
    await this.runStage(attemptId, "compute", "prompt-create", async (attempt) => {
      // Resolved here rather than at request time: the variable may have been
      // rebound in between, and the definition should reflect what the Block is
      // grounded on now, not what it was when the request was queued.
      const current = await this.loadSnapshot(attempt.documentId);
      const output = await this.deps.derivedOutputs.declare({
        prompt: attempt.definition.prompt,
        contextEntries: resolvePromptContext(current.snapshot, attempt.definition.context),
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
        this.deps.logger.info("document.attempt.failed", {
          attemptId: attempt.id,
          kind: attempt.kind,
          documentId: attempt.documentId,
          diagnosticCode: "initial_refresh_failed"
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
      this.deps.logger.info("document.attempt.proposed", {
        attemptId: updated.id,
        kind: updated.kind,
        documentId: updated.documentId
      });
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
              context: attempt.definition.context,
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
        this.deps.logger.info("document.attempt.unchanged", {
          attemptId: attempt.id,
          kind: attempt.kind,
          documentId: attempt.documentId
        });
        return;
      }
      const updated: PromptRefreshAttempt = {
        ...attempt,
        state: "proposed",
        candidateHeadRevision: result.output.headRevision,
        updatedAt: now()
      };
      await this.store.updateAttempt(updated);
      this.deps.logger.info("document.attempt.proposed", {
        attemptId: updated.id,
        kind: updated.kind,
        documentId: updated.documentId
      });
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
      this.deps.logger.info("document.attempt.proposed", {
        attemptId: updated.id,
        kind: updated.kind,
        documentId: updated.documentId
      });
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
        this.deps.logger.info("document.attempt.computing", {
          attemptId,
          kind,
          documentId: attempt.documentId
        });
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
        throw error;
      }
      this.deps.logger.info("document.attempt.failed", {
        attemptId,
        kind,
        documentId: attempt.documentId,
        diagnosticCode: diagnostic.code,
        errorMessage: diagnostic.message
      });
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
    this.deps.logger.info("document.attempt.stale", {
      attemptId: attempt.id,
      kind: attempt.kind,
      documentId: attempt.documentId,
      errorMessage: error instanceof Error ? error.message : String(error)
    });
  }

  async recoverPendingAttempts(): Promise<number> {
    await this.store.recoverInterruptedStages(now());
    const attempts = await this.store.listRecoverableAttempts();
    for (const attempt of attempts) {
      await this.dispatch(attemptIntent(attempt, attempt.state === "proposed" ? "settle" : "compute"));
    }
    this.deps.logger.info("document.recovery.completed", {
      recoveredCount: attempts.length
    });
    return attempts.length;
  }

  async compact(documentId: string): Promise<boolean> {
    const current = await this.loadSnapshot(documentId);
    const cutoffRevision = Math.max(
      1,
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
        documentId,
        baseSeq: cutoffRevision,
        snapshot: cutoff.snapshot,
        semanticDigest: digestSnapshot(cutoff.snapshot),
        createdAt
      }
    );
    if (!cutoffAppended) {
      this.deps.logger.debug("document.compaction.skipped", {
        documentId,
        cutoffRevision
      });
      return false;
    }

    const appended = cutoffRevision === current.head.revision
      ? true
      : await this.store.appendBaseIfHead(documentId, current.head.revision, {
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
    this.deps.logger.info("document.compaction.completed", {
      documentId,
      cutoffRevision,
      appended
    });
    return appended;
  }

  async pruneHistory(cutoff: string): Promise<number> {
    const anchors = await this.store.listRetentionAnchors(cutoff);
    let compacted = 0;
    for (const anchor of anchors) {
      try {
        const retained = await this.loadSnapshot(anchor.documentId, anchor.revision);
        const applied = await this.store.compactRetentionHistory(anchor, {
            documentId: anchor.documentId,
          baseSeq: anchor.revision,
          snapshot: retained.snapshot,
          semanticDigest: digestSnapshot(retained.snapshot),
          createdAt: now()
        });
        if (applied) compacted += 1;
      } catch (error) {
        this.deps.logger.error("document.retention.compaction.failed", {
          documentId: anchor.documentId,
          revision: anchor.revision,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return compacted + await this.store.pruneRevisionHistory(cutoff);
  }

  async purgeExpired(cutoff: string): Promise<number> {
    const documentIds = await this.store.listExpiredDeleted(cutoff);
    for (const documentId of documentIds) await this.purgeRetainedDocument(documentId);
    return documentIds.length;
  }

  private async loadSnapshot(
    documentId: string,
    revision?: number
  ): Promise<{ head: DocumentHead; snapshot: DocumentSnapshot }> {
    const current = await this.store.getHead(documentId);
    if (!current && revision === undefined) throw new DocumentNotFoundError(documentId);
    const target = revision ?? (current as DocumentHead).revision;
    if (!Number.isSafeInteger(target) || target < 1) {
      throw new HistoryPrunedError(documentId, target);
    }
    const head = current?.revision === target
      ? current
      : await this.store.getHistoricalHead(documentId, target);
    if (!head) {
      if (!(await this.store.hasResource(documentId))) {
        throw new DocumentNotFoundError(documentId);
      }
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

  private transaction(
    input: Omit<DocumentCommittedTransaction, "sourceTransactionId">
  ): DocumentCommittedTransaction {
    return {
      ...input,
      sourceTransactionId:
        `document:${input.documentId}:${input.sourceRequestId}:${input.kind}`
    };
  }

  /**
   * Source state is already committed when this runs. Delivery failures stay in
   * the local outbox for `publishPendingActivity()` rather than changing the
   * accepted Document command result.
   */
  private async publishActivityTransaction(
    transaction: DocumentCommittedTransaction
  ): Promise<boolean> {
    const publisher = this.deps.activityPublisher;
    if (!publisher) return false;
    try {
      await publisher.publish(transaction);
      await this.store.markTransactionPublished(transaction.sourceTransactionId, now());
      return true;
    } catch (error) {
      this.deps.logger.warn("document.activity.publish-failed", {
        sourceTransactionId: transaction.sourceTransactionId,
        documentId: transaction.documentId,
        sourceRequestId: transaction.sourceRequestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
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
