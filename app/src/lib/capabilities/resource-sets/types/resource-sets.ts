import type { ResourceSet } from "$representation/data/types/core/resource-set";

export type ResourceSetItem = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly set: ResourceSet;
  readonly createdByName: string;
  readonly revision: number;
  readonly updatedAt: number;
  readonly resolves: number;
};

export type ResourceSetUnavailable = {
  readonly setId: string;
  readonly reason: "corrupt";
  readonly detail: string;
};

export type ReadResourceSetsResult = {
  readonly sets: readonly ResourceSetItem[];
  readonly unavailable: readonly ResourceSetUnavailable[];
};

export type CreateResourceSetInput = {
  readonly name: string;
  readonly description?: string;
  readonly set: ResourceSet;
};

export type CreateResourceSetResult = {
  readonly accepted: true;
  readonly setId: string;
  readonly revision: 1;
};

export type UpdateResourceSetPatch = {
  readonly name?: string;
  readonly description?: string | null;
  readonly set?: ResourceSet;
};

export type UpdateResourceSetInput = {
  readonly setId: string;
  readonly baseRevision: number;
  readonly patch: UpdateResourceSetPatch;
};

export type UpdateResourceSetResult =
  | { readonly accepted: true; readonly setId: string; readonly revision: number }
  | {
      readonly accepted: false;
      readonly setId: string;
      readonly reason: "not-found" | "stale" | "corrupt";
      readonly revision: number | null;
      readonly detail: string;
    };

export type RemoveResourceSetInput = {
  readonly setId: string;
  readonly baseRevision: number;
};

export type RemoveResourceSetResult =
  | { readonly accepted: true; readonly setId: string; readonly revision: number }
  | {
      readonly accepted: false;
      readonly setId: string;
      readonly reason: "not-found" | "stale" | "in-use" | "corrupt";
      readonly revision: number | null;
      readonly detail: string;
    };
