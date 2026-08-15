import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * The one table Settings owns, as a fragment the deployment schema composes.
 *
 * The capability declares its own table and `src/convex/schema.ts` assembles the
 * set, so what a capability stores is decided in the capability rather than in a
 * file every capability has to edit.
 *
 * **`projectId` leads the index, and that is the whole of project isolation.**
 * One deployment holds every project, so a read that forgets the predicate reads
 * everyone's rows. Leading the index with it makes the scoped read the cheap one
 * and an unscoped read something you have to write on purpose.
 *
 * **`value` is a JSON string, not `v.any()`.** A setting value is recursive, and
 * a Convex validator is a value rather than a type, so there is no recursive one
 * to write. Storing the encoded form also keeps an author-controlled key space
 * out of Convex's field-name rules — `{"$schema": …}` is a legal setting and an
 * illegal field name. Nothing queries inside it, which is what makes the
 * encoding free.
 */
export const settingsTables = {
  settings: defineTable({
    projectId: v.id("projects"),
    key: v.string(),
    value: v.string(),
    updatedAt: v.number()
  }).index("by_project_and_key", ["projectId", "key"])
};
