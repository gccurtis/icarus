/**
 * Every screen the workspace tree defines. Generated — do not edit.
 *
 *     pnpm view-state-keys
 *
 * A screen is a directory and a subscreen is a file:
 * `workspaces/agents/workspace-persona.svelte` is the `agents` screen's
 * `"persona"`.
 *
 * The panel vocabulary is not here. It is hand-written in `panel-keys.ts`,
 * because a panel that has not been built yet still has to be nameable.
 *
 * `pnpm view-state-keys -- --check` fails when this file and the tree
 * disagree, which is what stops a screen naming something that is not there.
 */

/** Every screen: one per directory under `workspaces/`. */
export const SCREENS = [
  "agents",
  "analysis",
  "document-editor",
  "new-tab",
  "project-overview",
  "research",
  "slide-deck-editor",
  "spreadsheet-editor",
  "templates"
] as const;

export type Screen = (typeof SCREENS)[number];

/**
 * What each screen can show in its centre, with the prefix its files carry
 * stripped: `workspace.svelte` is `"workspace"` and
 * `workspace-persona.svelte` is `"persona"`.
 *
 * `as const satisfies` rather than a plain annotation, so the members stay
 * literal — `Subscreen` is read back off this table — while a screen missing
 * from it still fails to compile.
 */
export const SUBSCREENS = {
  "agents": ["automation", "library", "persona", "task"],
  "analysis": ["workspace"],
  "document-editor": ["workspace"],
  "new-tab": ["workspace"],
  "project-overview": ["workspace"],
  "research": ["workspace"],
  "slide-deck-editor": ["workspace"],
  "spreadsheet-editor": ["workspace"],
  "templates": ["editor", "library"]
} as const satisfies Record<Screen, readonly string[]>;

export type Subscreen = (typeof SUBSCREENS)[Screen][number];

export const isScreen = (value: string): value is Screen =>
  (SCREENS as readonly string[]).includes(value);
