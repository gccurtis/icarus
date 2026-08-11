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
