import type { ResourceKind } from "$app-views/categories/project-overview/procedures/resources";

export const KIND_LABEL: Record<ResourceKind, string> = {
  document: "Document",
  presentation: "Presentation",
  spreadsheet: "Spreadsheet",
  research: "Research",
  analysis: "Analysis",
  file: "External file",
  finding: "Finding"
};

export const KIND_PLURAL: Record<ResourceKind, string> = {
  document: "Documents",
  presentation: "Presentations",
  spreadsheet: "Spreadsheets",
  research: "Research",
  analysis: "Analyses",
  file: "External Files",
  finding: "Findings"
};
