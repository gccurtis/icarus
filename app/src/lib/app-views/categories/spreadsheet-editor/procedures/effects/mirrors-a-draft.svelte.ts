/**
 * A field the reader may type in that otherwise shows what the sheet holds.
 *
 * The two directions are not symmetrical: the sheet overwrites the field
 * whenever its own value changes, and the field holds whatever was typed until
 * that happens. Keeping the arrangement here is what stops each control
 * re-deciding it.
 */
export const mirrorsADraft = (of: () => string): { current: string } => {
  let held = $state("");

  $effect(() => {
    held = of();
  });

  return {
    get current(): string {
      return held;
    },
    set current(next: string) {
      held = next;
    }
  };
};
