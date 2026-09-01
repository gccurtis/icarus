import type { DocumentRuntimesState, Runtime } from "$model/client/document-runtimes/definition.svelte";
import { detach } from "$model/client/document-runtimes/methods/shared/detach";

export const release = (state: DocumentRuntimesState, id: string): Runtime | undefined =>
  detach(state, id);
