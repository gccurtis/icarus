import { randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import { digestTemplateCommand } from "../domain/canonical.js";
import {
  StaleTemplateRevisionError,
  TemplateAlreadyExistsError,
  TemplateBindingMismatchError,
  TemplateIdempotencyMismatchError,
  TemplateNameConflictError,
  TemplateNotFoundError,
  TemplateUnsupportedKindError
} from "../domain/errors.js";
import type {
  TemplateCommand,
  TemplateCommandRequest,
  TemplateCommandResult,
  TemplateCommittedTransaction,
  TemplateContextBindings,
  TemplateOrigin,
  TemplateQueryRequest,
  TemplateQueryResult,
  TemplateRecord
} from "../domain/model.js";
import type { TemplateActivityPublisher } from "../ports/activityPublisher.js";
import type {
  TemplatableResource,
  TemplatableResourceRegistry
} from "../ports/templatableResource.js";
import type { TemplateCommandReceipt, TemplateStore } from "../ports/templateStore.js";

export interface TemplateCapability {
  command(request: TemplateCommandRequest): Promise<TemplateCommandResult>;
  query(request: TemplateQueryRequest): Promise<TemplateQueryResult>;
  /** Drains the local source-transaction outbox. */
  publishPendingActivity(limit?: number): Promise<number>;
  pruneHistory(cutoff: string): Promise<number>;
  purgeExpired(cutoff: string): Promise<number>;
}

export interface TemplateDependencies {
  readonly resources: TemplatableResourceRegistry;
  readonly logger: Logger;
  readonly activityPublisher?: TemplateActivityPublisher;
  readonly attribution?: { readonly actorId?: string };
}

export interface TemplateClock {
  now(): string;
}

const systemClock: TemplateClock = { now: () => new Date().toISOString() };

/**
 * Deterministic per request, so a retry presents the resource the same key and
 * replays its own completed attempt rather than performing a second one. This is
 * the whole of the idempotency story on the far side of the boundary: nothing is
 * claimed or frozen here, so the key has to carry it.
 *
 * One key per command, shared by every call the command makes. A command's calls
 * are steps in one procedure, not independent operations, so they replay
 * together or not at all — and a resource that keys `duplicate` off its own
 * create receipt gets the same key on the retry that produced the copy.
 */
const resourceKey = (command: TemplateCommand["type"], requestId: string): string =>
  `templates:${command.slice("template.".length)}:${requestId}`;

/**
 * A template is a resource as a function of its declared parameters, so an
 * instantiation is a call to that function: every parameter is supplied, and
 * nothing else is.
 *
 * A declared `target` is the default the *template* was built with, not a
 * fallback for an omitted argument. Instantiation never falls back to it, which
 * is what makes "no instance holds an unbound variable" true by construction
 * rather than by hoping the declaration had defaults.
 */
const assertBindingsMatchDeclaration = (
  template: TemplateRecord,
  supplied: TemplateContextBindings
): void => {
  const declared = new Set(Object.keys(template.contextBindings));
  const given = new Set(Object.keys(supplied));
  const missing = [...declared].filter((name) => !given.has(name));
  const unexpected = [...given].filter((name) => !declared.has(name));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new TemplateBindingMismatchError(template.id, missing, unexpected);
  }
};

class TemplateService implements TemplateCapability {
  constructor(
    private readonly store: TemplateStore,
    private readonly dependencies: TemplateDependencies,
    private readonly clock: TemplateClock,
    private readonly createId: () => string
  ) {}

  private now(): string {
    return this.clock.now();
  }

  /**
   * Receipt lookup, then work, then receipt. Nothing is written before the work
   * runs, so a command that fails leaves no trace to reconcile — the retry is
   * simply the command again.
   *
   * A failed attempt therefore starts over rather than resuming, and that is the
   * trade this shape makes. What makes it safe is that every external call is
   * keyed by the request: the resource replays its own completed attempt, so
   * "start over" reaches the same place without doing the work twice.
   */
  async command(request: TemplateCommandRequest): Promise<TemplateCommandResult> {
    const { requestId, origin, command } = request;
    const digest = digestTemplateCommand(command);

    const prior = this.store.getReceipt(requestId);
    if (prior) {
      if (prior.requestDigest !== digest || prior.commandType !== command.type) {
        throw new TemplateIdempotencyMismatchError(requestId);
      }
      return prior.result as TemplateCommandResult;
    }

    let result: TemplateCommandResult;
    try {
      result = await this.execute(requestId, digest, origin, command);
    } catch (error) {
      this.dependencies.logger.warn("templates.command.failed", {
        type: command.type,
        requestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
    // Commands that change local state commit their own receipt inside the same
    // transaction. This covers the ones that do not — instantiate and purge —
    // and is a no-op for the rest.
    this.store.recordReceipt(this.receipt(requestId, digest, command.type, result));
    return result;
  }

  async query(request: TemplateQueryRequest): Promise<TemplateQueryResult> {
    const startedAt = performance.now();
    const { query } = request;
    if (query.type === "template.get") {
      const template = this.requireTemplate(query.templateId);
      this.dependencies.logger.debug("templates.query.completed", {
        type: query.type,
        templateId: template.id,
        durationMs: Math.round(performance.now() - startedAt)
      });
      return { type: "template.record", template };
    }
    if (query.type === "template.load") {
      // Deliberately not folded into template.get: a catalog listing is a
      // single store read and must not pay for a round trip to the resource.
      // This query exists because registration seals the owning capability's
      // own read surface, leaving Templates as the only way to the content.
      const template = this.requireTemplate(query.templateId);
      const content = await this.requireResource(template.kind).load({
        resourceId: template.resourceId
      });
      this.dependencies.logger.debug("templates.query.completed", {
        type: query.type,
        templateId: template.id,
        kind: template.kind,
        durationMs: Math.round(performance.now() - startedAt)
      });
      return { type: "template.content", template, content };
    }
    const page = this.store.list(query);
    this.dependencies.logger.debug("templates.query.completed", {
      type: query.type,
      ...(query.kinds !== undefined ? { kinds: query.kinds } : {}),
      ...(query.search !== undefined ? { searched: true } : {}),
      count: page.items.length,
      hasMore: page.nextCursor !== undefined,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return {
      type: "template.records",
      templates: page.items,
      ...(page.nextCursor !== undefined ? { nextCursor: page.nextCursor } : {})
    };
  }

  async publishPendingActivity(limit?: number): Promise<number> {
    const publisher = this.dependencies.activityPublisher;
    if (!publisher) return 0;

    const transactions = this.store.listUnpublishedTransactions(limit);
    let published = 0;
    for (const transaction of transactions) {
      try {
        await publisher.publish(transaction);
        this.store.markTransactionPublished(transaction.sourceTransactionId, this.now());
        published += 1;
      } catch (error) {
        // Source state is already committed. Delivery failures stay in the
        // outbox for the next drain rather than changing an accepted result.
        this.dependencies.logger.warn("templates.activity.publish-failed", {
          sourceTransactionId: transaction.sourceTransactionId,
          templateId: transaction.templateId,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: error instanceof Error ? error.message : String(error)
        });
        break;
      }
    }
    return published;
  }

  private async execute(
    requestId: string,
    digest: string,
    origin: TemplateOrigin,
    command: TemplateCommand
  ): Promise<TemplateCommandResult> {
    switch (command.type) {
      case "template.register":
        return this.register(requestId, digest, origin, command);
      case "template.update":
        return this.update(requestId, digest, origin, command);
      case "template.instantiate":
        return this.instantiate(requestId, command);
      case "template.delete":
        return this.remove(requestId, digest, origin, command);
      case "template.purge":
        return this.purge(requestId, command);
    }
  }

  /**
   * Templates owns the whole procedure: copy, seal, bind, then record. The
   * resource is driven, not asked — it neither knows nor decides that it is
   * becoming a template.
   *
   * Both refusals — unsupported kind and name conflict — precede the first
   * external call, so a rejected registration never leaves a backing copy
   * behind. That ordering is the reason the name is checked here rather than
   * being left to the unique index, which cannot report until the row is
   * written and the row is now written last.
   */
  private async register(
    requestId: string,
    digest: string,
    origin: TemplateOrigin,
    command: Extract<TemplateCommand, { type: "template.register" }>
  ): Promise<TemplateCommandResult> {
    const resource = this.requireResource(command.kind);
    if (this.store.nameTaken(command.kind, command.name)) {
      throw new TemplateNameConflictError(command.kind, command.name);
    }

    const idempotencyKey = resourceKey(command.type, requestId);
    // The resource names its own row. Templates names the catalog entry, below,
    // and only after the copy exists — so there is no identity to freeze across
    // the call and nothing to release when it fails.
    const { resourceId } = await resource.duplicate({
      sourceResourceId: command.resourceId,
      idempotencyKey
    });
    await resource.markAsTemplate({ resourceId });
    if (Object.keys(command.contextBindings).length > 0) {
      await resource.applyBindings({
        resourceId,
        contextBindings: command.contextBindings,
        idempotencyKey
      });
    }

    const templateId = this.createId();
    const createdAt = this.now();
    const template: TemplateRecord = {
      id: templateId,
      kind: command.kind,
      resourceId,
      name: command.name,
      ...(command.description !== undefined ? { description: command.description } : {}),
      contextBindings: command.contextBindings,
      revision: 1,
      createdAt,
      updatedAt: createdAt
    };
    const result: TemplateCommandResult = { type: "template.registered", template };

    if (!this.store.create({
      record: template,
      receipt: this.receipt(requestId, digest, command.type, result, createdAt),
      transaction: this.transaction("template.registered", template, createdAt, requestId, origin)
    })) {
      throw new TemplateAlreadyExistsError(templateId);
    }

    this.dependencies.logger.info("templates.registered", {
      templateId,
      kind: template.kind,
      requestId
    });
    return result;
  }

  /**
   * The only path that changes a registered template. Both halves run in one
   * command: the backing content through the resource, the declaration in the
   * catalog. Two writable statements about one template would otherwise drift.
   *
   * Resource first, catalog second — the same ordering as register. A failure
   * before the local commit leaves the catalog untouched and no receipt behind,
   * so the retry is the same command against the same state.
   */
  private async update(
    requestId: string,
    digest: string,
    origin: TemplateOrigin,
    command: Extract<TemplateCommand, { type: "template.update" }>
  ): Promise<TemplateCommandResult> {
    const current = this.requireTemplate(command.templateId);
    const resource = this.requireResource(current.kind);

    // Fail the whole command before the resource runs, so a rejected rename
    // never leaves edited content behind an unchanged declaration.
    if (current.revision !== command.expectedRevision) {
      throw new StaleTemplateRevisionError(
        current.id,
        command.expectedRevision,
        current.revision
      );
    }
    const name = command.name ?? current.name;
    if (name !== current.name && this.store.nameTaken(current.kind, name, current.id)) {
      throw new TemplateNameConflictError(current.kind, name);
    }

    // Two calls rather than one, because they are two different statements: the
    // declaration says which variables are parameters, the operations say what
    // the content is. Bindings first, so a content edit that references a
    // freshly bound variable sees it.
    const idempotencyKey = resourceKey(command.type, requestId);
    if (command.contextBindings !== undefined) {
      await resource.applyBindings({
        resourceId: current.resourceId,
        contextBindings: command.contextBindings,
        idempotencyKey
      });
    }
    if (command.resourceOperations !== undefined) {
      await resource.submit({
        resourceId: current.resourceId,
        operations: command.resourceOperations,
        idempotencyKey
      });
    }

    const updatedAt = this.now();
    const template: TemplateRecord = {
      ...current,
      name,
      // Wholesale replacement, never a patch: an omitted field means "leave
      // alone", and a supplied one replaces its predecessor entirely.
      ...(command.description !== undefined
        ? { description: command.description }
        : {}),
      ...(command.contextBindings !== undefined
        ? { contextBindings: command.contextBindings }
        : {}),
      revision: current.revision + 1,
      updatedAt
    };
    const result: TemplateCommandResult = { type: "template.updated", template };

    const committed = this.store.update({
      record: template,
      expectedRevision: current.revision,
      at: updatedAt,
      receipt: this.receipt(requestId, digest, command.type, result, updatedAt),
      transaction: this.transaction("template.updated", template, updatedAt, requestId, origin)
    });
    if (!committed) {
      // The read above passed, so losing here means the row moved underneath a
      // caller that bypassed the serial queue. Report it as the conflict it is.
      throw new StaleTemplateRevisionError(
        current.id,
        command.expectedRevision,
        this.store.get(current.id)?.revision ?? current.revision
      );
    }

    this.dependencies.logger.info("templates.updated", {
      templateId: template.id,
      kind: template.kind,
      revision: template.revision,
      requestId
    });
    return result;
  }

  /**
   * The mirror of register, one call shorter: copy and bind, but no
   * `markAsTemplate`. An instance is an ordinary resource of its kind, and the
   * only difference between the two procedures is that one seals and the other
   * does not.
   */
  private async instantiate(
    requestId: string,
    command: Extract<TemplateCommand, { type: "template.instantiate" }>
  ): Promise<TemplateCommandResult> {
    const template = this.requireTemplate(command.templateId);
    const resource = this.requireResource(template.kind);
    assertBindingsMatchDeclaration(template, command.contextBindings);

    const idempotencyKey = resourceKey(command.type, requestId);
    const created = await resource.duplicate({
      sourceResourceId: template.resourceId,
      ...(command.name !== undefined ? { name: command.name } : {}),
      idempotencyKey
    });
    if (Object.keys(command.contextBindings).length > 0) {
      await resource.applyBindings({
        resourceId: created.resourceId,
        contextBindings: command.contextBindings,
        idempotencyKey
      });
    }

    this.dependencies.logger.info("templates.instantiated", {
      templateId: template.id,
      kind: template.kind,
      resourceId: created.resourceId,
      requestId
    });

    // No catalog row: the instance belongs entirely to its owning capability,
    // and Templates keeps no instance list.
    return {
      type: "template.instantiated",
      template,
      resource: { kind: template.kind, resourceId: created.resourceId }
    };
  }

  private async remove(
    requestId: string,
    digest: string,
    origin: TemplateOrigin,
    command: Extract<TemplateCommand, { type: "template.delete" }>
  ): Promise<TemplateCommandResult> {
    const template = this.requireTemplate(command.templateId);
    const resource = this.requireResource(template.kind);

    await resource.logicalDelete({
      resourceId: template.resourceId,
      idempotencyKey: resourceKey(command.type, requestId)
    });

    const deletedAt = this.now();
    const result: TemplateCommandResult = {
      type: "template.deleted",
      templateId: template.id,
      revision: template.revision + 1
    };
    this.store.delete({
      templateId: template.id,
      at: deletedAt,
      receipt: this.receipt(requestId, digest, command.type, result, deletedAt),
      transaction: this.transaction("template.deleted", template, deletedAt, requestId, origin)
    });

    this.dependencies.logger.info("templates.deleted", {
      templateId: template.id,
      kind: template.kind,
      requestId
    });
    return result;
  }

  private async purge(
    requestId: string,
    command: Extract<TemplateCommand, { type: "template.purge" }>
  ): Promise<TemplateCommandResult> {
    // Let the store produce the consistent 409 if a live row still exists.
    if (this.store.get(command.templateId)) this.store.purge(command.templateId);
    const template = this.store.latestSnapshot(command.templateId);
    if (!template) this.store.purge(command.templateId);
    const retained = template as TemplateRecord;
    await this.requireResource(retained.kind).purge({
      resourceId: retained.resourceId,
      idempotencyKey: resourceKey(command.type, requestId)
    });
    this.store.purge(retained.id);
    this.dependencies.logger.info("templates.purged", {
      templateId: retained.id,
      kind: retained.kind,
      requestId
    });
    return { type: "template.purged", templateId: retained.id };
  }

  private receipt(
    requestId: string,
    requestDigest: string,
    commandType: TemplateCommand["type"],
    result: TemplateCommandResult,
    createdAt: string = this.now()
  ): TemplateCommandReceipt {
    return { requestId, requestDigest, commandType, result, createdAt };
  }

  /**
   * The source transaction ID is derived from the request rather than freshly
   * generated, so it is stable across retries. Paired with the outbox's
   * INSERT OR IGNORE, a request yields at most one source transaction per kind
   * even if the command is re-run.
   */
  private transaction(
    kind: TemplateCommittedTransaction["kind"],
    template: TemplateRecord,
    occurredAt: string,
    requestId: string,
    origin: TemplateOrigin
  ): TemplateCommittedTransaction {
    const actorId = this.dependencies.attribution?.actorId;
    return {
      sourceTransactionId: `${requestId}:${kind.slice("template.".length)}`,
      kind,
      templateId: template.id,
      resourceKind: template.kind,
      resourceId: template.resourceId,
      ...(actorId !== undefined ? { actorId } : {}),
      origin,
      occurredAt
    };
  }

  async pruneHistory(cutoff: string): Promise<number> {
    return this.store.pruneHistory(cutoff);
  }

  async purgeExpired(cutoff: string): Promise<number> {
    let count = 0;
    for (const templateId of this.store.expiredDeleted(cutoff)) {
      const template = this.store.latestSnapshot(templateId);
      if (!template) continue;
      await this.requireResource(template.kind).purge({
        resourceId: template.resourceId,
        idempotencyKey: `templates:retention-purge:${templateId}`
      });
      this.store.purge(templateId);
      count += 1;
    }
    return count;
  }

  private requireResource(kind: string): TemplatableResource {
    const resource = this.dependencies.resources.get(kind);
    if (!resource) throw new TemplateUnsupportedKindError(kind);
    return resource;
  }

  private requireTemplate(templateId: string): TemplateRecord {
    const template = this.store.get(templateId);
    if (!template) throw new TemplateNotFoundError(templateId);
    return template;
  }
}

export const createTemplateCapability = (
  store: TemplateStore,
  dependencies: TemplateDependencies,
  clock: TemplateClock = systemClock,
  createId: () => string = randomUUID
): TemplateCapability => new TemplateService(store, dependencies, clock, createId);
