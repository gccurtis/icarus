import type {
  DocumentRuntimesState,
  Runtime
} from "$model/client/document-runtimes/definition.svelte";

/** Read an already-acquired runtime without changing its lifetime. */
export const of = (state: DocumentRuntimesState, id: string): Runtime | undefined =>
  state.open.get(id);
