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

const spans = (zoom: number, reserveCommentLane: boolean): number =>
  (PAGE * zoom) / 100 + MINIMUM_GUTTER + (reserveCommentLane ? LANE : MINIMUM_GUTTER);

test("fitting a commented document leaves room for its comment lane", () => {
  const available = 60;
  const zoom = fitZoom(available, PAGE, true);

  assert.ok(spans(zoom, true) <= available, "the page and comment lane fit");
  assert.ok(spans(zoom + 1, true) > available, "one point more would not");
});

test("fitting an uncommented document uses both minimum gutters symmetrically", () => {
  const available = 60;
  const zoom = fitZoom(available, PAGE, false);

  assert.ok(spans(zoom, false) <= available, "the centered page fits");
  assert.ok(spans(zoom + 1, false) > available, "one point more would not");
  assert.ok(zoom > fitZoom(available, PAGE, true), "the unused lane is reclaimed for the page");
});

test("fitting a surface narrower than the page asks for the smallest zoom", () => {
  assert.equal(fitZoom(20, PAGE, false), 50);
});

test("fitting never asks for more than a page can be drawn at", () => {
  assert.equal(fitZoom(500, PAGE, false), MAXIMUM_ZOOM);
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
  assert.deepEqual(guttersOf(100, PAGE, true), {
    leading: MAXIMUM_GUTTER,
    trailing: MAXIMUM_GUTTER
  });

  const tight = guttersOf(PAGE + MINIMUM_GUTTER + LANE, PAGE, true);
  assert.equal(tight.trailing, LANE);
  assert.equal(tight.leading, MINIMUM_GUTTER);

  const tighter = guttersOf(PAGE, PAGE, true);
  assert.equal(tighter.trailing, LANE, "the lane is reserved even when nothing else fits");
  assert.equal(tighter.leading, MINIMUM_GUTTER);
});

test("an uncommented page always has balanced gutters", () => {
  assert.deepEqual(guttersOf(100, PAGE, false), {
    leading: MAXIMUM_GUTTER,
    trailing: MAXIMUM_GUTTER
  });
  assert.deepEqual(guttersOf(54, PAGE, false), { leading: 1, trailing: 1 });
  assert.deepEqual(guttersOf(PAGE, PAGE, false), {
    leading: MINIMUM_GUTTER,
    trailing: MINIMUM_GUTTER
  });
});
