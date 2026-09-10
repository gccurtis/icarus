import { describe, expect, it } from "vitest";

import { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
import { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import { acceptUploadReceipt } from "$app-views/categories/external/procedures/accept-upload-receipt";
import { acceptFileReupload } from "$app-views/categories/external/procedures/file-inspector/accept-reupload";
import type {
  ReuploadExternalFileResult,
  UploadExternalFilesResult
} from "$capabilities/external-files/index.remote";

const uploadReceipt = (): UploadExternalFilesResult => ({
  outcomes: [],
  uploaded: 0,
  reused: 0,
  rejected: 0
});

const reuploadReceipt = (): ReuploadExternalFileResult => ({
  accepted: false,
  externalFileId: "externalFiles:one",
  reason: "not-found",
  revision: null,
  detail: "No file in this project has that id."
});

describe("External remote receipt identity", () => {
  it("handles equal consecutive upload responses as distinct submissions", () => {
    const state = new ExternalLibraryState();
    const first = uploadReceipt();
    const second = uploadReceipt();

    expect(acceptUploadReceipt(state, "files", first)).toBe(true);
    expect(acceptUploadReceipt(state, "files", first)).toBe(false);
    expect(acceptUploadReceipt(state, "files", second)).toBe(true);
  });

  it("handles equal consecutive re-upload responses as distinct submissions", () => {
    const state = new ExternalFileInspectorState();
    state.activeId = "externalFiles:one";
    const first = reuploadReceipt();
    const second = reuploadReceipt();

    acceptFileReupload(state, first);
    expect(state.handledReupload).toBe(first);
    acceptFileReupload(state, second);
    expect(state.handledReupload).toBe(second);
  });

  it("consumes a stale re-upload receipt without showing it for another file", () => {
    const state = new ExternalFileInspectorState();
    state.activeId = "externalFiles:two";
    const stale = reuploadReceipt();

    acceptFileReupload(state, stale);
    expect(state.handledReupload).toBe(stale);
    expect(state.actionError).toBeUndefined();
    expect(state.actionNotice).toBeUndefined();
  });
});
