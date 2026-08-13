// Persona runtime: catalog commands, queries, pure rendering, and snapshot freeze.

import { randomUUID } from "node:crypto";
import type { Logger } from "#capabilities/observability/logger.js";
import { BUILTIN_PERSONA, isBuiltInPersonaId } from "../domain/builtin.js";
import { digestPersonaDefinition, digestPrompt } from "../domain/canonical.js";
import {
  BuiltInPersonaImmutableError,
  PersonaConflictError,
  PersonaNotFoundError,
  PersonaValidationError,
  StalePersonaRevisionError
} from "../domain/errors.js";
import type {
  ContextEntry,
  CreatePersonaInput,
  DeletePersonaInput,
  PersonaCommand,
  PersonaCommandResult,
  PersonaDefinition,
  PersonaQuery,
  PersonaQueryResult,
  PersonaRecord,
  PersonaResolveOptions,
  PersonaSectionName,
  PersonaSnapshot,
  PurgePersonaInput,
  UpdatePersonaInput
} from "../domain/model.js";
import { renderPersona, selectPersonaSections } from "../domain/render.js";
import {
  DEFAULT_PERSONA_LIMITS,
  validateDefinition,
  validateDescription,
  validateDisplayName,
  type PersonaLimits
} from "../domain/validation.js";
import type { PersonaContextPort } from "../ports/personaContext.js";
import type { PersonaStore } from "../ports/personaStore.js";

export interface PersonaClock {
  now(): string;
}

export interface PersonaDependencies {
  readonly context: PersonaContextPort;
  readonly logger: Logger;
  readonly limits?: PersonaLimits;
  readonly clock?: PersonaClock;
}

export interface PersonaCapability {
  // ── Transport surface ───────────────────────────────────────────────────
  /** Discriminated dispatch for POST /personas/command. */
  command(command: PersonaCommand): Promise<PersonaCommandResult>;
  /** Discriminated dispatch for POST /personas/query. */
  query(query: PersonaQuery): Promise<PersonaQueryResult>;

  // ── Catalog ─────────────────────────────────────────────────────────────
  create(input: CreatePersonaInput): Promise<PersonaRecord>;
  get(id: string): Promise<PersonaRecord | undefined>;
  getByName(displayName: string): Promise<PersonaRecord | undefined>;
  list(): Promise<PersonaRecord[]>;
  update(input: UpdatePersonaInput): Promise<PersonaRecord>;
  delete(input: DeletePersonaInput): Promise<void>;
  purge(input: PurgePersonaInput): Promise<void>;
  pruneHistory(cutoff: string): Promise<number>;
  purgeExpired(cutoff: string): Promise<number>;

  // ── Pure ────────────────────────────────────────────────────────────────
  /** No I/O. Same definition and selection always produce the same bytes. */
  render(definition: PersonaDefinition, sections?: readonly PersonaSectionName[]): string;

  // ── Freeze ──────────────────────────────────────────────────────────────
  /**
   * Absent id resolves the built-in. A deleted or unknown id throws rather than
   * falling back, so a consumer never silently gets different behaviour than the
   * one it named.
   */
  resolve(id?: string, options?: PersonaResolveOptions): Promise<PersonaSnapshot>;
}

/** The private wrapper's name is derived from the persona's immutable id, never
 *  its editable display name, so a rename can never orphan or collide it. */
const wrapperName = (personaId: string): string => `persona:${personaId}`;

/** Whether two optional context references point at the same entry, so a
 *  metadata-only edit that leaves the context untouched can skip any Context
 *  write entirely. */
const sameContextEntry = (a: ContextEntry | undefined, b: ContextEntry | undefined): boolean => {
  if (!a || !b) return a === b;
  return a.id === b.id && a.kind === b.kind;
};

class PersonaService implements PersonaCapability {
  private readonly limits: PersonaLimits;
  private readonly clock: PersonaClock;

  constructor(
    private readonly store: PersonaStore,
    private readonly deps: PersonaDependencies
  ) {
    this.limits = deps.limits ?? DEFAULT_PERSONA_LIMITS;
    this.clock = deps.clock ?? { now: () => new Date().toISOString() };
  }

  // Total switches with no default clause: adding a command or query variant is a
  // compile error until it is handled here.
  async command(command: PersonaCommand): Promise<PersonaCommandResult> {
    const startedAt = performance.now();
    try {
      switch (command.type) {
        case "persona.create":
          return { type: "persona.created", record: await this.create(command.input) };
        case "persona.update":
          return { type: "persona.updated", record: await this.update(command.input) };
        case "persona.delete":
          await this.delete(command.input);
          return {
            type: "persona.deleted",
            personaId: command.input.id,
            revision: command.input.expectedRevision + 1
          };
        case "persona.purge":
          await this.purge(command.input);
          return { type: "persona.purged", personaId: command.input.id };
      }
    } finally {
      this.deps.logger.debug("persona.command", {
        type: command.type,
        durationMs: Math.round(performance.now() - startedAt)
      });
    }
  }

  async query(query: PersonaQuery): Promise<PersonaQueryResult> {
    const startedAt = performance.now();
    switch (query.type) {
      case "persona.get": {
        const record = await this.get(query.id);
        if (!record) throw new PersonaNotFoundError(query.id);
        this.deps.logger.debug("persona.query.completed", {
          type: query.type,
          personaId: record.id,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return { type: "persona.entry", record };
      }
      case "persona.getByName": {
        const record = await this.getByName(query.displayName);
        if (!record) throw new PersonaNotFoundError(query.displayName);
        this.deps.logger.debug("persona.query.completed", {
          type: query.type,
          personaId: record.id,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return { type: "persona.entry", record };
      }
      case "persona.list": {
        const records = await this.list();
        this.deps.logger.debug("persona.query.completed", {
          type: query.type,
          count: records.length,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return { type: "persona.records", records };
      }
      case "persona.render": {
        const definition = validateDefinition(query.definition, this.limits);
        const prompt = this.render(definition, query.sections);
        const promptDigest = digestPrompt(prompt);
        this.deps.logger.debug("persona.query.completed", {
          type: query.type,
          promptDigest,
          durationMs: Math.round(performance.now() - startedAt)
        });
        return {
          type: "persona.rendered",
          prompt,
          promptDigest,
          sections: selectPersonaSections(definition, query.sections)
        };
      }
    }
  }

  private assertMutable(id: string): void {
    if (isBuiltInPersonaId(id)) throw new BuiltInPersonaImmutableError(id);
  }

  private async requireLive(id: string): Promise<PersonaRecord> {
    const record = await this.store.get(id);
    if (!record) throw new PersonaNotFoundError(id);
    return record;
  }

  async create(input: CreatePersonaInput): Promise<PersonaRecord> {
    const startedAt = performance.now();
    const displayName = validateDisplayName(input.displayName, this.limits);
    const description = validateDescription(input.description, this.limits);
    const definition = validateDefinition(input.definition, this.limits);

    if (await this.store.getByName(displayName)) {
      throw new PersonaConflictError(displayName);
    }
    const liveCount = await this.store.countLive();
    if (liveCount >= this.limits.maxPersonas) {
      throw new PersonaValidationError(
        "persona",
        `project already holds the maximum of ${this.limits.maxPersonas} personas`
      );
    }

    // The id is generated before the wrapper so the wrapper's name can be derived
    // from it. Context is called before the persona row is written; a failure
    // between the two leaves an orphaned private record, which is accepted — see
    // docs/invariants.md.
    const id = randomUUID();
    const wrapper = definition.context
      ? await this.deps.context.declare(wrapperName(id), [definition.context], {
          private: true,
          description: `Private scope wrapper for persona ${displayName}`
        })
      : undefined;
    if (wrapper) {
      this.deps.logger.info("persona.wrapper.declared", {
        personaId: id,
        wrapperId: wrapper.id,
        revision: wrapper.revision
      });
    }

    const now = this.clock.now();
    const record: PersonaRecord = {
      id,
      displayName,
      description,
      definition,
      ...(wrapper ? { contextWrapperId: wrapper.id, contextWrapperRevision: wrapper.revision } : {}),
      revision: 1,
      definitionDigest: digestPersonaDefinition(definition),
      createdAt: now,
      updatedAt: now
    };
    try {
      await this.store.insert(record);
    } catch (error) {
      if (wrapper) {
        this.deps.logger.warn("persona.wrapper.orphaned", {
          personaId: id,
          wrapperId: wrapper.id,
          reason: error instanceof Error ? error.message : String(error)
        });
      }
      throw error;
    }

    this.deps.logger.info("persona.create", {
      personaId: record.id,
      revision: record.revision,
      definitionDigest: record.definitionDigest,
      sectionCount: selectPersonaSections(definition).length,
      hasContext: Boolean(definition.context),
      durationMs: Math.round(performance.now() - startedAt)
    });
    return record;
  }

  async get(id: string): Promise<PersonaRecord | undefined> {
    if (isBuiltInPersonaId(id)) return BUILTIN_PERSONA;
    return this.store.get(id);
  }

  async getByName(displayName: string): Promise<PersonaRecord | undefined> {
    return this.store.getByName(displayName);
  }

  async list(): Promise<PersonaRecord[]> {
    return this.store.list();
  }

  async update(input: UpdatePersonaInput): Promise<PersonaRecord> {
    const startedAt = performance.now();
    this.assertMutable(input.id);
    const existing = await this.requireLive(input.id);
    if (existing.revision !== input.expectedRevision) {
      throw new StalePersonaRevisionError(input.id, input.expectedRevision, existing.revision);
    }

    const displayName =
      input.displayName === undefined
        ? existing.displayName
        : validateDisplayName(input.displayName, this.limits);
    if (displayName.toLowerCase() !== existing.displayName.toLowerCase()) {
      if (await this.store.getByName(displayName)) throw new PersonaConflictError(displayName);
    }

    const description =
      input.description === undefined
        ? existing.description
        : validateDescription(input.description, this.limits);
    const definition =
      input.definition === undefined
        ? existing.definition
        : validateDefinition(input.definition, this.limits);

    const plan = await this.planWrapperChange(existing, definition);

    const updated: PersonaRecord = {
      ...existing,
      displayName,
      description,
      definition,
      ...(plan.kind === "set" ? { contextWrapperId: plan.wrapper.id, contextWrapperRevision: plan.wrapper.revision } : {}),
      revision: existing.revision + 1,
      definitionDigest: digestPersonaDefinition(definition),
      updatedAt: this.clock.now()
    };
    if (plan.kind === "cleared") {
      delete (updated as { contextWrapperId?: string }).contextWrapperId;
      delete (updated as { contextWrapperRevision?: number }).contextWrapperRevision;
    }

    if (!(await this.store.update(updated, input.expectedRevision))) {
      // The persona row lost its revision race. A wrapper freshly declared just
      // above for this attempt is now unreferenced — it is never adopted by any
      // record, so it is simply abandoned rather than repaired; the caller
      // retries the whole operation against fresh state, and any *previous*
      // wrapper (if this was a swap or removal) is untouched and still valid.
      if (plan.kind === "set") {
        this.deps.logger.warn("persona.wrapper.orphaned", {
          personaId: existing.id,
          wrapperId: plan.wrapper.id,
          reason: "persona update lost its revision race after the wrapper was declared"
        });
      }
      const current = await this.store.get(input.id);
      if (!current) throw new PersonaNotFoundError(input.id);
      throw new StalePersonaRevisionError(input.id, input.expectedRevision, current.revision);
    }

    if (plan.kind === "set" && plan.previousWrapperId) {
      await this.deleteWrapperBestEffort(existing.id, plan.previousWrapperId);
    } else if (plan.kind === "cleared") {
      await this.deleteWrapperBestEffort(existing.id, plan.previousWrapperId);
    }

    this.deps.logger.info("persona.update", {
      personaId: updated.id,
      revision: updated.revision,
      definitionDigest: updated.definitionDigest,
      digestChanged: updated.definitionDigest !== existing.definitionDigest,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return updated;
  }

  /**
   * Decide what the persona's private wrapper should become for the incoming
   * definition, declaring a fresh wrapper up front when one is needed.
   *
   * A changed or newly-added context is never applied by mutating the existing
   * wrapper in place — a brand-new wrapper is declared instead (declare() always
   * starts at revision 1, so this step can never itself go stale). The persona's
   * own CAS write, made by the caller right after this returns, is what decides
   * whether the new wrapper takes effect; the old wrapper (if any) is only
   * deleted once that CAS has committed. If the CAS is lost, the freshly
   * declared wrapper here is simply abandoned as a harmless orphan and the
   * caller retries the whole operation against fresh state — the old wrapper,
   * untouched, is still exactly what the (unchanged) persona record points at.
   * This ordering is what keeps a lost race from ever leaving the persona
   * record pointing at a stale or missing wrapper (see docs/invariants.md).
   */
  private async planWrapperChange(
    existing: PersonaRecord,
    definition: PersonaDefinition
  ): Promise<
    | { kind: "unchanged" }
    | { kind: "cleared"; previousWrapperId: string }
    | { kind: "set"; wrapper: { id: string; revision: number }; previousWrapperId?: string }
  > {
    const before = existing.contextWrapperId;
    const beforeEntry = existing.definition.context;
    const after = definition.context;

    if (!before && !after) return { kind: "unchanged" };
    if (before && after && sameContextEntry(beforeEntry, after)) return { kind: "unchanged" };

    if (before && !after) {
      return { kind: "cleared", previousWrapperId: before };
    }

    const wrapper = await this.deps.context.declare(wrapperName(existing.id), [after as ContextEntry], {
      private: true,
      description: `Private scope wrapper for persona ${existing.displayName}`
    });
    this.deps.logger.info("persona.wrapper.declared", {
      personaId: existing.id,
      wrapperId: wrapper.id,
      revision: wrapper.revision
    });
    return before ? { kind: "set", wrapper, previousWrapperId: before } : { kind: "set", wrapper };
  }

  /** Best-effort cleanup of a wrapper that is no longer referenced by any
   *  persona record. A failure here does not undo or fail the mutation that
   *  already committed — it just leaves an inert, harmless orphan, logged so
   *  it is visible rather than silent. */
  private async deleteWrapperBestEffort(personaId: string, wrapperId: string): Promise<void> {
    try {
      await this.deps.context.delete(wrapperId);
      this.deps.logger.info("persona.wrapper.deleted", { personaId, wrapperId });
    } catch (error) {
      this.deps.logger.warn("persona.wrapper.orphaned", {
        personaId,
        wrapperId,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async delete(input: DeletePersonaInput): Promise<void> {
    const startedAt = performance.now();
    this.assertMutable(input.id);
    const existing = await this.requireLive(input.id);
    if (existing.revision !== input.expectedRevision) {
      throw new StalePersonaRevisionError(input.id, input.expectedRevision, existing.revision);
    }

    // Delete the owned wrapper first. A retry tolerates an already-absent
    // wrapper, so a failure between the two databases is recoverable and a
    // successful Persona deletion can never leave a live wrapper behind.
    if (existing.contextWrapperId) {
      try {
        await this.deps.context.delete(existing.contextWrapperId);
        this.deps.logger.info("persona.wrapper.deleted", {
          personaId: input.id,
          wrapperId: existing.contextWrapperId
        });
      } catch (error) {
        if (!(error instanceof Error && error.name === "ContextNotFoundError")) throw error;
      }
    }

    const deletedAt = this.clock.now();
    if (!(await this.store.delete(existing, input.expectedRevision, deletedAt))) {
      const current = await this.store.get(input.id);
      if (!current) throw new PersonaNotFoundError(input.id);
      throw new StalePersonaRevisionError(input.id, input.expectedRevision, current.revision);
    }

    this.deps.logger.info("persona.delete", {
      personaId: input.id,
      revision: existing.revision + 1,
      durationMs: Math.round(performance.now() - startedAt)
    });
  }

  async purge(input: PurgePersonaInput): Promise<void> {
    this.assertMutable(input.id);
    const snapshot = await this.store.latestSnapshot(input.id);
    if (snapshot?.contextWrapperId) {
      try {
        await this.deps.context.purge(snapshot.contextWrapperId);
      } catch (error) {
        if (!(error instanceof Error && error.name === "ResourceHistoryNotFoundError")) throw error;
      }
    }
    await this.store.purge(input.id);
    this.deps.logger.info("persona.purge", { personaId: input.id });
  }

  async pruneHistory(cutoff: string): Promise<number> {
    return this.store.pruneHistory(cutoff);
  }

  async purgeExpired(cutoff: string): Promise<number> {
    let count = 0;
    for (const id of await this.store.expiredDeleted(cutoff)) {
      await this.purge({ id });
      count += 1;
    }
    return count;
  }

  render(definition: PersonaDefinition, sections?: readonly PersonaSectionName[]): string {
    return renderPersona(definition, sections);
  }

  async resolve(id?: string, options?: PersonaResolveOptions): Promise<PersonaSnapshot> {
    const startedAt = performance.now();
    const isBuiltIn = id === undefined;
    const record = isBuiltIn ? BUILTIN_PERSONA : await this.get(id);
    if (!record) throw new PersonaNotFoundError(id as string);

    const sections = selectPersonaSections(record.definition, options?.sections);
    const prompt = renderPersona(record.definition, options?.sections);
    // The snapshot points at Persona's private wrapper, not the authored entry.
    // Consumers treat it as opaque and hand it to knowledge.resolveScope.
    const wrapperEntry: ContextEntry | undefined = record.contextWrapperId
      ? { id: record.contextWrapperId, kind: "context" }
      : undefined;

    const snapshot: PersonaSnapshot = {
      personaId: record.id,
      displayName: record.displayName,
      revision: record.revision,
      definition: record.definition,
      sections,
      prompt,
      ...(wrapperEntry ? { context: wrapperEntry } : {}),
      definitionDigest: record.definitionDigest,
      promptDigest: digestPrompt(prompt),
      frozenAt: this.clock.now()
    };

    this.deps.logger.debug("persona.resolve", {
      personaId: snapshot.personaId,
      revision: snapshot.revision,
      definitionDigest: snapshot.definitionDigest,
      promptDigest: snapshot.promptDigest,
      sectionCount: snapshot.sections.length,
      promptChars: prompt.length,
      hasContext: Boolean(wrapperEntry),
      isBuiltIn,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return snapshot;
  }
}

export const createPersonaCapability = (
  store: PersonaStore,
  dependencies: PersonaDependencies
): PersonaCapability => {
  dependencies.logger.info("persona.runtime.created", {});
  return new PersonaService(store, dependencies);
};
