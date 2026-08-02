// Persona runtime: catalog commands, queries, pure rendering, and snapshot freeze.

import { randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
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
    switch (command.type) {
      case "persona.create":
        return { type: "persona.created", record: await this.create(command.input) };
      case "persona.update":
        return { type: "persona.updated", record: await this.update(command.input) };
      case "persona.delete":
        await this.delete(command.input);
        return { type: "persona.deleted", personaId: command.input.id };
    }
  }

  async query(query: PersonaQuery): Promise<PersonaQueryResult> {
    switch (query.type) {
      case "persona.get": {
        const record = await this.get(query.id);
        if (!record) throw new PersonaNotFoundError(query.id);
        return { type: "persona.entry", record };
      }
      case "persona.getByName": {
        const record = await this.getByName(query.displayName);
        if (!record) throw new PersonaNotFoundError(query.displayName);
        return { type: "persona.entry", record };
      }
      case "persona.list":
        return { type: "persona.records", records: await this.list() };
      case "persona.render": {
        const definition = validateDefinition(query.definition, this.limits);
        const prompt = this.render(definition, query.sections);
        return {
          type: "persona.rendered",
          prompt,
          promptDigest: digestPrompt(prompt),
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
    await this.store.insert(record);

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

    const wrapper = await this.reconcileWrapper(existing, definition);

    const updated: PersonaRecord = {
      ...existing,
      displayName,
      description,
      definition,
      ...(wrapper ? { contextWrapperId: wrapper.id, contextWrapperRevision: wrapper.revision } : {}),
      revision: existing.revision + 1,
      definitionDigest: digestPersonaDefinition(definition),
      updatedAt: this.clock.now()
    };
    // reconcileWrapper returns undefined both when there is no wrapper and when it
    // was just removed, so the fields are stripped rather than spread away.
    if (!wrapper) {
      delete (updated as { contextWrapperId?: string }).contextWrapperId;
      delete (updated as { contextWrapperRevision?: number }).contextWrapperRevision;
    }

    if (!(await this.store.update(updated, input.expectedRevision))) {
      const current = await this.store.get(input.id);
      if (!current) throw new PersonaNotFoundError(input.id);
      throw new StalePersonaRevisionError(input.id, input.expectedRevision, current.revision);
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
   * Bring the private wrapper into line with the incoming definition.
   *
   * The wrapper id is stable for the life of the persona: a changed context
   * updates the same record rather than declaring a new one, so anything holding
   * the wrapper id keeps resolving.
   */
  private async reconcileWrapper(
    existing: PersonaRecord,
    definition: PersonaDefinition
  ): Promise<{ id: string; revision: number } | undefined> {
    const before = existing.contextWrapperId;
    const after = definition.context;

    if (!before && !after) return undefined;

    if (!before && after) {
      return this.deps.context.declare(wrapperName(existing.id), [after], {
        private: true,
        description: `Private scope wrapper for persona ${existing.displayName}`
      });
    }

    if (before && !after) {
      await this.deps.context.delete(before);
      return undefined;
    }

    return this.deps.context.update(
      before as string,
      [after as ContextEntry],
      existing.contextWrapperRevision ?? 1
    );
  }

  async delete(input: DeletePersonaInput): Promise<void> {
    const startedAt = performance.now();
    this.assertMutable(input.id);
    const existing = await this.requireLive(input.id);
    if (existing.revision !== input.expectedRevision) {
      throw new StalePersonaRevisionError(input.id, input.expectedRevision, existing.revision);
    }

    if (existing.contextWrapperId) {
      await this.deps.context.delete(existing.contextWrapperId);
    }

    if (!(await this.store.softDelete(input.id, input.expectedRevision, this.clock.now()))) {
      const current = await this.store.get(input.id);
      if (!current) throw new PersonaNotFoundError(input.id);
      throw new StalePersonaRevisionError(input.id, input.expectedRevision, current.revision);
    }

    this.deps.logger.info("persona.delete", {
      personaId: input.id,
      revision: existing.revision,
      durationMs: Math.round(performance.now() - startedAt)
    });
  }

  render(definition: PersonaDefinition, sections?: readonly PersonaSectionName[]): string {
    return renderPersona(definition, sections);
  }

  async resolve(id?: string, options?: PersonaResolveOptions): Promise<PersonaSnapshot> {
    const startedAt = performance.now();
    const record = id === undefined ? BUILTIN_PERSONA : await this.get(id);
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
      durationMs: Math.round(performance.now() - startedAt)
    });
    return snapshot;
  }
}

export const createPersonaCapability = (
  store: PersonaStore,
  dependencies: PersonaDependencies
): PersonaCapability => new PersonaService(store, dependencies);
