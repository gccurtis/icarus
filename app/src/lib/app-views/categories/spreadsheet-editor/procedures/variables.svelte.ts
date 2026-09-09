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
 * One project's variables, held so every lens can answer a name.
 *
 * A formula reaches a name while an edit is being applied, which is not a moment
 * that can wait for a request, so a project's list is loaded when its first sheet
 * opens and refreshed whenever this module changes it.
 *
 * Keyed by project, because a name is only unique inside one: two projects may
 * both hold `rate` and mean different numbers, and a single list would answer a
 * formula in one project with the other's value.
 */
type Held = {
  variables: readonly VariableRecord[];
  asked: boolean;
  /** Bumped on every change, so a sheet can answer its formulas again. */
  revision: number;
};

const projects = new Map<string, Held>();

const stateOf = (project: string): Held => {
  const seen = projects.get(project);
  if (seen !== undefined) return seen;
  const fresh = $state<Held>({ variables: [], asked: false, revision: 0 });
  projects.set(project, fresh);
  return fresh;
};

export const variables = (project: string): readonly VariableRecord[] => stateOf(project).variables;

export const variablesLoaded = (project: string): boolean => stateOf(project).asked;

export const variablesRevision = (project: string): number => stateOf(project).revision;

export const variableValue = (project: string, name: string): VariableValue | undefined =>
  stateOf(project).variables.find((variable) => variable.name.toLowerCase() === name.toLowerCase())
    ?.value;

export const loadVariables = async (project: string): Promise<void> => {
  const held = stateOf(project);
  try {
    const found = await readVariables({});
    held.variables = found.variables;
  } catch {
    held.variables = [];
  }
  held.asked = true;
  held.revision += 1;
};

export const saveVariable = async (
  project: string,
  input: SaveVariableInput
): Promise<SaveVariableResult> => {
  const answer = await saveRemotely(input);
  if (answer.saved) await loadVariables(project);
  return answer;
};

export const removeVariable = async (project: string, name: string): Promise<boolean> => {
  const answer = await removeRemotely({ name });
  if (answer.removed) await loadVariables(project);
  return answer.removed;
};
