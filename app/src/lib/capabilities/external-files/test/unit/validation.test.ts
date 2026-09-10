import { describe, expect, it } from "vitest";

import {
  validateReadExternalFile,
  validateRelocateExternalFile,
  validateReuploadExternalFile,
  validateRenameExternalFile,
  validateUpdateExternalFileContext,
  validateUploadExternalFiles
} from "$capabilities/external-files/api/shared/validation";
import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import type { Configuration } from "$model/server/configuration/index.server";

describe("External capability input admission", () => {
  it("requires every current limit and never supplies a compatibility default", () => {
    const values = new Map<string, unknown>([
      ["externalFiles.upload.maxFiles", 10],
      ["externalFiles.upload.maxFileBytes", 1_000],
      ["externalFiles.upload.maxBatchBytes", 5_000],
      ["externalFiles.upload.maxPathBytes", 512],
      ["externalFiles.download.maxResponseBytes", 1_000]
    ]);
    const configuration = {
      get: (key: string) => values.get(key)
    } as Configuration;

    expect(externalFilesLimits(configuration)).toEqual({
      maxFiles: 10,
      maxFileBytes: 1_000,
      maxBatchBytes: 5_000,
      maxPathBytes: 512,
      maxResponseBytes: 1_000
    });

    for (const key of [...values.keys()]) {
      const current = values.get(key);
      values.delete(key);
      expect(() => externalFilesLimits(configuration)).toThrow(
        new RegExp(key.replaceAll(".", "\\."))
      );
      values.set(key, current);
    }
  });

  it("requires exact own fields instead of reading inherited or extra values", () => {
    const inherited = Object.create({ externalFileId: "externalFiles:one" });
    expect(() => validateReadExternalFile(inherited)).toThrow(/plain data object/);
    expect(() => validateReadExternalFile({
      externalFileId: "externalFiles:one",
      oldId: "one"
    })).toThrow(/unexpected field 'oldId'/);
    const hidden = { externalFileId: "externalFiles:one" };
    Object.defineProperty(hidden, "retired", { value: true });
    const symbolic = { externalFileId: "externalFiles:one" };
    Object.defineProperty(symbolic, Symbol("retired"), { value: true });
    const accessor = {} as Record<string, unknown>;
    Object.defineProperty(accessor, "externalFileId", {
      enumerable: true,
      get: () => "externalFiles:one"
    });
    expect(() => validateReadExternalFile(hidden)).toThrow(/unexpected field/);
    expect(() => validateReadExternalFile(symbolic)).toThrow(/unexpected field/);
    expect(() => validateReadExternalFile(accessor)).toThrow(/non-data shape/);
  });

  it("admits only real File values and one exact optional-path shape", () => {
    const file = new File(["body"], "note.txt", { type: "text/plain" });
    expect(validateUploadExternalFiles({ id: "files", files: [file] })).toEqual({
      id: "files",
      files: [file]
    });
    expect(() => validateUploadExternalFiles({
      id: "files",
      files: [file],
      relativePaths: undefined
    })).toThrow(/absent relativePaths is omitted/);
    expect(() => validateUploadExternalFiles({ id: "folder", files: [file] }))
      .toThrow(/folder requires one relative path/);
    expect(() => validateUploadExternalFiles({
      id: "folder",
      files: [file],
      relativePaths: [""]
    })).toThrow(/relativePaths aligns/);
    expect(() => validateUploadExternalFiles({
      id: "files",
      files: [{ name: "note.txt", type: "text/plain", size: 4, arrayBuffer: async () => new ArrayBuffer(4) }]
    })).toThrow(/File array/);
    expect(() => validateReuploadExternalFile({
      id: "reupload",
      externalFileId: "externalFiles:one",
      baseRevision: 1,
      file: new File(["body"], "note.txt ", { type: "text/plain" })
    })).toThrow(/canonical name/);
  });

  it("rejects decorated or accessor upload arrays without reading their elements", () => {
    const file = new File(["body"], "note.txt", { type: "text/plain" });
    const decorated = [file];
    Object.defineProperty(decorated, "retired", { value: true, enumerable: false });
    expect(() => validateUploadExternalFiles({ id: "files", files: decorated }))
      .toThrow(/File array/);

    let reads = 0;
    const accessor = [file];
    Object.defineProperty(accessor, "0", {
      enumerable: true,
      get: () => {
        reads += 1;
        return file;
      }
    });
    expect(() => validateUploadExternalFiles({ id: "files", files: accessor }))
      .toThrow(/File array/);
    expect(reads).toBe(0);

    const paths = ["folder/note.txt"];
    Object.defineProperty(paths, Symbol("retired"), { value: true });
    expect(() => validateUploadExternalFiles({
      id: "folder",
      files: [file],
      relativePaths: paths
    })).toThrow(/relativePaths aligns/);
  });

  it("rejects noncanonical authored mutation values instead of coercing them", () => {
    expect(() => validateRenameExternalFile({
      externalFileId: "externalFiles:one",
      baseRevision: 1,
      name: " note.txt "
    })).toThrow(/already canonical/);
    expect(() => validateRelocateExternalFile({
      externalFileId: "externalFiles:one",
      baseRevision: 1,
      destinationDirectory: "north\\reports"
    })).toThrow(/already canonical/);
    expect(() => validateUpdateExternalFileContext({
      externalFileId: "externalFiles:one",
      baseRevision: 1,
      semanticContext: " context "
    })).toThrow(/already canonical/);
  });
});
