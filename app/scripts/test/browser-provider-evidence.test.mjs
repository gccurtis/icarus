import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DERIVED_QUERY,
  derivedDecisionFor,
  embeddingFor
} from "./browser-provider-evidence.mjs";

test("the derived query ranks both seeded scoped evidence passages above unrelated spans", () => {
  assert.deepEqual(embeddingFor(DERIVED_QUERY), [1, 0, 0, 0]);
  assert.deepEqual(
    embeddingFor("The remaining transfer capability is 220 MW."),
    [1, 0, 0, 0]
  );
  assert.deepEqual(
    embeddingFor("Protection isolated the transformer bank at 14:18 after the alarm."),
    [1, 0, 0, 0]
  );
  assert.deepEqual(embeddingFor("An unrelated title span."), [0, 1, 0, 0]);
});

test("a derived decision returns the exact retrieved scoped span and its issued evidence id", () => {
  for (const exact of [
    "The remaining transfer capability is 220 MW from the selected source.",
    "Protection isolated the transformer bank at 14:18 after the selected alarm."
  ]) {
    assert.deepEqual(
      derivedDecisionFor({
        hits: [
          { evidenceId: "evidence-title", span: { text: "An unrelated title" } },
          { evidenceId: "evidence-scoped", span: { text: exact } }
        ]
      }),
      {
        status: "answered",
        response: exact,
        evidence: [
          {
            evidenceId: "evidence-scoped",
            use: "Proves which selected source supplied the generated response."
          }
        ]
      }
    );
  }
});

test("the fixture invents no answer when retrieval issued no usable evidence", () => {
  assert.deepEqual(derivedDecisionFor({ hits: [] }), {
    status: "insufficient",
    response: "",
    evidence: []
  });
});
