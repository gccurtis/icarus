// Every category the tree defines. Generated — do not edit.
//
//     pnpm category-keys
//
// `pnpm category-keys -- --check` fails when a file and the tree disagree,
// which is what stops a category naming something that is not there.
import type { Category, Subscreen } from "$representation/data/types/workspace/categories";

export const CATEGORIES = [
  "agents",
  "analysis",
  "context-editor",
  "document-editor",
  "new-tab",
  "project-overview",
  "research",
  "slide-deck-editor",
  "spreadsheet-editor",
  "templates"
] as const satisfies readonly Category[];

export const SUBSCREENS = {
  "agents": ["automation", "library", "persona", "task"],
  "analysis": ["chart"],
  "context-editor": [],
  "document-editor": ["document"],
  "new-tab": ["launcher"],
  "project-overview": ["overview"],
  "research": ["thread"],
  "slide-deck-editor": ["deck"],
  "spreadsheet-editor": ["sheet"],
  "templates": ["editor", "library"]
} as const satisfies Record<Category, readonly Subscreen[]>;

export const isCategory = (value: string): value is Category =>
  (CATEGORIES as readonly string[]).includes(value);
