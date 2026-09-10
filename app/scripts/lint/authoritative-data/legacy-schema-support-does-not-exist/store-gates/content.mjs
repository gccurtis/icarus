export const CONTENT_GATES = [
  {
    path: ["representation", "data", "behavior", "content", "admission-values.ts"],
    name: "content-value-own-fields",
    required: /export const recordOf[\s\S]*?storedFields\(value\);[\s\S]*?export const exact[\s\S]*?hasExactFields\(value, required, optional\);/,
    message: "content admission ignores non-enumerable or symbolic own fields"
  },
  {
    path: ["representation", "data", "behavior", "content", "admission-inline.ts"],
    name: "formula-atom-fresh-only",
    required: /atom\.kind === "formula"[\s\S]*?\["id", "kind", "expression", "lastResolvedValue", "lastResolvedDisplay", "state"\],[\s\S]*?\["formulaId"\][\s\S]*?atom\.state === "fresh"/,
    message: "formula-atom admission no longer requires one exact fresh resolved snapshot"
  },
  {
    path: ["representation", "data", "behavior", "content", "admission.ts"],
    name: "formula-block-fresh-only",
    required: /block\.type === "formula"[\s\S]*?\["id", "type", "expression", "display", "value", "state"\],[\s\S]*?\["formulaId", "format"\][\s\S]*?block\.state === "fresh" &&[\s\S]*?\(block\.format === undefined \|\| currentFormat\(block\.format\)\);\s*\}\s*if \(block\.type === "image"\)/,
    message: "formula-block admission no longer requires one exact fresh snapshot without resolvedAt"
  },
  {
    path: ["representation", "data", "behavior", "content", "test", "unit", "admission.test.ts"],
    name: "formula-fresh-only-contract",
    required: /admits only the current resolved formula snapshot[\s\S]*?\["stale", "computing", "error"\][\s\S]*?error: "division by zero"[\s\S]*?resolvedAt: 10/,
    message: "formula admission lacks its executable fresh-only and retired-field contract"
  },
  {
    path: ["representation", "data", "behavior", "content", "admission.ts"],
    name: "prompt-block-explicit-owner",
    required: /const linked = Object\.hasOwn\(block, "derivedOutputId"\);/,
    message: "prompt-block admission infers its definition owner from a value instead of exact own-key presence"
  },
  {
    path: ["representation", "data", "behavior", "content", "admission.ts"],
    name: "prompt-block-exact-lifecycle",
    required: /const presentation = \["style", "hole", "format"\];[\s\S]*?if \(!linked\) \{[\s\S]*?block\.state !== "idle"[\s\S]*?exact\(block, base, \[\.\.\.presentation, "scope", "prompt"\]\)[\s\S]*?isStoredRowId\(block\.derivedOutputId, "derivedOutputs"\)[\s\S]*?block\.state === "idle"[\s\S]*?exact\(block, linkedBase, presentation\)[\s\S]*?block\.state === "stale"[\s\S]*?exact\(block, linkedBase, \[\.\.\.presentation, "refreshedAt"\]\)[\s\S]*?block\.state === "fresh"[\s\S]*?exact\(block, \[\.\.\.linkedBase, "refreshedAt"\], presentation\)[\s\S]*?block\.state === "error"[\s\S]*?exact\(block, \[\.\.\.linkedBase, "error"\], \[\.\.\.presentation, "refreshedAt"\]\)/,
    message: "prompt-block admission no longer enforces exact unlinked-idle and linked lifecycle arms"
  },
  {
    path: ["representation", "data", "behavior", "content", "test", "unit", "admission.test.ts"],
    name: "prompt-block-lifecycle-contract",
    required: /admits each complete prompt lifecycle arm and rejects partial or mixed arms[\s\S]*?state: "fresh",[\s\S]*?state: "error",[\s\S]*?state: "generating"/,
    message: "prompt-block admission lacks its executable owner-exclusive lifecycle contract"
  }
];
