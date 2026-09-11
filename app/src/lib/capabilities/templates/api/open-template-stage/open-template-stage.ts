import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { validateOpenTemplateStage } from "$capabilities/templates/api/open-template-stage/validate-open-template-stage";
import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import { stageOf, stageTitleOf } from "$capabilities/templates/api/shared/stages";
import type { OpenTemplateStageResult } from "$capabilities/templates/types/templates";

export const openTemplateStage = async (input: unknown): Promise<OpenTemplateStageResult> => {
  const scope = await requireScope();
  const asked = validateOpenTemplateStage(input);

  const store = serverModel().store;
  const found = visibleTemplate(store, scope, asked.templateId);
  if (found.kind !== "found") {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: found.kind === "missing" ? "not-found" : "unsupported-body",
      revision: null,
      detail: found.kind === "missing" ? "no visible template has that id" : found.detail
    };
  }
  let template: ReturnType<typeof admitStoredTemplate>;
  try {
    template = admitStoredTemplate(found.template);
  } catch (error) {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: "unsupported-body",
      revision: reportableRevision(found.template.revision),
      detail: error instanceof Error ? error.message : String(error)
    };
  }
  const body = template.body;
  if (body.resource === "spreadsheet") {
    return {
      accepted: false,
      templateId: template._id,
      reason: "unsupported-body",
      revision: template.revision,
      detail: "a spreadsheet template opens for editing once the spreadsheet editor lands"
    };
  }

  const held = stageOf(store, scope.projectId, template._id);
  if (held !== undefined) {
    return {
      accepted: true,
      stageId: held._id,
      templateId: template._id,
      templateRevision: held.templateRevision,
      target: held.target,
      resourceId: held.resourceId,
      reused: true
    };
  }

  const projectId = asId<"projects">(scope.projectId);
  const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
  const at = Date.now();
  const title = stageTitleOf(template.name);
  const { resource: target, ...stageBody } = body;

  const created = store.transaction((unit) => {
    const resourceId =
      target === "document"
        ? unit.create("documents", {
          projectId,
          title,
          createdBy: actor,
          updatedBy: { ...actor },
          updatedAt: at
        })
        : unit.create("presentations", {
          projectId,
          title,
          createdBy: actor,
          updatedBy: { ...actor },
          updatedAt: at
        });
    unit.create(target === "document" ? "documentSnapshots" : "presentationSnapshots", {
      projectId,
      resourceId,
      revision: 0,
      role: "leader",
      part: 0,
      body: stageBody,
      at
    });
    const stageId = unit.create("templateStages", {
      projectId,
      templateId: template._id,
      templateRevision: template.revision,
      target,
      resourceId,
      createdBy: { ...actor },
      updatedAt: at
    });
    return { resourceId, stageId };
  });
  const { resourceId, stageId } = created;

  return {
    accepted: true,
    stageId,
    templateId: template._id,
    templateRevision: template.revision,
    target,
    resourceId,
    reused: false
  };
};
