import assert from "node:assert/strict";
import { test } from "node:test";
import { latestQuestion, toolNames, toolResult } from "./browser-provider-input.mjs";

test("only the absence of a tool result starts a fixture's first turn", () => {
  assert.equal(toolResult({ messages: [{ role: "user", content: "Question" }] }), undefined);
  assert.deepEqual(toolResult({ messages: [
    { role: "tool", content: JSON.stringify({ ok: true, value: { hits: [] } }) }
  ] }), { hits: [] });
});

test("a failed fixture tool ends the provider request instead of requesting it forever", () => {
  assert.throws(() => toolResult({ messages: [
    { role: "tool", content: JSON.stringify({ ok: false, error: "outside scope" }) }
  ] }), /fixture tool failed: outside scope/);
});

test("malformed fixture tool envelopes are not silently treated as first turns", () => {
  for (const content of [null, "null", "{}", '{"ok":true}', "not-json"]) {
    assert.throws(() => toolResult({ messages: [{ role: "tool", content }] }));
  }
});

test("the fixture reads the latest question and the declared tool names", () => {
  assert.equal(latestQuestion({ messages: [
    { role: "user", content: "Old question" },
    { role: "user", content: [{ type: "text", text: "Current question" }] }
  ] }), "Current question");
  assert.deepEqual(toolNames({ tools: [{ function: { name: "retrieve" } }, {}] }), ["retrieve"]);
});
