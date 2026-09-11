import type { Target } from "$model/client/workspace-state";
import type { ProjectResourceKind } from "$capabilities/project-resources/index.remote";

/**
 * Where a thing of a given kind is opened.
 *
 * **A `Target` rather than a call.** Deciding where something opens and opening
 * it are different acts: a caller may want to know whether a kind is openable at
 * all, and a surface that only ever received a side effect could not ask.
 *
 * **`undefined` is a real answer.** It means no represented editor owns that
 * kind yet; callers can say so instead of opening a disconnected surface. A
 * file focuses its subject inside the stable External manager.
 */
const EDITOR: Partial<Record<ProjectResourceKind, Target["category"]>> = {
  document: "document-editor",
  presentation: "presentation-editor",
  spreadsheet: "spreadsheet-editor",
  research: "research"
};

export const openingFor = (
  kind: ProjectResourceKind,
  id: string
): Target | undefined => {
  const editor = EDITOR[kind];
  if (editor) return { category: editor, resourceId: id };

  if (kind === "file") return { category: "external", focus: id };

  return undefined;
};
