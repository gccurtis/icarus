import {
  booleanOf,
  fieldsOf,
  has,
  idOf,
  instructionOf,
  nameOf,
  only,
  resourceSetOf,
  revisionOf,
  toolsOf,
  triggerOf
} from "$capabilities/agents/api/shared/validation";
import type {
  UpdateAutomationInput,
  UpdateAutomationPatch
} from "$capabilities/agents/types/agents";

const SUBJECT = "update-automation";

export const validateUpdateAutomation = (input: unknown): UpdateAutomationInput => {
  const fields = fieldsOf(input, SUBJECT);
  only(fields, ["automationId", "baseRevision", "patch"], SUBJECT);
  const raw = fieldsOf(fields.patch, SUBJECT);
  only(raw, ["name", "instruction", "personaId", "trigger", "scope", "tools", "enabled"], SUBJECT);
  if (Reflect.ownKeys(raw).length === 0) throw new Error(`agents/${SUBJECT}: the patch changes nothing`);
  const patch: UpdateAutomationPatch = {
    ...(has(raw, "name") ? { name: nameOf(raw.name, SUBJECT) } : {}),
    ...(has(raw, "instruction") ? { instruction: instructionOf(raw.instruction, SUBJECT) } : {}),
    ...(has(raw, "personaId") ? { personaId: idOf(raw.personaId, "personas", SUBJECT, "personaId") } : {}),
    ...(has(raw, "trigger") ? { trigger: triggerOf(raw.trigger, SUBJECT) } : {}),
    ...(has(raw, "scope") ? { scope: raw.scope === null ? null : resourceSetOf(raw.scope, SUBJECT) } : {}),
    ...(has(raw, "tools") ? { tools: toolsOf(raw.tools, SUBJECT) } : {}),
    ...(has(raw, "enabled") ? { enabled: booleanOf(raw.enabled, SUBJECT, "enabled") } : {})
  };
  return {
    automationId: idOf(fields.automationId, "automations", SUBJECT, "automationId"),
    baseRevision: revisionOf(fields.baseRevision, SUBJECT),
    patch
  };
};
