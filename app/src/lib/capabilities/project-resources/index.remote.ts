import { command, query } from "$app/server";

import { createProjectResource as createProjectResourceProcedure } from "$capabilities/project-resources/api/create-project-resource/create-project-resource";
import { readProjectResourceIndex as readProjectResourceIndexProcedure } from "$capabilities/project-resources/api/read-project-resource-index/read-project-resource-index";
import { renameProjectResource as renameProjectResourceProcedure } from "$capabilities/project-resources/api/rename-project-resource/rename-project-resource";

export const readProjectResourceIndex = query(readProjectResourceIndexProcedure);

export const createProjectResource = command("unchecked", async (input) => {
  const result = await createProjectResourceProcedure(input);
  await readProjectResourceIndex().refresh();
  return result;
});

export const renameProjectResource = command("unchecked", async (input) => {
  const result = await renameProjectResourceProcedure(input);
  await readProjectResourceIndex().refresh();
  return result;
});

export type {
  CreateProjectResourceInput,
  CreateProjectResourceResult,
  ProjectResourceIndex,
  ProjectResourceIndexItem,
  ProjectResourceKind,
  ProjectResourceUnavailable,
  ProjectResourceTarget,
  RenameProjectResourceInput,
  RenameProjectResourceResult
} from "$capabilities/project-resources/types/project-resources";
