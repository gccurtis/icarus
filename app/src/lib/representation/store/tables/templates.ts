import type { Actor } from "$representation/data/types/core/actor";
import type { Id, Row } from "$representation/data/types/core/id";
import type { BoundTo, ResourceSet } from "$representation/data/types/core/resource-set";
import type {
  TemplateBody,
  TemplateSlot,
  TemplateVersionSlot
} from "$representation/data/types/templates/template";

export type TemplateFields = {
  projectId: Id<"projects">;
  userId: Id<"users">;
  name: string;
  description?: string;
  tags: string[];
  body: TemplateBody;
  slots: TemplateSlot[];
  createdBy: Actor;
  revision: number;
  updatedAt: number;
  lastUsedAt?: number;
};
export type Template = Row<"templates"> & TemplateFields;

export type TemplateVersionFields = {
  templateId: Id<"templates">;
  revision: number;
  name: string;
  description?: string;
  tags: string[];
  body: TemplateBody;
  slots: TemplateVersionSlot[];
  at: number;
};
export type TemplateVersion = Row<"templateVersions"> & TemplateVersionFields;

export type TemplateStageFields = {
  projectId: Id<"projects">;
  templateId: Id<"templates">;
  templateRevision: number;
  target: Exclude<TemplateBody["resource"], "spreadsheet">;
  resourceId: string;
  createdBy: Actor;
  updatedAt: number;
};
export type TemplateStage = Row<"templateStages"> & TemplateStageFields;

export type ResourceSetFields = {
  projectId: Id<"projects">;
  name?: string;
  description?: string;
  boundTo?: BoundTo;
  set: ResourceSet;
  createdBy: Actor;
  revision: number;
  updatedAt: number;
};
export type StoredResourceSet = Row<"resourceSets"> & ResourceSetFields;
