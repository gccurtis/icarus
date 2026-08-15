import { createConfiguration } from "$model/server/configuration/index.server";
import { createObservability } from "$model/server/observability/index.server";
import type { ServerModel } from "$model/server/types";

/**
 * Composes the server graph once, in dependency order.
 *
 * Configuration first, because observability is built from it. Neither is
 * wrapped: a failure in either has nothing to log with, so it rejects to the
 * caller and fails startup at `hooks.server.ts`'s `init`.
 *
 * **There is no release path, and that is a fact about what the graph holds
 * rather than an omission.** Nothing is acquired after the last step that can
 * fail, so a failure has nothing to strand. Adding an object that acquires
 * something before a later step can throw means adding the release path with it.
 *
 * Directly callable, and called by exactly two things: the accessor in
 * `index.server.ts`, which holds the one instance, and a test that wants a whole
 * graph without one. Application code reaches the graph through the door.
 */
export const buildServerModel = async (): Promise<ServerModel> => {
  const configuration = await createConfiguration();
  const observability = createObservability(configuration);

  observability.logger.info("model.started");

  return {
    configuration,
    observability,
    close: () => observability.close()
  };
};
