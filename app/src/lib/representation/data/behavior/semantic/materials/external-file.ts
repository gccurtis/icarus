import type { ImageBlock } from "$representation/data/types/content/content-block";
import type { MaterialSeed } from "$representation/data/types/semantic/material";
import { profileCsv } from "$representation/data/behavior/semantic/materials/csv";
import { codeLanguage, profileCode } from "$representation/data/behavior/semantic/materials/code";
import { profileImage } from "$representation/data/behavior/semantic/materials/profile";
import type { ExternalFileIdentity } from "$representation/data/behavior/semantic/projection/contract";
import { externalFileResourceKind } from "$representation/data/behavior/core/resource";

export const isCsvFile = (name: string, mediaType: string): boolean =>
  mediaType.toLowerCase().includes("csv") || /\.(csv|tsv)$/i.test(name);

const source = (file: ExternalFileIdentity) => ({
  kind: "externalFile" as const,
  /** Resource kinds follow the persisted file taxonomy; material.kind is more specific. */
  ref: { kind: externalFileResourceKind(file.subkind), id: file.fileId },
  fileId: file.fileId,
  hash: file.hash,
  mediaType: file.mediaType,
  subkind: file.subkind
});

/** Adapter called by the future upload boundary after authoritative bytes are stored. */
export const projectExternalFileMaterial = (
  file: ExternalFileIdentity,
  content?: string
): MaterialSeed | undefined => {
  const csv = isCsvFile(file.name, file.mediaType);
  if (csv && content !== undefined) return {
    identityKey: JSON.stringify(["csv", file.fileId, file.hash]),
    kind: "csv",
    name: file.name,
    source: source(file),
    profile: profileCsv(content).profile,
    context: { title: file.name, nearbyText: [], notes: [] }
  };
  const language = codeLanguage(file.name, file.mediaType);
  if (content !== undefined && language !== "unknown") return {
    identityKey: JSON.stringify(["code", file.fileId, file.hash]),
    kind: "code",
    name: file.name,
    source: source(file),
    profile: profileCode(content, file.name, file.mediaType),
    context: { title: file.name, nearbyText: [], notes: [] }
  };
  if (file.subkind === "image") {
    const block: ImageBlock = {
      id: file.fileId,
      type: "image",
      source: { kind: "file", fileId: file.fileId },
      alt: ""
    };
    return {
      identityKey: JSON.stringify(["image", file.fileId, file.hash]),
      kind: "image",
      name: file.name,
      source: source(file),
      profile: profileImage(block, file.hash, 0, file.mediaType),
      context: { title: file.name, nearbyText: [], notes: [] },
      ...(file.nativeImage === undefined ? {} : { nativeImage: file.nativeImage })
    };
  }
  return undefined;
};
