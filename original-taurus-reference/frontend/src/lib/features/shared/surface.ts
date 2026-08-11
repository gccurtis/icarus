import { writable } from 'svelte/store';
import type { Component } from 'svelte';

/**
 * The surface-contribution store — how the active stage brings its own panel
 * sections to the shell rails (docs/archive/plans/2026-07-21-panel-system-design.md).
 *
 * An active surface's context sections REPLACE the project-context fallback so
 * each stage gets a relevant left rail. Inspector sections still LEAD the
 * permanent shell sections (the surface's "Details" lens comes first). A stage
 * publishes on mount/load and clears on destroy — one writer, like the editor
 * session. The shell renders contributed content blind; each implemented
 * section's component reads its own surface's session store.
 *
 * Workspace-ready constraints: section ids are stable, serializable strings —
 * they're what the workspace persistence stores. Components are carried only in
 * memory, never persisted.
 */
export type PanelSection = {
  /** Stable id, unique within its rail (persisted as the active section). */
  id: string;
  label: string;
  icon: Component;
  /** Rendered with no props; reads its surface's session store. */
  content?: Component;
  /** Honest holding copy for a view whose contents have not been defined yet. */
  placeholder?: string;
};

export type SurfaceContribution = {
  /** Stable id for the surface instance, e.g. `document:<docId>`. */
  id: string;
  /** Implicit-context label for the AI Agent panel, e.g. the document's name. */
  scope?: string;
  /** Complete left-rail section set, replacing the project-context fallback. */
  context?: PanelSection[];
  /** Sections leading the right rail (the surface's Details lens first). */
  inspector?: PanelSection[];
};

/** The active stage's contribution; null when no surface claims the rails. */
export const activeSurface = writable<SurfaceContribution | null>(null);
