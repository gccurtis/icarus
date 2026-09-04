import assert from "node:assert/strict";
import { test } from "vitest";
import {
  componentSources,
  describeById,
  findById,
  insertAt,
  insertInto,
  isDescendant,
  moveInto,
  moveTo,
  removeById
} from "$development-views/stack-builder/procedures/manifest";
import type { StackNode, SubstackNode } from "$development-views/stack-builder/types";

const component = (id: string, over: Partial<StackNode> = {}): StackNode =>
  ({
    kind: "component",
    id,
    source: "authored",
    name: "PanelStat",
    path: "src/lib/components/authored/panel/panel-stat.svelte",
    description: "",
    ...over
  }) as StackNode;

test("an insert lands at the index it names", () => {
  const nodes = [component("a"), component("b")];
  assert.deepEqual(
    insertAt(nodes, component("c"), 1).map((node) => node.id),
    ["a", "c", "b"]
  );
});

test("an insert past the end lands at the end", () => {
  const nodes = [component("a")];
  assert.deepEqual(
    insertAt(nodes, component("b"), 9).map((node) => node.id),
    ["a", "b"]
  );
});

test("a removal leaves the rest in order", () => {
  const nodes = [component("a"), component("b"), component("c")];
  assert.deepEqual(
    removeById(nodes, "b").map((node) => node.id),
    ["a", "c"]
  );
});

test("removing an id that is not there changes nothing", () => {
  const nodes = [component("a")];
  assert.deepEqual(removeById(nodes, "z"), nodes);
});

test("a move takes the node out before it puts it back, so the index means the result", () => {
  const nodes = [component("a"), component("b"), component("c")];
  assert.deepEqual(
    moveTo(nodes, "a", 2).map((node) => node.id),
    ["b", "c", "a"]
  );
});

test("moving a node onto itself is the identity", () => {
  const nodes = [component("a"), component("b")];
  assert.deepEqual(moveTo(nodes, "a", 0), nodes);
});

test("a description replaces only the node it names", () => {
  const nodes = [component("a"), component("b")];
  const after = describeById(nodes, "b", "the total");
  assert.equal(findById(after, "b")?.description, "the total");
  assert.equal(findById(after, "a")?.description, "");
});

const group = (id: string, children: StackNode[]): SubstackNode => ({
  kind: "substack",
  id,
  name: "Header",
  description: "",
  children
});

test("an insert into a substack lands among its children", () => {
  const nodes = [component("a"), group("g", [component("b")])];
  const after = insertInto(nodes, "g", component("c"), 0);
  assert.deepEqual((after[1] as SubstackNode).children.map((node) => node.id), ["c", "b"]);
  assert.equal(after.length, 2);
});

test("a node nested any depth down is found and described", () => {
  const nodes = [group("g", [group("h", [component("deep")])])];
  assert.equal(findById(nodes, "deep")?.id, "deep");
  const after = describeById(nodes, "deep", "the total");
  assert.equal(findById(after, "deep")?.description, "the total");
});

test("removing a substack takes its children with it", () => {
  const nodes = [component("a"), group("g", [component("b")])];
  assert.deepEqual(
    removeById(nodes, "g").map((node) => node.id),
    ["a"]
  );
  assert.equal(findById(removeById(nodes, "g"), "b"), undefined);
});

test("removing a child reaches into the substack and leaves it standing", () => {
  const nodes = [group("g", [component("b"), component("c")])];
  const after = removeById(nodes, "b");
  assert.deepEqual((after[0] as SubstackNode).children.map((node) => node.id), ["c"]);
});

test("a node moves out of a substack to the root", () => {
  const nodes = [component("a"), group("g", [component("b")])];
  const after = moveInto(nodes, "b", null, 0);
  assert.deepEqual(
    after.map((node) => node.id),
    ["b", "a", "g"]
  );
  assert.deepEqual((after[2] as SubstackNode).children, []);
});

test("a node moves from the root into a substack", () => {
  const nodes = [component("a"), group("g", [])];
  const after = moveInto(nodes, "a", "g", 0);
  assert.deepEqual(
    after.map((node) => node.id),
    ["g"]
  );
  assert.deepEqual((after[0] as SubstackNode).children.map((node) => node.id), ["a"]);
});

test("a substack cannot be moved into itself or into its own descendant", () => {
  const nodes = [group("g", [group("h", [])])];
  assert.deepEqual(moveInto(nodes, "g", "g", 0), nodes);
  assert.deepEqual(moveInto(nodes, "g", "h", 0), nodes);
});

test("descent is transitive, so a substack cannot be moved into its own grandchild", () => {
  const nodes = [group("g", [group("h", [component("deep")])])];
  assert.equal(isDescendant(nodes, "h", "g"), true);
  assert.equal(isDescendant(nodes, "deep", "g"), true);
  assert.equal(isDescendant(nodes, "deep", "h"), true);
  assert.equal(isDescendant(nodes, "g", "h"), false);
  assert.deepEqual(moveInto(nodes, "g", "deep", 0), nodes);
});

test("the component sources walk into substacks", () => {
  const nodes = [
    group("g", [
      component("b", {
        name: "PanelRow",
        path: "src/lib/components/authored/panel/panel-row.svelte"
      } as Partial<StackNode>)
    ])
  ];
  assert.deepEqual(
    componentSources(nodes).map((source) => source.name),
    ["PanelRow"]
  );
});

test("the component sources are the component nodes, deduplicated by path", () => {
  const nodes = [
    component("a"),
    component("b"),
    component("c", {
      name: "PanelRow",
      path: "src/lib/components/authored/panel/panel-row.svelte"
    } as Partial<StackNode>),
    { kind: "custom", id: "d", name: "A banner", description: "" } as StackNode
  ];
  assert.deepEqual(
    componentSources(nodes).map((source) => source.name),
    ["PanelStat", "PanelRow"]
  );
});
