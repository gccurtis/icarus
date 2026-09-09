/** Keeps a panel disclosure synchronized for exactly one component instance. */
export const synchronizePanelSection = ({
  open,
  requested,
  setExpanded,
  setRequested,
  settle
}: {
  open: () => boolean;
  requested: () => boolean;
  setExpanded: (value: boolean) => void;
  setRequested: (value: boolean) => void;
  settle: () => void;
}): void => {
  $effect(() => settle());
  $effect(() => {
    const next = open();
    if (next && !requested()) setExpanded(true);
    setRequested(next);
  });
};
