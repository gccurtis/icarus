import { v, type Infer } from "convex/values";

/**
 * The three resources that are *edited* — the ones a change set can name.
 *
 * **A closed union, unlike [`ResourceKind`](../../shared/types/resource.ts).**
 * That one is an open string because connectors and file types keep arriving and
 * a closed union would make every integration a schema change. This one is the
 * opposite question: a general resource is something with a body, an op
 * vocabulary, and an editor, and adding one is a substantial piece of work
 * rather than a configuration change. Closing it is what lets `BodyFor<T>`
 * resolve, `revisions.submit` narrow its argument, and a missing arm fail to
 * compile.
 *
 * The two are related but not the same set: every general resource type is also
 * a resource kind, and most resource kinds — `finding`, `connector`, `external`
 * — are not general resources, because nothing edits them through ops.
 *
 * Named `GeneralResourceType` rather than `ResourceType` so the contrast with
 * `ResourceKind` is visible at every use site. Two similarly-named types over
 * different spaces is how the open one ends up closed by accident.
 */
export const generalResourceTypeValidator = v.union(
  v.literal("document"),
  v.literal("slides"),
  v.literal("spreadsheet")
);

export type GeneralResourceType = Infer<typeof generalResourceTypeValidator>;

/**
 * The members, as a list.
 *
 * `shared` deliberately exports no such list for `ResourceKind`, on the grounds
 * that naming the members invites reading an open space as closed. Here the
 * space *is* closed, so the list is the truth rather than a snapshot of it — and
 * a register that has to iterate every editable type needs it.
 */
export const GENERAL_RESOURCE_TYPES = ["document", "slides", "spreadsheet"] as const;

/**
 * Which resource a change set is against.
 *
 * The type travels with the id for the same reason `ResourceRef` carries its
 * kind: a change set has to be routed without probing three tables to find out
 * what its id belongs to.
 *
 * `resourceId` is a plain `string`, not `Id<"documents">`, because the three
 * tables do not exist yet and a union of table ids would have to be loosened to
 * add the fourth. The table it names is `resourceType`'s to say.
 */
export const resourceKeyValidator = v.object({
  resourceType: generalResourceTypeValidator,
  resourceId: v.string()
});

export type ResourceKey = Infer<typeof resourceKeyValidator>;
