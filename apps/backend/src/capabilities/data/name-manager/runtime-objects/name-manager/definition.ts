import { errorFields, type Logger } from "#observability";
import { NameManagerError } from "#name-manager/errors.js";
import { defineVariable } from "#name-manager/runtime-api/define/define.js";
import { getVariable } from "#name-manager/runtime-api/get/get.js";
import { listVariables } from "#name-manager/runtime-api/list/list.js";
import { requireVariable } from "#name-manager/runtime-api/require/require.js";
import type {
  NamedVariable,
  NamedVariableInput,
  VariableCatalog
} from "#name-manager/types/variables.js";

export interface NameManager {
  define(variable: NamedVariableInput): NamedVariable;
  get(name: string): NamedVariable | undefined;
  require(name: string): NamedVariable;
  list(): readonly NamedVariable[];
}

/**
 * Records one call: what it was asked for, and how it ended.
 *
 * Only names, shapes, and counts are recorded — never an authored value. A
 * catalog holds whatever an author put in it, and a log is copied, shipped, and
 * kept far longer than the data it describes.
 */
const record = <T>(
  logger: Logger,
  method: string,
  input: Record<string, unknown>,
  run: () => T,
  output: (result: T) => Record<string, unknown>
): T => {
  logger.debug(`name-manager.${method}.started`, input);

  try {
    const result = run();
    logger.debug(`name-manager.${method}.completed`, { ...input, ...output(result) });
    return result;
  } catch (error) {
    // An expected failure is a decision this capability made and states with a
    // code; anything else is a fault, and reads as one.
    if (error instanceof NameManagerError) {
      logger.warn(`name-manager.${method}.rejected`, { ...input, errorCode: error.code });
    } else {
      logger.error(`name-manager.${method}.failed`, { ...input, ...errorFields(error) });
    }
    throw error;
  }
};

export class InMemoryNameManager implements NameManager {
  private readonly variables: VariableCatalog = new Map();

  constructor(private readonly logger: Logger) {}

  define(input: NamedVariableInput): NamedVariable {
    return record(
      this.logger,
      "define",
      { name: input.name, kind: input.type.kind },
      () => defineVariable(this.variables, input),
      (variable) => ({ name: variable.name, catalogSize: this.variables.size })
    );
  }

  get(name: string): NamedVariable | undefined {
    return record(
      this.logger,
      "get",
      { name },
      () => getVariable(this.variables, name),
      (variable) => ({ found: variable !== undefined })
    );
  }

  require(name: string): NamedVariable {
    return record(
      this.logger,
      "require",
      { name },
      () => requireVariable(this.variables, name),
      (variable) => ({ name: variable.name })
    );
  }

  list(): readonly NamedVariable[] {
    return record(
      this.logger,
      "list",
      {},
      () => listVariables(this.variables),
      (variables) => ({ count: variables.length })
    );
  }
}
