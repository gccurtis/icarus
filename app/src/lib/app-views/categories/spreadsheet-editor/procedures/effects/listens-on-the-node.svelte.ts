/**
 * An event the framework cannot bind, listened for while the node is on screen.
 *
 * A selection inside rendered text is read from the document rather than from a
 * property, so it arrives as a plain listener. The node comes as a function
 * because it is bound after the script runs.
 */
export const listensOnTheNode = (
  node: () => HTMLElement | null,
  event: string,
  handler: (event: Event) => void
): void => {
  $effect(() => {
    const element = node();
    if (element === null) return;

    element.addEventListener(event, handler);
    return () => element.removeEventListener(event, handler);
  });
};
