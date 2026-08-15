import type { PersistenceState } from "$model/server/persistence/definition";

/**
 * Closes every open database.
 *
 * Settles rather than races: one project failing to close must not leave the
 * others holding their directories, and shutdown reports the failures rather
 * than swallowing them. The first failure is usually the cause, so all of them
 * travel together in an `AggregateError` instead of one replacing another.
 */
export const close = async (state: PersistenceState): Promise<void> => {
  // `await pending` also surfaces a project that failed to *open*, so the
  // message below says "could not be closed" rather than blaming close.
  const closing = [...state.open.values()].map(async (pending) => {
    const project = await pending;
    await project.close();
  });
  state.open.clear();

  const results = await Promise.allSettled(closing);
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `${failures.length} project database(s) could not be closed`
    );
  }
};
