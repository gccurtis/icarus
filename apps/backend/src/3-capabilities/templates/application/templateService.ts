import { randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import { digestTemplateCommand } from "../domain/canonical.js";
import {
  StaleTemplateRevisionError,
  TemplateAlreadyExistsError,
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
  TemplateOrigin,
  TemplateQueryRequest,
  TemplateQueryResult,
  TemplateRecord
} from "../domain/model.js";
import type { TemplateActivityPublisher } from "../ports/activityPublisher.js";
import type { TemplateResourceAdapter, TemplateResourceRegistry } from "../ports/resourceAdapter.js";
import type { TemplateStore } from "../ports/templateStore.js";

export interface TemplateCapability {
  command(request: TemplateCommandRequest): Promise<TemplateCommandResult>;
  query(request: TemplateQueryRequest): Promise<TemplateQueryResult>;
  /** Drains the local source-transaction outbox. */
  publishPendingActivity(limit?: number): Promise<number>;
  pruneHistory(cutoff: string): Promise<number>;
  purgeExpired(cutoff: string): Promise<number>;
}

export interface TemplateDependencies {
  readonly adapters: TemplateResourceRegistry;
  readonly logger: Logger;
  readonly activityPublisher?: TemplateActivityPublisher;
  readonly attribution?: { readonly actorId?: string };
}

export interface TemplateClock {
  now(): string;
}

const systemClock: TemplateClock = { now: () => new Date().toISOString() };

/** Deterministic per request, so a resumed claim replays the adapter's own attempt. */
const adapterKey = (command: TemplateCommand["type"], requestId: string): string =>
  `templates:${command.slice("template.".length)}:${requestId}`;

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

  async command(request: TemplateCommandRequest): Promise<TemplateCommandResult> {
    const { requestId, origin, command } = request;
    const digest = digestTemplateCommand(command);
    const claim = this.store.claimCommand({
      requestId,
      requestDigest: digest,
      commandType: command.type,
      createdAt: this.now()
    });

    if (claim.requestDigest !== digest || claim.commandType !== command.type) {
      throw new TemplateIdempotencyMismatchError(requestId);
    }
    if (claim.state === "completed") {
      return claim.result as TemplateCommandResult;
    }

    // "pending" means a prior attempt did not finish. Resuming is safe because
    // the allocated identity is already frozen on the claim and every adapter
    // call is keyed by the request.
    let result: TemplateCommandResult;
    try {
      result = await this.execute(requestId, origin, command, claim.templateId);
    } catch (error) {
      this.dependencies.logger.warn("templates.command.failed", {
        type: command.type,
        requestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
    this.store.completeClaim(requestId, result, this.now());
    return result;
  }

  async query(request: TemplateQueryRequest): Promise<TemplateQueryResult> {
    const startedAt = performance.now();
    const { query } = request;
    if (query.type === "template.get") {
      const template = this.requireReady(query.templateId);
      this.dependencies.logger.debug("templates.query.completed", {
        type: query.type,
        templateId: template.id,
        durationMs: Math.round(performance.now() - startedAt)
      });
      return { type: "template.record", template };
    }
    if (query.type === "template.load") {
      // Deliberately not folded into template.get: a catalog listing is a
      // single store read and must not pay for an adapter round trip. This
      // query exists because registration seals the owning capability's own
      // read surface, leaving Templates as the only way to the content.
      const template = this.requireReady(query.templateId);
      const content = await this.requireAdapter(template.kind).readTemplateCopy({
        templateId: template.id
      });
      this.dependencies.logger.debug("templates.query.completed", {
        type: query.type,
        templateId: template.id,
        kind: template.kind,
        durationMs: Math.round(performance.now() - startedAt)
      });
      return { type: "template.content", template, content };
    }
    const templates = this.store.list(query.kind);
    this.dependencies.logger.debug("templates.query.completed", {
      type: query.type,
      kind: query.kind,
      count: templates.length,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return { type: "template.records", templates };
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
    origin: TemplateOrigin,
    command: TemplateCommand,
    frozenTemplateId: string | undefined
  ): Promise<TemplateCommandResult> {
    switch (command.type) {
      case "template.register":
        return this.register(requestId, origin, command, frozenTemplateId);
      case "template.update":
        return this.update(requestId, origin, command);
      case "template.instantiate":
        return this.instantiate(requestId, command);
      case "template.delete":
        return this.remove(requestId, origin, command);
      case "template.purge":
        return this.purge(requestId, command);
    }
  }

  private async register(
    requestId: string,
    origin: TemplateOrigin,
    command: Extract<TemplateCommand, { type: "template.register" }>,
    frozenTemplateId: string | undefined
  ): Promise<TemplateCommandResult> {
    const adapter = this.requireAdapter(command.source.kind);

    // Allocate once, then make the identity durable before the adapter runs.
    // A crash mid-copy must have a row to resume from, and a retry must not
    // mint a second identity or a second backing resource.
    const templateId = frozenTemplateId ?? this.createId();
    const createdAt = this.now();
    if (!frozenTemplateId) {
      this.store.bindClaimTemplateId(requestId, templateId, createdAt);
    }

    const record: TemplateRecord = {
      id: templateId,
      kind: command.source.kind,
      resourceId: templateId,
      name: command.name,
      ...(command.description !== undefined ? { description: command.description } : {}),
      contextBindings: command.contextBindings,
      state: "reserving",
      revision: 1,
      createdAt,
      updatedAt: createdAt
    };

    const existing = this.store.get(templateId);
    if (!existing) {
      // Checked before reserve() so the caller gets the specific conflict. The
      // unique index is still the authority; this only tells the two apart,
      // and both fail before the adapter runs, so no backing copy is created.
      if (this.store.nameTaken(record.kind, record.name)) {
        throw new TemplateNameConflictError(record.kind, record.name);
      }
      if (!this.store.reserve(record)) {
        throw new TemplateAlreadyExistsError(templateId);
      }
    }

    try {
      await adapter.createTemplateCopy({
        sourceResourceId: command.source.resourceId,
        templateId,
        contextBindings: command.contextBindings,
        idempotencyKey: adapterKey(command.type, requestId)
      });
    } catch (error) {
      // Release the reservation so a failed registration does not burn the ID.
      this.store.deleteReservation(templateId);
      throw error;
    }

    const readyAt = this.now();
    const template: TemplateRecord = { ...record, state: "ready", updatedAt: readyAt };
    this.store.markReady({
      templateId,
      at: readyAt,
      transaction: this.transaction("template.registered", template, readyAt, requestId, origin)
    });

    this.dependencies.logger.info("templates.registered", {
      templateId,
      kind: template.kind,
      requestId
    });
    return { type: "template.registered", template };
  }

  /**
   * The only path that changes a registered template. Both halves run in one
   * command: the backing content through the adapter, the declaration in the
   * catalog. Two writable statements about one template would otherwise drift.
   *
   * Adapter first, catalog second — the same ordering as register. A failure
   * before the local commit leaves the catalog untouched and the command
   * retryable on its still-pending claim.
   */
  private async update(
    requestId: string,
    origin: TemplateOrigin,
    command: Extract<TemplateCommand, { type: "template.update" }>
  ): Promise<TemplateCommandResult> {
    const current = this.requireReady(command.templateId);
    const adapter = this.requireAdapter(current.kind);

    // Fail the whole command before the adapter runs, so a rejected rename
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

    if (command.resourceOperations !== undefined || command.contextBindings !== undefined) {
      await adapter.updateTemplateCopy({
        templateId: current.id,
        operations: command.resourceOperations,
        ...(command.contextBindings !== undefined
          ? { contextBindings: command.contextBindings }
          : {}),
        idempotencyKey: adapterKey(command.type, requestId)
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

    const committed = this.store.update({
      record: template,
      expectedRevision: current.revision,
      at: updatedAt,
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
    return { type: "template.updated", template };
  }

  private async instantiate(
    requestId: string,
    command: Extract<TemplateCommand, { type: "template.instantiate" }>
  ): Promise<TemplateCommandResult> {
    const template = this.requireReady(command.templateId);
    const adapter = this.requireAdapter(template.kind);

    await adapter.instantiateTemplate({
      templateId: template.id,
      destinationResourceId: command.destinationResourceId,
      instantiation: {
        ...(command.title !== undefined ? { title: command.title } : {}),
        contextBindings: command.contextBindings
      },
      idempotencyKey: adapterKey(command.type, requestId)
    });

    this.dependencies.logger.info("templates.instantiated", {
      templateId: template.id,
      kind: template.kind,
      destinationResourceId: command.destinationResourceId,
      requestId
    });

    // No catalog row: the instance belongs entirely to its owning capability,
    // and Templates keeps no instance list.
    return {
      type: "template.instantiated",
      template,
      resource: { kind: template.kind, resourceId: command.destinationResourceId }
    };
  }

  private async remove(
    requestId: string,
    origin: TemplateOrigin,
    command: Extract<TemplateCommand, { type: "template.delete" }>
  ): Promise<TemplateCommandResult> {
    const template = this.requireReady(command.templateId);
    const adapter = this.requireAdapter(template.kind);

    await adapter.logicalDeleteTemplateCopy({
      templateId: template.id,
      idempotencyKey: adapterKey(command.type, requestId)
    });

    const deletedAt = this.now();
    this.store.delete({
      templateId: template.id,
      at: deletedAt,
      transaction: this.transaction("template.deleted", template, deletedAt, requestId, origin)
    });

    this.dependencies.logger.info("templates.deleted", {
      templateId: template.id,
      kind: template.kind,
      requestId
    });
    return {
      type: "template.deleted",
      templateId: template.id,
      revision: template.revision + 1
    };
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
    await this.requireAdapter(retained.kind).purgeTemplateCopy({
      templateId: retained.id,
      idempotencyKey: adapterKey(command.type, requestId)
    });
    this.store.purge(retained.id);
    this.dependencies.logger.info("templates.purged", {
      templateId: retained.id,
      kind: retained.kind,
      requestId
    });
    return { type: "template.purged", templateId: retained.id };
  }

  /**
   * The source transaction ID is derived from the request rather than freshly
   * generated, so it is stable across retries. A crash between the catalog
   * commit and claim completion re-runs this command; a random ID would write
   * a second transaction. Paired with the outbox's INSERT OR IGNORE, a request
   * yields at most one source transaction per kind.
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
      await this.requireAdapter(template.kind).purgeTemplateCopy({
        templateId,
        idempotencyKey: `templates:retention-purge:${templateId}`
      });
      this.store.purge(templateId);
      count += 1;
    }
    return count;
  }

  private requireAdapter(kind: string): TemplateResourceAdapter {
    const adapter = this.dependencies.adapters.get(kind);
    if (!adapter) throw new TemplateUnsupportedKindError(kind);
    return adapter;
  }

  /** A reserving record is not yet a template, so it reads as absent. */
  private requireReady(templateId: string): TemplateRecord {
    const template = this.store.get(templateId);
    if (!template || template.state !== "ready") {
      throw new TemplateNotFoundError(templateId);
    }
    return template;
  }
}

export const createTemplateCapability = (
  store: TemplateStore,
  dependencies: TemplateDependencies,
  clock: TemplateClock = systemClock,
  createId: () => string = randomUUID
): TemplateCapability => new TemplateService(store, dependencies, clock, createId);
