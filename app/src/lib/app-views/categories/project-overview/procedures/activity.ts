import { actorName } from "$app-views/categories/project-overview/procedures/actor-name";
import { rowsIn, since } from "$app-views/categories/project-overview/procedures/rows";

export type Event = {
  readonly id: string;
  readonly at: string;
  readonly actor: string;
  readonly verb: string;
  readonly subject: string;
};

/**
 * What has happened here, newest first.
 *
 * `actorLabel` is stored beside the actor and is what this reads: an event is a
 * record of a moment, so the name it carries is the one that was true then. A
 * renamed person does not rewrite what the feed says they did — which is why
 * this one place does not go through `actorName`, and falls back to it only
 * where an older row was written without a label.
 */
export const activity = (projectId: string, now: number): readonly Event[] =>
  rowsIn("activity")
    .filter((event) => event.projectId === projectId)
    .slice()
    .sort((a, b) => b._creationTime - a._creationTime)
    .map((event) => ({
      id: event._id,
      at: since(event._creationTime, now),
      actor: event.actorLabel === "" ? actorName(event.actor) : event.actorLabel,
      verb: event.verb,
      subject: event.target.label
    }));
