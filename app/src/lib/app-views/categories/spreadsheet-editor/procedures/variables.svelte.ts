import {
  readVariables,
  removeVariable as removeRemotely,
  saveVariable as saveRemotely,
  type SaveVariableInput,
  type SaveVariableResult,
  type VariableRecord
} from "$capabilities/variables/index.remote";
import type { VariableValue } from "$representation/data/types/content/variable-value";

export type { VariableRecord, SaveVariableInput, SaveVariableResult };

/**
 * The project's variables, held once for every lens that has to answer a name.
 *
 * A formula reaches a name while an edit is being applied, which is not a moment
 * that can wait for a request, so the list is loaded when a sheet opens and
 * refreshed whenever this module changes it.
 */
let held = $state<readonly VariableRecord[]>([]);
let asked = $state(false);

/**
 * Bumped whenever the list changes, so a sheet can answer its formulas again
 * without waiting for somebody to retype one.
 */
let revision = $state(0);

export const variables = (): readonly VariableRecord[] => held;

export const variablesLoaded = (): boolean => asked;

export const variablesRevision = (): number => revision;

export const variableValue = (name: string): VariableValue | undefined =>
  held.find((variable) => variable.name.toLowerCase() === name.toLowerCase())?.value;

export const loadVariables = async (): Promise<void> => {
  try {
    const found = await readVariables({});
    held = found.variables;
  } catch {
    held = [];
  }
  asked = true;
  revision += 1;
};

export const saveVariable = async (input: SaveVariableInput): Promise<SaveVariableResult> => {
  const answer = await saveRemotely(input);
  if (answer.saved) await loadVariables();
  return answer;
};

export const removeVariable = async (name: string): Promise<boolean> => {
  const answer = await removeRemotely({ name });
  if (answer.removed) await loadVariables();
  return answer.removed;
};
