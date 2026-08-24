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
import type { ResourceKind } from "$mock-capabilities/cast";
import { analyses, threads } from "$mock-capabilities/library";
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
 * A row in the project's work names its subject; the screen behind it is keyed by
 * its own id, and the title is the only join the mock data carries.
 *
 * Making the join matters: without it a thread reached from the work table and
 * the same thread reached from the threads map would be two tabs.
 */
const threadFor = (name: string): string | undefined =>
  threads().current.find((row) => row.title === name)?.id;

const analysisFor = (name: string): string | undefined =>
  analyses().current.find((row) => row.name === name)?.id;

/**
 * What opens this thing, or nothing where no screen holds its kind.
 *
 * `name` is what makes the join above possible; a caller that has only an id
 * passes it as both, which is correct for every kind that is keyed by the id it
 * was given.
 */
export const openingFor = (
  kind: ResourceKind,
  id: string,
  name: string = id
): Target | undefined => {
  const editor = EDITOR[kind];
  if (editor) return { screen: editor, resourceId: id };

  // A thread earns a tab of its own; an analysis and a template are places you
  // return to, so those move a permanent tab onto the subject instead.
  if (kind === "research") return { screen: "research", resourceId: threadFor(name) ?? id };
  if (kind === "analysis") return { screen: "analysis", focus: analysisFor(name) ?? id };
  if (kind === "template") return { screen: "templates", subscreen: "editor", focus: id };

  return undefined;
};
