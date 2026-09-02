// Every category the tree defines. Generated — do not edit.
//
//     pnpm category-keys
//
// `pnpm category-keys -- --check` fails when a file and the tree disagree,
// which is what stops a category naming something that is not there.

export type Category =
  | "agents"
  | "analysis"
  | "context-editor"
  | "document-editor"
  | "new-tab"
  | "project-overview"
  | "research"
  | "slide-deck-editor"
  | "spreadsheet-editor"
  | "templates";

export type ContentView =
  | "agents.automation"
  | "agents.library"
  | "agents.persona"
  | "agents.task"
  | "analysis.chart"
  | "document-editor.document"
  | "new-tab.launcher"
  | "project-overview.overview"
  | "research.thread"
  | "slide-deck-editor.deck"
  | "spreadsheet-editor.sheet"
  | "templates.editor"
  | "templates.library";
