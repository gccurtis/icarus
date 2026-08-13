import { defineVariable } from "#data-manager/runtime-api/define/define.js";
import { getVariable } from "#data-manager/runtime-api/get/get.js";
import { listVariables } from "#data-manager/runtime-api/list/list.js";
import { requireVariable } from "#data-manager/runtime-api/require/require.js";
import type {
  NamedVariable,
  NamedVariableInput,
  VariableCatalog
} from "#data-manager/types/variables.js";

export interface DataManager {
  define(variable: NamedVariableInput): NamedVariable;
  get(name: string): NamedVariable | undefined;
  require(name: string): NamedVariable;
  list(): readonly NamedVariable[];
}

export class InMemoryDataManager implements DataManager {
  private readonly variables: VariableCatalog = new Map();

  define(input: NamedVariableInput): NamedVariable {
    return defineVariable(this.variables, input);
  }

  get(name: string): NamedVariable | undefined {
    return getVariable(this.variables, name);
  }

  require(name: string): NamedVariable {
    return requireVariable(this.variables, name);
  }

  list(): readonly NamedVariable[] {
    return listVariables(this.variables);
  }
}
