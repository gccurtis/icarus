import type { Runtime, SlideDeckRuntimesState } from "$model/client/slide-deck-runtimes/definition.svelte";
import { sync } from "$model/client/slide-deck-runtimes/methods/sync";

export const attach = (state: SlideDeckRuntimesState, id: string): Runtime => {
  const open = state.open.get(id);
  if (open) {
    void sync(open);
    return open;
  }

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

/**
 * The heartbeat starts with the runtime and stops with it — `detach` calls
 * `unsubscribe`. It is the same beat the debounce uses: whatever wakes a
 * runtime, it either sends what it holds or reads what it does not.
 */
const subscribe = (runtime: Runtime): void => {
  void runtime.tick();

  const every = runtime.thresholds.syncEveryMs;
  if (every <= 0) return;

  const timer = setInterval(() => void runtime.tick(), every);
  runtime.unsubscribe = () => clearInterval(timer);
};
