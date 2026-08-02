import { randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import { digestTemplateCommand } from "../domain/canonical.js";
import {
  TemplateAlreadyExistsError,
  TemplateCatalogLimitError,
  TemplateIdempotencyMismatchError,
  TemplateNotFoundError,
  TemplateUnsupportedKindError
} from "../domain/errors.js";
import type {
  TemplateCommand,
  TemplateCommandRequest,
  TemplateCommandResult,
  TemplateCommittedFact,
  TemplateOptions,
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
  /** Drains the local outbox. Returns the number of facts published. */
  publishPendingActivity(limit?: number): Promise<number>;
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
    private readonly options: TemplateOptions,
    private readonly clock: TemplateClock,
    private readonly newId: () => string
  ) {}

  private now(): string {
    return this.clock.now();
  }

  async command(request: TemplateCommandRequest): Promise<TemplateCommandResult> {
    const { requestId, command } = request;
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
    const result = await this.execute(requestId, command, claim.templateId);
    this.store.completeClaim(requestId, result, this.now());
    return result;
  }

  async query(request: TemplateQueryRequest): Promise<TemplateQueryResult> {
    const { query } = request;
    if (query.type === "template.get") {
      const template = this.requireReady(query.templateId);
      return { type: "template.record", template };
    }
    return { type: "template.records", templates: this.store.list(query.kind) };
  }

  async publishPendingActivity(limit?: number): Promise<number> {
    const publisher = this.dependencies.activityPublisher;
    if (!publisher) return 0;

    const facts = this.store.listUnpublishedFacts(limit);
    let published = 0;
    for (const fact of facts) {
      try {
        await publisher.publish(fact);
        this.store.markFactPublished(fact.factId, this.now());
        published += 1;
      } catch (error) {
        // Source state is already committed. Delivery failures stay in the
        // outbox for the next drain rather than changing an accepted result.
        this.dependencies.logger.warn("templates.activity.publish-failed", {
          factId: fact.factId,
          templateId: fact.templateId,
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
    command: TemplateCommand,
    frozenTemplateId: string | undefined
  ): Promise<TemplateCommandResult> {
    switch (command.type) {
      case "template.register":
        return this.register(requestId, command, frozenTemplateId);
      case "template.instantiate":
        return this.instantiate(requestId, command);
      case "template.delete":
        return this.remove(requestId, command);
    }
  }

  private async register(
    requestId: string,
    command: Extract<TemplateCommand, { type: "template.register" }>,
    frozenTemplateId: string | undefined
  ): Promise<TemplateCommandResult> {
    const adapter = this.requireAdapter(command.source.kind);

    if (this.store.countLive() >= this.options.maxTemplatesPerProject) {
      throw new TemplateCatalogLimitError(this.options.maxTemplatesPerProject);
    }

    // Allocate once, then make the identity durable before the adapter runs.
    // A crash mid-copy must have a row to resume from, and a retry must not
    // mint a second identity or a second backing resource.
    const templateId = frozenTemplateId ?? this.newId();
    const createdAt = this.now();
    if (!frozenTemplateId) {
      this.store.bindClaimTemplateId(requestId, templateId, createdAt);
    }

    const record: TemplateRecord = {
      id: templateId,
      kind: command.source.kind,
      resourceId: templateId,
      ...(command.description !== undefined ? { description: command.description } : {}),
      state: "reserving",
      createdAt
    };

    const existing = this.store.get(templateId);
    if (!existing && !this.store.reserve(record)) {
      throw new TemplateAlreadyExistsError(templateId);
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
    const template: TemplateRecord = { ...record, state: "ready" };
    this.store.markReady({
      templateId,
      at: readyAt,
      fact: this.fact("template.registered", template, readyAt, requestId)
    });

    this.dependencies.logger.info("templates.registered", {
      templateId,
      kind: template.kind,
      requestId
    });
    return { type: "template.registered", template };
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
    command: Extract<TemplateCommand, { type: "template.delete" }>
  ): Promise<TemplateCommandResult> {
    const template = this.requireReady(command.templateId);
    const adapter = this.requireAdapter(template.kind);

    await adapter.deleteTemplateCopy({
      templateId: template.id,
      idempotencyKey: adapterKey(command.type, requestId)
    });

    const deletedAt = this.now();
    this.store.softDelete({
      templateId: template.id,
      at: deletedAt,
      fact: this.fact("template.deleted", template, deletedAt, requestId)
    });

    this.dependencies.logger.info("templates.deleted", {
      templateId: template.id,
      kind: template.kind,
      requestId
    });
    return { type: "template.deleted", templateId: template.id };
  }

  /**
   * The fact ID is derived from the request rather than freshly generated, so
   * it is stable across retries. A crash between the catalog commit and the
   * claim completion re-runs this command; a random ID would write a second
   * fact and give Activity duplicate history for one registration. Paired with
   * the outbox's INSERT OR IGNORE, a request yields at most one fact per kind.
   */
  private fact(
    kind: TemplateCommittedFact["kind"],
    template: TemplateRecord,
    occurredAt: string,
    requestId: string
  ): TemplateCommittedFact {
    const actorId = this.dependencies.attribution?.actorId;
    return {
      factId: `${requestId}:${kind.slice("template.".length)}`,
      kind,
      templateId: template.id,
      resourceKind: template.kind,
      resourceId: template.resourceId,
      ...(actorId !== undefined ? { actorId } : {}),
      occurredAt
    };
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
  options: TemplateOptions,
  clock: TemplateClock = systemClock,
  newId: () => string = randomUUID
): TemplateCapability => new TemplateService(store, dependencies, options, clock, newId);
