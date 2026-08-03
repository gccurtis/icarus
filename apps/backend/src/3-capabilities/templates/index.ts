export {
  createTemplateCapability,
  type TemplateCapability,
  type TemplateClock,
  type TemplateDependencies
} from "./application/templateService.js";

export * from "./domain/model.js";
export * from "./domain/errors.js";
export { canonicalDigest, digestTemplateCommand } from "./domain/canonical.js";

export type {
  TemplatableResource,
  TemplatableResourceRegistry
} from "./ports/templatableResource.js";
export type { TemplateActivityPublisher } from "./ports/activityPublisher.js";
export type {
  TemplateCommandReceipt,
  TemplateCreateCommit,
  TemplateFinalizeCommit,
  TemplateStore,
  TemplateUpdateCommit
} from "./ports/templateStore.js";

export { SQLiteTemplateStore } from "./persistence/sqliteTemplateStore.js";

export { decodeTemplateCommand } from "./wire/commandSchemas.js";
export { decodeTemplateQuery } from "./wire/querySchemas.js";
export { TEMPLATE_WIRE_LIMITS } from "./wire/valueSchemas.js";
