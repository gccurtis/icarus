import type { CurrentRowPolicies } from "$representation/store/schema/types";

export const TEMPLATE_ROW_POLICIES = {
  templates: {
    projectId: "required", userId: "required", name: "required", description: "optional",
    tags: "required", body: "required", holes: "required", createdBy: "required",
    revision: "required", updatedAt: "required", lastUsedAt: "optional"
  },
  templateVersions: {
    templateId: "required", revision: "required", name: "required", description: "optional",
    tags: "required", body: "required", holes: "required", at: "required"
  },
  templateStages: {
    projectId: "required", templateId: "required", templateRevision: "required",
    target: "required", resourceId: "required", createdBy: "required", updatedAt: "required"
  },
  resourceSets: {
    projectId: "required", name: "optional", description: "optional", boundTo: "optional",
    set: "required", createdBy: "required", revision: "required", updatedAt: "required"
  }
} satisfies Pick<
  CurrentRowPolicies,
  "templates" | "templateVersions" | "templateStages" | "resourceSets"
>;
