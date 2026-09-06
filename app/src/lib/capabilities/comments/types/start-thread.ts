import type { AnchorWithin } from "$representation/data/types/collaboration/anchor";
import type { ResourceRef } from "$representation/data/types/core/resource";

export type StartThreadInput = {
  readonly target: ResourceRef;
  readonly within?: AnchorWithin;
  readonly quote?: string;
  readonly text: string;
};

export type StartThreadResult = {
  readonly threadId: string;
  readonly commentId: string;
};
