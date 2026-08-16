import type { Doc } from "$convex/_generated/dataModel";
import type { Persona } from "$personas/types/persona";

/**
 * The stored row as the public shape.
 *
 * **`projectId` becomes `global`.** The caller is already scoped to one project,
 * so the id says nothing they do not know; whether this persona is theirs to
 * edit is the question a list actually has to answer.
 */
export const asPersona = (row: Doc<"personas">): Persona => ({
  id: row._id,
  name: row.name,
  description: row.description,
  definition: row.definition,
  scope: row.scope,
  modelBinding: row.modelBinding,
  tools: row.tools,
  avatar: row.avatar,
  global: row.projectId === undefined,
  createdBy: row.createdBy,
  revision: row.revision,
  updatedAt: row.updatedAt
});
