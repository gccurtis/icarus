import {
  createProjectResource as createProjectResourceRemote,
  readProjectResourceIndex,
  type CreateProjectResourceInput
} from "$capabilities/project-resources/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/**
 * Mint a represented resource before opening its editor.
 *
 * The resource table query is named explicitly because editor titles read that
 * table, not the project overview's merged index. Refreshing only the index
 * leaves a newly opened editor looking disconnected even though its row exists.
 */
export const createProjectResource = (
  view: WorkspaceStateModel,
  input: CreateProjectResourceInput
) => {
  const table = view.readStore(
    input.target === "document"
      ? "documents"
      : input.target === "slides"
        ? "slideDecks"
        : "spreadsheets"
  );
  return view.singleFlight(
    ["new-tab", view.project, "create", input.target, input.title?.trim() ?? null],
    async () => {
      const result = await createProjectResourceRemote(input).updates(readProjectResourceIndex);
      await table.refresh();
      return result;
    }
  );
};
