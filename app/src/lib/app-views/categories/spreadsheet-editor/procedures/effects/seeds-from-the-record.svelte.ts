/**
 * Fields that start from a record and then belong to whoever is typing.
 *
 * The seeding happens once per record rather than whenever the record changes,
 * because a save writes the record the fields came from and re-seeding there
 * would overwrite what is being edited with what was just sent.
 */
export const seedsFromTheRecord = <T extends { readonly id: string }>(
  record: () => T | undefined,
  seed: (held: T) => void
): void => {
  let seeded: string | undefined;

  $effect(() => {
    const held = record();
    if (held === undefined || seeded === held.id) return;

    seeded = held.id;
    seed(held);
  });
};
