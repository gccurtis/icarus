import { command, query } from "$app/server";

import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import { createTemplate as createTemplateProcedure } from "$capabilities/templates/api/create-template/create-template";
import { duplicateTemplate as duplicateTemplateProcedure } from "$capabilities/templates/api/duplicate-template/duplicate-template";
import { instantiateTemplate as instantiateTemplateProcedure } from "$capabilities/templates/api/instantiate-template/instantiate-template";
import { readTemplate as readTemplateProcedure } from "$capabilities/templates/api/read-template/read-template";
import { readTemplateLibrary as readTemplateLibraryProcedure } from "$capabilities/templates/api/read-template-library/read-template-library";
import { removeTemplate as removeTemplateProcedure } from "$capabilities/templates/api/remove-template/remove-template";
import { updateTemplate as updateTemplateProcedure } from "$capabilities/templates/api/update-template/update-template";

export const readTemplateLibrary = query(readTemplateLibraryProcedure);
export const readTemplate = query("unchecked", readTemplateProcedure);

/**
 * Commands refresh the query instances they mutate from inside the same remote
 * request. Client `.updates(...)` calls name the mounted cache keys; these
 * refreshes return their new values alongside the command result.
 */
export const createTemplate = command("unchecked", async (input) => {
  const result = await createTemplateProcedure(input);
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

export type {
  CreateTemplateInput,
  CreateTemplateResult,
  DuplicateTemplateInput,
  DuplicateTemplateResult,
  InstantiateTemplateInput,
  InstantiateTemplateResult,
  ReadTemplateInput,
  ReadTemplateLibraryResult,
  ReadTemplateResult,
  RemoveTemplateInput,
  RemoveTemplateResult,
  TemplateAvailability,
  TemplateDetail,
  TemplateLibraryItem,
  TemplateUnavailable,
  TemplateTarget,
  UpdateTemplateInput,
  UpdateTemplatePatch,
  UpdateTemplateResult
} from "$capabilities/templates/types/templates";
