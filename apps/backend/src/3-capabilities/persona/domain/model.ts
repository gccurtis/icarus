// Persona canonical types.
// ContextEntry is defined in knowledge/types.ts and re-exported by Context; Persona
// takes it from Context so the ownership story stays readable at call sites.

import type { ContextEntry } from "#context";

export type { ContextEntry };

/**
 * The five sections of a definition, in render order. This array is the single
 * source of that order — the renderer and the wire decoder both read it, so a
 * section cannot be added in one place and forgotten in the other.
 */
export const PERSONA_SECTION_NAMES = [
  "focus",
  "background",
  "approach",
  "outputPreferences",
  "verification"
] as const;

export type PersonaSectionName = (typeof PERSONA_SECTION_NAMES)[number];

/** Heading rendered above each section body. */
export const PERSONA_SECTION_HEADINGS = {
  focus: "Focus",
  background: "Background",
  approach: "Approach",
  outputPreferences: "Output",
  verification: "Verification"
} as const satisfies Record<PersonaSectionName, string>;

export interface PersonaDefinition {
  /** What to concentrate on, and what to deliberately leave alone. */
  readonly focus: string;
  /** Standing facts the task should assume without being told. */
  readonly background: string;
  /** How to work: method, rigour, standards, boundaries. */
  readonly approach: string;
  /** What the result should look like: shape, length, formatting, tone. */
  readonly outputPreferences: string;
  /** What to check before presenting the result as finished. */
  readonly verification: string;
  /** Optional reusable material this persona brings with it. */
  readonly context?: ContextEntry;
}

export interface PersonaRecord {
  readonly id: string;
  readonly displayName: string;
  /** Catalog blurb. Never rendered, never digested. */
  readonly description: string;
  readonly definition: PersonaDefinition;
  /**
   * Persona's own private Context record wrapping definition.context.
   * Present iff definition.context is present. Internal bookkeeping — never
   * returned in place of definition.context, and excluded from the digest
   * because it lives outside PersonaDefinition.
   */
  readonly contextWrapperId?: string;
  readonly contextWrapperRevision?: number;
  readonly revision: number;
  /** sha256 over the canonical definition. Answers: did the behaviour change? */
  readonly definitionDigest: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PersonaSnapshot {
  /** "builtin:default" for the fallback. */
  readonly personaId: string;
  readonly displayName: string;
  /** 0 for the built-in. */
  readonly revision: number;
  readonly definition: PersonaDefinition;
  /** Which sections were folded in, in render order. */
  readonly sections: readonly PersonaSectionName[];
  /** The exact rendered fragment. Carried so a pinned task replays without Persona. */
  readonly prompt: string;
  /** Persona's private wrapper record, not the entry the author authored. */
  readonly context?: ContextEntry;
  /** Identity of the persona's behaviour. Stable across section selection. */
  readonly definitionDigest: string;
  /** sha256 of the rendered bytes. Varies with section selection. */
  readonly promptDigest: string;
  readonly frozenAt: string;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

export interface CreatePersonaInput {
  readonly displayName: string;
  readonly description?: string;
  readonly definition: PersonaDefinition;
}

export interface UpdatePersonaInput {
  readonly id: string;
  readonly expectedRevision: number;
  readonly displayName?: string;
  readonly description?: string;
  /** Replaced wholesale, never field-patched. */
  readonly definition?: PersonaDefinition;
}

export interface DeletePersonaInput {
  readonly id: string;
  readonly expectedRevision: number;
}

export interface PurgePersonaInput {
  readonly id: string;
}

export type PersonaCommand =
  | { readonly type: "persona.create"; readonly input: CreatePersonaInput }
  | { readonly type: "persona.update"; readonly input: UpdatePersonaInput }
  | { readonly type: "persona.delete"; readonly input: DeletePersonaInput }
  | { readonly type: "persona.purge"; readonly input: PurgePersonaInput };

export type PersonaCommandResult =
  | { readonly type: "persona.created"; readonly record: PersonaRecord }
  | { readonly type: "persona.updated"; readonly record: PersonaRecord }
  | { readonly type: "persona.deleted"; readonly personaId: string; readonly revision: number }
  | { readonly type: "persona.purged"; readonly personaId: string };

// ─── Queries ──────────────────────────────────────────────────────────────────

export type PersonaQuery =
  | { readonly type: "persona.get"; readonly id: string }
  | { readonly type: "persona.getByName"; readonly displayName: string }
  | { readonly type: "persona.list" }
  | {
      readonly type: "persona.render";
      readonly definition: PersonaDefinition;
      readonly sections?: readonly PersonaSectionName[];
    };

export type PersonaQueryResult =
  | { readonly type: "persona.entry"; readonly record: PersonaRecord }
  | { readonly type: "persona.records"; readonly records: readonly PersonaRecord[] }
  | {
      readonly type: "persona.rendered";
      readonly prompt: string;
      readonly promptDigest: string;
      readonly sections: readonly PersonaSectionName[];
    };

export interface PersonaResolveOptions {
  /** Which sections this consumer folds in. Omitted means all five. */
  readonly sections?: readonly PersonaSectionName[];
}
