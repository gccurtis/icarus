import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import {
  admitStoredTemplate,
  reportableRevision,
  visibleTemplate
} from "$capabilities/templates/api/shared/projection";
import { removeRowsBoundTo } from "$capabilities/templates/api/shared/scopes";
import { removeStage, stagesIn } from "$capabilities/templates/api/shared/stages";
import {
  canonicalRowId,
  recordsIn
} from "$capabilities/templates/api/shared/store";
import { validateRemoveTemplate } from "$capabilities/templates/api/remove-template/validate-remove-template";
import type { RemoveTemplateResult } from "$capabilities/templates/types/templates";

export const removeTemplate = async (input: unknown): Promise<RemoveTemplateResult> => {
  const scope = await requireScope();
  const asked = validateRemoveTemplate(input);

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
  const stored = found.template;
  if (stored.userId !== scope.userId) {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: "forbidden",
      revision: reportableRevision(stored.revision),
      detail: "only the template owner can delete it"
    };
  }
  if (stored.revision !== asked.baseRevision) {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: "stale",
      revision: reportableRevision(stored.revision),
      detail: `deletion asked for revision ${asked.baseRevision}, the template is at ${stored.revision}`
    };
  }

  let template: ReturnType<typeof admitStoredTemplate>;
  try {
    template = admitStoredTemplate(stored);
  } catch (error) {
    return {
      accepted: false,
      templateId: asked.templateId,
      reason: "unsupported-body",
      revision: reportableRevision(stored.revision),
      detail: error instanceof Error ? error.message : String(error)
    };
  }

  // Resolve every provenance row before writing. A corrupt or cross-project
  // reference must not leave the template half removed.
  const resourceTables = ["documents", "slideDecks", "spreadsheets"] as const;
  const detach = new Map<(typeof resourceTables)[number], readonly string[]>();
  for (const table of resourceTables) {
    const resources = recordsIn(store, table);
    const claimants = new Map<string, number>();
    for (const resource of resources) {
      const id = canonicalRowId(resource._id, table);
      if (id !== undefined) claimants.set(id, (claimants.get(id) ?? 0) + 1);
    }
    const ids: string[] = [];
    for (const resource of resources) {
      if (resource.templateId !== template._id) continue;
      const id = canonicalRowId(resource._id, table);
      if (
        id === undefined ||
        typeof resource.projectId !== "string" ||
        resource.projectId !== resource.projectId.trim() ||
        resource.projectId.length === 0 ||
        resource.projectId.length > 500
      ) {
        return {
          accepted: false,
          templateId: template._id,
          reason: "unsupported-body",
          revision: template.revision,
          detail: `a ${table} provenance row is corrupt`
        };
      }
      if (claimants.get(id) !== 1) {
        return {
          accepted: false,
          templateId: template._id,
          reason: "unsupported-body",
          revision: template.revision,
          detail: `a ${table} provenance id is ambiguous`
        };
      }
      if (resource.projectId !== scope.projectId) {
        return {
          accepted: false,
          templateId: template._id,
          reason: "in-use-elsewhere",
          revision: template.revision,
          detail: "this template is referenced outside the current project and cannot be deleted here"
        };
      }
      ids.push(id);
    }
    detach.set(table, ids);
  }

  const stages = stagesIn(store).filter((stage) => stage.templateId === template._id);

  const versions = recordsIn(store, "templateVersions");
  const versionClaimants = new Map<string, number>();
  for (const version of versions) {
    const id = canonicalRowId(version._id, "templateVersions");
    if (id !== undefined) versionClaimants.set(id, (versionClaimants.get(id) ?? 0) + 1);
  }
  const versionIds: string[] = [];
  for (const version of versions) {
    if (version.templateId !== template._id) continue;
    const id = canonicalRowId(version._id, "templateVersions");
    if (id === undefined) {
      return {
        accepted: false,
        templateId: template._id,
        reason: "unsupported-body",
        revision: template.revision,
        detail: "a template version row is corrupt"
      };
    }
    if (versionClaimants.get(id) !== 1) {
      return {
        accepted: false,
        templateId: template._id,
        reason: "unsupported-body",
        revision: template.revision,
        detail: "a template version id is ambiguous"
      };
    }
    versionIds.push(id);
  }

  store.transaction((unit) => {
    for (const table of resourceTables) {
      unit.removeFieldFromRows(
        table,
        (detach.get(table) ?? []).map((id) => asId<typeof table>(id)),
        "templateId"
      );
    }
    for (const stage of stages) removeStage(unit, stage);
    for (const hole of template.holes) {
      removeRowsBoundTo(unit, scope.projectId, {
        kind: "hole",
        templateId: template._id,
        hole: hole.name
      });
    }
    unit.removeRows(
      "templateVersions",
      versionIds.map((id) => asId<"templateVersions">(id))
    );
    unit.remove(`templates.${template._id}`);
  });

  return { accepted: true, templateId: template._id, revision: template.revision };
};
