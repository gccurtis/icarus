import type { Id } from "$convex/_generated/dataModel";
import type { ResourceType } from "$revisions/types/change";
import type { Actor } from "$shared/types/actor";
import { TemplatesError } from "$templates/errors";
import type { TemplateBody } from "$templates/types/body";
import type { TemplateSlot } from "$templates/types/slot";

/**
 * A template as a picker sees it: what it makes, what it will ask for, and
 * nothing of what it holds.
 *
 * **No `body`.** That is the point of keeping `target` on the row — listing the
 * document templates costs the metadata alone, however much has been authored
 * into them.
 *
 * `global` replaces `projectId`, which a caller already knows for everything else
 * it asked about. What it does not know is whether this one came from everywhere,
 * and that is the answer to "can I edit it".
 */
export type Template = {
  readonly id: Id<"templates">;
  readonly name: string;
  readonly description?: string;
  readonly target: ResourceType;
  readonly slots: TemplateSlot[];
  readonly global: boolean;
  readonly createdBy: Actor;
  readonly revision: number;
  readonly updatedAt: number;
};

/**
 * Everything a template is authored as. `create` and `revise` take the same
 * shape, because revising one is replacing it — there is no partial edit to a
 * skeleton, and an absent field would have to mean either "unchanged" or
 * "cleared" without being able to say which.
 *
 * No `target`: it is read off the body, so it cannot be given wrongly.
 */
export type TemplateDefinition = {
  readonly name: string;
  readonly description?: string;
  readonly body: TemplateBody;
  readonly slots: TemplateSlot[];
};

/**
 * The stored form of a name: trimmed, and never empty.
 *
 * A template is only ever reached by picking it out of a list, so an unnamed one
 * is a row nobody can choose. What to call it is the client's decision.
 */
export const templateName = (name: string): string => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new TemplatesError("empty-name", "A template name cannot be empty");
  }
  return trimmed;
};
