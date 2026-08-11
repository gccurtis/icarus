# src/lib/systems/personas/types.ts — breakdown

Companion to [types.ts](types.ts). The persona types — a 1:1 mirror of Omega's
`GET /personas` shape plus a flattened `Persona` used by the UI.

## Doc comment

### Module doc-comment explaining the two-part envelope shape

```ts
/**
 * Persona types — mirror Omega's `GET /personas` shape.
 *
 * A persona is a reusable, project-scoped AI voice/role. Omega returns each one
 * as a `{ persona, version }` pair: `persona` is the stable metadata, `version`
 * carries the current definition (behavioral guidance, focus, etc.). The UI
 * flattens both into a single `Persona` for display.
 */

```

Explains the two-part `{ persona, version }` envelope Omega uses and why the UI
flattens it.

## The definition + envelope types

### PersonaDefinition, PersonaMeta, PersonaVersion, and the raw envelope

```ts
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

```

`PersonaDefinition` matches the verified server payload (`focus`,
`behavioralGuidance`, `contextReferences` — nullable, `defaultVerification`,
`outputPreferences`). `PersonaMeta`/`PersonaVersion` are the two halves of the
envelope; `PersonaEnvelope` is the raw list element.

## The flattened UI shape + store state

### The flattened Persona plus the store status and state types

```ts
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
```

`Persona` is what the panel/picker consume — the envelope collapsed into one
object with an `isDefault` flag. `PersonasState` is the store payload: the list,
the resolved default id, a load `status`, and an `error` message.
