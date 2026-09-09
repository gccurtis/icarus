import { getContext, setContext } from "svelte";

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

export type VariableRegister = {
  readonly records: readonly VariableRecord[];
  readonly loaded: boolean;
  readonly revision: number;
  readonly valueOf: (name: string) => VariableValue | undefined;
  readonly load: () => Promise<void>;
  readonly save: (input: SaveVariableInput) => Promise<SaveVariableResult>;
  readonly remove: (name: string) => Promise<boolean>;
};

/**
 * One project's variables, held so every lens can answer a name.
 *
 * A formula reaches a name while an edit is being applied, which is not a moment
 * that can wait for a request, so the list is loaded when the first sheet opens
 * and refreshed whenever this register changes it.
 *
 * One register per project rather than a module holding a map of them: a name is
 * only unique inside a project, and an instance somebody constructed can be
 * pointed at a test's project as easily as at the reader's.
 */
export const createVariableRegister = (): VariableRegister => {
  let records = $state<readonly VariableRecord[]>([]);
  let loaded = $state(false);
  let revision = $state(0);

  const load = async (): Promise<void> => {
    try {
      const found = await readVariables({});
      records = found.variables;
    } catch {
      records = [];
    }
    loaded = true;
    revision += 1;
  };

  return {
    get records(): readonly VariableRecord[] {
      return records;
    },
    get loaded(): boolean {
      return loaded;
    },
    get revision(): number {
      return revision;
    },
    valueOf: (name) =>
      records.find((variable) => variable.name.toLowerCase() === name.toLowerCase())?.value,
    load,
    save: async (input) => {
      const answer = await saveRemotely(input);
      if (answer.saved) await load();
      return answer;
    },
    remove: async (name) => {
      const answer = await removeRemotely({ name });
      if (answer.removed) await load();
      return answer.removed;
    }
  };
};

const REGISTER = Symbol("spreadsheet-editor.variables");

export const provideVariableRegister = (register: VariableRegister): VariableRegister =>
  setContext(REGISTER, register);

export const variableRegister = (): VariableRegister => {
  const held = getContext<VariableRegister | undefined>(REGISTER);
  if (held === undefined) {
    throw new Error(
      "No variable register was provided for this project. " +
        "See src/routes/app/[project]/+layout.svelte."
    );
  }
  return held;
};
