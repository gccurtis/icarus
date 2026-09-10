type RunningTask = { readonly state: "running" | "review" | "finished" };

/** Keep one open task current while its process-owned runner works in the background. */
export const refreshRunningTask = (
  current: () => RunningTask | undefined,
  refresh: () => Promise<unknown> | undefined
): void => {
  $effect(() => {
    if (current()?.state !== "running") return;
    const interval = setInterval(() => {
      void refresh();
    }, 1_000);
    return () => clearInterval(interval);
  });
};
