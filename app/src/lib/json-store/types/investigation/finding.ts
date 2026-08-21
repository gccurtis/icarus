import type { Id } from "$json-store/types/core/id";
import type { ResourceRef } from "$json-store/types/core/resource";

/**
 * Where something came from, and what it said when it was read.
 *
 * Each variant carries its own copy: pages change and get taken down, and a
 * citation that is only a pointer degrades into an unfalsifiable claim the
 * moment its target moves.
 *
 * `manual` exists so a finding can cite a conversation or prior knowledge rather
 * than being forced into a fake URL.
 */
export type FindingSource =
  | { kind: "resource"; ref: ResourceRef; locator?: string; excerpt?: string }
  | {
      kind: "url";
      url: string;
      title?: string;
      excerpt?: string;
      /** Required: an excerpt with no date is a copy of nothing in particular. */
      capturedAt: number;
    }
  | { kind: "message"; threadId: Id<"threads">; messageId: string; excerpt?: string }
  | { kind: "manual"; note: string };
