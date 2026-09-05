import type { StoreModel, TableRow } from "$model/server/store/index.server";

import type { RowFields } from "$capabilities/templates/api/shared/store";

type TemplateFields = RowFields<"templates">;
type Template = TableRow<"templates">;

export const writeTemplateVersion = (
  store: StoreModel,
  templateId: string,
  fields: TemplateFields,
  at: number
): void => {
  store.create("templateVersions", {
    templateId,
    revision: fields.revision,
    name: fields.name,
    ...(fields.description === undefined ? {} : { description: fields.description }),
    tags: fields.tags,
    body: fields.body,
    variables: fields.variables,
    at
  });
};

export const fieldsOfTemplate = (template: Template): TemplateFields => ({
  userId: template.userId,
  name: template.name,
  ...(template.description === undefined ? {} : { description: template.description }),
  tags: template.tags,
  body: template.body,
  variables: template.variables,
  createdBy: template.createdBy,
  revision: template.revision,
  updatedAt: template.updatedAt
});
