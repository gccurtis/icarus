/**
 * Where a thing of a given kind is opened.
 *
 * The companion to [`naming`](naming.ts): that one answers what an id is called,
 * this one answers what to do when someone asks for it. Four surfaces ask — the
 * Overview's work table, the New Tab launcher, the resource lens and the recent
 * lens — and four copies of the branch is four places for one rule to be wrong.
 *
 * **A `Target` rather than a call.** Deciding where something opens and opening
 * it are different acts: a caller may want to know whether a kind is openable at
 * all, and a surface that only ever received a side effect could not ask.
 *
 * **`undefined` is a real answer.** A file, a finding, a connector and a Context
 * have no screen that holds them — they are things you look at in the inspector,
 * not places you go — and inventing a screen for them is how a launcher ends up
 * with a row that opens a blank plane.
 */
import type { ResourceKind } from "$capabilities/cast";
import { analysisFor, threadFor } from "$capabilities/joins";
import type { Target } from "$model/client/view-state";

/**
 * The screen a kind of body is edited in. Absent for the kinds no screen holds,
 * and for the two that a permanent tab shows rather than a tab of their own.
 */
const EDITOR: Partial<Record<ResourceKind, Target["screen"]>> = {
  document: "document-editor",
  slides: "slide-deck-editor",
  spreadsheet: "spreadsheet-editor"
};

/**
 * What opens this thing, or nothing where no screen holds its kind.
 *
 * `name` is what makes the [title joins](joins.ts) possible; a caller that has
 * only an id passes it as both, which is correct for every kind that is keyed by
 * the id it was given.
 */
export const openingFor = (
  kind: ResourceKind,
  id: string,
  name: string = id
): Target | undefined => {
  const editor = EDITOR[kind];
  if (editor) return { screen: editor, resourceId: id };

  // A thread and an analysis each earn a tab of their own; a template is a place
  // you return to, so that one moves a permanent tab onto the subject instead.
  if (kind === "research") return { screen: "research", resourceId: threadFor(name) ?? id };
  if (kind === "analysis") return { screen: "analysis", resourceId: analysisFor(name) ?? id };
  if (kind === "template") return { screen: "templates", subscreen: "editor", focus: id };

  return undefined;
};
