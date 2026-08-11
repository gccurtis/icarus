# src/lib/systems/personas/store.ts — breakdown

Companion to [store.ts](store.ts). The personas store — real project personas
from Omega, project-isolated, replacing the mock persona identities.

## Imports + fresh state

### Store imports, the module doc-comment, and the fresh-state factory

```ts
import { writable } from 'svelte/store';
import { api } from '$data/api';
import { workspace } from '$data/workspace';
import type { Persona, PersonaEnvelope, PersonasState } from './types';

/**
 * Personas store — real project personas from Omega's `GET /personas` +
 * `GET /personas/default`. Replaces the mock persona identities that used to
 * back the personas surface.
 *
 * Strict project isolation (design law, matches the ai-agent store): personas
 * are reset whenever the active project changes so one project's personas never
 * bleed into another's.
 */
function freshState(): PersonasState {
  return { personas: [], defaultId: null, status: 'idle', error: null };
}

export const personas = writable<PersonasState>(freshState());

```

The store is a single writable seeded to an empty `idle` state.

## Flatten helper

### Collapse the `{ persona, version }` envelope into the display shape

```ts
// Flatten Omega's `{ persona, version }` envelope into the display shape.
function flatten(env: PersonaEnvelope, defaultId: string | null): Persona {
  return {
    id: env.persona.id,
    name: env.persona.name,
    description: env.persona.description,
    version: env.version?.version ?? env.persona.currentVersion,
    createdBy: env.persona.createdBy,
    definition: env.version?.definition ?? {},
    isDefault: defaultId != null && env.persona.id === defaultId
  };
}

```

Collapses the two-part envelope into the flat `Persona`, defaulting the version
number to the metadata's `currentVersion` and marking `isDefault` by id.

## loadPersonas

### Load personas, resolve the default, and track load status

```ts
/**
 * Load the project's personas and mark the default. Idempotent-ish: safe to call
 * on panel mount; sets `status` so the UI can show loading/error states. The
 * default lookup is best-effort — a failure there still lists the personas.
 */
export async function loadPersonas(): Promise<void> {
  personas.update((s) => ({ ...s, status: 'loading', error: null }));
  try {
    // Resolve the default first so the list can flag it in one pass.
    let defaultId: string | null = null;
    try {
      const def = await api<{ persona: { id: string } }>('/personas/default');
      defaultId = def?.persona?.id ?? null;
    } catch {
      // No default configured (or endpoint failed) — list still loads unflagged.
    }

    const res = await api<{ personas: PersonaEnvelope[] }>('/personas');
    const list = (res.personas ?? []).map((env) => flatten(env, defaultId));
    personas.set({ personas: list, defaultId, status: 'ready', error: null });
  } catch (e) {
    const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Failed to load personas';
    personas.set({ personas: [], defaultId: null, status: 'error', error: message });
  }
}

```

Sets `loading`, resolves the default persona id (best-effort — a failed
`/personas/default` just leaves the list unflagged), then loads `/personas` and
flattens each envelope. On a fatal error it stores the message and an empty list
in the `error` state. `ApiError` carries `.message`; the guard narrows the
unknown catch value before reading it.

## Project isolation

### Reset the store whenever the active project changes

```ts
// Reset personas on project switch (strict isolation).
let watchedProject: string | null = null;
workspace.subscribe((ws) => {
  if (!ws) {
    watchedProject = null;
    return;
  }
  if (watchedProject !== ws.projectId) {
    watchedProject = ws.projectId;
    personas.set(freshState());
  }
});
```

Mirrors the ai-agent store: watches the workspace and resets to fresh (`idle`)
state whenever the active project id changes, so the next panel open re-fetches
for the new project.
