import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ProjectResourceKind } from "$capabilities/project/index.remote";
import { openingFor } from "$app-views/categories/project-overview/procedures/opening";

/** Offer an explicit action even when a resource has no standalone view yet. */
export const openInspectedResource = (
  view: WorkspaceStateModel,
  resource: { readonly kind: ProjectResourceKind; readonly id: string }
): void => {
  const target = openingFor(resource);
  if (target !== undefined) view.open(target);
  else alert("Opening a finding in its own view is not wired up yet.");
};
