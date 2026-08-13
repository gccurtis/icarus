import type { InternalJobsRegistrar } from "#workflows/internalRuntime.js";
import type { DocumentCapability, DocumentInternalJobIntent } from "#document";
import { createDocumentInternalJob } from "./createDocumentJobs.js";

const TYPES: DocumentInternalJobIntent["type"][] = [
  "document.compact",
  "document.prompt.create.compute",
  "document.prompt.create.settle",
  "document.prompt.refresh.compute",
  "document.prompt.refresh.settle",
  "document.formula.evaluate.compute",
  "document.formula.evaluate.settle"
];

export const registerDocumentInternalJobs = (
  jobs: InternalJobsRegistrar<DocumentInternalJobIntent>,
  document: DocumentCapability
): void => {
  for (const type of TYPES) {
    jobs.register(type, (intent) => createDocumentInternalJob(document, intent));
  }
};
