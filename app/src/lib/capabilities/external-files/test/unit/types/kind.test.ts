import { describe, expect, it } from "vitest";
import { extensionOf, fileKindValidator, kindForExtension } from "$external-files/types/kind";
import { resourceTypeValidator } from "$revisions/types/change";

/** Every row of the table in external-file.md, so a dropped row fails here. */
const MAPPING: Array<[string, string]> = [
  ["txt", "ext-text"],
  ["md", "ext-text"],
  ["rtf", "ext-text"],
  ["png", "ext-image"],
  ["jpg", "ext-image"],
  ["jpeg", "ext-image"],
  ["gif", "ext-image"],
  ["webp", "ext-image"],
  ["svg", "ext-image"],
  ["heic", "ext-image"],
  ["csv", "ext-data"],
  ["tsv", "ext-data"],
  ["json", "ext-data"],
  ["xlsx", "ext-data"],
  ["xls", "ext-data"],
  ["parquet", "ext-data"],
  ["pdf", "ext-document"],
  ["docx", "ext-document"],
  ["pptx", "ext-document"],
  ["odt", "ext-document"],
  ["mp3", "ext-audio"],
  ["wav", "ext-audio"],
  ["m4a", "ext-audio"],
  ["flac", "ext-audio"],
  ["mp4", "ext-video"],
  ["mov", "ext-video"],
  ["webm", "ext-video"],
  ["avi", "ext-video"],
  ["zip", "ext-archive"],
  ["tar", "ext-archive"],
  ["gz", "ext-archive"],
  ["7z", "ext-archive"]
];

describe("kindForExtension", () => {
  it.each(MAPPING)("classifies %s as %s", (extension, kind) => {
    expect(kindForExtension(extension)).toBe(kind);
  });

  /**
   * A file we cannot classify is still a perfectly good file: it is stored and
   * offered for download, and nothing else happens to it. Refusing it would
   * throw away bytes someone chose to keep.
   */
  it("keeps a file it cannot classify rather than refusing it", () => {
    expect(kindForExtension("dwg")).toBe("ext-unknown");
    expect(kindForExtension("")).toBe("ext-unknown");
  });

  it("classifies an extension however it was typed", () => {
    expect(kindForExtension("PNG")).toBe("ext-image");
  });
});

describe("extensionOf", () => {
  it("reads the extension off the name, lowercased and without the dot", () => {
    expect(extensionOf("Q3 forecast.XLSX")).toBe("xlsx");
  });

  it("reads the last segment, so a double extension is the one that names the format", () => {
    expect(extensionOf("logs.tar.gz")).toBe("gz");
  });

  it("gives a name with no extension nothing to classify on", () => {
    expect(extensionOf("README")).toBe("");
    expect(kindForExtension(extensionOf("README"))).toBe("ext-unknown");
  });
});

describe("the ext- namespace", () => {
  /**
   * A kind travels into resource sets, lattice sources, and comment anchors,
   * where it is matched against kinds from every other domain. `ext-document` is
   * an uploaded PDF and `document` is an Icarus document; a bare `document` in
   * both vocabularies would eventually be switched on as if it were one thing.
   *
   * The resource kinds are resource-set.md's `ResourceKind`. The three general
   * resources come from the validator that already states them; the rest are
   * named here until the tables that own them exist.
   */
  const resourceKinds = [
    ...resourceTypeValidator.members.map((member) => member.value),
    "externalFile",
    "finding",
    "connector",
    "template"
  ];

  it("collides with no resource kind", () => {
    for (const member of fileKindValidator.members) {
      expect(member.value.startsWith("ext-")).toBe(true);
      expect(resourceKinds).not.toContain(member.value);
    }
  });
});
