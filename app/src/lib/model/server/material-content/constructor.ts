import type { Configuration } from "$model/server/configuration/index.server";
import { defineMaterialContent } from "$model/server/material-content/definition";
import type { MaterialContentModel } from "$model/server/material-content/types";

export const createMaterialContent = (configuration: Configuration): MaterialContentModel => {
  const configured = configuration.get("representation.materials.directory");
  return defineMaterialContent(
    typeof configured === "string" && configured.trim() ? configured.trim() : "data/materials"
  );
};
