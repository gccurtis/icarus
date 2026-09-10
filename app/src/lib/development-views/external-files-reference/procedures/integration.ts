/** The integration record distinguishes executable coverage from completed certification. */
export const integrationChecks = [
  ["Checker and generator contracts", "Passed", "328 tests, including schema-regression mutations and fail-fast provider-fixture contracts."],
  ["Live provider workflows", "Passed", "All five configured Jina/OpenRouter Chromium tests passed: direct generation, named variables, document and deck Prompt Blocks, and Research across a tab switch and reload. These runs use user-approved fictional seeded data."],
  ["Application contracts", "Passed", "2,024 application tests passed; two opt-in live-provider tests were not counted as passes. Typecheck reported zero errors and warnings; production build passed."],
  ["Reload during generation", "Passed", "Both exact External document grounding and delayed publication across reload passed in Chromium; the persisted result and citation were verified."],
  ["Local Chromium workflows", "Passed", "114 tests passed; the five opt-in provider tests were skipped here and passed separately against the live services. Disposable Store/native-file directories keep these contracts separate from the manual demo."],
  ["Architecture", "Passed", "90 checks clean with no new findings. 179 existing baselined entries remain; this does not claim that the whole repository has no architectural debt."],
  ["Final application certification", "Passed", "The final frozen-source Chromium run passed all 114 local workflows after the Research scope and exact-configuration fixes. Screenshots were reviewed for editor placement, file-path clarity, and External reference layout."],
  ["Merge and push", "Pending", "Main's 3,054 source files match the preserved pre-integration snapshot byte-for-byte."]
] as const;

export const integrationWorkflows = [
  {
    title: "Manage native files",
    path: "test/browser/external-files.spec.ts",
    proof: "Upload → inspect → rename → move → re-upload → download → History → delete → reload. Checks stable identity, exact bytes, ETag, range and conditional requests, and stale download refusal."
  },
  {
    title: "Import directories",
    path: "test/browser/external-files.spec.ts",
    proof: "Real Chromium folder selection over a source tree and an 8 MiB payload. Nested, dotted, Unicode and duplicate-leaf paths survive directory relocation, reload, and hash-checked download."
  },
  {
    title: "Fill template text and scope holes",
    path: "test/browser/template-features.spec.ts",
    proof: "Fill a text hole; generate from source A; choose source B and prove A is excluded; reload before and after generation. A separate case scopes the resulting document Prompt Block to an uploaded External file."
  },
  {
    title: "Give an Agent exact evidence",
    path: "test/browser/agents-external.spec.ts",
    proof: "Upload fictional evidence → select it in a persona → inherit the exact scope in a task → verify grounded output and citation → reload → refuse deletion while referenced. Same-named files in different folders show their paths while retaining exact resource identity."
  },
  {
    title: "Author document and deck Prompt Blocks",
    path: "test/browser/document-external-prompt.spec.ts · test/browser/document-delayed-prompt.spec.ts · test/browser/slide-deck-editor.spec.ts",
    proof: "Direct authoring, exact uploaded-file scope, generation, editable output, citation navigation, and persistence. A delayed-provider contract reloads the page before generation finishes, then checks that the document adopts and saves the completed publication."
  },
  {
    title: "Research without a stuck turn",
    path: "test/browser/research-chat.spec.ts",
    proof: "The apples arithmetic question finishes as insufficient instead of an ingestion failure. Separate contracts prove in-flight tab switching, reload, and exact scope selection between same-named files in different folders."
  },
  {
    title: "Edit spreadsheets across tabs",
    path: "test/browser/spreadsheet-editor.spec.ts · test/browser/resource-creation.spec.ts",
    proof: "Drag forward and backward formula ranges, compute, save and reload. Switch sheet → document → sheet → Agents → sheet without stale input ownership. Creation uses a real durable resource ID; rapid opening keystrokes survive the canvas-to-input focus handoff."
  }
] as const;

export const integrationBoundaries = [
  ["One current schema", "Exact own-field and nested-value admission at command, durable-read, transaction, and recovery boundaries. Invalid data fails closed; no legacy readers, migration scripts, compatibility aliases, or repair-on-read."],
  ["Owned state", "Component state has an instance and lifetime. Effects and commands live in named procedures. Workspace owns tab runtimes; ServerModel owns active operations and their release."],
  ["Atomic changes", "One Store unit of work publishes a coherent intent. Durable journal recovery and failpoint tests cover rows, revisions, back references, History, and semantic queue work. Native file claims reconcile only after Store recovery."],
  ["Reviewable modules", "Table vocabulary is grouped by domain. Template admission is split by body kind; file storage by operation; upload by admission/publication/settlement; editors by projection, interaction, and lifecycle. Checker mutation fixtures are grouped by the boundary they exercise."],
  ["Independent editors", "Document, deck and spreadsheet keep their own state and procedure owners. Similar inspector design does not introduce a shared editor runtime or shared mutable state."],
  ["Honest verification", "Deterministic provider contracts verify application workflows; separate configured-provider runs verify actual service integration. A skipped test is not a pass. Existing architecture baseline debt is reported separately from new findings."]
] as const;

export const integrationLimits = [
  "PDF, Office, archives, audio and video are managed and downloadable, not parsed or previewed. Prose, source code, structured data and images follow their explicitly supported semantic lanes.",
  "Buffered uploads are bounded, not resumable. A History entry is not a version browser or a promise that unreferenced predecessor bytes are retained.",
  "Clean changed-code checks do not certify every older file in the repository. Existing architecture debt remains subject to its explicit baseline and review dates.",
  "Live-provider runs transmit only the user-approved seeded/demo content. Ordinary browser contracts use a local deterministic provider and disposable Store/native-file directories."
] as const;
