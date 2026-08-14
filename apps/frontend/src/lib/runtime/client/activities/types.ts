import type { Component } from "svelte";

/**
 * Activities — the map. What the context panel's rail offers for whatever the
 * active tab holds, and which of them that tab chose.
 *
 * Named for what it is rather than for the panel it drives. It was `context`,
 * which collided with Svelte's own `getContext` and, once panel geometry moved
 * out to the components, no longer described anything but this projection.
 */

export type ActivityId = string;

export type Activity = {
  /**
   * Stable identity. Separate from `label` because the label is display copy:
   * rewording or translating it must not change what a tab points at.
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

export type ActivitiesRuntime = {
  /** Activities for the active tab's resource kind. Static per kind. */
  readonly available: readonly Activity[];
  /** The tab's remembered activity, or the kind's first when none is valid. */
  readonly active: Activity;
  /** Records the choice on the active tab, so each keeps its own rail position. */
  select(id: ActivityId): void;
};
