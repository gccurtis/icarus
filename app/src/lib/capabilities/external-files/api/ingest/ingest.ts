import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { ActorLabel } from "$activity/types/activity";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { previousVersion } from "$external-files/api/ingest/previous-version";
import {
  fileName,
  originFrom,
  pendingExtraction,
  type FileOrigin
} from "$external-files/types/external-file";
import { extensionOf, kindForExtension } from "$external-files/types/kind";
import type { Actor } from "$shared/types/actor";

/** The bytes are already stored; this is everything we know about them. */
export type FileIngest = {
  readonly storageId: Id<"_storage">;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
  readonly origin: FileOrigin;
  /** The file this replaces, when the caller knows. A re-sync finds its own. */
  readonly supersedes?: Id<"externalFiles">;
};

/** How the file got here, as the log says it. */
const VERBS: Readonly<Record<FileOrigin["kind"], string>> = {
  upload: "uploaded",
  connector: "synced",
  generated: "generated",
  capture: "captured"
};

/**
 * Records a file that has arrived, whatever it is and wherever from.
 *
 * **`kind` and `extension` are derived from the name, never accepted.** Two
 * fields describing the same thing can disagree, and the one a caller sends is
 * the one that would be wrong. An extension nobody mapped is `ext-unknown` — a
 * file we cannot classify is still a file we keep.
 *
 * **The actor is a parameter, not an argument.** The door builds it from
 * `ctx.scope`, so a browser cannot sign someone else's name to a file; an agent
 * producing one calls this directly with its own. `byLabel` rides along for the
 * actor kinds `record` cannot resolve until their tables exist.
 */
export const ingest = async (
  ctx: MutationCtx,
  scope: Scope,
  by: Actor,
  input: FileIngest,
  byLabel?: ActorLabel
): Promise<Id<"externalFiles">> => {
  const name = fileName(input.name);
  const origin = originFrom(by, input.origin);
  const extension = extensionOf(name);
  const kind = kindForExtension(extension);
  const supersedes = await previousVersion(ctx, scope, origin, input.supersedes);

  const id = await ctx.db.insert("externalFiles", {
    projectId: scope.projectId,
    storageId: input.storageId,
    name,
    extension,
    mimeType: input.mimeType,
    size: input.size,
    kind,
    origin,
    supersedes,
    extraction: pendingExtraction(kind),
    createdBy: by,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    actorLabel: byLabel,
    verb: VERBS[origin.kind],
    target: { type: "externalFile", id, label: name }
  });

  return id;
};
