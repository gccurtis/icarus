import type { StoreUnitOfWork, TableRow } from "$model/server/store/index.server";
import type { TemplateVersionSlot } from "$representation/data/types/templates/template";

import { versionScopeOf } from "$capabilities/templates/api/shared/scopes";
import type { RowFields } from "$capabilities/templates/api/shared/store";
import { versionSlotsOf } from "$capabilities/templates/api/shared/slot-validation";

type TemplateFields = RowFields<"templates">;
type Template = TableRow<"templates">;

export const writeTemplateVersion = (
  store: StoreUnitOfWork,
  templateId: Template["_id"],
  fields: TemplateFields,
  at: number
): void => {
  const snapshot = fields.slots.map((slot): TemplateVersionSlot => {
    const { default: liveDefault, ...identity } = structuredClone(slot);
    const versionDefault = versionScopeOf(
      store,
      fields.projectId,
      { kind: "slot", templateId, slot: slot.name },
      liveDefault
    );
    return versionDefault === undefined
      ? identity
      : { ...identity, default: versionDefault };
  });
  const slots = versionSlotsOf(snapshot, `version-${templateId}-${fields.revision}`);
  store.create("templateVersions", {
    templateId,
    revision: fields.revision,
    name: fields.name,
    ...(fields.description === undefined ? {} : { description: fields.description }),
    tags: fields.tags,
    body: fields.body,
    slots: [...slots],
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
  slots: template.slots,
  createdBy: template.createdBy,
  revision: template.revision,
  updatedAt: template.updatedAt
});
