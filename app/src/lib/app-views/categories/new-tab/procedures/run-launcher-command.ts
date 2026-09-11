import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const LAUNCHER_BUSY = "Another New Tab action is already in progress.";

const commandKey = (view: WorkspaceStateModel, tabId: string) =>
  ["new-tab", view.project, tabId, "launch"] as const;

/** Give one New Tab one durable command owner across its center and side panels. */
export const runLauncherCommand = <Result>(
  view: WorkspaceStateModel,
  tabId: string,
  run: () => PromiseLike<Result>
): Promise<Result> | undefined => {
  const key = commandKey(view, tabId);
  if (view.pendingFlight(key) !== undefined) return undefined;
  return view.singleFlight(key, run);
};
