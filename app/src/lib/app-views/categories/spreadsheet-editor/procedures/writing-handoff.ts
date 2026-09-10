export type WritingHandoff = {
  readonly text: string;
  readonly selectAll: boolean;
};

/** Preserves every printable key while the grid hands writing to the field. */
export const continueWritingHandoff = (
  current: WritingHandoff | undefined,
  shown: string,
  seed: string
): WritingHandoff => {
  if (current === undefined) {
    return seed === ""
      ? { text: shown, selectAll: true }
      : { text: seed, selectAll: false };
  }
  if (seed === "") return current;
  return {
    text: current.selectAll ? seed : current.text + seed,
    selectAll: false
  };
};
