import type { WorkspaceDefaults, WorkspaceRuntime } from "$lib/capabilities/workspace/types";

/**
 * The workspace runtime — a singleton, for the same reason the session runtime
 * is one: several zones read the same values and must agree.
 *
 * Safe as module-level state *only because the app runs with `ssr = false`*.
 * See the note in capabilities/session/session.svelte.ts — the hazard is
 * identical and it is a real one.
 *
 * Nothing here is persisted yet. When it is, this object is the seam: a
 * snapshot in at construction, a subscription out. Deliberately not built now.
 */

/**
 * Seeded from --shell-panel (320px), restated here because CSS custom
 * properties are not readable from a module without touching the DOM. The two
 * can drift; if they do, the stylesheet is right and this is wrong, because the
 * shell paints before this runtime is ever consulted.
 *
 * contextWidth is 320 minus the 44px rail, because it measures the content
 * portion alone. The inspector has no rail, so it takes the full 320.
 */
const INITIAL: WorkspaceDefaults = {
  contextWidth: 276,
  contextCollapsed: false,
  inspectorWidth: 320,
  inspectorCollapsed: false,
};

class Workspace implements WorkspaceRuntime {
  #defaults = $state<WorkspaceDefaults>({ ...INITIAL });

  get defaults(): WorkspaceDefaults {
    return this.#defaults;
  }

  remember(patch: Partial<WorkspaceDefaults>): void {
    this.#defaults = { ...this.#defaults, ...patch };
  }
}

export const workspace: WorkspaceRuntime = new Workspace();
