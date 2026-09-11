import { DocumentRuntimes } from "$model/client/document-runtimes/definition.svelte";
import type {
  DocumentRuntimesModel,
  Thresholds
} from "$model/client/document-runtimes/types";

export const createDocumentRuntimes = (
  thresholds: Thresholds
): DocumentRuntimesModel => new DocumentRuntimes(thresholds);
