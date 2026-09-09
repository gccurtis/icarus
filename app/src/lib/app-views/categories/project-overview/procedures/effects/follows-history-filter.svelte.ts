import { readProjectHistory } from "$capabilities/project/index.remote";

/** Own the reactive query root while the reader changes the history filters. */
export const followsHistoryFilter = (
  search: () => string,
  since: () => number | null
) => {
  let answer = $state.raw(
    readProjectHistory({ search: search(), since: since(), before: null, limit: 50 })
  );

  $effect(() => {
    answer = readProjectHistory({ search: search(), since: since(), before: null, limit: 50 });
  });

  return {
    get current() {
      return answer;
    }
  };
};
