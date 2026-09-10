export const SEMANTIC_GATES = [
  {
    path: ["representation", "data", "behavior", "semantic", "stored-materials.ts"],
    name: "semantic-material-ready-only",
    required: /hasExactFields\([\s\S]*?required,[\s\S]*?\["userDescription", "descriptor", "error"\][\s\S]*?material\.state !== "ready"[\s\S]*?material\.error !== undefined && !isStoredText\(material\.error, 10_000\)/,
    message: "semantic material admission no longer requires ready-only state with only its current degradation error"
  },
  {
    path: ["representation", "data", "behavior", "semantic", "test", "unit", "stored-materials.test.ts"],
    name: "semantic-material-ready-contract",
    required: /admits the sole usable current material state[\s\S]*?Optional visual description was unavailable[\s\S]*?rejects retired in-row work states and decorated fields[\s\S]*?state: "profiled"[\s\S]*?state: "describing"[\s\S]*?state: "stale"[\s\S]*?state: "error"/,
    message: "semantic material admission lacks its executable ready-only state contract"
  },
  {
    path: ["representation", "data", "behavior", "semantic", "stored-citations.ts"],
    name: "semantic-text-citation-discriminator",
    required: /if \(held\.evidenceKind === "text"\)[\s\S]*?\["evidenceKind",\s*"selections",\s*"source",\s*"span",\s*"overlayGeneration"\]/,
    message: "semantic text-citation admission does not require its explicit current discriminator"
  },
  {
    path: ["representation", "data", "behavior", "semantic", "stored-citations.ts"],
    name: "semantic-descriptor-facet-provenance",
    required: /held\.facet === "generated"[\s\S]*?"model", "promptVersion", "overlayGeneration"[\s\S]*?isStoredText\(held\.model, 500\)[\s\S]*?isStoredText\(held\.promptVersion, 500\)[\s\S]*?isStoredChoice\(held\.facet, \["identity", "profile", "authored", "nativeVisual"\]\)[\s\S]*?"inputHash",[\s\S]*?"overlayGeneration"/,
    message: "semantic descriptor admission no longer makes provenance exact to its generated facet"
  },
  {
    path: ["representation", "data", "behavior", "semantic", "test", "unit", "stored-citations.test.ts"],
    name: "semantic-descriptor-facet-contract",
    required: /requires provenance exactly on the generated descriptor facet[\s\S]*?withoutModel[\s\S]*?withoutVersion[\s\S]*?facet: "profile", model[\s\S]*?facet: "profile", promptVersion/,
    message: "semantic descriptor admission lacks its executable facet-dependent provenance contract"
  },
  {
    path: ["representation", "data", "behavior", "semantic", "stored-derived-output.ts"],
    name: "derived-output-value-lifecycle",
    required: /"definitionRevision", "valueSource",[\s\S]*?const noValue = row\.valueSource === "none"[\s\S]*?row\.queries\.length === 0 && row\.evidence\.length === 0[\s\S]*?const authoredValue = row\.valueSource === "authored"[\s\S]*?admitContentBlocks\(\[row\.lastResponse\]\)[\s\S]*?isStoredNatural\(row\.lastRevision\)[\s\S]*?const generatedValue = row\.valueSource === "generated"[\s\S]*?row\.evidence\.every\(isStoredSemanticCitation\)[\s\S]*?isStoredNatural\(row\.lastGeneration\)[\s\S]*?isStoredTime\(row\.refreshedAt\)[\s\S]*?if \(!noValue && !authoredValue && !generatedValue\) return false;[\s\S]*?row\.state === "idle" && !noValue[\s\S]*?row\.state === "fresh" && !generatedValue[\s\S]*?hasExactFields\(/,
    message: "Derived Output admission no longer requires its exact value-source and state lifecycle"
  },
  {
    path: ["representation", "data", "behavior", "semantic", "stored-derived-output.ts"],
    name: "derived-output-refresh-job-lifecycle",
    required: /row\.state === "queued"[\s\S]*?hasExactFields\(row, base, \["selection"\]\)[\s\S]*?row\.state === "running"[\s\S]*?hasExactFields\(row, \[\.\.\.base, "startedAt"\], \["selection"\]\)[\s\S]*?row\.state === "failed"[\s\S]*?hasExactFields\(row, \[\.\.\.base, "startedAt", "error"\], \["selection"\]\)/,
    message: "Derived Output refresh-job admission no longer requires one complete exact lifecycle arm"
  },
  {
    path: ["representation", "data", "behavior", "semantic", "test", "unit", "stored-derived-output.test.ts"],
    name: "derived-output-lifecycle-contract",
    required: /admits only coherent current value and lifecycle arms[\s\S]*?rejects implicit, partial, and mixed value shapes[\s\S]*?rejects partial and mixed refresh jobs/,
    message: "Derived Output admission lacks its executable exact value and refresh lifecycle contract"
  },
  {
    path: ["representation", "data", "behavior", "semantic", "stored-state.ts"],
    name: "semantic-job-lifecycle",
    required: /row\.state === "queued"[\s\S]*?hasExactFields\(row, base, \["force"\]\)[\s\S]*?row\.state === "running"[\s\S]*?hasExactFields\(row, \[\.\.\.base, "startedAt", "claimId", "leaseExpiresAt"\], \["force"\]\)[\s\S]*?row\.state === "failed"[\s\S]*?hasExactFields\(row, \[\.\.\.base, "error"\], \["force"\]\)/,
    message: "semantic job admission no longer requires exact queued, running, and failed lifecycle arms"
  },
  {
    path: ["representation", "data", "behavior", "semantic", "test", "unit", "stored-state.test.ts"],
    name: "semantic-job-lifecycle-contract",
    required: /admits each complete exact current arm[\s\S]*?rejects partial and mixed lifecycle arms[\s\S]*?rejects values no current writer persists/,
    message: "semantic job admission lacks its executable exact-lifecycle contract"
  },
  {
    path: ["representation", "data", "behavior", "semantic", "citation.ts"],
    name: "semantic-text-citation-reading",
    required: /const isText[\s\S]*?=>\s*citation\.evidenceKind === "text";/,
    message: "semantic citation behavior infers the text arm instead of reading its discriminator"
  }
];
