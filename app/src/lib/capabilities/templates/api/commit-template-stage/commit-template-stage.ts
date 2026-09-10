import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { settledHoleDefaults, templatedBodyOf } from "$capabilities/templates/api/shared/prompts";
import type { TemplateBody } from "$representation/data/types/templates/template";

import { validateCommitTemplateStage } from "$capabilities/templates/api/commit-template-stage/validate-commit-template-stage";
import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import {
  leaderBodyOf,
  stageById,
  stageResourceRef
} from "$capabilities/templates/api/shared/stages";
import type { RowFields } from "$capabilities/templates/api/shared/store";
import { writeTemplateVersion } from "$capabilities/templates/api/shared/template-rows";
import { bodyOf } from "$capabilities/templates/api/shared/body-validation/body-validation";
import { declaredFor } from "$capabilities/templates/api/shared/holes";
import { expandedScope } from "$capabilities/templates/api/shared/scopes";
import type { CommitTemplateStageResult } from "$capabilities/templates/types/templates";

export const commitTemplateStage = async (input: unknown): Promise<CommitTemplateStageResult> => {
  const scope = await requireScope();
  const asked = validateCommitTemplateStage(input);

  const store = serverModel().store;
  const stage = stageById(store, asked.stageId);
  if (stage === undefined || stage.projectId !== scope.projectId) {
    return {
      accepted: false,
      stageId: asked.stageId,
      templateId: null,
      reason: "not-found",
      revision: null,
      detail: "no stage in this project has that id"
    };
  }
  const found = visibleTemplate(store, scope, stage.templateId);
  if (found.kind !== "found") {
    return {
      accepted: false,
      stageId: stage._id,
      templateId: stage.templateId,
      reason: found.kind === "missing" ? "not-found" : "unsupported-body",
      revision: null,
      detail: found.kind === "missing" ? "the template this stage edits is gone" : found.detail
    };
  }
  if (found.template.revision !== asked.baseRevision) {
    return {
      accepted: false,
      stageId: stage._id,
      templateId: stage.templateId,
      reason: "stale",
      revision: reportableRevision(found.template.revision),
      detail: `saved against revision ${asked.baseRevision}, the template is at ${found.template.revision}`
    };
  }
  let template: ReturnType<typeof admitStoredTemplate>;
  try {
    template = admitStoredTemplate(found.template);
  } catch (error) {
    return {
      accepted: false,
      stageId: stage._id,
      templateId: stage.templateId,
      reason: "unsupported-body",
      revision: reportableRevision(found.template.revision),
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  const leader = leaderBodyOf(store, scope.projectId, stage.target, stage.resourceId);
  if (leader === undefined) {
    return {
      accepted: false,
      stageId: stage._id,
      templateId: template._id,
      reason: "unsupported-body",
      revision: template.revision,
      detail: "the staged copy has no body to save"
    };
  }
  const portable = templatedBodyOf(store, { resource: stage.target, ...leader.body }, template.holes);
  let body: TemplateBody;
  try {
    body = bodyOf(portable.body, "commit-template-stage");
  } catch (error) {
    return {
      accepted: false,
      stageId: stage._id,
      templateId: template._id,
      reason: "unsupported-body",
      revision: template.revision,
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  let holes;
  try {
    const ref = stageResourceRef(stage.target, stage.resourceId);
    holes = declaredFor(body, portable.holes).map((hole) => {
      const expanded = expandedScope(
        store,
        scope.projectId,
        { kind: "resource", ref, hole: hole.name },
        hole.default
      );
      return expanded === undefined ? hole : { ...hole, default: expanded };
    });
  } catch (error) {
    return {
      accepted: false,
      stageId: stage._id,
      templateId: template._id,
      reason: "unsupported-body",
      revision: template.revision,
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  const at = Date.now();
  const fields = store.transaction((unit): RowFields<"templates"> => {
    const next: RowFields<"templates"> = {
      projectId: template.projectId,
      userId: template.userId,
      name: template.name,
      ...(template.description === undefined ? {} : { description: template.description }),
      tags: [...template.tags],
      body,
      holes: [
        ...settledHoleDefaults(
          unit,
          template.projectId,
          template.createdBy,
          template._id,
          holes,
          at
        )
      ],
      createdBy: template.createdBy,
      revision: template.revision + 1,
      updatedAt: at
    };
    unit.update(`templates.${template._id}`, next);
    writeTemplateVersion(unit, template._id, next, at);
    unit.update(`templateStages.${stage._id}.templateRevision`, next.revision);
    unit.update(`templateStages.${stage._id}.updatedAt`, at);
    return next;
  });

  return {
    accepted: true,
    stageId: stage._id,
    templateId: template._id,
    revision: fields.revision,
    dropped: portable.dropped
  };
};
