import { command, query } from "$app/server";

import { readVariables as readVariablesProcedure } from "$capabilities/variables/api/read-variables/read-variables";
import { removeVariable as removeVariableProcedure } from "$capabilities/variables/api/remove-variable/remove-variable";
import { saveVariable as saveVariableProcedure } from "$capabilities/variables/api/save-variable/save-variable";

export const readVariables = query("unchecked", readVariablesProcedure);
export const saveVariable = command("unchecked", saveVariableProcedure);
export const removeVariable = command("unchecked", removeVariableProcedure);

export type {
  ReadVariablesInput,
  ReadVariablesResult,
  RemoveVariableInput,
  RemoveVariableResult,
  SaveVariableInput,
  SaveVariableResult,
  VariableRecord
} from "$capabilities/variables/types/variables";
