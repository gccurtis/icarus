import type { VariableType, VariableValue } from "$representation/data/types/content/variable-value";

/** One variable as anything outside this capability sees it. */
export type VariableRecord = {
  readonly id: string;
  readonly name: string;
  readonly value: VariableValue;
  readonly type: VariableType;
  readonly description?: string;
  readonly updatedAt: number;
};

export type ReadVariablesInput = Record<string, never>;

export type ReadVariablesResult = {
  readonly variables: readonly VariableRecord[];
};

export type SaveVariableInput = {
  readonly name: string;
  readonly value: VariableValue;
  readonly type: VariableType;
  readonly description?: string;
};

export type SaveVariableResult =
  | { readonly saved: true; readonly variable: VariableRecord }
  | { readonly saved: false; readonly reason: string };

export type RemoveVariableInput = {
  readonly name: string;
};

export type RemoveVariableResult = {
  readonly removed: boolean;
};
