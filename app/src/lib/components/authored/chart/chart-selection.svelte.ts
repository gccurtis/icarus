import { markId, readMarkId, type Mark } from "$authored-components/chart/chart-spec";

/**
 * What is selected in a chart.
 *
 * **A chart is not a picture, it is a set of things you can point at.** That is
 * the whole difference between a chart you can present from and one you can only
 * look at: selecting one bar of a cluster, or three slices, is what every
 * subsequent operation — recolour this one, annotate that one, pull this slice
 * out — has to be built on. Without a selection there is nowhere to hang any of
 * them.
 *
 * **Selection is by id, not by index.** Ids come from the category and the
 * series, so sorting the chart, filtering a category out or hiding a series
 * leaves the selection pointing at the same things it did before. An
 * index-keyed selection silently moves to different bars the moment the order
 * changes, which is the bug that makes a selection feel haunted.
 *
 * **The gestures are the ones people already have.** Click replaces, shift-click
 * or meta-click adds, clicking the same thing again with a modifier removes it,
 * clicking empty space clears. Selecting a whole category or a whole series is a
 * separate call rather than a modifier, because those are reached by clicking an
 * axis label or a legend entry — different targets, so they need no modifier of
 * their own.
 *
 * One instance per chart, created by the chart and handed down. Not a module
 * singleton: two charts on one screen have two selections, and a shared one
 * would make selecting in either clear the other.
 */
export const createChartSelection = () => {
  let ids = $state<string[]>([]);

  const set = (next: readonly string[]) => {
    ids = [...new Set(next)];
  };

  return {
    get ids(): readonly string[] {
      return ids;
    },
    get count(): number {
      return ids.length;
    },
    get isEmpty(): boolean {
      return ids.length === 0;
    },

    has: (id: string) => ids.includes(id),

    /**
     * The ordinary click. `additive` is shift or meta being held: it toggles
     * rather than adds, so a modifier-click on something already selected takes
     * it out — which is what makes a mis-click recoverable without starting the
     * selection over.
     */
    click(id: string, additive = false) {
      if (!additive) {
        set(ids.length === 1 && ids[0] === id ? [] : [id]);
        return;
      }
      set(ids.includes(id) ? ids.filter((held) => held !== id) : [...ids, id]);
    },

    /** Everything in one column or slice group — an axis label's click. */
    category(category: string, series: readonly { key: string }[], additive = false) {
      const next = series.map((entry) => markId(category, entry.key));
      set(additive ? [...ids, ...next] : next);
    },

    /** One series across every category — a legend entry's click. */
    series(seriesKey: string, categories: readonly string[], additive = false) {
      const next = categories.map((category) => markId(category, seriesKey));
      set(additive ? [...ids, ...next] : next);
    },

    /** Everything drawn. */
    all(marks: readonly Mark[]) {
      set(marks.map((mark) => mark.id));
    },

    clear() {
      set([]);
    },

    /**
     * What is selected, described.
     *
     * A count is not enough for the thing that reads this — a panel inspecting
     * the selection needs to know whether it is looking at one bar, one whole
     * series, or an arbitrary handful, because those offer different actions.
     */
    get shape(): "none" | "one" | "category" | "series" | "many" {
      if (ids.length === 0) return "none";
      if (ids.length === 1) return "one";

      const parts = ids.map(readMarkId);
      const categories = new Set(parts.map((part) => part.category));
      const seriesKeys = new Set(parts.map((part) => part.seriesKey));

      if (categories.size === 1) return "category";
      if (seriesKeys.size === 1) return "series";
      return "many";
    }
  };
};

export type ChartSelection = ReturnType<typeof createChartSelection>;
