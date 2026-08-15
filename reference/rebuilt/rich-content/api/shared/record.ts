import { errorFields, serverModel } from "$model/server/index.server";
import { RichContentError } from "$rich-content/errors";

/**
 * Records one call: what it was asked for, and how it ended.
 *
 * Called from inside each entry rather than wrapping them, because a wrapper
 * above a procedure can be bypassed and a call inside it cannot — and a
 * browser-reachable call that leaves no trace is the one most worth having a
 * record of.
 *
 * The logger is resolved here rather than passed in: there is one per process
 * and it depends on nothing the caller knows. Only the database is scoped, and
 * only the database is a parameter.
 *
 * Only names, shapes, and counts belong in `fields`. A log is copied, shipped,
 * and retained far longer than the data it describes, so authored values,
 * secrets, and personal fields stay out of it.
 */
export const record = async <T>(
  operation: string,
  fields: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> => {
  const { logger } = serverModel().observability;

  logger.debug(`rich-content.${operation}.started`, fields);

  try {
    const result = await run();
    logger.debug(`rich-content.${operation}.completed`, fields);
    return result;
  } catch (error) {
    // A failure this capability chose and stated with a code is a decision;
    // anything else is a fault. Collapsing the two makes every ordinary
    // rejection read like a bug, and real bugs stop standing out.
    if (error instanceof RichContentError) {
      logger.warn(`rich-content.${operation}.rejected`, { ...fields, errorCode: error.code });
    } else {
      logger.error(`rich-content.${operation}.failed`, { ...fields, ...errorFields(error) });
    }
    throw error;
  }
};
