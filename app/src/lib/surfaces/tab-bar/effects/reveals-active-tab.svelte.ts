/** Follow activation after the DOM updates, without disturbing manual scrolling. */
export const revealActiveTab = (
  track: () => HTMLElement | undefined,
  activeId: () => string
): void => {
  $effect(() => {
    activeId();
    const tab = track()?.querySelector('[aria-current="page"]')?.closest(".tab");
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
};
