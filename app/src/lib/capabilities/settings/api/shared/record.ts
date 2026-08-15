import { errorFields, serverModel } from "$model/server/index.server";
import { SettingsError } from "$settings/errors";

/**
 * Records one call: what it was asked for, and how it ended.
 *
 * Called from inside each entry rather than wrapping them. A wrapper above a
 * procedure can be bypassed by anything that reaches the procedure directly; a
 * call inside it cannot. That mattered enough to delete the model object this
 * used to hang from — there is now no object left to reach past.
 *
 * The logger is resolved here rather than passed in, because it is one per
 * process and depends on nothing the caller knows. Only the database is scoped,
 * and only the database is a parameter.
 *
 * **Only names, shapes, and counts belong in `fields`.** A setting's key is an
 * identifier and is safe to record; its value is whatever someone stored, and a
 * log is copied, shipped, and retained far longer than the thing it describes.
 */
export const record = async <T>(
  operation: string,
  fields: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> => {
  const { logger } = serverModel().observability;

  logger.debug(`settings.${operation}.started`, fields);

  try {
    const result = await run();
    logger.debug(`settings.${operation}.completed`, fields);
    return result;
  } catch (error) {
    // A failure this capability chose and stated with a code is a decision;
    // anything else is a fault. Collapsing the two makes every ordinary
    // rejection read like a bug, and real bugs stop standing out.
    if (error instanceof SettingsError) {
      logger.warn(`settings.${operation}.rejected`, { ...fields, errorCode: error.code });
    } else {
      logger.error(`settings.${operation}.failed`, { ...fields, ...errorFields(error) });
    }
    throw error;
  }
};
