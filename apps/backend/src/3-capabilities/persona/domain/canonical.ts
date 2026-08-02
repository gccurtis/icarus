// Canonical serialisation and digests for Persona.
//
// A standalone copy owned by this capability, matching the house rule against
// premature type sharing. Document carries an equivalent helper; the two are
// deliberately independent so neither constrains the other's canonical form.

import { createHash } from "node:crypto";
import { PERSONA_SECTION_NAMES, type PersonaDefinition } from "./model.js";

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) sorted[key] = canonicalValue(item);
    }
    return sorted;
  }
  return value;
};

export const canonicalize = (value: unknown): Uint8Array =>
  Buffer.from(JSON.stringify(canonicalValue(value)), "utf8");

export const canonicalDigest = (value: unknown): string =>
  createHash("sha256").update(canonicalize(value)).digest("hex");

/**
 * Identity of a persona's behaviour.
 *
 * Covers exactly the five sections plus the authored context reference. It
 * excludes displayName and description on purpose: renaming a persona or editing
 * its catalog blurb bumps `revision` but leaves this digest alone, so the digest
 * keeps answering one question — did the behaviour change?
 *
 * It also excludes the private wrapper id, which is Persona's own bookkeeping and
 * would otherwise make two behaviourally identical personas digest differently.
 */
export const digestPersonaDefinition = (definition: PersonaDefinition): string => {
  const canonical: Record<string, unknown> = {};
  for (const section of PERSONA_SECTION_NAMES) {
    canonical[section] = definition[section];
  }
  if (definition.context) {
    canonical.context = { id: definition.context.id, kind: definition.context.kind };
  }
  return canonicalDigest(canonical);
};

/** Identity of the exact bytes a task received. */
export const digestPrompt = (prompt: string): string =>
  createHash("sha256").update(prompt, "utf8").digest("hex");
