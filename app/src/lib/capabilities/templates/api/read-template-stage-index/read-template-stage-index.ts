import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { isStoredEditableResource } from "$representation/data/behavior/project-resources/stored";

import {
  admitStoredTemplate,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import {
  resourceTableOf,
  stagesIn
} from "$capabilities/templates/api/shared/stages";
import { recordsIn } from "$capabilities/templates/api/shared/store";
import type {
  ReadTemplateStageIndexResult,
  TemplateStageIdentity,
  TemplateStageIdentityUnavailable
} from "$capabilities/templates/types/templates";

/**
 * Exact identity for current template working copies.
 *
 * Stages are deliberately absent from the normal project-resource index: they
 * are editor subjects, not listable project material. This projection admits
 * the stage, its target-specific scratch resource, and its template as one
 * current subject before global chrome may name it.
 */
export const readTemplateStageIndex = async (): Promise<ReadTemplateStageIndexResult> => {
  const scope = await requireScope();
  const store = serverModel().store;
  const all = stagesIn(store);
  const held = all.filter((stage) => stage.projectId === scope.projectId);
  const stages: TemplateStageIdentity[] = [];
  const unavailable: TemplateStageIdentityUnavailable[] = [];

  const stageClaims = new Map<string, number>();
  const resourceClaims = new Map<string, number>();
  for (const stage of all) {
    stageClaims.set(stage._id, (stageClaims.get(stage._id) ?? 0) + 1);
    resourceClaims.set(stage.resourceId, (resourceClaims.get(stage.resourceId) ?? 0) + 1);
  }

  for (const stage of held) {
    let detail: string | undefined;
    if (stageClaims.get(stage._id) !== 1) {
      detail = "more than one current stage row claims this stage id";
    } else if (resourceClaims.get(stage.resourceId) !== 1) {
      detail = "more than one current stage row claims this resource";
    }

    const table = resourceTableOf(stage.target);
    const resources = recordsIn(store, table).filter((row) => row._id === stage.resourceId);
    if (
      detail === undefined &&
      (resources.length !== 1 ||
        resources[0].projectId !== scope.projectId ||
        !isStoredEditableResource(resources[0], table))
    ) {
      detail = "the stage does not own one exact current scratch resource in this project";
    }

    let template: ReturnType<typeof admitStoredTemplate> | undefined;
    if (detail === undefined) {
      const found = visibleTemplate(store, scope, stage.templateId);
      if (found.kind === "missing") {
        detail = "the stage's current template does not exist in this project";
      } else if (found.kind === "ambiguous") {
        detail = found.detail;
      } else {
        try {
          template = admitStoredTemplate(found.template);
        } catch (error) {
          detail = error instanceof Error ? error.message : String(error);
        }
      }
    }

    if (detail === undefined && template?.body.resource !== stage.target) {
      detail = "the stage target does not match its current template body";
    }

    if (detail !== undefined) {
      unavailable.push({
        unavailable: true,
        stageId: stage._id,
        resourceId: stage.resourceId,
        reason: "corrupt",
        detail
      });
      continue;
    }
    if (template === undefined) {
      throw new Error("templates/read-template-stage-index: exact template admission produced no value");
    }

    stages.push({
      stageId: stage._id,
      templateId: stage.templateId,
      templateName: template.name,
      target: stage.target,
      resourceId: stage.resourceId
    });
  }

  stages.sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  unavailable.sort((left, right) => left.resourceId.localeCompare(right.resourceId));
  return { stages, unavailable };
};
