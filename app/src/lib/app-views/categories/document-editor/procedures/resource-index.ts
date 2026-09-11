import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";
import type { ReadResourceTemplateResult } from "$capabilities/templates/index.remote";
import { isExternalFileResourceKind } from "$representation/data/behavior/core/resource";

export type ResourceIndexQuery = ReturnType<typeof readProjectResourceIndex>;

export const resourceIndex = (): ResourceIndexQuery => readProjectResourceIndex();

export const resourceName = (
  query: ResourceIndexQuery,
  id: string | undefined,
  template: ReadResourceTemplateResult | undefined = undefined
): string | undefined => {
  if (id === undefined) return undefined;

  // A template stage is a current editor subject, but deliberately is not a
  // listable project resource. Its discriminated membership owns its identity.
  const stage = template?.stage;
  if (
    template?.resourceId === id &&
    stage !== null &&
    stage !== undefined &&
    stage.target === "document"
  ) {
    return `Template · ${stage.templateName}`.slice(0, 160);
  }

  return query.current?.resources.find((resource) => resource.id === id)?.name;
};

export const evidenceTitles = (query: ResourceIndexQuery): ReadonlyMap<string, string> =>
  new Map(
    (query.current?.resources ?? [])
      .filter((resource) =>
        resource.ref.kind === "document" ||
        resource.ref.kind === "presentation" ||
        resource.ref.kind === "spreadsheet" ||
        isExternalFileResourceKind(resource.ref.kind)
      )
      .map((resource) => [`${resource.ref.kind}:${resource.id}`, resource.name])
  );
