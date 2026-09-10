import type { DocumentBody } from "$representation/data/types/documents/body";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { FileSubkind } from "$representation/data/types/external/file";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { MaterialSeed } from "$representation/data/types/semantic/material";
import type { NativeImageInput } from "$representation/data/types/semantic/material";
import type { SemanticResourceProjection } from "$representation/data/types/semantic/source";

export type ExternalFileIdentity = {
  fileId: Id<"externalFiles">;
  name: string;
  mediaType: string;
  subkind: FileSubkind;
  hash: string;
  semanticContext?: string;
  nativeImage?: NativeImageInput;
};

export type ExternalFileLookup = (id: Id<"externalFiles">) => ExternalFileIdentity | undefined;

export type ProjectResourceInput = {
  ref: ResourceRef;
  revision: number;
  title: string;
  externalFile?: ExternalFileLookup;
} & (
  | { kind: "document"; body: DocumentBody }
  | { kind: "slides"; body: SlideDeckBody }
);

export type ProjectSemanticProjection = {
  exact: SemanticResourceProjection;
  materials: MaterialSeed[];
};
