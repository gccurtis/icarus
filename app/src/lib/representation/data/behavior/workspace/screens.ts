// Every screen the workspace tree defines. Generated — do not edit.
//
//     pnpm screen-keys
//
// `pnpm screen-keys -- --check` fails when a file and the tree disagree,
// which is what stops a screen naming something that is not there.
import type { Screen, Subscreen } from "$representation/data/types/workspace/screens";

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
] as const satisfies readonly Screen[];

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
} as const satisfies Record<Screen, readonly Subscreen[]>;

export const isScreen = (value: string): value is Screen =>
  (SCREENS as readonly string[]).includes(value);
