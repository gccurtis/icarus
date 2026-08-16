import { v, type Infer } from "convex/values";
import type { Id } from "$convex/_generated/dataModel";
import { ExternalFilesError } from "$external-files/errors";
import { fileKindValidator, type FileKind } from "$external-files/types/kind";
import type { Actor } from "$shared/types/actor";

/**
 * Where the bytes came from. A union rather than a flag, because the four cases
 * carry genuinely different data: a connector file keeps the provider's own id
 * so a re-sync matches it, a capture keeps the URL and the moment it was read.
 *
 * `connectorId` and `agentTaskId` are `v.string()` because `connectors` and
 * `agentTasks` do not exist until passes 8 and 7; each tightens to `v.id(...)`
 * in the task that creates its table.
 */
export const fileOriginValidator = v.union(
  v.object({ kind: v.literal("upload") }),
  v.object({
    kind: v.literal("connector"),
    connectorId: v.string(),
    externalId: v.string(),
    externalUrl: v.optional(v.string())
  }),
  v.object({ kind: v.literal("generated"), agentTaskId: v.string() }),
  v.object({ kind: v.literal("capture"), url: v.string(), capturedAt: v.number() })
);

export type FileOrigin = Infer<typeof fileOriginValidator>;

/**
 * What an extractor managed to read. **`unsupported` and `error` are ordinary
 * outcomes**, not failures — and a file with no extraction at all is still a
 * perfectly good file.
 */
export const extractionOutcomeValidator = v.object({
  state: v.union(
    v.literal("pending"),
    v.literal("ready"),
    v.literal("unsupported"),
    v.literal("error")
  ),
  text: v.optional(v.string()),
  pageCount: v.optional(v.number()),
  dimensions: v.optional(v.object({ width: v.number(), height: v.number() })),
  error: v.optional(v.string())
});

export type ExtractionOutcome = Infer<typeof extractionOutcomeValidator>;

/** `extractedAt` is stamped on receipt, not accepted: an extractor's clock is not evidence. */
export const fileExtractionValidator = v.object({
  ...extractionOutcomeValidator.fields,
  extractedAt: v.optional(v.number())
});

export type FileExtraction = Infer<typeof fileExtractionValidator>;

/**
 * A file as a list, a picker, or a block reference sees it.
 *
 * `origin` sits beside `createdBy` and the overlap is deliberate: `createdBy`
 * answers who put the file here, `origin` answers where the bytes came from and
 * carries the per-case data that answer needs.
 */
export type ExternalFile = {
  readonly id: Id<"externalFiles">;
  readonly storageId: Id<"_storage">;
  readonly name: string;
  readonly extension: string;
  readonly mimeType: string;
  readonly size: number;
  readonly kind: FileKind;
  readonly origin: FileOrigin;
  /** The file this one replaces. Bytes are immutable, so a version is a row. */
  readonly supersedes?: Id<"externalFiles">;
  readonly extraction?: FileExtraction;
  readonly createdBy: Actor;
  readonly updatedAt: number;
};

/**
 * The stored form of a name: trimmed, and never empty. A file is picked out of a
 * list by name, so a blank one is a row nobody can find again.
 */
export const fileName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ExternalFilesError("empty-name", "A file must have a name");
  }
  return trimmed;
};

/**
 * The origin, checked against who is recording it.
 *
 * **Uploads come from people.** An agent cannot upload a file from nowhere —
 * there is no source for it to upload from. What an agent can do is *produce*
 * one, and that is the `generated` case, pointing at the task that made it.
 */
export const originFrom = (by: Actor, origin: FileOrigin): FileOrigin => {
  if (origin.kind === "upload" && by.kind !== "user") {
    throw new ExternalFilesError(
      "upload-needs-user",
      `A ${by.kind} has no source to upload from; a file it produced is a generated origin`
    );
  }
  return origin;
};

/** Kinds there is something to read out of. The rest are stored and handed back. */
const READABLE: ReadonlySet<FileKind> = new Set<FileKind>([
  "ext-text",
  "ext-data",
  "ext-document",
  "ext-image"
]);

/**
 * What ingest queues, decided by kind — which is the routing decision `kind`
 * exists to make. Queuing an archive would leave a pending state nothing ever
 * completes.
 */
export const pendingExtraction = (kind: FileKind): FileExtraction | undefined =>
  READABLE.has(kind) ? { state: "pending" } : undefined;
