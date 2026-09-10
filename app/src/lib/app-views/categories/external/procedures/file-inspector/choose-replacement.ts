import { tick } from "svelte";

import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

type ReuploadForm = { readonly pending: number; submit(): Promise<unknown> };

export const chooseFileReplacement = async (
  state: ExternalFileInspectorState,
  input: HTMLInputElement,
  file: LibraryExternalFileDetail | undefined,
  reupload: ReuploadForm
): Promise<void> => {
  if ((input.files?.length ?? 0) !== 1 || file === undefined) return;
  state.actionError = undefined;
  state.actionNotice = undefined;
  await tick();
  await reupload.submit();
  input.value = "";
};
