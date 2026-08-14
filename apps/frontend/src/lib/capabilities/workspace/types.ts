/**
 * Workspace — what the shell remembers between sessions.
 *
 * Deliberately the lighter of the two capabilities. Session state dies with a
 * tab; workspace state outlives every tab, which is the test for what belongs
 * here. A user who sized the inspector once expects it sized in the next tab
 * too — the alternative makes panels jump on every switch, which the layout
 * laws forbid.
 *
 * These are *defaults learned from past actions*, not settings. Nothing here is
 * configured; a panel reports what the user did and the next one starts there.
 *
 * Most of this migrates to the panel capabilities once those exist. Workspace
 * keeps only what is genuinely cross-panel.
 */

export type WorkspaceDefaults = {
  /**
   * Pixels, and the **content portion only** — the context panel's icon rail is
   * structural, never resizes, and never collapses, so it is not part of this
   * number. The panel's total width is this plus RAIL_WIDTH. Storing the total
   * instead would oblige every consumer to remember to subtract the rail, which
   * is an off-by-44 waiting to happen.
   */
  contextWidth: number;
  contextCollapsed: boolean;
  /** Pixels. The inspector has no rail, so this is its whole width. */
  inspectorWidth: number;
  inspectorCollapsed: boolean;
};

export type WorkspaceRuntime = {
  readonly defaults: WorkspaceDefaults;
  /**
   * Record what the user just did, so the next panel opens that way.
   * Named for the intent rather than `set`: nothing here is a preference the
   * user configured, it is an observation of what they last chose.
   */
  remember(patch: Partial<WorkspaceDefaults>): void;
};
