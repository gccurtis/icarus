/**
 * Static evidence that a named contract is executable rather than a prose stub.
 * Runtime truth still comes from the test runner; architecture lint verifies
 * that the required contract exists and visibly exercises the named concepts.
 */
export const executableContract = (text, concepts = []) =>
  /\b(?:test|it)\s*\(/.test(text) &&
  /\b(?:assert|expect)\s*(?:\.|\()/.test(text) &&
  concepts.every((concept) => text.toLowerCase().includes(concept.toLowerCase()));
