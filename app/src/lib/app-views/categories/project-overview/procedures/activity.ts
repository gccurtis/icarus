import type { ReadProjectHistoryResult } from "$capabilities/project/index.remote";
import { since } from "$app-views/categories/project-overview/procedures/rows";

export type Event = {
  readonly id: string;
  readonly at: string;
  readonly actor: string;
  readonly action: string;
  readonly subject: string;
};

/**
 * What has happened here, newest first.
 *
 * `actorLabel` is stored beside the actor and is what this reads: an event is a
 * record of a moment, so the name it carries is the one that was true then. A
 * renamed person does not rewrite what the feed says they did. Current activity
 * rows require the label; this projection neither repairs nor substitutes it.
 */
export const activity = (
  now: number,
  history: ReadProjectHistoryResult | undefined
): readonly Event[] =>
  (history?.entries ?? [])
    .map((event) => ({
      id: event.id,
      at: since(event.at, now),
      actor: event.actorLabel,
      action: event.action,
      subject: event.target.label
    }));
