import type { Id } from "$representation/data/types/core/id";

/**
 * A row id, taken as read.
 *
 * The only way to produce a branded `Id`, and deliberately unchecked: nothing
 * about a string says which table minted it, so this asserts rather than
 * validates. What makes an id trustworthy is where it came from — a store read,
 * or admission at a door — never its characters.
 */
export const asId = <Table extends string>(value: string): Id<Table> => value as Id<Table>;
