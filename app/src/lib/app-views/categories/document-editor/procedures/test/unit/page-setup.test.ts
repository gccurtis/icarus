import assert from "node:assert/strict";
import { test } from "vitest";
import {
  LANE,
  MAXIMUM_GUTTER,
  MAXIMUM_ZOOM,
  MINIMUM_GUTTER,
  fitZoom,
  gutterOf,
  guttersOf
} from "$app-views/categories/document-editor/procedures/page-setup";

const PAGE = 52;

const spans = (zoom: number): number => (PAGE * zoom) / 100 + MINIMUM_GUTTER + LANE;

test("fitting takes the whole width the surface has, less the least gutter and the lane", () => {
  const available = 60;
  const zoom = fitZoom(available, PAGE);

  assert.ok(spans(zoom) <= available, "the page fits");
  assert.ok(spans(zoom + 1) > available, "one point more would not");
});

test("fitting a surface narrower than the page asks for the smallest zoom", () => {
  assert.equal(fitZoom(20, PAGE), 50);
});

test("fitting never asks for more than a page can be drawn at", () => {
  assert.equal(fitZoom(500, PAGE), MAXIMUM_ZOOM);
});

test("the gutter opens to its maximum where there is room", () => {
  assert.equal(gutterOf(100, PAGE), MAXIMUM_GUTTER);
});

test("the gutter collapses rather than push the page off the surface", () => {
  assert.equal(gutterOf(54, PAGE), 1);
  assert.equal(gutterOf(52.5, PAGE), MINIMUM_GUTTER);
});

test("a page wider than the surface keeps the least gutter either side", () => {
  assert.equal(gutterOf(40, PAGE), MINIMUM_GUTTER);
});

test("the trailing gutter never gives up the lane, and the leading one gives way first", () => {
  assert.deepEqual(guttersOf(100, PAGE), { leading: MAXIMUM_GUTTER, trailing: MAXIMUM_GUTTER });

  const tight = guttersOf(PAGE + MINIMUM_GUTTER + LANE, PAGE);
  assert.equal(tight.trailing, LANE);
  assert.equal(tight.leading, MINIMUM_GUTTER);

  const tighter = guttersOf(PAGE, PAGE);
  assert.equal(tighter.trailing, LANE, "the lane is reserved even when nothing else fits");
  assert.equal(tighter.leading, MINIMUM_GUTTER);
});
