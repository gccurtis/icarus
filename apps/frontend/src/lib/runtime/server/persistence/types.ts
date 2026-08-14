/**
 * The tables every capability owns, merged into one interface.
 *
 * A capability declares its own tables onto this from its `persistence/tables.ts`
 * using `declare module`, which is the one place the bare-alias import rule does
 * not apply: declaration merging must name the module that declares the
 * interface, not a door that re-exports it.
 *
 * Deliberately empty here. Keeping the shape at the runtime boundary lets every
 * capability share one typed client without moving table ownership out of the
 * capability that owns them.
 *
 * **No table on this interface carries a `project_id` column.** A project is its
 * own database, so scoping is structural — see the registry.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Database {}
