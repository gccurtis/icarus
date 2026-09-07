import { command, query } from "$app/server";

import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import { read as readStoreTable } from "$capabilities/store/index.remote";
import { commitTemplateStage as commitTemplateStageProcedure } from "$capabilities/templates/api/commit-template-stage/commit-template-stage";
import { createTemplate as createTemplateProcedure } from "$capabilities/templates/api/create-template/create-template";
import { createTemplateFromResource as createTemplateFromResourceProcedure } from "$capabilities/templates/api/create-template-from-resource/create-template-from-resource";
import { discardTemplateStage as discardTemplateStageProcedure } from "$capabilities/templates/api/discard-template-stage/discard-template-stage";
import { duplicateTemplate as duplicateTemplateProcedure } from "$capabilities/templates/api/duplicate-template/duplicate-template";
import { instantiateTemplate as instantiateTemplateProcedure } from "$capabilities/templates/api/instantiate-template/instantiate-template";
import { openTemplateStage as openTemplateStageProcedure } from "$capabilities/templates/api/open-template-stage/open-template-stage";
import { readResourceTemplate as readResourceTemplateProcedure } from "$capabilities/templates/api/read-resource-template/read-resource-template";
import { readTemplate as readTemplateProcedure } from "$capabilities/templates/api/read-template/read-template";
import { readTemplateLibrary as readTemplateLibraryProcedure } from "$capabilities/templates/api/read-template-library/read-template-library";
import { removeTemplate as removeTemplateProcedure } from "$capabilities/templates/api/remove-template/remove-template";
import { resourceTableOf } from "$capabilities/templates/api/shared/stages";
import { updateTemplate as updateTemplateProcedure } from "$capabilities/templates/api/update-template/update-template";

export const readTemplateLibrary = query(readTemplateLibraryProcedure);
export const readTemplate = query("unchecked", readTemplateProcedure);
export const readResourceTemplate = query("unchecked", readResourceTemplateProcedure);

export const createTemplate = command("unchecked", async (input) => {
  const result = await createTemplateProcedure(input);
  await readTemplateLibrary().refresh();
  return result;
});

export const createTemplateFromResource = command("unchecked", async (input) => {
  const result = await createTemplateFromResourceProcedure(input);
  await readTemplateLibrary().refresh();
  return result;
});

export const updateTemplate = command("unchecked", async (input) => {
  const result = await updateTemplateProcedure(input);
  await readTemplateLibrary().refresh();
  await readTemplate({ templateId: result.templateId }).refresh();
  return result;
});

export const duplicateTemplate = command("unchecked", async (input) => {
  const result = await duplicateTemplateProcedure(input);
  await readTemplateLibrary().refresh();
  return result;
});

export const removeTemplate = command("unchecked", async (input) => {
  const result = await removeTemplateProcedure(input);
  await readTemplateLibrary().refresh();
  await readTemplate({ templateId: result.templateId }).refresh();
  return result;
});

export const instantiateTemplate = command("unchecked", async (input) => {
  const result = await instantiateTemplateProcedure(input);
  await readTemplateLibrary().refresh();
  if (result.accepted) await readProjectResourceIndex().refresh();
  return result;
});

export const openTemplateStage = command("unchecked", async (input) => {
  const result = await openTemplateStageProcedure(input);
  await readTemplateLibrary().refresh();
  await readTemplate({ templateId: result.templateId }).refresh();
  if (result.accepted) {
    await readResourceTemplate({ resourceId: result.resourceId }).refresh();
    await readStoreTable({ path: resourceTableOf(result.target) }).refresh();
  }
  return result;
});

export const commitTemplateStage = command("unchecked", async (input) => {
  const result = await commitTemplateStageProcedure(input);
  await readTemplateLibrary().refresh();
  if (result.templateId !== null) await readTemplate({ templateId: result.templateId }).refresh();
  return result;
});

export const discardTemplateStage = command("unchecked", async (input) => {
  const result = await discardTemplateStageProcedure(input);
  await readTemplateLibrary().refresh();
  if (result.accepted) {
    await readTemplate({ templateId: result.templateId }).refresh();
    await readResourceTemplate({ resourceId: result.resourceId }).refresh();
    await readStoreTable({ path: resourceTableOf(result.target) }).refresh();
  }
  return result;
});

export type {
  CommitTemplateStageInput,
  CommitTemplateStageResult,
  CreateTemplateFromResourceInput,
  CreateTemplateFromResourceResult,
  CreateTemplateInput,
  CreateTemplateResult,
  DiscardTemplateStageInput,
  DiscardTemplateStageResult,
  DuplicateTemplateInput,
  DuplicateTemplateResult,
  InstantiateTemplateInput,
  InstantiateTemplateResult,
  OpenTemplateStageInput,
  OpenTemplateStageResult,
  ReadResourceTemplateInput,
  ReadResourceTemplateResult,
  ReadTemplateInput,
  ReadTemplateLibraryResult,
  ReadTemplateResult,
  RemoveTemplateInput,
  RemoveTemplateResult,
  ResourceTemplateStage,
  TemplateAnswers,
  TemplateTexts,
  TemplateAvailability,
  TemplateDetail,
  TemplateLibraryItem,
  TemplateStageTarget,
  TemplateTarget,
  TemplateUnavailable,
  UpdateTemplateInput,
  UpdateTemplatePatch,
  UpdateTemplateResult
} from "$capabilities/templates/types/templates";
