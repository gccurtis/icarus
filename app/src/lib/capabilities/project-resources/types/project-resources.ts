import type { ResourceRef } from "$representation/data/types/core/resource";

export type ProjectResourceKind =
  | "document"
  | "presentation"
  | "spreadsheet"
  | "research"
  | "file"
  | "finding";

/** A closed metadata projection; represented bodies and storage fields never cross this door. */
export type ProjectResourceIndexItem = {
  readonly id: string;
  /** Exact represented identity; `kind` below is presentation taxonomy only. */
  readonly ref: ResourceRef;
  readonly kind: ProjectResourceKind;
  readonly name: string;
  /** Exact External location; null for resources that do not live in External. */
  readonly relativePath: string | null;
  readonly updatedAt: number;
  /** Null when the exact historical actor is no longer inspectable in this project. */
  readonly updatedByName: string | null;
};

export type ProjectResourceUnavailable = {
  readonly resourceId: string;
  readonly kind: ProjectResourceKind;
  readonly reason: "corrupt";
  readonly detail: string;
};

/** The listable resource metadata for the resolved project. */
export type ProjectResourceIndex = {
  readonly resources: readonly ProjectResourceIndexItem[];
  readonly unavailable: readonly ProjectResourceUnavailable[];
};

export type ProjectResourceTarget = "document" | "presentation" | "spreadsheet";

export type CreateProjectResourceInput = {
  readonly target: ProjectResourceTarget;
  /** Omit to have the server allocate the next project-local Untitled suffix. */
  readonly title?: string;
};

export type CreateProjectResourceResult = {
  readonly accepted: true;
  readonly target: ProjectResourceTarget;
  readonly resourceId: string;
  readonly title: string;
  readonly revision: 0;
};

export type RenameProjectResourceInput = {
  readonly resourceId: string;
  readonly title: string;
};

export type RenameProjectResourceResult = {
  readonly resourceId: string;
  readonly title: string;
  readonly updatedAt: number;
};
