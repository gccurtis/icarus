import { describe, expect, it } from "vitest";

import { moveChartFrame, resizeChartFrame, type ChartFrame } from "$lib/unique-components/chart";

const frame: ChartFrame = { x: 40, y: 30, width: 300, height: 200 };

describe("chart frame", () => {
  it("moves without changing chart size", () => {
    expect(moveChartFrame(frame, 25, -10)).toEqual({ x: 65, y: 20, width: 300, height: 200 });
  });

  it("keeps the complete chart reachable inside optional bounds", () => {
    expect(moveChartFrame(frame, 500, 500, { width: 600, height: 400 })).toEqual({
      x: 300,
      y: 200,
      width: 300,
      height: 200
    });
  });

  it("resizes from the south-east corner with minimums and bounds", () => {
    expect(
      resizeChartFrame(frame, -500, -500, { width: 600, height: 400 }, { width: 240, height: 180 })
    ).toEqual({ x: 40, y: 30, width: 240, height: 180 });
    expect(resizeChartFrame(frame, 500, 500, { width: 600, height: 400 })).toEqual({
      x: 40,
      y: 30,
      width: 560,
      height: 370
    });
  });
});
