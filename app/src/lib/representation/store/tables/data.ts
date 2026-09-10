import type { Actor } from "$representation/data/types/core/actor";
import type { Id, Row } from "$representation/data/types/core/id";
import type { VariableType, VariableValue } from "$representation/data/types/content/variable-value";
import type { BackReferenceTargetKind } from "$representation/data/types/data/back-reference";
import type { FormulaUse } from "$representation/data/types/data/formula-use";

export type FormulaFields = {
  projectId: Id<"projects">;
  representation: string;
  usedBy: FormulaUse[];
  updatedAt: number;
};
export type Formula = Row<"formulas"> & FormulaFields;

export type DataBackReferenceFields = {
  projectId: Id<"projects">;
  formulaId: Id<"formulas">;
  targetKind: BackReferenceTargetKind;
  target: string;
  to?: string;
  updatedAt: number;
};
export type DataBackReference = Row<"dataBackReferences"> & DataBackReferenceFields;

export type VariableFields = {
  projectId: Id<"projects">;
  name: string;
  value: VariableValue;
  type: VariableType;
  description?: string;
  createdBy: Actor;
  updatedAt: number;
};
export type Variable = Row<"variables"> & VariableFields;
