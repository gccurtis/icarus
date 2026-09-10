/**
 * One initialization command per hook-module lifetime. SvelteKit can create a
 * new development Server after route invalidation while retaining that module.
 * Those callers must join its original startup, not construct a second graph.
 * A replaced hook owns a new command and waits for the outgoing graph's release.
 */
export const serverInitialization = (
  released: Promise<void> | undefined,
  initialize: () => Promise<unknown>
): (() => Promise<void>) => {
  let started: Promise<void> | undefined;
  return () => {
    started ??= (async () => {
      await released;
      await initialize();
    })();
    return started;
  };
};
