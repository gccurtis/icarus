import {
  readResourceTemplate,
  readTemplate,
  readTemplateLibrary,
  type ReadResourceTemplateResult,
  type ReadTemplateLibraryResult,
  type ReadTemplateResult,
  type ResourceTemplateStage,
  type TemplateDetail,
  type TemplateLibraryItem
} from "$capabilities/templates/index.remote";

export const resourceTemplate = (resourceId: string) => readResourceTemplate({ resourceId });
export const templateLibrary = () => readTemplateLibrary();
export const templateDetail = (templateId: string | undefined) =>
  templateId === undefined ? undefined : readTemplate({ templateId });
export const stageIn = (
  answer: ReadResourceTemplateResult | undefined
): ResourceTemplateStage | undefined => answer?.stage ?? undefined;
export const detailIn = (answer: ReadTemplateResult | undefined): TemplateDetail | undefined =>
  answer === null || answer === undefined || "unavailable" in answer ? undefined : answer;
export const deckTemplatesIn = (
  answer: ReadTemplateLibraryResult | undefined
): readonly TemplateLibraryItem[] =>
  (answer?.templates ?? []).filter((item) => item.target === "slides");
