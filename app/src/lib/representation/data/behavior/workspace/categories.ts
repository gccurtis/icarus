// Every category the tree defines. Generated — do not edit.
//
//     pnpm category-keys
//
// `pnpm category-keys -- --check` fails when a file and the tree disagree,
// which is what stops a category naming something that is not there.
import type { Category, ContentView } from "$representation/data/types/workspace/categories";

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

export const CONTENT_VIEWS = [
  "agents.automation",
  "agents.library",
  "agents.persona",
  "agents.task",
  "analysis.chart",
  "document-editor.document",
  "new-tab.launcher",
  "project-overview.overview",
  "research.thread",
  "slide-deck-editor.deck",
  "spreadsheet-editor.sheet",
  "templates.editor",
  "templates.library"
] as const satisfies readonly ContentView[];

export const isCategory = (value: string): value is Category =>
  (CATEGORIES as readonly string[]).includes(value);

export const isContentView = (value: string): value is ContentView =>
  (CONTENT_VIEWS as readonly string[]).includes(value);
