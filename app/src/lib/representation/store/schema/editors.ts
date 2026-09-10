import type { CurrentRowPolicies } from "$representation/store/schema/types";

const CHANGE_SET = {
  projectId: "required", resourceId: "required", revision: "required", baseRevision: "required",
  tier: "required", ops: "required", touched: "required", actor: "required", at: "required"
} as const;

const RESOURCE = {
  projectId: "required", title: "required", summary: "optional", createdBy: "required",
  updatedBy: "required", updatedAt: "required"
} as const;

const SNAPSHOT = {
  projectId: "required", resourceId: "required", revision: "required", role: "required",
  part: "required", body: "required", at: "required"
} as const;

export const EDITOR_ROW_POLICIES = {
  documentChangeSets: CHANGE_SET,
  documents: RESOURCE,
  documentSnapshots: SNAPSHOT,
  slideDeckChangeSets: CHANGE_SET,
  slideDecks: RESOURCE,
  slideDeckSnapshots: SNAPSHOT,
  spreadsheetChangeSets: CHANGE_SET,
  spreadsheets: RESOURCE,
  spreadsheetSnapshots: SNAPSHOT,
  sheetCells: {
    projectId: "required", resourceId: "required", rowOrder: "required", rowId: "required",
    columnId: "required", value: "required", expression: "optional", anchors: "optional",
    formulaId: "optional", failure: "optional", marks: "optional", format: "optional",
    mergedTo: "optional", spillTo: "optional"
  },
  formulas: {
    projectId: "required", representation: "required", usedBy: "required", updatedAt: "required"
  },
  dataBackReferences: {
    projectId: "required", formulaId: "required", targetKind: "required", target: "required",
    to: "optional", updatedAt: "required"
  },
  variables: {
    projectId: "required", name: "required", value: "required", type: "required",
    description: "optional", createdBy: "required", updatedAt: "required"
  },
  workspaceRevisions: {
    projectId: "required", userId: "required", revision: "required", baseRevision: "required",
    ops: "required", at: "required"
  },
  workspaceSnapshots: {
    projectId: "required", userId: "required", revision: "required", tabs: "required",
    activeId: "required", views: "required", at: "required"
  }
} satisfies Pick<
  CurrentRowPolicies,
  | "documentChangeSets"
  | "documents"
  | "documentSnapshots"
  | "slideDeckChangeSets"
  | "slideDecks"
  | "slideDeckSnapshots"
  | "spreadsheetChangeSets"
  | "spreadsheets"
  | "spreadsheetSnapshots"
  | "sheetCells"
  | "formulas"
  | "dataBackReferences"
  | "variables"
  | "workspaceRevisions"
  | "workspaceSnapshots"
>;
