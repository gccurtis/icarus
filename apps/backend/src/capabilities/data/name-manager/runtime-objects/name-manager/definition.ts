import { errorFields, type Logger } from "#observability";
import { NameManagerError } from "#name-manager/errors.js";
import type { NameManagerStore } from "#name-manager/persistence/store.js";
import { defineVariable } from "#name-manager/runtime-api/define/define.js";
import { getVariable } from "#name-manager/runtime-api/get/get.js";
import { listVariables } from "#name-manager/runtime-api/list/list.js";
import { requireVariable } from "#name-manager/runtime-api/require/require.js";
import type {
  NamedVariable,
  NamedVariableInput
} from "#name-manager/types/variables.js";

export interface NameManager {
  define(variable: NamedVariableInput): Promise<NamedVariable>;
  get(name: string): Promise<NamedVariable | undefined>;
  require(name: string): Promise<NamedVariable>;
  list(): Promise<readonly NamedVariable[]>;
}

/**
 * Records one call: what it was asked for, and how it ended.
 *
 * Only names, shapes, and counts are recorded — never an authored value. The
 * store holds whatever an author put in it, and a log is copied, shipped, and
 * kept far longer than the data it describes.
 */
const record = async <T>(
  logger: Logger,
  method: string,
  input: Record<string, unknown>,
  run: () => Promise<T>,
  output: (result: T) => Record<string, unknown>
): Promise<T> => {
  logger.debug(`name-manager.${method}.started`, input);

  try {
    const result = await run();
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

export class PersistedNameManager implements NameManager {
  constructor(
    private readonly store: NameManagerStore,
    private readonly logger: Logger
  ) {}

  define(input: NamedVariableInput): Promise<NamedVariable> {
    return record(
      this.logger,
      "define",
      { name: input.name, kind: input.type.kind },
      () => defineVariable(this.store, input),
      (variable) => ({ name: variable.name })
    );
  }

  get(name: string): Promise<NamedVariable | undefined> {
    return record(
      this.logger,
      "get",
      { name },
      () => getVariable(this.store, name),
      (variable) => ({ found: variable !== undefined })
    );
  }

  require(name: string): Promise<NamedVariable> {
    return record(
      this.logger,
      "require",
      { name },
      () => requireVariable(this.store, name),
      (variable) => ({ name: variable.name })
    );
  }

  list(): Promise<readonly NamedVariable[]> {
    return record(
      this.logger,
      "list",
      {},
      () => listVariables(this.store),
      (variables) => ({ count: variables.length })
    );
  }
}
