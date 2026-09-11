import { tick } from "svelte";

import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
import { receiveLibraryPicker } from "$app-views/categories/external/procedures/receive-library-picker";

type UploadForm = {
  submit(): Promise<unknown>;
};

/** Validate one browser picker result, publish its relative paths, and upload it immediately. */
export const chooseLibraryUpload = async (
  state: ExternalLibraryState,
  input: HTMLInputElement,
  picker: "files" | "folder",
  setRelativePaths: (paths: string[]) => void,
  upload: UploadForm
): Promise<void> => {
  if (!receiveLibraryPicker(state, input, picker, setRelativePaths)) return;
  await tick();
  try {
    await upload.submit();
  } finally {
    // Let a user retry the same file after either a refusal or a transport fault.
    input.value = "";
  }
};
