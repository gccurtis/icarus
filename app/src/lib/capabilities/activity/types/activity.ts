import { v, type Infer } from "convex/values";
import type { Actor } from "$shared/types/actor";

/**
 * The display form of whoever acted, frozen at write time.
 *
 * `kind` is `v.string()` rather than a union of the five actor kinds: it is a
 * rendering hint that mirrors `actor.kind`, and a second union would have to be
 * kept in step with the first for no gain — the reference is what code compares.
 */
export const actorLabelValidator = v.object({
  kind: v.string(),
  name: v.string(),
  /** Who asked for it. Agents only, per the model's resolution table. */
  onBehalfOf: v.optional(v.string()),
  detail: v.optional(v.string())
});

export type ActorLabel = Infer<typeof actorLabelValidator>;

/**
 * A thing an entry points at, carrying the name it had at the time.
 *
 * `type` and `id` are strings rather than a table union and `v.id`, because an
 * entry outlives its subject — a `v.id` names a row that a deletion is free to
 * remove, and the whole point of the label beside it is that the entry still
 * reads afterwards.
 */
export const referenceValidator = v.object({
  type: v.string(),
  id: v.string(),
  label: v.string()
});

export type Reference = Infer<typeof referenceValidator>;

/**
 * One thing that happened, as a reader sees it.
 *
 * No `projectId` and no row id: every entry a caller gets back is from the
 * project they asked about, so repeating it per entry says nothing, and there is
 * nothing to fetch an entry by — a log is read as a range, never by key.
 */
export type Activity = {
  readonly actor: Actor;
  readonly actorLabel: ActorLabel;
  readonly verb: string;
  readonly target: Reference;
  /** The containing thing, when the target has one — a comment's document. */
  readonly context?: Reference;
  readonly detail?: string;
  readonly at: number;
};

/**
 * What a capability hands `record`. It states what happened and not when.
 *
 * `actorLabel` is optional because `record` resolves the kinds it can reach —
 * and ignores one passed for those. It is supplied only for an actor whose table
 * does not exist yet, and each of those tasks moves its resolution into `record`.
 */
export type ActivityEntry = Omit<Activity, "at" | "actorLabel"> & {
  readonly actorLabel?: ActorLabel;
};
