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
  | "external"
  | "new-tab"
  | "presentation-editor"
  | "project-overview"
  | "research"
  | "spreadsheet-editor"
  | "templates";

export type ContentView =
  | "agents.automation"
  | "agents.library"
  | "agents.persona"
  | "agents.task"
  | "analysis.chart"
  | "context-editor.unavailable"
  | "document-editor.document"
  | "external.library"
  | "new-tab.launcher"
  | "presentation-editor.presentation"
  | "project-overview.overview"
  | "research.thread"
  | "spreadsheet-editor.sheet"
  | "templates.editor"
  | "templates.library";
