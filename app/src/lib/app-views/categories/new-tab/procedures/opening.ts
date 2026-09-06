import type { Target } from "$model/client/workspace-state";
import type { ResourceKind } from "$app-views/categories/new-tab/procedures/cast";
import { analysisFor, threadFor } from "$app-views/categories/new-tab/procedures/joins";

/**
 * Where a thing of a given kind is opened.
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
const EDITOR: Partial<Record<ResourceKind, Target["category"]>> = {
  document: "document-editor",
  slides: "slide-deck-editor",
  spreadsheet: "spreadsheet-editor"
};

export const openingFor = (
  kind: ResourceKind,
  id: string,
  name: string = id
): Target | undefined => {
  const editor = EDITOR[kind];
  if (editor) return { category: editor, resourceId: id };

  if (kind === "research") return { category: "research", resourceId: threadFor(name) ?? id };
  if (kind === "analysis") return { category: "analysis", resourceId: analysisFor(name) ?? id };
  if (kind === "template") return { category: "templates", content: "templates.editor", focus: id };

  return undefined;
};
