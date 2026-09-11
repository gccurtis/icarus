import { describe, expect, it } from "vitest";

import { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
import { chooseLibraryUpload } from "$app-views/categories/external/procedures/choose-library-upload";

describe("immediate External file upload", () => {
  it("clears the picker after a transport fault so the same file can be retried", async () => {
    const state = new ExternalLibraryState();
    const input = {
      files: [{ name: "notes.md", webkitRelativePath: "" }],
      value: "notes.md"
    } as unknown as HTMLInputElement;
    let paths: string[] = [];
    const failure = new Error("transport failed");

    await expect(chooseLibraryUpload(
      state,
      input,
      "files",
      (next) => (paths = next),
      { submit: async () => { throw failure; } }
    )).rejects.toBe(failure);

    expect(paths).toEqual(["notes.md"]);
    expect(input.value).toBe("");
  });
});
