import type { TextBlock } from "$representation/data/types/content/content-block";
import type { Actor } from "$representation/data/types/core/actor";
import type { Comment, User } from "$representation/store/tables";
import { mint } from "$app-views/categories/spreadsheet-editor/procedures/ids";

export type Remark = Comment;
export type Person = User;

export const nameOf = (users: readonly Person[], actor: Actor | undefined): string => {
  if (actor === undefined) return "Someone";
  if (actor.kind !== "user") return "An agent";
  return users.find((user) => user._id === actor.userId)?.displayName ?? "Someone";
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const ago = (at: number, now: number = Date.now()): string => {
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

export const textOf = (remark: Remark): string =>
  remark.blocks
    .map((block) => ("display" in block ? block.display : ""))
    .filter((text) => text.length > 0)
    .join("\n");

export const remarkBlock = (text: string): TextBlock => ({
  id: mint("block"),
  type: "text",
  variant: "paragraph",
  atoms: [{ id: mint("atom"), kind: "literal", text }],
  display: text,
  marks: []
});
