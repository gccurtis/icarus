import type { StoreUnitOfWork, TableRow } from "$model/server/store/index.server";
import type { TemplateVersionHole } from "$representation/data/types/templates/template";

import { versionScopeOf } from "$capabilities/templates/api/shared/scopes";
import type { RowFields } from "$capabilities/templates/api/shared/store";
import { versionHolesOf } from "$capabilities/templates/api/shared/validation";

type TemplateFields = RowFields<"templates">;
type Template = TableRow<"templates">;

export const writeTemplateVersion = (
  store: StoreUnitOfWork,
  templateId: Template["_id"],
  fields: TemplateFields,
  at: number
): void => {
  const snapshot = fields.holes.map((hole): TemplateVersionHole => {
    const { default: liveDefault, ...identity } = structuredClone(hole);
    const versionDefault = versionScopeOf(
      store,
      fields.projectId,
      { kind: "hole", templateId, hole: hole.name },
      liveDefault
    );
    return versionDefault === undefined
      ? identity
      : { ...identity, default: versionDefault };
  });
  const holes = versionHolesOf(snapshot, `version-${templateId}-${fields.revision}`);
  store.create("templateVersions", {
    templateId,
    revision: fields.revision,
    name: fields.name,
    ...(fields.description === undefined ? {} : { description: fields.description }),
    tags: fields.tags,
    body: fields.body,
    holes: [...holes],
    at
  });
};

export const fieldsOfTemplate = (template: Template): TemplateFields => ({
  projectId: template.projectId,
  userId: template.userId,
  name: template.name,
  ...(template.description === undefined ? {} : { description: template.description }),
  tags: template.tags,
  body: template.body,
  holes: template.holes,
  createdBy: template.createdBy,
  revision: template.revision,
  updatedAt: template.updatedAt
});
