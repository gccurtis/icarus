import { defineSchema } from "convex/server";
import { settingsTables } from "$settings/schema";

/**
 * The deployment's schema, composed from one fragment per capability.
 *
 * This file owns the list and nothing else: a capability declares its own tables
 * in its own `schema.ts`, so adding one does not mean editing a file that
 * describes every other capability's storage.
 *
 * A spread is honest for one fragment. At two it becomes a compose that refuses
 * a duplicate table name — object spread lets a later fragment silently shadow an
 * earlier one, and silently is the problem: two capabilities claiming one table
 * should fail the push, not pick a winner by declaration order.
 */
export default defineSchema({
  ...settingsTables
});
