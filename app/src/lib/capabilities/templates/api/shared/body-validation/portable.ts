import {
  type Fields,
  isRecord
} from "$capabilities/templates/api/shared/body-validation/primitives";

export const assertPortableBody = (value: unknown, subject: string): void => {
  const boundField = (step: Fields): string | undefined => {
    if (step.to === "resource" && "ref" in step) return "resource reference";
    if (step.kind === "resource" && "ref" in step) return "resource reference";
    if (step.kind === "range" && "resourceId" in step) return "resourceId";
    if (step.kind === "function" && "formulaId" in step) return "formulaId";
    if ((step.kind === "formula" || step.type === "formula") && "formulaId" in step) {
      return "formulaId";
    }
    if (step.type === "prompt" && "derivedOutputId" in step) return "derivedOutputId";
    if (step.kind === "user" && "userId" in step) return "userId";
    if (step.kind === "agent" && "taskId" in step) return "taskId";
    if (step.kind === "connector" && "connectorId" in step) return "connectorId";
    if (step.kind === "persona" && "personaId" in step) return "personaId";
    if (step.kind === "file" && "fileId" in step) return "fileId";
    if (step.kind === "storage" && "storageId" in step) return "storageId";
    if (step.kind === "image" && "fileId" in step) return "fileId";
    return undefined;
  };

  const walk = (step: unknown): void => {
    if (Array.isArray(step)) {
      for (const nested of step) walk(nested);
      return;
    }
    if (!isRecord(step)) return;
    const field = boundField(step);
    if (field !== undefined) {
      throw new Error(`templates/${subject}: body contains project-bound field ${field}`);
    }
    for (const nested of Object.values(step)) walk(nested);
  };
  walk(value);
};
