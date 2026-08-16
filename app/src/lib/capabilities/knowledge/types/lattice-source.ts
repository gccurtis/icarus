import { v, type Infer } from "convex/values";
import type { ResourceKind } from "$shared/types/resource";

/**
 * What the lattice reads text out of.
 *
 * **A strict subset of [`ResourceKind`](../../shared/types/resource.ts), using
 * the same kind strings.** That is what makes scoping total: anything the
 * lattice indexes, a resource set can select, with no translation table between
 * the two vocabularies to drift.
 *
 * A template is a skeleton and a connector is configuration, so neither is a
 * source — both are resource kinds all the same, which is why the subset is
 * strict rather than equal.
 */
export const latticeSourceValidator = v.union(
  v.object({ kind: v.literal("document"), id: v.id("documents") }),
  v.object({ kind: v.literal("slides"), id: v.id("slideDecks") }),
  v.object({ kind: v.literal("spreadsheet"), id: v.id("spreadsheets") }),
  v.object({ kind: v.literal("externalFile"), id: v.id("externalFiles") }),
  v.object({ kind: v.literal("finding"), id: v.id("findings") })
);

export type LatticeSource = Infer<typeof latticeSourceValidator>;

/**
 * The subset relation, stated where the compiler can check it.
 *
 * `satisfies` fails the build if a kind is ever spelled differently here than in
 * `ResourceKind`; the runtime half — that every one of these is admitted there,
 * and which two are not sources — is asserted in
 * `test/unit/types/lattice-source.test.ts`.
 */
export const LATTICE_SOURCE_KINDS = [
  "document",
  "slides",
  "spreadsheet",
  "externalFile",
  "finding"
] as const satisfies readonly ResourceKind[];

/** A source's identity as one string, for a `tierSourceId` and for a window id. */
export const sourceKey = (source: LatticeSource): string => `${source.kind}:${source.id}`;
