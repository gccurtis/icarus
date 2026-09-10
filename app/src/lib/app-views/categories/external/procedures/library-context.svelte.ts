import { getContext, setContext } from "svelte";

import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
import type {
  LibraryExternalDirectory,
  LibraryExternalFile
} from "$app-views/categories/external/procedures/library-query";

const KEY = Symbol("external-library");

export type ExternalLibraryContext = {
  readonly state: ExternalLibraryState;
  readonly view: WorkspaceStateModel;
  readonly visibleFiles: () => readonly LibraryExternalFile[];
  readonly directDirectories: () => readonly LibraryExternalDirectory[];
};

export const provideExternalLibraryContext = (context: ExternalLibraryContext): void => {
  setContext(KEY, context);
};

export const externalLibraryContext = (): ExternalLibraryContext =>
  getContext<ExternalLibraryContext>(KEY);
