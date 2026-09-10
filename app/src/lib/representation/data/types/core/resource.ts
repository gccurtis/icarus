import type { Id } from "$representation/data/types/core/id";

/** The complete current taxonomy persisted on an external-file row. */
export type ExternalFileSubkind =
  | "text"
  | "code"
  | "data"
  | "image"
  | "audio"
  | "video"
  | "unknown";

/** An external-file reference always names the persisted file's exact current subkind. */
export type ExternalFileResourceKind = `externalFile::${ExternalFileSubkind}`;

/** The closed vocabulary that can identify one specific current resource. */
export type ResourceKind =
  | "document"
  | "slides"
  | "spreadsheet"
  | "research"
  | "finding"
  | "connection"
  | ExternalFileResourceKind;

/**
 * A kind selector may name the whole external-file family. Specific references
 * may not: their kind must carry the exact represented file subkind.
 */
export type ResourceSelectorKind = ResourceKind | "externalFile";

export type ExternalFileResourceRef = {
  kind: ExternalFileResourceKind;
  id: Id<"externalFiles">;
};

/** A specific current resource, with its discriminator tied to its row namespace. */
export type ResourceRef =
  | { kind: "document"; id: Id<"documents"> }
  | { kind: "slides"; id: Id<"slideDecks"> }
  | { kind: "spreadsheet"; id: Id<"spreadsheets"> }
  | { kind: "research"; id: Id<"researchThreads"> }
  | { kind: "finding"; id: Id<"findings"> }
  | { kind: "connection"; id: Id<"connectors"> }
  | ExternalFileResourceRef;
