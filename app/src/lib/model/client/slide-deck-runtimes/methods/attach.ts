import { readSlideDeckBody } from "$capabilities/slide-deck/index.remote";
import type { Runtime, SlideDeckRuntimesState } from "$model/client/slide-deck-runtimes/definition.svelte";
import { emptyBody } from "$model/client/slide-deck-runtimes/methods/shared/empty-body";

export const attach = (state: SlideDeckRuntimesState, id: string): Runtime => {
  const open = state.open.get(id);
  if (open) return open;

  const settling = state.settling.get(id);
  if (settling) {
    state.settling.delete(id);
    state.open.set(id, settling);
    subscribe(settling);
    return settling;
  }

  const runtime = state.createRuntime(id);
  state.open.set(id, runtime);
  subscribe(runtime);

  return runtime;
};

const subscribe = (runtime: Runtime): void => {
  if (runtime.body !== undefined) return;

  void load(runtime);
};

const load = async (runtime: Runtime): Promise<void> => {
  try {
    const found = await readSlideDeckBody({ resourceId: runtime.id });
    if (runtime.body !== undefined) return;

    runtime.body = found === null ? emptyBody() : found.body;
    runtime.revision = found === null ? 0 : found.revision;
    runtime.sync = "saved";
  } catch {
    runtime.sync = "error";
  }
};
