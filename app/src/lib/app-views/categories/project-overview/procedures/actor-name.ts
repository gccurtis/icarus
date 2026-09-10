import {
  type CommentActor,
  type CommentPersonRecord
} from "$capabilities/comments/index.remote";

/**
 * What to call whoever did something.
 *
 * One `Actor`, four arms, three tables — and the fourth arm is the reason this
 * returns a string rather than a row: `system` has no id and no record anywhere,
 * so a caller that wanted the row could not be given one.
 */
export const actorName = (
  actor: CommentActor,
  people: readonly CommentPersonRecord[]
): string => {
  if (actor.kind === "system") return "Icarus";

  if (actor.kind === "user") {
    const row = people.find((candidate) => candidate._id === actor.userId);
    return row?.displayName ?? "Someone";
  }

  if (actor.kind === "connector") {
    return "A connector";
  }

  return "An agent";
};
