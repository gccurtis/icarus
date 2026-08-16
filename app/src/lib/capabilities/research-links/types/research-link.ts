import { v, type Infer } from "convex/values";
import type { Id } from "$convex/_generated/dataModel";
import { ResearchLinksError } from "$research-links/errors";
import type { Actor } from "$shared/types/actor";

/**
 * What can bear on something, and what can be borne on.
 *
 * Two validators rather than one kind list, because the split *is* the
 * direction: bearers are the more specific object and subjects the more general,
 * running finding → hypothesis → question. A question is never a bearer and a
 * finding is never a subject, so the same relationship cannot be stored two ways
 * — which is the only reason a duplicate check on the pair means anything.
 */
export const linkBearerKindValidator = v.union(v.literal("finding"), v.literal("hypothesis"));

export type LinkBearerKind = Infer<typeof linkBearerKindValidator>;

export const linkSubjectKindValidator = v.union(v.literal("hypothesis"), v.literal("question"));

export type LinkSubjectKind = Infer<typeof linkSubjectKindValidator>;

/**
 * What the bearer says about its subject.
 *
 * `neutral` is not "unknown": it records that the evidence was assessed and
 * moves neither way, which an absent bearing would leave indistinguishable from
 * nobody having looked.
 */
export const linkBearingValidator = v.union(
  v.literal("supports"),
  v.literal("contradicts"),
  v.literal("neutral")
);

export type LinkBearing = Infer<typeof linkBearingValidator>;

/** The specific end: what bears on something. What `by_bearer` reads by. */
export type LinkBearer = {
  readonly bearerKind: LinkBearerKind;
  readonly bearerId: string;
};

/** The general end: what is borne on. What `by_subject` reads by. */
export type LinkSubject = {
  readonly subjectKind: LinkSubjectKind;
  readonly subjectId: string;
};

/**
 * One edge, as a read returns it.
 *
 * `at` is `_creationTime` rather than a stored column: there is no `rank`,
 * because ordering evidence is a view concern — and relevance, recency, and
 * bearing are all here to sort by without anybody maintaining a position.
 */
export type ResearchLink = LinkBearer &
  LinkSubject & {
    readonly id: Id<"researchLinks">;
    /** Findings only. */
    readonly bearing?: LinkBearing;
    readonly note?: string;
    readonly createdBy: Actor;
    readonly at: number;
  };

/** An edge as the person drawing it states it. */
export type NewLink = LinkBearer &
  LinkSubject & {
    readonly bearing?: LinkBearing;
    readonly note?: string;
  };

/**
 * Specific to general: the order that makes direction canonical.
 *
 * The rule is the whole legality table — a link is legal exactly when its bearer
 * sits strictly before its subject — so the three pairs are a consequence of one
 * statement rather than a list to keep in step with prose.
 */
const chain = ["finding", "hypothesis", "question"];

/**
 * The pairing checked before anything is written.
 *
 * The validators already exclude a question bearer and a finding subject; this
 * refuses them a step further in, along with the pairing they cannot express —
 * a hypothesis bearing on a hypothesis, where both kinds are legal and the pair
 * is not.
 *
 * Without canonical direction the same relationship could be stored two ways,
 * every read would query both directions and merge, and the duplicate check on
 * the pair would mean nothing.
 */
export const researchLinkPair = (bearerKind: LinkBearerKind, subjectKind: LinkSubjectKind): void => {
  const bearer = chain.indexOf(bearerKind);
  const subject = chain.indexOf(subjectKind);
  if (bearer === -1 || subject === -1 || bearer >= subject) {
    throw new ResearchLinksError(
      "illegal-pair",
      `A ${bearerKind} does not bear on a ${subjectKind}`
    );
  }
};

/** The set is read off the validator so the two cannot drift into disagreeing. */
const bearings = new Set<string>(linkBearingValidator.members.map((member) => member.value));

/**
 * The stored form of a bearing, which is `undefined` on every link but a
 * finding's.
 *
 * A hypothesis addressing a question is a proposal, not evidence: it has no
 * bearing to record, and one stored anyway would read as an assessment of the
 * hypothesis nothing here ever made.
 */
export const researchLinkBearing = (
  bearerKind: LinkBearerKind,
  bearing: LinkBearing | undefined
): LinkBearing | undefined => {
  if (bearing === undefined) return undefined;
  if (bearerKind !== "finding") {
    throw new ResearchLinksError(
      "bearing-not-evidence",
      `A ${bearerKind} proposes rather than evidences, so it bears no ${bearing}`
    );
  }
  if (!bearings.has(bearing)) {
    throw new ResearchLinksError("unknown-bearing", `A finding does not bear '${bearing}'`);
  }
  return bearing;
};

/**
 * The stored form of a note: a sentence of justification, or nothing.
 *
 * Blank is stored as absent rather than as `""`, which would make "this link
 * says why it exists" true of a link that says nothing.
 */
export const researchLinkNote = (note: string | undefined): string | undefined => {
  const trimmed = note?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};
