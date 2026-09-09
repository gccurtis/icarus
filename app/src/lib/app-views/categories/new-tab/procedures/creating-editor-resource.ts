import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ProjectResourceTarget } from "$capabilities/project-resources/index.remote";
import { createProjectResource } from "$app-views/categories/new-tab/procedures/creating";
import type { EditorKind } from "$app-views/categories/new-tab/procedures/library";
import { openingFor } from "$app-views/categories/new-tab/procedures/opening";

export type EditorCreation = {
  readonly view: WorkspaceStateModel;
  readonly kind: EditorKind;
  readonly busy: () => boolean;
  readonly began: (name: EditorKind["name"]) => void;
  readonly refused: (message: string | undefined) => void;
  readonly ended: () => void;
};

const targetOf = (kind: EditorKind): ProjectResourceTarget =>
  kind.name === "Document"
    ? "document"
    : kind.name === "Slide deck"
      ? "slides"
      : "spreadsheet";

/** Create a represented blank and open its editor if the person is still here. */
export const createsEditorResource = async (asked: EditorCreation): Promise<void> => {
  if (asked.busy()) return;

  const { view, kind } = asked;
  const originTabId = view.activeId;
  asked.began(kind.name);
  asked.refused(undefined);

  try {
    const target = targetOf(kind);
    const { resourceId } = await createProjectResource(view, { target });
    if (view.activeId !== originTabId) return;
    const opening = openingFor(target, resourceId);
    if (opening === undefined) throw new Error(`No editor owns '${target}'.`);
    view.open(opening);
  } catch (error) {
    asked.refused(error instanceof Error ? error.message : String(error));
  } finally {
    asked.ended();
  }
};
