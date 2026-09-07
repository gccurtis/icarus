<script lang="ts">
  import Activity from "@lucide/svelte/icons/activity";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import BookOpen from "@lucide/svelte/icons/book-open";
  import Braces from "@lucide/svelte/icons/braces";
  import Check from "@lucide/svelte/icons/check";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import CircleDot from "@lucide/svelte/icons/circle-dot";
  import Database from "@lucide/svelte/icons/database";
  import FileCode2 from "@lucide/svelte/icons/file-code-2";
  import GitBranch from "@lucide/svelte/icons/git-branch";
  import History from "@lucide/svelte/icons/history";
  import KeyRound from "@lucide/svelte/icons/key-round";
  import LockKeyhole from "@lucide/svelte/icons/lock-keyhole";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Search from "@lucide/svelte/icons/search";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  type AlgorithmId = "agent" | "citation" | "publication" | "freshness";
  type ScenarioId = "stable" | "cited-change" | "unrelated" | "no-evidence" | "user-edit" | "failure";
  type FileGroup = "configuration" | "model" | "representation" | "capability" | "runtime" | "tests" | "artifact";

  type Algorithm = {
    id: AlgorithmId;
    number: string;
    label: string;
    title: string;
    summary: string;
    equations: { expression: string; meaning: string }[];
    steps: string[];
    invariants: string[];
    complexity: string;
  };

  type Scenario = {
    id: ScenarioId;
    label: string;
    headline: string;
    note: string;
    result: string;
    tone: "success" | "active" | "warning";
    steps: { label: string; detail: string; state: "done" | "retry" | "kept" }[];
  };

  type LedgerEntry = {
    group: FileGroup;
    action: "add" | "change" | "move";
    path: string;
    lines: string;
    symbols: string;
    change: string;
    reason: string;
  };

  const ALGORITHMS: Algorithm[] = [
    {
      id: "agent",
      number: "01",
      label: "Tool agent",
      title: "A bounded OpenRouter loop, without a planner.",
      summary:
        "The intelligence model owns one OpenAI-compatible conversation loop. Derived Output supplies the grounding prompt, one retrieval tool, and a strict final-output schema. The first turn is forced to retrieve; subsequent turns may retrieve again or finish.",
      equations: [
        { expression: "M₀ = [system, user]", meaning: "Start with two messages and no hidden plan artifact." },
        { expression: "choice₁ = force(retrieve)", meaning: "The model cannot answer before initiating retrieval." },
        { expression: "Mₜ₊₁ = Mₜ + assistant(calls) + tool(results)", meaning: "Every call/result pair is replayed exactly." },
        { expression: "provider requests ≤ R + 1", meaning: "R tool rounds plus at most one structured final turn." }
      ],
      steps: [
        "Validate unique non-blank tool names and the requested first tool before any network call.",
        "POST system/user messages, the retrieval schema, strict response JSON Schema, forced retrieve choice, disabled parallel calls, reasoning effort, and the output limit.",
        "Parse exactly one provider choice; reject malformed content, call IDs, names, arguments, or usage shapes.",
        "Execute requested handlers sequentially. Invalid JSON, unknown tools, and handler failures return bounded tool errors so the model can recover.",
        "Append the assistant tool-call message and each tool result, then invoke the provider again with automatic tool choice.",
        "Parse final JSON through application code and return the trusted value, call trace, request/token/reasoning/cost totals, or a stable bounded error."
      ],
      invariants: ["no planner row", "one retrieval tool", "forced first retrieval", "strict final JSON", "bounded rounds", "secrets stay server-side"],
      complexity: "Local orchestration is O(R + C); wall time is dominated by at most R + 1 model requests plus the retrieval calls the model chooses."
    },
    {
      id: "citation",
      number: "02",
      label: "Evidence selection",
      title: "Retrieval returns the evidence; the model selects what it used.",
      summary:
        "Each synthesis attempt owns an ephemeral evidence registry. Retrieve immediately returns exact span text and an application-issued ID. The final structured decision can select those IDs, but cannot invent source coordinates or provenance.",
      equations: [
        { expression: "R[evidence-i] = SemanticHit", meaning: "Issued IDs map only to trusted query results from this attempt." },
        { expression: "retrieve(q) → { evidenceId, source, span, score, generation }[]", meaning: "Similarity and exact text arrive in one tool result." },
        { expression: "E = citation(R[id]) for id ∈ decision.evidence", meaning: "Only selected, issued IDs become citations." },
        { expression: "overlap ⇔ a.from < b.to ∧ b.from < a.to", meaning: "Strict half-open overlap creates citation unions." }
      ],
      steps: [
        "Validate a focused query and top-k; configuration supplies top-k when the model omits it.",
        "Call the existing Semantic Overlay capability with the Derived Output's ResourceSet.",
        "Assign stable attempt-local evidence IDs by source snapshot, range, and observed generation; repeated hits reuse the same ID.",
        "Return each issued ID with exact source/span text, similarity score, and observed generation in the retrieval result.",
        "Require a structured answered/insufficient decision. Reject blank, duplicate, or unissued selected IDs before trusting response prose.",
        "Coalesce selected overlaps only inside the same source revision, encoding, and observed generation; retain every ID and use annotation.",
        "If no valid evidence is selected, discard model prose and publish the application's deterministic insufficiency response."
      ],
      invariants: ["retrieve includes exact text", "IDs are application-issued", "selection is structured", "citation by value", "exact coordinate text", "unsupported prose is discarded"],
      complexity: "Evidence lookup is O(1) average. Citation grouping and interval ordering are O(E log E), with a linear merge over E selections."
    },
    {
      id: "publication",
      number: "03",
      label: "Publish guard",
      title: "One shared job, with stable inputs at publication.",
      summary:
        "Refresh claims the server job while leaving the last value readable. After synthesis, it re-reads the versioned definition, active evidence, and semantic-input watermark. Only a stable attempt replaces response, evidence, queries, and revision in one row write.",
      equations: [
        { expression: "same request + active job → join", meaning: "Repeated browser signals do not create provider work." },
        { expression: "requestVersion′ > requestVersion ⇔ definition/selection changed", meaning: "Only a causal request change schedules a follow-up pass." },
        { expression: "valid(E,S) = ∀e∈E, ∃s∈S: ref(s)=ref(e) ∧ rev(s)=rev(e) ∧ enc(s)=enc(e)", meaning: "Every cited snapshot must still be active." },
        { expression: "attempts ≤ 1 + maxSourceRetries", meaning: "Revision churn cannot create an unbounded loop." },
        { expression: "lastRevision′ = (lastRevision ?? 0) + 1", meaning: "A publication or explicit user response edit advances output revision." }
      ],
      steps: [
        "Resolve project authority, validate configuration, and join or claim the one durable refresh job.",
        "Snapshot definitionRevision, prompt inputs, selection, previous response, and the project semantic watermark; previous text is continuity context, never evidence.",
        "Run one isolated retrieve/select attempt and aggregate provider plus embedding accounting.",
        "Re-read the row. If its definition changed, return superseded without writing over the newer value; a changed queued request gets one follow-up pass.",
        "Compare captured citations and the full semantic watermark. Drain and retry from a fresh registry if authoritative inputs moved.",
        "Publish queries, coalesced citations, a one-paragraph TextBlock, output revision, current overlay generation, fresh state, and refresh time atomically."
      ],
      invariants: ["server-owned job", "duplicate requests join", "definition wins", "bounded source retry", "old response stays readable", "one publication write"],
      complexity: "Per attempt: synthesis + retrieval, then O(E + S) source validation with the current JSON table scan. Publication itself is one synchronous row replacement."
    },
    {
      id: "freshness",
      number: "04",
      label: "Pull freshness",
      title: "A source update does not fan out across Derived Outputs.",
      summary:
        "Stored citations are historical values. Reading an output joins only those cited source refs against today's source snapshots and reports an effective stale state. Overlay generation is intentionally absent from the predicate because unrelated sources may advance it.",
      equations: [
        { expression: "stale(D) ⇔ ∃e∈D.evidence: current(ref(e)) ≠ (revision(e), encoding(e))", meaning: "Only evidence actually used can stale the response." },
        { expression: "generation ∉ stale(D)", meaning: "A project-wide generation bump is not itself invalidation." },
        { expression: "read(D) → { output, effectiveState, refresh }", meaning: "Value freshness and shared operation state are independent projections." },
        { expression: "edit(lastResponse): evidence → ∅; fresh → stale", meaning: "User prose becomes continuity context, not falsely grounded output." }
      ],
      steps: [
        "Load one project-owned Derived Output or return null without disclosing another project.",
        "Build the current source snapshot map by resource kind and ID.",
        "Mark a cited snapshot changed if its source is absent, its revision differs, or its encoding differs.",
        "Return value state unchanged unless stored fresh has changed citations; separately project the durable job as idle, queued, running, or failed.",
        "A user response edit advances its revision, clears grounding metadata, and is supplied to the next refresh as continuity-only context.",
        "Do not scan or rewrite derivedOutputs during source additions, updates, deletions, or unrelated generation changes.",
        "A caller explicitly refreshes a stale output, entering the independent publication lifecycle."
      ],
      invariants: ["pull-based", "value remains readable", "project-scoped", "no fan-out writes", "editable continuity", "shared refresh visible"],
      complexity: "Current JSON storage makes a read O(S + E). A keyed source lookup later reduces it to O(E) without changing this contract."
    }
  ];

  const SCENARIOS: Scenario[] = [
    {
      id: "stable",
      label: "Stable evidence",
      headline: "One attempt publishes revision N + 1.",
      note: "The cited source snapshot still matches immediately before publication.",
      result: "fresh · response/evidence/queries replaced together",
      tone: "success",
      steps: [
        { label: "Acquire", detail: "refresh job queued → running; value row remains readable", state: "done" },
        { label: "Retrieve", detail: "query returns text + evidence-1 at generation 11", state: "done" },
        { label: "Select", detail: "structured answer selects evidence-1 and explains its use", state: "done" },
        { label: "Validate", detail: "active source is still revision 7", state: "done" },
        { label: "Publish", detail: "lastRevision increments; lastGeneration = 11", state: "done" }
      ]
    },
    {
      id: "cited-change",
      label: "Cited source changes",
      headline: "The first answer is discarded; retrieval starts over.",
      note: "A response authored from revision 7 may not publish after that source becomes revision 8.",
      result: "attempt 2 publishes only if revision 8 remains current",
      tone: "active",
      steps: [
        { label: "Attempt 1", detail: "selected evidence captures source revision 7", state: "done" },
        { label: "Source update", detail: "active source advances to revision 8", state: "retry" },
        { label: "Preflight", detail: "revision mismatch rejects all attempt-1 prose", state: "retry" },
        { label: "Attempt 2", detail: "new retrieval/selection captures revision 8", state: "done" },
        { label: "Publish", detail: "only the stable attempt becomes lastResponse", state: "done" }
      ]
    },
    {
      id: "unrelated",
      label: "Unrelated generation",
      headline: "A later unrelated generation does not stale the answer.",
      note: "After publication, another source can advance the overlay from generation 11 to 12 without changing what this answer used. A change during synthesis is conservatively retried once.",
      result: "fresh · no retry · cited source revision is the authority",
      tone: "success",
      steps: [
        { label: "Read", detail: "citation records source A revision 7 at generation 11", state: "done" },
        { label: "Other update", detail: "source B changes; overlay becomes generation 12", state: "kept" },
        { label: "Publication", detail: "answer was grounded while source A remained revision 7", state: "done" },
        { label: "Pull check", detail: "source A still matches despite project generation 12", state: "done" },
        { label: "Later read", detail: "effective state remains fresh", state: "done" }
      ]
    },
    {
      id: "no-evidence",
      label: "No valid selection",
      headline: "Uncited model prose never becomes the response.",
      note: "Search may return nothing, status may be insufficient, or an answered decision may select a blank, duplicate, or invented ID.",
      result: "fresh deterministic insufficiency response · evidence = []",
      tone: "warning",
      steps: [
        { label: "Retrieve", detail: "first tool call still occurs", state: "done" },
        { label: "Select", detail: "no valid issued evidence ID supports the response", state: "retry" },
        { label: "Discard prose", detail: "any model-authored answer is ignored", state: "kept" },
        { label: "Replace", detail: "application supplies a fixed insufficiency sentence", state: "done" },
        { label: "Publish", detail: "queries/accounting remain inspectable", state: "done" }
      ]
    },
    {
      id: "user-edit",
      label: "User edits response",
      headline: "The edit guides the next answer without masquerading as evidence.",
      note: "An edited response can preserve the user's preferred wording and organization, but its old citations cannot automatically ground new prose.",
      result: "stale continuity draft · revision advances · evidence cleared",
      tone: "active",
      steps: [
        { label: "Edit", detail: "update receives a nonblank lastResponse string", state: "done" },
        { label: "Version", detail: "lastRevision advances and a new TextBlock is stored", state: "done" },
        { label: "Unground", detail: "queries, evidence, lastGeneration, refreshedAt are cleared", state: "kept" },
        { label: "Refresh", detail: "edited text is sent as continuity only, never factual evidence", state: "done" },
        { label: "Republish", detail: "new selected citations ground the regenerated response", state: "done" }
      ]
    },
    {
      id: "failure",
      label: "Provider or churn failure",
      headline: "The last good response survives the failed refresh.",
      note: "Timeouts, bounded provider failures, and repeated cited-source churn converge on one error path.",
      result: "error · prior lastResponse/lastRevision/evidence preserved",
      tone: "warning",
      steps: [
        { label: "Acquire", detail: "job runs while existing stale response remains readable", state: "done" },
        { label: "Fail", detail: "provider error or retry budget exhausted", state: "retry" },
        { label: "Sanitize", detail: "credentials/provider bodies are not exposed", state: "kept" },
        { label: "Record", detail: "state = error with bounded message", state: "done" },
        { label: "Preserve", detail: "last successful revision remains renderable", state: "done" }
      ]
    }
  ];

  const LEDGER: LedgerEntry[] = [
    { group: "configuration", action: "add", path: "app/configuration/intelligence.yaml", lines: "L1–15", symbols: "intelligence.api · providers.openrouter · agent limits", change: "Adds tracked endpoint/model/timeout/output/reasoning settings plus tool-round, source-retry, and default-top-k limits.", reason: "Real credentials continue to merge from ignored local.yaml; behavior is explicit and startup-validated." },
    { group: "configuration", action: "change", path: "app/configuration/representation.yaml", lines: "L25", symbols: "representation.domains.semantic", change: "Declares semantic → content/core because DerivedOutput now owns its ContentBlock response contract in the semantic domain.", reason: "The domain graph matches real type imports instead of hiding the dependency in store tables." },
    { group: "model", action: "add", path: "app/src/lib/model/server/intelligence/types.ts", lines: "L1–81", symbols: "IntelligenceTool · IntelligenceStructuredOutput · IntelligenceInput<Value> · IntelligenceResult<Value> · IntelligenceModel", change: "Defines the generic provider-neutral tool-agent port, strict output schema/parser contract, injected transport, accounting, limits, and stable service error.", reason: "Capabilities declare trusted output values without handling credentials, HTTP, or OpenRouter wire shapes." },
    { group: "model", action: "add", path: "…/intelligence/constructor.ts", lines: "L8–67", symbols: "createIntelligence", change: "Validates provider selection, nested OpenRouter credential/URL/model, positive time/output/round limits, and reasoning effort.", reason: "A bad provision fails server startup, not the first Derived Output refresh." },
    { group: "model", action: "add", path: "…/intelligence/definition.ts · index.server.ts · intelligence.md", lines: "definition L1–27 · index L1–15 · doc L1–16", symbols: "OpenRouterIntelligence · defineIntelligence · IntelligenceStructuredOutput export", change: "Binds immutable provider state to the generic agent method, exports the strict-output seam, and records parser/security rules.", reason: "The runtime holds one provider object while callers own their final-value contracts." },
    { group: "model", action: "add", path: "…/intelligence/methods/run-agent/run-agent.ts", lines: "L1–139", symbols: "wire messages · parseTurn · parseUsage · safeError · serialize", change: "Defines exact OpenAI-compatible messages/calls, defensive provider parsing, usage accumulation inputs, and bounded tool-error redaction.", reason: "Malformed or secret-bearing provider/tool failures cannot leak through loosely typed JSON." },
    { group: "model", action: "add", path: "…/intelligence/methods/run-agent/run-agent.ts", lines: "L141–204", symbols: "invoke", change: "Posts bearer-authenticated JSON with forced/automatic tool choice, serial tool policy, strict response_format JSON Schema, reasoning settings, and abort timeout.", reason: "There is one auditable OpenRouter edge; response bodies are intentionally absent from surfaced HTTP errors." },
    { group: "model", action: "add", path: "…/intelligence/methods/run-agent/run-agent.ts", lines: "L207–307", symbols: "parsedInput · runAgent<Value>", change: "Executes the bounded tool loop, parses final JSON through the caller's validator, and returns a trusted generic value plus call trace, rounds, and usage.", reason: "Derived Output gets structured evidence selection without a persisted planner or provider-shaped values." },
    { group: "representation", action: "change", path: "…/types/semantic/derived-output.ts", lines: "L1–140", symbols: "SemanticCitation · DerivedOutputFields · DerivedOutputRefreshJobFields", change: "Stores citation-by-value, the singular lastResponse, a user-input definition revision, and the coalesced refresh-job contract.", reason: "Canonical value and shared operation state have explicit, independent owners." },
    { group: "representation", action: "add", path: "…/behavior/semantic/citation.ts", lines: "L1–134", symbols: "assertCitation · mergedSelections · coalesceSemanticCitations", change: "Validates coordinate/text and selected-evidence fields, unions overlapping selected spans, and preserves every ID/use annotation within one source snapshot and generation.", reason: "Several selected hits become minimal trustworthy evidence without losing the model's declared use of each item." },
    { group: "representation", action: "add", path: "…/behavior/semantic/citation.ts", lines: "L138–165", symbols: "changedSemanticSources", change: "Joins selected citation refs to active snapshots and reports missing, revised, or re-encoded sources.", reason: "The same pure predicate drives pre-publication validation and pull-time freshness." },
    { group: "representation", action: "change", path: "app/src/lib/representation/store/tables.ts", lines: "L37–40 · L275–276", symbols: "SemanticDerivedOutput aliases", change: "Reuses semantic-domain fields/row types instead of maintaining a second Derived Output schema in the storage catalog.", reason: "One stored contract eliminates schema drift and keeps table identity intact." },
    { group: "capability", action: "add", path: "app/src/lib/capabilities/derived-output/index.remote.ts", lines: "L1–21", symbols: "create · read · update · refresh", change: "Exposes three mutating commands and one read query through the only client/server crossing.", reason: "Remote semantics now match mutation semantics; no project ID is accepted from the client." },
    { group: "capability", action: "add", path: "app/src/lib/capabilities/derived-output/derived-output.md", lines: "L1–29", symbols: "capability contract", change: "Documents direct retrieval evidence, strict selection, user-edited continuity, source preflight, and failure preservation.", reason: "The capability contract stays aligned to executable behavior instead of the retired handle/read design." },
    { group: "capability", action: "add", path: "…/derived-output/types/{create,read,update,refresh}-derived-output.ts", lines: "public contracts", symbols: "value state · refresh status · outcomes", change: "Defines prompt/scope creation, ID-based reads and updates, effective freshness, shared queued/running/failed status, outcomes, and provider accounting.", reason: "Callers observe one server-owned operation without reaching into stored rows." },
    { group: "capability", action: "add", path: "…/derived-output/api/shared/input.ts + four validate-* files", lines: "shared L1–57 · create L1–14 · read L1–10 · update L1–24 · refresh L1–10", symbols: "resourceSet · derivedOutputId · procedure validators", change: "Checks unknown remote values, every ResourceSet term/ref, prompts/IDs, and normalizes an optional nonblank response edit to one paragraph.", reason: "Remote values are reconstructed before mutation; the stored TextBlock invariant excludes newlines." },
    { group: "capability", action: "add", path: "…/derived-output/api/shared/rows.ts", lines: "L1–82", symbols: "rowsOf · outputOf · writeOutput · responseBlock · activeSources · currentGeneration", change: "Adds project-filtered access, undefined-free row replacement, shared TextBlock construction, source snapshots, and current generation lookup.", reason: "Refresh and user editing construct the same valid response block while all storage remains project-scoped." },
    { group: "capability", action: "add", path: "…/derived-output/api/shared/synthesis.ts", lines: "L15–143", symbols: "SynthesisAttempt · SynthesisDecision parser/schema · prompts", change: "Defines answered/insufficient attempt output, strict final schema, evidence-selection validation, hit identity, continuity context, and fixed insufficiency prose.", reason: "Prior output can stabilize style but only selected retrieved text can ground facts." },
    { group: "capability", action: "add", path: "…/derived-output/api/shared/synthesis.ts", lines: "L145–180", symbols: "synthesize.retrieve", change: "Calls scoped Semantic Overlay query, assigns/reuses attempt-local evidence IDs, and returns each ID with exact source/span text, score, generation, and diagnostics.", reason: "The model receives the similar text immediately without a redundant read call." },
    { group: "capability", action: "add", path: "…/derived-output/api/shared/synthesis.ts", lines: "L183–242", symbols: "structured agent call · selected citation resolution", change: "Forces the sole retrieve tool first, requires strict final JSON, rejects duplicate/unissued selections, coalesces selected citations, and suppresses unsupported prose.", reason: "The application—not the model—resolves citation provenance while the model declares which issued evidence it used." },
    { group: "capability", action: "add", path: "…/api/create-derived-output/create-derived-output.ts", lines: "L1–38", symbols: "createDerivedOutput", change: "Creates a project-owned idle row with empty queries/evidence and the scoped user actor.", reason: "Definition and lifecycle begin in representation without synthesizing eagerly." },
    { group: "capability", action: "add", path: "…/api/read-derived-output/read-derived-output.ts", lines: "read projection", symbols: "readDerivedOutput", change: "Returns one owned row, effective value state, shared refresh status, and exact changed source snapshots.", reason: "Collaborators see the same work state while source updates still avoid fan-out writes." },
    { group: "capability", action: "add", path: "…/api/update-derived-output/update-derived-output.ts", lines: "definition update", symbols: "updateDerivedOutput", change: "Updates prompt/scope or a user-edited response, advances definitionRevision, clears invalid grounding, and may supersede in-flight work.", reason: "A real collaborative input change is distinguishable from a repeated refresh click." },
    { group: "capability", action: "add", path: "…/api/shared/refresh-queue.ts", lines: "coordinator", symbols: "enqueueDerivedOutputRefreshFor · processDerivedOutputRefreshFor", change: "Coalesces one durable job by output ID, joins identical request keys, and schedules one follow-up only for changed definition/selection inputs.", reason: "Several browsers cannot multiply provider work or hide operation state in local UI." },
    { group: "capability", action: "add", path: "…/api/refresh-derived-output/refresh-derived-output.ts", lines: "server worker", symbols: "semanticInputWatermark · attempt loop · atomic publication", change: "Drains semantic work, retries changed authoritative inputs, respects superseding definitions, and versions stable response/evidence together.", reason: "No response publishes from a mixed semantic snapshot, while the previous value remains readable." },
    { group: "capability", action: "add", path: "…/api/refresh-derived-output/refresh-derived-output.ts", lines: "L176–202", symbols: "failure/superseded path", change: "Converges provider/tool/schema errors on sanitized error state while leaving the previous response revision and evidence untouched.", reason: "A failed refresh does not destroy the last usable answer or continuity draft." },
    { group: "runtime", action: "change", path: "app/src/lib/runtime/server/{types,start.server}.ts", lines: "types L1,L24 · start L6,L48,L56", symbols: "ServerModel.intelligence · createIntelligence", change: "Constructs the OpenRouter model immediately after configuration and returns it in the process graph.", reason: "One immutable provider object exists before requests; capabilities borrow it from the runtime." },
    { group: "runtime", action: "change", path: "…/runtime/server/test/{construction,lifetime}.test.ts", lines: "construction L34–37,L70 · lifetime L40–43,L88", symbols: "intelligence runtime fake/assertions", change: "Extends composition and process-lifetime proofs to include the new model object.", reason: "Adding infrastructure changes the graph contract and its tests together." },
    { group: "tests", action: "add", path: "…/intelligence/test/unit/intelligence.test.ts", lines: "L1–316", symbols: "8 provider-loop tests", change: "Proves forced/auto payloads, exact replay, strict response_format shape and local parsing, malformed-output rejection, accounting, bounds, timeout, secret safety, and construction.", reason: "Both tool and structured-output behavior are deterministic without provider spend." },
    { group: "tests", action: "add", path: "…/derived-output/test/unit/derived-output.test.ts", lines: "L1–543", symbols: "13 lifecycle tests", change: "Covers direct text retrieval, selected citation capture, unknown-ID suppression, response editing/continuity, scope, source retry/exhaustion, failure preservation, lock, supersession, and config validation.", reason: "Every grounding and lifecycle branch runs against a mutable in-memory store and controlled structured agent." },
    { group: "tests", action: "add", path: "…/derived-output/test/non-functional/live-derived-output.test.ts", lines: "L1–100", symbols: "real Jina + recursive index + OpenRouter", change: "Embeds three passages, builds/searches the index, runs the real one-tool structured agent, and asserts answer plus selected evidence.", reason: "The mocked provider seams are proven together with configured credentials." },
    { group: "tests", action: "add", path: "…/semantic/test/unit/citation.test.ts", lines: "L1–64", symbols: "3 coalescence/freshness tests", change: "Proves overlap unions retain ID/use selections, generation separation, cited-only invalidation, and coordinate/text rejection.", reason: "Citation mathematics remains pure and provider/store independent." },
    { group: "tests", action: "move", path: "…/embedding/test/integration/jina.test.ts → test/non-functional/jina.test.ts", lines: "unchanged 79 lines", symbols: "configured Jina live suite", change: "Moves the opt-in provider test into one of the repository's three permitted test categories.", reason: "The model architecture linter now passes all 9 checks without changing Jina behavior." },
    { group: "model", action: "change", path: "…/model/client/{commands/commands.md,storage/storage.md}", lines: "commands L136 · storage L22", symbols: "two stale links", change: "Removes two inherited links to files that do not exist; no executable behavior changes.", reason: "Those stale paths were the remaining model-lint failures once the test category was corrected." },
    { group: "artifact", action: "add", path: "…/semantic-overlay/components/derived-output.svelte + route", lines: "entire component · route L1–5", symbols: "this visual implementation review", change: "Adds interactive algorithm, scenario, wire-contract, state, file-ledger, verification, and scaling-boundary views aligned to the final contract.", reason: "The final phase is reviewable visually beside the updated index/query page." }
  ];

  const GROUPS: { id: FileGroup | "all"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "configuration", label: "Config" },
    { id: "model", label: "Model" },
    { id: "representation", label: "Representation" },
    { id: "capability", label: "Capability" },
    { id: "runtime", label: "Runtime" },
    { id: "tests", label: "Tests" },
    { id: "artifact", label: "Artifact" }
  ];

  const FIRST_REQUEST = `POST /api/v1/chat/completions
Authorization: Bearer ••••••••
{
  "model": "~openai/gpt-latest",
  "messages": [system, user],
  "tools": [retrieve],
  "tool_choice": {
    "type": "function",
    "function": { "name": "retrieve" }
  },
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "semantic_derived_output",
      "strict": true,
      "schema": SynthesisDecision
    }
  },
  "parallel_tool_calls": false,
  "max_tokens": 4096,
  "reasoning": { "effort": "medium" }
}`;

  const TOOL_REPLAY = `assistant
  tool_calls: [{
    id: "call-1",
    function: {
      name: "retrieve",
      arguments: "{ query, topK }"
    }
  }]

tool
  tool_call_id: "call-1"
  content: {
    ok: true,
    value: {
      hits: [{
        evidenceId: "evidence-1",
        source, span: { from, to, text },
        score, overlayGeneration
      }]
    }
  }

next request
  tool_choice: "auto"

final assistant JSON
  {
    status: "answered",
    response: "…",
    evidence: [{
      evidenceId: "evidence-1",
      use: "Establishes the launch date"
    }]
  }`;

  let activeAlgorithm = $state<AlgorithmId>("agent");
  let activeScenario = $state<ScenarioId>("stable");
  let activeGroup = $state<FileGroup | "all">("all");
  const algorithm = $derived(ALGORITHMS.find((item) => item.id === activeAlgorithm)!);
  const scenario = $derived(SCENARIOS.find((item) => item.id === activeScenario)!);
  const visibleLedger = $derived(
    activeGroup === "all" ? LEDGER : LEDGER.filter((entry) => entry.group === activeGroup)
  );
</script>

<svelte:head>
  <title>Semantic Overlay · Derived Output implementation</title>
  <meta
    name="description"
    content="A line-level visual review of the Semantic Overlay to Derived Output implementation."
  />
</svelte:head>

<div class="review-shell">
  <header class="topbar">
    <a class="wordmark" href="/demo/semantic-overlay"><span class="mark"></span><span>ICARUS</span><span class="muted">/ SEMANTIC OVERLAY</span></a>
    <nav aria-label="Review sections">
      <a href="#boundary">Boundary</a>
      <a href="#algorithms">Algorithms</a>
      <a href="#scenarios">Scenarios</a>
      <a href="#files">Files</a>
      <a href="#proof">Proof</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow"><Sparkles size={14} aria-hidden="true" /> FINAL PHASE · IMPLEMENTED</span>
        <h1>Evidence arrives<br /><em>ready to use.</em></h1>
        <p class="lede">
          Derived Output now pulls from the indexed Semantic Overlay through one bounded agent.
          Retrieval returns exact text with application-issued IDs. A strict final decision selects what was used, and source revisions are checked again at publication.
        </p>
        <div class="hero-actions">
          <a class="primary-action" href="#boundary"><BookOpen size={14} aria-hidden="true" /> Review execution</a>
          <a href="/demo/semantic-overlay/index-query"><ChevronLeft size={14} aria-hidden="true" /> Index + query review</a>
        </div>
      </div>

      <aside class="branch-card">
        <header><GitBranch size={15} aria-hidden="true" /><span>STACKED REVIEW WORKTREE</span></header>
        <div class="branch-name"><span>BRANCH</span><code>work/semantic-overlay-derived-output</code></div>
        <div class="branch-state"><span class="pulse"></span><strong>Final bridge is executable</strong><small>stacked on phase-two commit c63dda4 · not merged</small></div>
        <dl>
          <div><dt>remote operations</dt><dd>4</dd><small>create · read · update · refresh</small></div>
          <div><dt>agent tools</dt><dd>1</dd><small>retrieve returns evidence text</small></div>
          <div><dt>automated tests</dt><dd>636</dd><small>634 pass · 2 opt-in live</small></div>
          <div><dt>scoped checks</dt><dd>39</dd><small>four owners + across boundaries</small></div>
        </dl>
        <p><Check size={14} aria-hidden="true" /><span>Real Jina + recursive index + one-tool OpenRouter loop: <strong>passed in 5.71s</strong></span></p>
      </aside>
    </section>

    <section class="result-strip" aria-label="Implemented result">
      <ShieldCheck size={18} aria-hidden="true" />
      <p><strong>Working seam:</strong> prompt → forced retrieve with text + IDs → strict evidence selection → cited-source preflight → atomic response revision</p>
      <span>PHASE 03 / BUILT</span>
    </section>

    <section id="boundary" class="section">
      <div class="section-heading">
        <div><span class="kicker">TRUST BOUNDARY</span><h2>Text and its evidence identity arrive together.</h2></div>
        <p>The agent never receives generation-local semantic object IDs to persist. Retrieval text carries an attempt-local evidence ID; only issued IDs selected in strict output resolve to stored source/span values.</p>
      </div>

      <div class="boundary-flow">
        <article class="flow-node source">
          <span class="node-number">01</span><Search size={19} aria-hidden="true" />
          <small>SEMANTIC OVERLAY QUERY</small><h3>Recursive retrieval</h3>
          <code>SemanticHit[]</code><p>Full trusted hits exist inside application memory.</p>
        </article>
        <div class="flow-edge"><ArrowRight size={19} aria-hidden="true" /><small>issue ID</small></div>
        <article class="flow-node registry">
          <span class="node-number">02</span><KeyRound size={19} aria-hidden="true" />
          <small>RETRIEVAL RESULT</small><h3>Text + evidence ID</h3>
          <code>evidence-1 → trusted hit</code><p>The model immediately receives ref, exact span text, score, and generation.</p>
        </article>
        <div class="flow-edge guarded"><ArrowRight size={19} aria-hidden="true" /><small>select IDs</small></div>
        <article class="flow-node citation">
          <span class="node-number">03</span><Braces size={19} aria-hidden="true" />
          <small>STRICT FINAL JSON</small><h3>Answer + selections</h3>
          <code>E ← citation(R[id])</code><p>Application code accepts only unique IDs it issued, then copies provenance by value.</p>
        </article>
        <div class="flow-edge"><ArrowRight size={19} aria-hidden="true" /><small>validate</small></div>
        <article class="flow-node stored">
          <span class="node-number">04</span><Database size={19} aria-hidden="true" />
          <small>REPRESENTATION</small><h3>Derived Output</h3>
          <code>lastResponse + evidence</code><p>One stable row write publishes the next revision.</p>
        </article>
      </div>

      <div class="trust-grid">
        <article>
          <header><Search size={15} aria-hidden="true" /><span>RETRIEVE RETURNS</span></header>
          <pre><code>{`{
  evidenceId: "evidence-1",
  source: { ref, revision, encoding },
  span: { from, to, text },
  score,
  overlayGeneration
}`}</code></pre>
        </article>
        <article class="gate-card">
          <header><LockKeyhole size={15} aria-hidden="true" /><span>APPLICATION VALIDATION</span></header>
          <div><strong>decision.evidence</strong><ArrowRight size={17} aria-hidden="true" /><strong>resolve issued IDs</strong></div>
          <p>Blank, duplicate, invented, cross-attempt, and expired IDs cannot publish model prose. No model field can rewrite source, span, revision, encoding, or generation.</p>
        </article>
        <article>
          <header><History size={15} aria-hidden="true" /><span>STORED BY VALUE</span></header>
          <pre><code>{`SemanticCitation {
  selections: [{ evidenceId, use }];
  source: SemanticSourceSnapshot;
  span: { from, to, text };
  overlayGeneration: number;
}`}</code></pre>
        </article>
      </div>
    </section>

    <section id="algorithms" class="section">
      <div class="section-heading">
        <div><span class="kicker">ALGORITHM NOTEBOOK</span><h2>Four procedures, one grounded lifecycle.</h2></div>
        <p>Select a layer to inspect the equations, exact execution order, invariants, and computational boundary implemented by this branch.</p>
      </div>

      <div class="algorithm-tabs" role="tablist" aria-label="Derived Output algorithms">
        {#each ALGORITHMS as item}
          <button type="button" role="tab" aria-selected={activeAlgorithm === item.id} class:active={activeAlgorithm === item.id} onclick={() => (activeAlgorithm = item.id)}>
            <span>{item.number}</span><strong>{item.label}</strong>
          </button>
        {/each}
      </div>

      <div class="algorithm-panel" role="tabpanel">
        <div class="algorithm-intro"><span class="panel-number">{algorithm.number}</span><div><h3>{algorithm.title}</h3><p>{algorithm.summary}</p></div></div>
        <div class="equation-grid">
          {#each algorithm.equations as equation}
            <article><code>{equation.expression}</code><p>{equation.meaning}</p></article>
          {/each}
        </div>
        <div class="algorithm-detail">
          <div>
            <span class="detail-label">EXACT PROCEDURE</span>
            <ol>{#each algorithm.steps as step, index}<li><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>{/each}</ol>
          </div>
          <aside>
            <span class="detail-label">INVARIANTS</span>
            <ul>{#each algorithm.invariants as invariant}<li><Check size={13} aria-hidden="true" />{invariant}</li>{/each}</ul>
            <div class="complexity"><Activity size={15} aria-hidden="true" /><div><span>COMPUTATIONAL SHAPE</span><p>{algorithm.complexity}</p></div></div>
          </aside>
        </div>
      </div>
    </section>

    <section id="scenarios" class="section">
      <div class="section-heading">
        <div><span class="kicker">EXECUTION SIMULATOR</span><h2>Two lifecycles remain independent.</h2></div>
        <p>Overlay updates advance sources and generation. Derived Outputs react only when read or explicitly refreshed—never through a project-wide invalidation fan-out.</p>
      </div>

      <div class="scenario-layout">
        <div class="scenario-tabs" role="tablist" aria-label="Refresh scenarios">
          {#each SCENARIOS as item}
            <button type="button" role="tab" aria-selected={activeScenario === item.id} class:active={activeScenario === item.id} onclick={() => (activeScenario = item.id)}>
              <CircleDot size={13} aria-hidden="true" /><span>{item.label}</span>
            </button>
          {/each}
        </div>
        <div class="scenario-panel tone-{scenario.tone}" role="tabpanel">
          <header><div><span>SELECTED PATH</span><h3>{scenario.headline}</h3><p>{scenario.note}</p></div><RefreshCw size={22} aria-hidden="true" /></header>
          <div class="scenario-steps">
            {#each scenario.steps as step, index}
              <div class="scenario-step state-{step.state}">
                <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.label}</strong><p>{step.detail}</p></div>
                {#if index < scenario.steps.length - 1}<ArrowRight size={15} aria-hidden="true" />{/if}
              </div>
            {/each}
          </div>
          <footer><Check size={15} aria-hidden="true" /><strong>{scenario.result}</strong></footer>
        </div>
      </div>

      <div class="lifecycle-grid">
        <article>
          <header><Database size={16} aria-hidden="true" /><span>SEMANTIC OVERLAY LIFECYCLE</span></header>
          <div class="mini-flow"><span>source add / update / delete</span><ArrowRight size={14} /><span>translate</span><ArrowRight size={14} /><span>publish generation</span><ArrowRight size={14} /><span>rebuild index</span></div>
          <p>History retains retired object values. No step scans <code>derivedOutputs</code>.</p>
        </article>
        <article>
          <header><Sparkles size={16} aria-hidden="true" /><span>DERIVED OUTPUT LIFECYCLE</span></header>
          <div class="mini-flow"><span>value stays readable</span><ArrowRight size={14} /><span>job queued / running</span><ArrowRight size={14} /><span>fresh or error</span></div>
          <p>A normal read computes effective staleness and projects the shared refresh job without combining those two lifecycles.</p>
        </article>
      </div>
    </section>

    <section class="section wire-section" aria-labelledby="wire-title">
      <div class="section-heading">
        <div><span class="kicker">OPENROUTER WIRE CONTRACT</span><h2 id="wire-title">One provider object, exact replay.</h2></div>
        <p>The provider uses the existing ignored credential namespace. Tool inputs remain application-validated, while the final turn is provider-constrained by a strict JSON Schema and parsed again locally.</p>
      </div>
      <div class="wire-grid">
        <article><header><KeyRound size={15} aria-hidden="true" /><span>FIRST REQUEST</span></header><pre><code>{FIRST_REQUEST}</code></pre></article>
        <article><header><Braces size={15} aria-hidden="true" /><span>TOOL REPLAY</span></header><pre><code>{TOOL_REPLAY}</code></pre></article>
      </div>
      <div class="security-strip">
        <ShieldCheck size={18} aria-hidden="true" />
        <div><strong>Credential and prompt boundary</strong><p>API keys remain in ignored local.yaml and private model state. Neither prompts, source passages, provider response bodies, nor credentials enter logs. Operational logs contain IDs, revisions, generations, attempt/tool counts, evidence count, and coarse failure reason only.</p></div>
      </div>
    </section>

    <section id="files" class="section">
      <div class="section-heading">
        <div><span class="kicker">LINE-LEVEL CHANGE LEDGER</span><h2>Every final-phase edit, grouped by owner.</h2></div>
        <p>Ranges point to this review worktree. Each entry separates the executable change from the architectural reason it belongs in that file.</p>
      </div>
      <div class="ledger-toolbar">
        <div class="ledger-filters" aria-label="Filter line-level changes">
          {#each GROUPS as group}
            <button type="button" class:active={activeGroup === group.id} onclick={() => (activeGroup = group.id)}>{group.label}<span>{group.id === "all" ? LEDGER.length : LEDGER.filter((entry) => entry.group === group.id).length}</span></button>
          {/each}
        </div>
        <span><FileCode2 size={14} aria-hidden="true" /> {visibleLedger.length} review entries</span>
      </div>
      <div class="ledger-list">
        {#each visibleLedger as entry}
          <article>
            <div class="ledger-meta"><span class="action action-{entry.action}">{entry.action}</span><span class="group">{entry.group}</span></div>
            <div class="ledger-location"><code>{entry.path}</code><strong>{entry.lines}</strong><small>{entry.symbols}</small></div>
            <div class="ledger-change"><span>CHANGE</span><p>{entry.change}</p></div>
            <div class="ledger-reason"><span>WHY HERE</span><p>{entry.reason}</p></div>
          </article>
        {/each}
      </div>
    </section>

    <section id="proof" class="section">
      <div class="section-heading">
        <div><span class="kicker">VERIFICATION</span><h2>Mocked edges, live edges, lifecycle branches.</h2></div>
        <p>The default suite is deterministic and free of provider spend. The opt-in combined proof crosses both configured APIs and exercises the actual recursive query plus tool agent.</p>
      </div>
      <div class="proof-stats">
        <article><Check size={17} aria-hidden="true" /><div><strong>934</strong><span>default tests passed</span><p>101 files · 2 opt-in files skipped</p></div></article>
        <article><Check size={17} aria-hidden="true" /><div><strong>56 / 56</strong><span>architecture checks</span><p>all ownership groups · no findings</p></div></article>
        <article><Check size={17} aria-hidden="true" /><div><strong>1 / 1</strong><span>combined live pipeline</span><p>real Jina + OpenRouter · 5.71s</p></div></article>
        <article><Check size={17} aria-hidden="true" /><div><strong>0</strong><span>credential values tracked</span><p>local.yaml remains ignored</p></div></article>
      </div>

      <div class="proof-grid">
        <article>
          <header><Braces size={17} aria-hidden="true" /><div><span>INTELLIGENCE MODEL</span><strong>Exact wire and failure behavior</strong></div></header>
          <ul>
            <li><Check size={13} /> forced retrieve first; automatic later turns</li>
            <li><Check size={13} /> assistant call + tool result replayed byte-for-shape</li>
            <li><Check size={13} /> strict response schema is sent and application-parsed</li>
            <li><Check size={13} /> invalid JSON recovers without handler execution</li>
            <li><Check size={13} /> tool-round limit, abort timeout, status-only HTTP failure</li>
            <li><Check size={13} /> request/token/reasoning/cost totals accumulated</li>
          </ul>
        </article>
        <article>
          <header><RefreshCw size={17} aria-hidden="true" /><div><span>DERIVED OUTPUT</span><strong>Every state boundary</strong></div></header>
          <ul>
            <li><Check size={13} /> create, pull read, definition update</li>
            <li><Check size={13} /> scope reaches Semantic Overlay query</li>
            <li><Check size={13} /> retrieve returns text + issued IDs; structured selection cites</li>
            <li><Check size={13} /> unknown IDs suppress prose; user edits become ungrounded continuity</li>
            <li><Check size={13} /> cited revision retry and bounded churn failure</li>
            <li><Check size={13} /> duplicate-request join, causal follow-up, superseding definition</li>
          </ul>
        </article>
        <article>
          <header><Sparkles size={17} aria-hidden="true" /><div><span>COMBINED LIVE PROOF</span><strong>One real grounded answer</strong></div></header>
          <ol>
            <li><span>01</span>Jina embeds three deliberately distinct passages.</li>
            <li><span>02</span>Deterministic spherical clustering builds the recursive tree.</li>
            <li><span>03</span>OpenRouter is forced to retrieve against that tree.</li>
            <li><span>04</span>The model selects issued evidence IDs in strict final JSON.</li>
            <li><span>05</span>The application resolves selected citations; answer and evidence both name Tuesday, 14:00 UTC, Mira Chen.</li>
          </ol>
        </article>
      </div>

      <div class="command-evidence">
        <code>pnpm test</code><span>101 files passed · 2 skipped · 934 tests passed · 2 skipped</span>
        <code>pnpm lint</code><span>56 / 56 checks · no findings</span>
        <code>pnpm typecheck</code><span>0 errors · 0 warnings</span>
        <code>pnpm build</code><span>3,293 SSR modules · 4,818 client modules · production output complete</span>
        <code>ICARUS_LIVE_DERIVED_OUTPUT=1 …live-derived-output.test.ts</code><span>1 / 1 passed · 5.71s</span>
        <code>playwright test …derived-output-architecture.spec.ts</code><span>updated procedure diagrams · Chromium · 1 / 1 passed</span>
      </div>
    </section>

    <section class="section caveat-section" aria-labelledby="boundary-title">
      <div class="caveat-icon"><TriangleAlert size={22} aria-hidden="true" /></div>
      <div>
        <span class="kicker">SCALING + CONSISTENCY BOUNDARY</span>
        <h2 id="boundary-title">Correct for one JSON process. Explicitly not a distributed lock.</h2>
        <p>
          The current store keeps whole tables in memory and synchronously rewrites one JSON file per mutation. A process-wide flight registry plus one durable refresh-job row provides same-process exclusion and joined results. It does not provide an atomic lease or claim across several server processes. Likewise, source freshness currently scans the in-memory source table.
        </p>
      </div>
      <div class="caveat-grid">
        <article><span>PROVEN NOW</span><strong>one shared in-process flight</strong><p>duplicate joins · bounded retries · definition and watermark guards</p></article>
        <article><span>WHEN STORAGE CHANGES</span><strong>transactional lease / claim</strong><p>atomically claim the same refresh-job row with expiry and expected version</p></article>
        <article><span>MILLION-SOURCE FOLLOW-UP</span><strong>keyed source lookup</strong><p>replace O(S) hydration with ref-key reads; no lifecycle contract changes</p></article>
      </div>
    </section>

    <section class="handoff">
      <div><span class="kicker">REVIEW HANDOFF</span><h2>The three implementation passes now compose.</h2><p>Pass one owns semantic translation and persistence. Pass two owns Jina vector space, recursive index, and scoped query. This final pass owns grounded synthesis, citation values, revision-safe publication, and pull freshness.</p></div>
      <div class="handoff-links">
        <a href="/demo/semantic-overlay/implementation"><span>01</span> Translation cutover</a>
        <a href="/demo/semantic-overlay/index-query"><span>02</span> Index + query</a>
        <a class="current" href="#boundary"><span>03</span> Derived Output bridge</a>
      </div>
    </section>
  </main>

  <footer class="page-footer"><span>SEMANTIC OVERLAY / DERIVED OUTPUT / REVIEW 04</span><span>work/derived-output-architecture · executable reference</span></footer>
</div>

<style>
  :global(body) { margin: 0; }
  :global(*) { box-sizing: border-box; }
  .review-shell {
    min-height: 100vh;
    background:
      radial-gradient(circle at 82% 4%, color-mix(in srgb, var(--token-color-intelligence-border) 17%, transparent), transparent 26rem),
      radial-gradient(circle at 7% 29%, color-mix(in srgb, var(--token-color-success-border) 9%, transparent), transparent 24rem),
      var(--token-surface-canvas);
    color: var(--token-ink-primary);
  }
  .topbar { position: sticky; z-index: 30; top: 0; display: flex; justify-content: space-between; align-items: center; min-height: 3.5rem; padding: 0 2rem; border-bottom: 1px solid var(--token-border-subtle); background: color-mix(in srgb, var(--token-surface-canvas) 89%, transparent); backdrop-filter: blur(16px); }
  .wordmark, nav, .hero-actions, .mini-flow, .handoff-links { display: flex; align-items: center; }
  .wordmark { gap: .5rem; color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .69rem; letter-spacing: .1em; text-decoration: none; }
  .mark { width: .58rem; height: .58rem; border: 2px solid var(--token-color-intelligence-text); transform: rotate(45deg); }
  .muted { color: var(--token-ink-muted); }
  nav { gap: 1.2rem; }
  nav a { color: var(--token-ink-secondary); font-size: .71rem; text-decoration: none; }
  nav a:hover { color: var(--token-color-interactive-text); }
  main, .page-footer { width: min(100% - 3rem, 84rem); margin-inline: auto; }
  h1, h2, h3, p { margin: 0; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.48fr) minmax(21rem, .68fr); gap: 4rem; align-items: end; padding: 6.5rem 0 3rem; }
  .eyebrow, .kicker, .detail-label { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .64rem; font-weight: 500; letter-spacing: .11em; text-transform: uppercase; }
  .eyebrow { display: flex; gap: .45rem; align-items: center; margin-bottom: 1.2rem; }
  h1 { font-size: clamp(3rem, 6.6vw, 5.9rem); font-weight: 500; letter-spacing: -.067em; line-height: .92; }
  h1 em { color: var(--token-color-intelligence-text); font-style: normal; }
  .lede { max-width: 55rem; margin-top: 1.7rem; color: var(--token-ink-secondary); font-size: clamp(.98rem, 1.8vw, 1.14rem); line-height: 1.67; }
  .hero-actions { gap: .7rem; margin-top: 1.5rem; }
  .hero-actions a { display: inline-flex; gap: .45rem; align-items: center; padding: .55rem .72rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); color: var(--token-ink-secondary); font-family: var(--token-font-mono); font-size: .64rem; text-decoration: none; }
  .hero-actions .primary-action { border-color: var(--token-color-intelligence-border); background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); }
  .branch-card { overflow: hidden; border: 1px solid var(--token-color-intelligence-border); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); box-shadow: var(--token-shadow-panel); }
  .branch-card > header { display: flex; gap: .5rem; align-items: center; padding: .72rem .9rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .61rem; letter-spacing: .09em; }
  .branch-name { padding: 1rem; border-bottom: 1px solid var(--token-border-subtle); }
  .branch-name span, .branch-name code { display: block; }
  .branch-name span { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .55rem; }
  .branch-name code { margin-top: .35rem; color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .75rem; overflow-wrap: anywhere; }
  .branch-state { display: grid; grid-template-columns: auto 1fr; column-gap: .55rem; align-items: center; padding: .75rem 1rem; border-bottom: 1px solid var(--token-border-subtle); background: var(--token-color-intelligence-surface); }
  .pulse { grid-row: 1 / 3; width: .55rem; height: .55rem; border-radius: 50%; background: var(--token-color-intelligence-text); box-shadow: 0 0 0 .3rem color-mix(in srgb, var(--token-color-intelligence-text) 14%, transparent); }
  .branch-state strong { font-size: .69rem; font-weight: 500; }
  .branch-state small { margin-top: .13rem; color: var(--token-ink-muted); font-size: .57rem; }
  .branch-card dl { display: grid; grid-template-columns: 1fr 1fr; margin: 0; }
  .branch-card dl > div { padding: .8rem 1rem; border-right: 1px solid var(--token-border-subtle); border-bottom: 1px solid var(--token-border-subtle); }
  .branch-card dl > div:nth-child(even) { border-right: 0; }
  .branch-card dt { color: var(--token-ink-muted); font-size: .58rem; }
  .branch-card dd { margin: .25rem 0 0; font-family: var(--token-font-mono); font-size: 1.2rem; }
  .branch-card dl small { display: block; margin-top: .2rem; color: var(--token-ink-muted); font-size: .52rem; line-height: 1.35; }
  .branch-card > p { display: flex; gap: .5rem; align-items: start; padding: .85rem 1rem 1rem; color: var(--token-ink-muted); font-size: .61rem; line-height: 1.5; }
  .branch-card > p :global(svg) { flex: 0 0 auto; color: var(--token-color-success-text); }
  .branch-card > p strong { color: var(--token-color-success-text); font-weight: 500; }
  .result-strip { display: grid; grid-template-columns: auto 1fr auto; gap: .8rem; align-items: center; padding: .9rem 1rem; border: 1px solid var(--token-color-success-border); border-radius: var(--token-radius-control); background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .result-strip p { color: var(--token-ink-secondary); font-size: .75rem; line-height: 1.45; }
  .result-strip strong { color: var(--token-color-success-text); font-weight: 500; }
  .result-strip > span { font-family: var(--token-font-mono); font-size: .58rem; letter-spacing: .08em; white-space: nowrap; }
  .section { padding-top: 6rem; scroll-margin-top: 4rem; }
  .section-heading { display: flex; justify-content: space-between; gap: 3rem; align-items: end; margin-bottom: 2rem; }
  h2 { margin-top: .42rem; font-size: clamp(1.85rem, 3.5vw, 2.85rem); font-weight: 500; letter-spacing: -.045em; line-height: 1.04; }
  .section-heading > p { max-width: 34rem; color: var(--token-ink-muted); font-size: .78rem; line-height: 1.58; text-align: right; }
  .boundary-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr; gap: .6rem; align-items: center; }
  .flow-node { position: relative; min-width: 0; min-height: 15rem; padding: 1rem; border: 1px solid var(--node-border); border-top: 3px solid var(--node-border); border-radius: var(--token-radius-panel); background: linear-gradient(145deg, var(--node-surface), var(--token-surface-panel) 72%); color: var(--node-text); }
  .flow-node.source { --node-border: var(--token-color-active-border); --node-surface: var(--token-color-active-surface); --node-text: var(--token-color-active-text); }
  .flow-node.registry { --node-border: var(--token-color-intelligence-border); --node-surface: var(--token-color-intelligence-surface); --node-text: var(--token-color-intelligence-text); }
  .flow-node.citation, .flow-node.stored { --node-border: var(--token-color-success-border); --node-surface: var(--token-color-success-surface); --node-text: var(--token-color-success-text); }
  .node-number { position: absolute; top: .8rem; right: .8rem; font-family: var(--token-font-mono); font-size: .54rem; }
  .flow-node > :global(svg) { margin-bottom: 1.3rem; }
  .flow-node small { display: block; font-family: var(--token-font-mono); font-size: .54rem; letter-spacing: .07em; }
  .flow-node h3 { margin-top: .42rem; color: var(--token-ink-primary); font-size: .98rem; font-weight: 500; }
  .flow-node code { display: block; margin-top: .75rem; padding: .42rem .5rem; border: 1px solid var(--node-border); border-radius: var(--token-radius-control); color: var(--node-text); font-family: var(--token-font-mono); font-size: .59rem; overflow-wrap: anywhere; }
  .flow-node p { margin-top: .7rem; color: var(--token-ink-muted); font-size: .64rem; line-height: 1.48; }
  .flow-edge { display: grid; justify-items: center; gap: .3rem; color: var(--token-ink-muted); }
  .flow-edge.guarded { color: var(--token-color-success-text); }
  .flow-edge small { font-size: .5rem; white-space: nowrap; }
  .trust-grid { display: grid; grid-template-columns: 1fr .8fr 1fr; gap: .75rem; margin-top: .75rem; }
  .trust-grid article, .wire-grid article { overflow: hidden; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .trust-grid header, .wire-grid header { display: flex; gap: .48rem; align-items: center; padding: .68rem .8rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-color-intelligence-text); }
  .trust-grid header span, .wire-grid header span { font-family: var(--token-font-mono); font-size: .55rem; letter-spacing: .08em; }
  pre { margin: 0; }
  .trust-grid pre, .wire-grid pre { height: 100%; padding: .9rem; background: var(--token-surface-work); color: var(--token-ink-secondary); font-family: var(--token-font-mono); font-size: .62rem; line-height: 1.58; overflow-x: auto; }
  .gate-card > div { display: flex; gap: .6rem; align-items: center; justify-content: center; min-height: 7rem; padding: 1rem; color: var(--token-color-success-text); }
  .gate-card strong { padding: .45rem .55rem; border: 1px solid var(--token-color-success-border); border-radius: var(--token-radius-control); background: var(--token-color-success-surface); font-family: var(--token-font-mono); font-size: .63rem; font-weight: 500; }
  .gate-card p { padding: 0 1rem 1rem; color: var(--token-ink-muted); font-size: .64rem; line-height: 1.5; }
  .algorithm-tabs { display: grid; grid-template-columns: repeat(4, 1fr); overflow: hidden; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel) var(--token-radius-panel) 0 0; }
  .algorithm-tabs button { display: flex; gap: .55rem; align-items: center; padding: .85rem 1rem; border: 0; border-right: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); color: var(--token-ink-muted); cursor: pointer; }
  .algorithm-tabs button:last-child { border-right: 0; }
  .algorithm-tabs button.active { background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); box-shadow: inset 0 -2px 0 var(--token-color-intelligence-border); }
  .algorithm-tabs button span { font-family: var(--token-font-mono); font-size: .55rem; }
  .algorithm-tabs button strong { color: var(--token-ink-primary); font-size: .69rem; font-weight: 500; }
  .algorithm-panel { min-height: 39rem; padding: 1.4rem; border: 1px solid var(--token-color-intelligence-border); border-top: 0; border-radius: 0 0 var(--token-radius-panel) var(--token-radius-panel); background: linear-gradient(145deg, var(--token-color-intelligence-surface), var(--token-surface-panel) 55%); }
  .algorithm-intro { display: grid; grid-template-columns: auto 1fr; gap: 1rem; align-items: start; }
  .panel-number { display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border: 1px solid var(--token-color-intelligence-border); border-radius: 50%; color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .63rem; }
  .algorithm-intro h3 { font-size: 1.35rem; font-weight: 500; letter-spacing: -.025em; }
  .algorithm-intro p { max-width: 62rem; margin-top: .45rem; color: var(--token-ink-secondary); font-size: .76rem; line-height: 1.6; }
  .equation-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: .65rem; margin-top: 1.35rem; }
  .equation-grid article { min-width: 0; padding: .85rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-work); }
  .equation-grid code { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .72rem; overflow-wrap: anywhere; }
  .equation-grid p { margin-top: .42rem; color: var(--token-ink-muted); font-size: .61rem; line-height: 1.42; }
  .algorithm-detail { display: grid; grid-template-columns: 1.5fr .75fr; gap: 1.5rem; margin-top: 1.5rem; }
  .algorithm-detail ol, .algorithm-detail ul { margin: .75rem 0 0; padding: 0; list-style: none; }
  .algorithm-detail ol { overflow: hidden; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); }
  .algorithm-detail ol li { display: grid; grid-template-columns: 2rem 1fr; gap: .7rem; padding: .7rem; border-bottom: 1px solid var(--token-border-subtle); background: color-mix(in srgb, var(--token-surface-panel) 88%, transparent); }
  .algorithm-detail ol li:last-child { border-bottom: 0; }
  .algorithm-detail ol li span { color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .56rem; }
  .algorithm-detail ol li p { color: var(--token-ink-secondary); font-size: .65rem; line-height: 1.48; }
  .algorithm-detail aside ul { display: flex; flex-wrap: wrap; gap: .4rem; }
  .algorithm-detail aside li { display: inline-flex; gap: .35rem; align-items: center; padding: .3rem .45rem; border: 1px solid var(--token-color-success-border); border-radius: 999px; background: var(--token-color-success-surface); color: var(--token-color-success-text); font-size: .57rem; }
  .complexity { display: flex; gap: .65rem; align-items: start; margin-top: 1rem; padding: .8rem; border: 1px solid var(--token-color-active-border); border-radius: var(--token-radius-control); color: var(--token-color-active-text); }
  .complexity span { font-family: var(--token-font-mono); font-size: .53rem; letter-spacing: .07em; }
  .complexity p { margin-top: .35rem; color: var(--token-ink-secondary); font-size: .63rem; line-height: 1.5; }
  .scenario-layout { display: grid; grid-template-columns: 14rem 1fr; gap: .75rem; }
  .scenario-tabs { display: flex; flex-direction: column; gap: .4rem; }
  .scenario-tabs button { display: flex; gap: .5rem; align-items: center; width: 100%; padding: .7rem .75rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-panel); color: var(--token-ink-muted); font-size: .66rem; text-align: left; cursor: pointer; }
  .scenario-tabs button.active { border-color: var(--token-color-intelligence-border); background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); }
  .scenario-panel { overflow: hidden; border: 1px solid var(--scenario-border); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .scenario-panel.tone-success { --scenario-border: var(--token-color-success-border); --scenario-surface: var(--token-color-success-surface); --scenario-text: var(--token-color-success-text); }
  .scenario-panel.tone-active { --scenario-border: var(--token-color-active-border); --scenario-surface: var(--token-color-active-surface); --scenario-text: var(--token-color-active-text); }
  .scenario-panel.tone-warning { --scenario-border: var(--token-color-warning-border); --scenario-surface: var(--token-color-warning-surface); --scenario-text: var(--token-color-warning-text); }
  .scenario-panel > header { display: flex; justify-content: space-between; gap: 1rem; padding: 1.1rem; border-bottom: 1px solid var(--scenario-border); background: var(--scenario-surface); color: var(--scenario-text); }
  .scenario-panel > header span { font-family: var(--token-font-mono); font-size: .53rem; letter-spacing: .08em; }
  .scenario-panel > header h3 { margin-top: .3rem; color: var(--token-ink-primary); font-size: 1.12rem; font-weight: 500; }
  .scenario-panel > header p { margin-top: .38rem; color: var(--token-ink-secondary); font-size: .66rem; line-height: 1.45; }
  .scenario-steps { display: grid; grid-template-columns: repeat(5, 1fr); padding: 1rem; }
  .scenario-step { position: relative; min-width: 0; padding: .7rem .9rem .7rem .7rem; border: 1px solid var(--token-border-subtle); border-right: 0; background: var(--token-surface-work); }
  .scenario-step:first-child { border-radius: var(--token-radius-control) 0 0 var(--token-radius-control); }
  .scenario-step:last-child { border-right: 1px solid var(--token-border-subtle); border-radius: 0 var(--token-radius-control) var(--token-radius-control) 0; }
  .scenario-step > span { color: var(--scenario-text); font-family: var(--token-font-mono); font-size: .52rem; }
  .scenario-step strong { display: block; margin-top: .35rem; font-size: .65rem; font-weight: 500; }
  .scenario-step p { margin-top: .28rem; color: var(--token-ink-muted); font-size: .57rem; line-height: 1.4; }
  .scenario-step > :global(svg) { position: absolute; z-index: 2; top: 50%; right: -.52rem; padding: .12rem; border-radius: 50%; background: var(--token-surface-panel); color: var(--token-ink-muted); transform: translateY(-50%); }
  .scenario-step.state-retry { background: var(--token-color-warning-surface); }
  .scenario-panel > footer { display: flex; gap: .5rem; align-items: center; padding: .75rem 1rem; border-top: 1px solid var(--scenario-border); color: var(--scenario-text); font-size: .65rem; }
  .scenario-panel > footer strong { font-weight: 500; }
  .lifecycle-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; margin-top: .75rem; }
  .lifecycle-grid article { padding: 1rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .lifecycle-grid header { display: flex; gap: .5rem; align-items: center; color: var(--token-color-intelligence-text); }
  .lifecycle-grid header span { font-family: var(--token-font-mono); font-size: .55rem; letter-spacing: .07em; }
  .mini-flow { gap: .38rem; margin-top: .9rem; color: var(--token-ink-muted); }
  .mini-flow span { padding: .34rem .42rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-work); font-size: .55rem; }
  .lifecycle-grid article > p { margin-top: .75rem; color: var(--token-ink-muted); font-size: .62rem; line-height: 1.45; }
  .lifecycle-grid code { color: var(--token-ink-secondary); }
  .wire-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: .75rem; }
  .wire-grid pre { min-height: 22rem; font-size: .67rem; }
  .security-strip { display: flex; gap: .75rem; align-items: start; margin-top: .75rem; padding: .9rem 1rem; border: 1px solid var(--token-color-success-border); border-radius: var(--token-radius-control); background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .security-strip strong { font-size: .72rem; font-weight: 500; }
  .security-strip p { margin-top: .3rem; color: var(--token-ink-secondary); font-size: .64rem; line-height: 1.5; }
  .ledger-toolbar { display: flex; justify-content: space-between; gap: 1rem; align-items: center; margin-bottom: .75rem; }
  .ledger-filters { display: flex; flex-wrap: wrap; gap: .35rem; }
  .ledger-filters button { display: inline-flex; gap: .38rem; align-items: center; padding: .36rem .48rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-panel); color: var(--token-ink-muted); font-size: .59rem; cursor: pointer; }
  .ledger-filters button span { display: grid; place-items: center; min-width: 1.15rem; height: 1.15rem; border-radius: 999px; background: var(--token-surface-work); font-family: var(--token-font-mono); font-size: .49rem; }
  .ledger-filters button.active { border-color: var(--token-color-intelligence-border); background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); }
  .ledger-toolbar > span { display: flex; gap: .38rem; align-items: center; color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .56rem; }
  .ledger-list { overflow: hidden; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); }
  .ledger-list article { display: grid; grid-template-columns: 8rem minmax(15rem, 1.2fr) minmax(15rem, 1fr) minmax(15rem, 1fr); border-bottom: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); }
  .ledger-list article:last-child { border-bottom: 0; }
  .ledger-list article > div { min-width: 0; padding: .75rem .8rem; border-right: 1px solid var(--token-border-subtle); }
  .ledger-list article > div:last-child { border-right: 0; }
  .ledger-meta { display: flex; flex-direction: column; gap: .35rem; align-items: start; }
  .action { padding: .22rem .35rem; border: 1px solid var(--token-color-success-border); border-radius: 999px; background: var(--token-color-success-surface); color: var(--token-color-success-text); font-family: var(--token-font-mono); font-size: .48rem; text-transform: uppercase; }
  .action-change { border-color: var(--token-color-active-border); background: var(--token-color-active-surface); color: var(--token-color-active-text); }
  .action-move { border-color: var(--token-color-warning-border); background: var(--token-color-warning-surface); color: var(--token-color-warning-text); }
  .group { color: var(--token-ink-muted); font-size: .55rem; }
  .ledger-location code { display: block; color: var(--token-ink-primary); font-family: var(--token-font-mono); font-size: .59rem; line-height: 1.45; overflow-wrap: anywhere; }
  .ledger-location strong { display: block; margin-top: .35rem; color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .54rem; font-weight: 500; }
  .ledger-location small { display: block; margin-top: .3rem; color: var(--token-ink-muted); font-size: .53rem; line-height: 1.35; }
  .ledger-change span, .ledger-reason span { color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .49rem; letter-spacing: .07em; }
  .ledger-change p, .ledger-reason p { margin-top: .35rem; color: var(--token-ink-secondary); font-size: .61rem; line-height: 1.48; }
  .proof-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: .7rem; }
  .proof-stats article { display: flex; gap: .65rem; align-items: start; padding: .85rem; border: 1px solid var(--token-color-success-border); border-radius: var(--token-radius-control); background: var(--token-color-success-surface); color: var(--token-color-success-text); }
  .proof-stats strong, .proof-stats span { display: block; }
  .proof-stats strong { font-family: var(--token-font-mono); font-size: 1.05rem; font-weight: 500; }
  .proof-stats span { margin-top: .18rem; color: var(--token-ink-primary); font-size: .63rem; }
  .proof-stats p { margin-top: .26rem; color: var(--token-ink-muted); font-size: .54rem; }
  .proof-grid { display: grid; grid-template-columns: 1fr 1fr 1.05fr; gap: .75rem; margin-top: .75rem; }
  .proof-grid article { overflow: hidden; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-panel); background: var(--token-surface-panel); }
  .proof-grid header { display: flex; gap: .6rem; align-items: start; padding: .8rem; border-bottom: 1px solid var(--token-border-subtle); color: var(--token-color-intelligence-text); }
  .proof-grid header span, .proof-grid header strong { display: block; }
  .proof-grid header span { font-family: var(--token-font-mono); font-size: .5rem; letter-spacing: .07em; }
  .proof-grid header strong { margin-top: .22rem; color: var(--token-ink-primary); font-size: .7rem; font-weight: 500; }
  .proof-grid ul, .proof-grid ol { margin: 0; padding: .75rem .85rem; list-style: none; }
  .proof-grid li { display: flex; gap: .4rem; align-items: start; padding: .36rem 0; color: var(--token-ink-secondary); font-size: .61rem; line-height: 1.42; }
  .proof-grid li :global(svg) { flex: 0 0 auto; color: var(--token-color-success-text); }
  .proof-grid ol li span { flex: 0 0 auto; color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); font-size: .51rem; }
  .command-evidence { display: grid; grid-template-columns: minmax(20rem, auto) 1fr; margin-top: .75rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); overflow: hidden; }
  .command-evidence code, .command-evidence span { padding: .55rem .7rem; border-bottom: 1px solid var(--token-border-subtle); font-size: .59rem; }
  .command-evidence code { border-right: 1px solid var(--token-border-subtle); background: var(--token-surface-work); color: var(--token-color-intelligence-text); font-family: var(--token-font-mono); }
  .command-evidence span { color: var(--token-ink-secondary); }
  .command-evidence > :nth-last-child(-n + 2) { border-bottom: 0; }
  .caveat-section { display: grid; grid-template-columns: auto 1fr; gap: 1rem; }
  .caveat-icon { display: grid; place-items: center; width: 3rem; height: 3rem; border: 1px solid var(--token-color-warning-border); border-radius: 50%; background: var(--token-color-warning-surface); color: var(--token-color-warning-text); }
  .caveat-section > div:nth-child(2) > p { max-width: 70rem; margin-top: .8rem; color: var(--token-ink-secondary); font-size: .75rem; line-height: 1.62; }
  .caveat-grid { grid-column: 1 / 3; display: grid; grid-template-columns: repeat(3, 1fr); gap: .7rem; }
  .caveat-grid article { padding: .9rem; border: 1px solid var(--token-color-warning-border); border-radius: var(--token-radius-control); background: var(--token-color-warning-surface); }
  .caveat-grid span { color: var(--token-color-warning-text); font-family: var(--token-font-mono); font-size: .5rem; letter-spacing: .07em; }
  .caveat-grid strong { display: block; margin-top: .4rem; font-size: .72rem; font-weight: 500; }
  .caveat-grid p { margin-top: .38rem; color: var(--token-ink-muted); font-size: .59rem; line-height: 1.4; }
  .handoff { display: grid; grid-template-columns: 1.2fr .8fr; gap: 3rem; align-items: end; margin-top: 6rem; padding: 2rem; border: 1px solid var(--token-color-intelligence-border); border-radius: var(--token-radius-panel); background: linear-gradient(145deg, var(--token-color-intelligence-surface), var(--token-surface-panel)); }
  .handoff p { max-width: 48rem; margin-top: .75rem; color: var(--token-ink-secondary); font-size: .72rem; line-height: 1.55; }
  .handoff-links { flex-direction: column; align-items: stretch; gap: .45rem; }
  .handoff-links a { display: flex; gap: .55rem; align-items: center; padding: .62rem .7rem; border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); color: var(--token-ink-secondary); font-size: .65rem; text-decoration: none; }
  .handoff-links a.current { border-color: var(--token-color-intelligence-border); background: var(--token-color-intelligence-surface); color: var(--token-color-intelligence-text); }
  .handoff-links span { font-family: var(--token-font-mono); font-size: .54rem; }
  .page-footer { display: flex; justify-content: space-between; margin-top: 5rem; padding: 1rem 0 2rem; border-top: 1px solid var(--token-border-subtle); color: var(--token-ink-muted); font-family: var(--token-font-mono); font-size: .53rem; letter-spacing: .06em; }

  @media (max-width: 70rem) {
    .hero { grid-template-columns: 1fr; gap: 2rem; }
    .branch-card { max-width: 34rem; }
    .boundary-flow { grid-template-columns: 1fr; }
    .flow-edge { transform: rotate(90deg); }
    .flow-edge small { display: none; }
    .equation-grid { grid-template-columns: 1fr 1fr; }
    .scenario-steps { grid-template-columns: 1fr; gap: .4rem; }
    .scenario-step { border-right: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control) !important; }
    .scenario-step > :global(svg) { display: none; }
    .ledger-list article { grid-template-columns: 7rem 1fr 1fr; }
    .ledger-reason { grid-column: 2 / 4; border-top: 1px solid var(--token-border-subtle); }
    .proof-stats { grid-template-columns: 1fr 1fr; }
    .proof-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 48rem) {
    .topbar { padding: 0 1rem; }
    nav { display: none; }
    main, .page-footer { width: min(100% - 1.5rem, 84rem); }
    .hero { padding-top: 4.5rem; }
    .section { padding-top: 4.5rem; }
    .section-heading { display: block; }
    .section-heading > p { margin-top: .8rem; text-align: left; }
    .trust-grid, .algorithm-detail, .scenario-layout, .lifecycle-grid, .wire-grid, .caveat-grid, .handoff { grid-template-columns: 1fr; }
    .algorithm-tabs { grid-template-columns: 1fr 1fr; }
    .algorithm-tabs button:nth-child(2) { border-right: 0; }
    .algorithm-tabs button:nth-child(-n + 2) { border-bottom: 1px solid var(--token-border-subtle); }
    .equation-grid, .proof-stats { grid-template-columns: 1fr; }
    .scenario-tabs { display: grid; grid-template-columns: 1fr 1fr; }
    .ledger-toolbar { align-items: start; flex-direction: column; }
    .ledger-list article { grid-template-columns: 1fr; }
    .ledger-list article > div { border-right: 0; border-bottom: 1px solid var(--token-border-subtle); }
    .ledger-reason { grid-column: auto; border-top: 0; }
    .command-evidence { grid-template-columns: 1fr; }
    .command-evidence code { border-right: 0; }
    .command-evidence > :nth-last-child(-n + 2) { border-bottom: 1px solid var(--token-border-subtle); }
    .command-evidence > :last-child { border-bottom: 0; }
    .caveat-grid { grid-column: auto; }
    .handoff { gap: 1.5rem; }
    .page-footer { gap: .7rem; flex-direction: column; }
  }
</style>
