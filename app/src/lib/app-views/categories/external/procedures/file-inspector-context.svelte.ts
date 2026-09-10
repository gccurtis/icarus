import { getContext, setContext } from "svelte";

import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

const KEY = Symbol("external-file-inspector");

export type ExternalFileInspectorContext = {
  readonly file: () => LibraryExternalFileDetail;
};

export const provideExternalFileInspectorContext = (
  context: ExternalFileInspectorContext
): void => {
  setContext(KEY, context);
};

export const externalFileInspectorContext = (): ExternalFileInspectorContext =>
  getContext<ExternalFileInspectorContext>(KEY);
