import type { Component } from "svelte";

/**
 * Context — the map. It answers "where am I and what else is here?"
 *
 * The panel is a fixed icon rail plus a content view. The rail lists the
 * activities available for whatever the active session holds; the content view
 * is whichever activity is selected.
 */

export type ActivityId = string;

export type Activity = {
  /**
   * Stable identity. Separate from `label` because the label is display copy:
   * rewording it, or translating it, must not change what a session points at.
   */
  readonly id: ActivityId;
  /**
   * The rail's accessible name and its tooltip. Every rail item is icon-only,
   * and an icon never carries meaning alone.
   */
  readonly label: string;
  readonly icon: Component;
  readonly view: Component;
};

export type ContextRuntime = {
  /** Activities for the active session's resource kind. Static per kind. */
  readonly activities: readonly Activity[];
  /** The session's remembered activity, or the kind's first when none is valid. */
  readonly activeActivity: Activity;
  /** Records the choice on the active session, so each tab keeps its own rail. */
  select(id: ActivityId): void;

  /** Width of the content portion only — the rail is structural and never varies. */
  readonly contentWidth: number;
  readonly collapsed: boolean;
  /** Clamps within range; below the collapse threshold it collapses instead. */
  resize(width: number): void;
  /** Collapses to the rail, or restores the width the user last chose. */
  toggle(): void;
};
