import type { Id } from "$representation/data/types/core/id";

type Level = "low" | "medium" | "high";

/** What kind of model a persona wants — never which one. Nothing here names a model. */
export type Cast = { label: string; strength: Level; speed: Level };

/** A face. A union, so "no avatar" has one representation. */
export type PersonaAvatar =
  | { kind: "emoji"; emoji: string }
  | { kind: "image"; storageId: Id<"_storage"> };

/**
 * How a persona behaves, as five sections answering five questions: what is this
 * about, what do you already know, how should you work, what comes out, when are
 * you done.
 *
 * Five named fields rather than a list, because the set is closed.
 *
 * `background` is inline knowledge that is in the prompt on every call. It is
 * not `scope`, which is retrievable material that is never rendered.
 */
export type PersonaDefinition = {
  focus: string;
  background: string;
  approach: string;
  outputPreferences: string;
  verification: string;
};
