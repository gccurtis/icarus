export const TARGET_SENTENCE = "Substation 14 is the binding constraint";
export const DERIVED_QUERY = "selected source material";
export const DERIVED_EVIDENCE = [
  "remaining transfer capability",
  "Protection isolated the transformer bank at 14:18"
];

/** The fixture gives grounded target passages and their query one exact vector. */
export const embeddingFor = (value) => {
  const text = String(value).toLowerCase();
  const isGroundedFixtureEvidence = [TARGET_SENTENCE, ...DERIVED_EVIDENCE]
    .some((needle) => text.includes(needle.toLowerCase()));
  return isGroundedFixtureEvidence || text === DERIVED_QUERY
    ? [1, 0, 0, 0]
    : [0, 1, 0, 0];
};

const usableHit = (candidate) =>
  typeof candidate?.evidenceId === "string" &&
  typeof candidate?.span?.text === "string" &&
  candidate.span.text.trim().length > 0;

/** Build a synthesis result only from evidence issued by the real retrieve tool. */
export const derivedDecisionFor = (result) => {
  const hits = Array.isArray(result?.hits) ? result.hits.filter(usableHit) : [];
  const hit = hits.find((candidate) =>
    DERIVED_EVIDENCE.some((needle) =>
      candidate.span.text.toLowerCase().includes(needle.toLowerCase())
    )
  ) ?? hits[0];

  return hit === undefined
    ? { status: "insufficient", response: "", evidence: [] }
    : {
        status: "answered",
        response: hit.span.text,
        evidence: [
          {
            evidenceId: hit.evidenceId,
            use: "Proves which selected source supplied the generated response."
          }
        ]
      };
};
