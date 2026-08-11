/**
 * Persona types — mirror Omega's `GET /personas` shape.
 *
 * A persona is a reusable, project-scoped AI voice/role. Omega returns each one
 * as a `{ persona, version }` pair: `persona` is the stable metadata, `version`
 * carries the current definition (behavioral guidance, focus, etc.). The UI
 * flattens both into a single `Persona` for display.
 */

/** The behavioral definition of a persona version (all fields optional/blank-able). */
export interface PersonaDefinition {
  focus?: string;
  behavioralGuidance?: string;
  contextReferences?: string[] | null;
  defaultVerification?: string;
  outputPreferences?: string;
}

/** Stable persona metadata (Omega `personas[].persona`). */
export interface PersonaMeta {
  id: string;
  projectId: string;
  name: string;
  description: string;
  currentVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** A persona version (Omega `personas[].version`). */
export interface PersonaVersion {
  personaId: string;
  projectId: string;
  version: number;
  definition: PersonaDefinition;
  createdBy?: string;
  createdAt?: string;
}

/** Raw `{ persona, version }` pair as returned by Omega. */
export interface PersonaEnvelope {
  persona: PersonaMeta;
  version: PersonaVersion;
}

/** Flattened persona for the picker/panel — metadata + current definition + default flag. */
export interface Persona {
  id: string;
  name: string;
  description: string;
  version: number;
  createdBy: string;
  definition: PersonaDefinition;
  /** True for the persona returned by `GET /personas/default`. */
  isDefault: boolean;
}

export type PersonasStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PersonasState {
  personas: Persona[];
  /** Id of the default persona (from `/personas/default`), or null if unknown. */
  defaultId: string | null;
  status: PersonasStatus;
  error: string | null;
}
