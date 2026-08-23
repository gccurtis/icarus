import type { ChartModel } from "$json-store/types/data/chart";
import { chartAxes } from "$lib/unique-components/chart/chart-model";
import type { ChartMark } from "$lib/unique-components/chart/chart-spec";

export type ChartSelectionTarget =
  | { kind: "chart"; chartId: string }
  | {
      kind: "datum";
      chartId: string;
      datumId: string;
      categoryId: string;
      seriesId: string;
    }
  | { kind: "category"; chartId: string; categoryId: string }
  | { kind: "series"; chartId: string; seriesId: string }
  | { kind: "axis"; chartId: string; axisId: string }
  | { kind: "element"; chartId: string; elementId: string };

export type ChartSelectionShape =
  | "none"
  | "one"
  | "category"
  | "series"
  | "axis"
  | "element"
  | "many";

/** A stable key for DOM state only; persisted identity stays in the target. */
export const chartTargetKey = (target: ChartSelectionTarget): string => {
  switch (target.kind) {
    case "chart":
      return `${target.chartId}:chart`;
    case "datum":
      return `${target.chartId}:datum:${target.datumId}`;
    case "category":
      return `${target.chartId}:category:${target.categoryId}`;
    case "series":
      return `${target.chartId}:series:${target.seriesId}`;
    case "axis":
      return `${target.chartId}:axis:${target.axisId}`;
    case "element":
      return `${target.chartId}:element:${target.elementId}`;
  }
};

const targetForMark = (chartId: string, mark: ChartMark): ChartSelectionTarget => ({
  kind: "datum",
  chartId,
  datumId: mark.datumId,
  categoryId: mark.categoryId,
  seriesId: mark.seriesId
});

/**
 * Selection for one chart surface.
 *
 * Targets carry semantic ids rather than positions. Sorting categories,
 * refreshing values or relaying the SVG therefore cannot move a selection to a
 * different bar. The store can also represent axes and annotations, which are
 * interactive chart parts but are not data marks.
 */
export const createChartSelection = () => {
  let targets = $state<ChartSelectionTarget[]>([]);

  const set = (next: readonly ChartSelectionTarget[]) => {
    const unique = new Map(next.map((target) => [chartTargetKey(target), target]));
    targets = [...unique.values()];
  };

  const toggle = (target: ChartSelectionTarget, additive: boolean) => {
    const key = chartTargetKey(target);
    const held = targets.some((entry) => chartTargetKey(entry) === key);
    if (!additive) {
      set(held && targets.length === 1 ? [] : [target]);
      return;
    }
    set(held ? targets.filter((entry) => chartTargetKey(entry) !== key) : [...targets, target]);
  };

  return {
    get targets(): readonly ChartSelectionTarget[] {
      return targets;
    },
    /** Compatibility for simple consumers; these are stable target keys. */
    get ids(): readonly string[] {
      return targets.map(chartTargetKey);
    },
    get count(): number {
      return targets.length;
    },
    get isEmpty(): boolean {
      return targets.length === 0;
    },

    has(target: ChartSelectionTarget): boolean {
      const key = chartTargetKey(target);
      return targets.some((entry) => chartTargetKey(entry) === key);
    },

    hasDatum(chartId: string, datumId: string): boolean {
      return targets.some(
        (target) =>
          target.kind === "datum" && target.chartId === chartId && target.datumId === datumId
      );
    },

    click(target: ChartSelectionTarget, additive = false) {
      toggle(target, additive);
    },

    mark(chartId: string, mark: ChartMark, additive = false) {
      toggle(targetForMark(chartId, mark), additive);
    },

    category(chart: ChartModel, categoryId: string, additive = false) {
      const visibleSeriesIds = new Set(
        chart.data.series.filter((entry) => !entry.hidden).map((entry) => entry.id)
      );
      const next = chart.data.datums
        .filter(
          (entry) =>
            entry.categoryId === categoryId && visibleSeriesIds.has(entry.seriesId)
        )
        .map((entry): ChartSelectionTarget => ({
          kind: "datum",
          chartId: chart.id,
          datumId: entry.id,
          categoryId: entry.categoryId,
          seriesId: entry.seriesId
        }));
      set(additive ? [...targets, ...next] : next);
    },

    series(chart: ChartModel, seriesId: string, additive = false) {
      const next = chart.data.datums
        .filter((entry) => entry.seriesId === seriesId)
        .map((entry): ChartSelectionTarget => ({
          kind: "datum",
          chartId: chart.id,
          datumId: entry.id,
          categoryId: entry.categoryId,
          seriesId: entry.seriesId
        }));
      set(additive ? [...targets, ...next] : next);
    },

    all(chartId: string, marks: readonly ChartMark[]) {
      set(marks.map((mark) => targetForMark(chartId, mark)));
    },

    /** Drop references that no longer exist after a source refresh. */
    prune(chart: ChartModel) {
      const datumById = new Map(chart.data.datums.map((entry) => [entry.id, entry]));
      const categoryIds = new Set(chart.data.categories.map((entry) => entry.id));
      const seriesIds = new Set(chart.data.series.map((entry) => entry.id));
      const elementIds = new Set(chart.elements.map((entry) => entry.id));
      const axisIds = new Set(chartAxes(chart).map((axis) => axis.id));

      set(
        targets.flatMap((target): ChartSelectionTarget[] => {
          if (target.chartId !== chart.id) return [];
          switch (target.kind) {
            case "chart":
              return [target];
            case "datum": {
              const current = datumById.get(target.datumId);
              return current === undefined
                ? []
                : [{
                    ...target,
                    categoryId: current.categoryId,
                    seriesId: current.seriesId
                  }];
            }
            case "category":
              return categoryIds.has(target.categoryId) ? [target] : [];
            case "series":
              return seriesIds.has(target.seriesId) ? [target] : [];
            case "element":
              return elementIds.has(target.elementId) ? [target] : [];
            case "axis":
              return axisIds.has(target.axisId) ? [target] : [];
          }
        })
      );
    },

    clear() {
      set([]);
    },

    get shape(): ChartSelectionShape {
      if (targets.length === 0) return "none";
      if (targets.length === 1) {
        const kind = targets[0].kind;
        if (kind === "axis" || kind === "element") return kind;
        return "one";
      }
      if (targets.every((target) => target.kind === "datum")) {
        const datums = targets.filter(
          (target): target is Extract<ChartSelectionTarget, { kind: "datum" }> =>
            target.kind === "datum"
        );
        if (new Set(datums.map((target) => target.categoryId)).size === 1) return "category";
        if (new Set(datums.map((target) => target.seriesId)).size === 1) return "series";
      }
      return "many";
    }
  };
};

export type ChartSelection = ReturnType<typeof createChartSelection>;
