/** Keep wheel scrolling local to the mounted tab bar's transient tabs. */
export const scrollTabs = (
  toolbar: HTMLElement,
  track: () => HTMLElement | undefined
): { destroy: () => void } => {
  const wheel = (event: WheelEvent): void => {
    const node = track();
    if (node === undefined || event.ctrlKey || event.defaultPrevented) return;
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? node.clientWidth : 1;
    const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * unit;
    const next = Math.max(0, Math.min(node.scrollWidth - node.clientWidth, node.scrollLeft + delta));
    if (next === node.scrollLeft) return;
    event.preventDefault();
    node.scrollLeft = next;
  };

  const focus = (event: FocusEvent): void => {
    const tab = event.target instanceof Element ? event.target.closest(".tab.named") : null;
    if (tab !== null && track()?.contains(tab)) {
      tab.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  // Wheel handlers must be non-passive to replace vertical scrolling once consumed.
  toolbar.addEventListener("wheel", wheel, { passive: false });
  toolbar.addEventListener("focusin", focus);
  return { destroy: () => {
    toolbar.removeEventListener("wheel", wheel);
    toolbar.removeEventListener("focusin", focus);
  } };
};
