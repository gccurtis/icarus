import type { StoreUnitOfWork } from "$model/server/store/index.server";

import { rowsIn } from "$capabilities/templates/api/shared/store";

const keyOf = (name: string): string => name.trim().toLowerCase();

/** Project-wide template names are one namespace across every template target. */
export const templateNameTaken = (
  store: StoreUnitOfWork,
  projectId: string,
  name: string,
  exceptTemplateId?: string
): boolean =>
  rowsIn(store, "templates").some(
    (row) =>
      row.projectId === projectId &&
      row._id !== exceptTemplateId &&
      keyOf(row.name) === keyOf(name)
  );

const suffixed = (name: string, suffix: string): string =>
  `${name.slice(0, 160 - suffix.length).trimEnd()}${suffix}`;

/** A deterministic duplicate name that remains unique inside the project. */
export const availableTemplateCopyName = (
  store: StoreUnitOfWork,
  projectId: string,
  sourceName: string
): string => {
  let index = 1;
  while (true) {
    const suffix = index === 1 ? " copy" : ` copy ${index}`;
    const candidate = suffixed(sourceName, suffix);
    if (!templateNameTaken(store, projectId, candidate)) return candidate;
    index += 1;
  }
};

export const templateNameConflictDetail = (name: string): string =>
  `a template named “${name}” already exists in this project`;
