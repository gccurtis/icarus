import type { CommentActor } from "$capabilities/comments/index.remote";
import type {
  Comment,
  CommentThread,
  User
} from "$app-views/categories/slide-deck-editor/procedures/comments";

export const nameOf = (users: readonly User[], actor: CommentActor | undefined): string => {
  if (actor === undefined) return "Someone";
  if (actor.kind === "agent") return "An agent";
  if (actor.kind === "connector") return "A connector";
  if (actor.kind === "system") return "System";

  return users.find((user) => user._id === actor.userId)?.displayName ?? "Someone";
};

export const userIdOf = (actor: CommentActor | undefined): string | undefined =>
  actor?.kind === "user" ? actor.userId : undefined;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const ago = (at: number, now: number): string => {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return DAYS[new Date(at).getDay()];

  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const textOf = (remark: Comment): string => remark.text;

export const belongsToDeck = (
  thread: CommentThread,
  deckId: string | undefined
): boolean => thread.target.kind === "slides" && thread.target.id === deckId;
