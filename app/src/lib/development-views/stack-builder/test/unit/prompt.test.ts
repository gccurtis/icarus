import assert from "node:assert/strict";
import { test } from "vitest";
import { buildMessages } from "$development-views/stack-builder/procedures/prompt.server";
import type { StackNode } from "$development-views/stack-builder/types";

const nodes: StackNode[] = [
  {
    kind: "component",
    id: "n1",
    source: "authored",
    name: "PanelStat",
    path: "src/lib/components/authored/panel/panel-stat.svelte",
    description: "the total number of findings"
  },
  { kind: "custom", id: "n2", name: "A verdict ribbon", description: "pass or fail, in one line" }
];

const input = {
  title: "Findings flank",
  nodes,
  brief: ":root { --token-ink-primary: black }",
  sources: [{ name: "PanelStat", path: "a/b.svelte", text: "<script>let {}</script>" }]
};

test("the system message forbids utility classes and names the token vocabulary", () => {
  const { system } = buildMessages(input);
  assert.match(system, /--token-/);
  assert.match(system, /utility class/i);
});

test("the system message warns that the sources it is shown are full of utility classes", () => {
  const { system } = buildMessages(input);
  assert.match(system, /DO NOT EXIST/);
  assert.match(system, /translate/i);
});

test("the system message refuses scripts, because the frame is sandboxed", () => {
  assert.match(buildMessages(input).system, /sandboxed/i);
});

test("the user message carries every entry's name and description", () => {
  const { user } = buildMessages(input);
  assert.match(user, /PanelStat/);
  assert.match(user, /the total number of findings/);
  assert.match(user, /A verdict ribbon/);
  assert.match(user, /pass or fail, in one line/);
});

test("the brief is carried verbatim, because it is the token vocabulary", () => {
  assert.match(buildMessages(input).user, /--token-ink-primary: black/);
});

test("a custom entry is marked as having no component behind it", () => {
  assert.match(buildMessages(input).user, /no component/i);
});

test("an entry nobody described says so rather than reading as blank", () => {
  const bare = buildMessages({ ...input, nodes: [{ ...nodes[0], description: "  " } as StackNode] });
  assert.match(bare.user, /nothing said/);
});

test("component source is included under the name it was found for", () => {
  const { user } = buildMessages(input);
  assert.match(user, /a\/b\.svelte/);
  assert.match(user, /let \{\}/);
});

test("without feedback the round asks for a mock, with feedback it asks for a revision", () => {
  assert.doesNotMatch(buildMessages(input).user, /revise/i);

  const revised = buildMessages({ ...input, previous: "<p>old</p>", feedback: "too heavy" });
  assert.match(revised.user, /revise/i);
  assert.match(revised.user, /too heavy/);
  assert.match(revised.user, /<p>old<\/p>/);
});

test("feedback with no previous mock is a first pass, not a revision of nothing", () => {
  assert.doesNotMatch(buildMessages({ ...input, feedback: "too heavy" }).user, /revise/i);
});
