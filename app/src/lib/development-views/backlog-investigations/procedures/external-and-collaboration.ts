import type { Investigation } from "$development-views/backlog-investigations/types";

export const EXTERNAL_AND_COLLABORATION: readonly Investigation[] = [
  {
    id: "external-semantics",
    number: "01",
    label: "External files",
    prompt: "What should each external-file field mean?",
    status: "resolved",
    verdict: "Separate exact provenance, interpreted meaning, and operational health.",
    answer:
      "The current UI mixes three different kinds of truth. File facts and actor history are exact; generated description, purpose, entities, and themes are model interpretations; unavailable rows are integrity failures. Naming and placement should preserve those boundaries instead of presenting every value as equivalent metadata.",
    observed: [
      "“Quarantined metadata” counts admitted file rows whose per-file projection could not resolve a required relation or semantic-status record. It is not malware quarantine, ingestion review, or pending source acceptance; malformed rows can instead fail strict table admission.",
      "Material Profile is a bounded structural digest—such as rows, columns, headers, inferred column types, samples, parser facts, dimensions, and warnings—not another generated summary or a general file-facts card.",
      "Purpose is generated in the same semantic-description call as the description. It adds no second model call, and it contributes to generated retrieval text.",
      "The chips beneath semantic status are entities and themes. They are generated, feed semantic retrieval, and are neither user-authored tags nor first-class filtering facets.",
      "The store records who added and last updated a file plus its upload or connector origin. It does not establish the source document’s author.",
      "A re-upload changes the stored content, increments revision, and updates updatedAt/updatedBy; createdAt/createdBy remain the original admission event. Today even byte-identical input still creates revision/history and regenerates semantic state.",
      "Stable file identity is the resource ID. Name, compressed path, full-path tooltip, origin, and connector locator are secondary disambiguation—not identity.",
      "Three adjacent defects were found: the overview omits idle files from status totals, duplicate entity/theme text can create duplicate Svelte keys, and Project Overview single-click routes a file to an inspector key that has no implementation."
    ],
    contract: [
      { concern: "Unavailable records", decision: "Remove the ordinary “Quarantined metadata” metric. Show an actionable “Unavailable records” diagnostic only when non-zero, with recovery detail." },
      { concern: "Generated meaning", decision: "Keep Generated Description primary. Retain Purpose immediately below it and label the whole group as generated interpretation; any copy rename is a separate owner choice." },
      { concern: "Exact structure", decision: "Rename Material Profile to “Detected structure.” Keep it secondary and collapsed by default, because it is useful evidence when inspecting extraction quality." },
      { concern: "Entities and themes", decision: "Use the actual labels “Entities” and “Themes.” Do not call them tags or expose tag editing/filtering until a first-class tag model exists." },
      { concern: "People and origin", decision: "Use Added by, Updated by, and Origin. Do not add Author until source authorship has its own represented provenance." },
      { concern: "Re-upload", decision: "Treat it as a new content revision of the same file: preserve admission provenance, update current-content provenance, and record a re-upload activity." },
      { concern: "Identical content", decision: "A byte-identical re-upload is an accepted no-op: no new revision, timestamp, activity, or semantic regeneration." },
      { concern: "Duplicate names", decision: "Keep name primary and path compact with full hover anywhere the file appears. Surface the concrete connector/source locator in details and route selection to the existing External file inspector." },
      { concern: "Semantic status", decision: "Use an exhaustive visible state—Ready, Processing, Needs attention, Not processed, or Managed only—plus subordinate lane detail and non-color warnings." },
      { concern: "Format coverage", decision: "Publish a supported-profile matrix. Add real structured profilers for data formats before presenting code-style profiling as structured understanding." }
    ],
    alternatives: [
      { option: "Three truth lanes", benefit: "Users can distinguish exact facts, generated interpretation, and integrity state.", cost: "Requires a small information-architecture cleanup.", decision: "recommend" },
      { option: "Keep current labels", benefit: "No implementation change.", cost: "“Quarantine,” “Purpose,” “Tags,” and “Author” continue to imply facts the model does not store.", decision: "reject" },
      { option: "Hide semantic metadata", benefit: "A simpler inspector.", cost: "Removes valuable retrieval transparency and makes extraction harder to audit.", decision: "reject" }
    ],
    sequence: [
      "Rename and regroup existing fields without changing their persisted meaning.",
      "Replace the always-visible unavailable count with a non-zero diagnostic and recovery path.",
      "Add explicit generated/exact provenance labels and semantic-status timestamps.",
      "Only add editable tags or source authorship through new current-schema fields with real product consumers."
    ],
    acceptance: [
      "A ready file never shows “Quarantined metadata.” A corrupt projected row is visible as an actionable unavailable record.",
      "Purpose, entities, and themes are visibly generated; no UI calls them authored metadata.",
      "Re-upload preserves Added by/Added at while changing Updated by/Updated at and recording the new revision.",
      "Byte-identical re-upload changes nothing durable and starts no semantic work.",
      "All semantic status counts sum to the file total; duplicate entity/theme values render without duplicate keys.",
      "Two same-named files can be distinguished and opened from every list using secondary full-path/origin context."
    ],
    evidence: [
      { path: "app/src/lib/capabilities/external-files/api/shared/rows.ts", finding: "Projection failures become unavailable rows with a corrupt reason; projected actors and origin are resolved here." },
      { path: "app/src/lib/app-views/categories/external/context/overview.svelte", finding: "The current “Quarantined metadata” count is the unavailable-row count." },
      { path: "app/src/lib/capabilities/semantic-overlay/api/shared/material-description.ts", finding: "Description, purpose, entities, measures, dimensions, time range, themes, and uncertainty come from one generated descriptor." },
      { path: "app/src/lib/capabilities/semantic-overlay/api/shared/material-facets.ts", finding: "Generated descriptor fields are included in semantic material text used for retrieval." },
      { path: "app/src/lib/app-views/categories/external/components/file-details.svelte", finding: "Current exact labels include Added by, Updated by, Origin, size, type, and timestamps." },
      { path: "app/src/lib/representation/data/types/external/file.ts", finding: "Origin distinguishes uploads from connector source IDs; file identity remains the resource ID." },
      { path: "app/src/lib/app-views/categories/external/procedures/library-query.ts", finding: "The aggregate semantic label has lane combinations that the current overview does not count exhaustively." },
      { path: "app/src/lib/capabilities/external-files/api/reupload-external-file/reupload-external-file.ts", finding: "Byte equality currently avoids blob release but does not avoid a new revision and downstream semantic work." },
      { path: "app/src/lib/app-views/categories/project-overview/procedures/inspecting.ts", finding: "Single-click file selection points at a missing project-overview.file inspector rather than external.file." }
    ]
  },
  {
    id: "activity-language",
    number: "08",
    label: "Collaboration",
    prompt: "How should ambiguous activity “What” values work?",
    status: "resolved",
    verdict: "Persist canonical actions and frozen referents; generate human language centrally.",
    answer:
      "Today activity accepts an arbitrary verb and only four phrases receive deliberate copy. That makes the “What” column drift as producers invent wording. A closed action identifier should express what happened, while frozen actor and target labels preserve historical readability and a central projection owns the sentence shown to people.",
    observed: [
      "Activity targets are currently a free-form kind, ID, and label snapshot; verbs are also free-form strings.",
      "The Project Overview formatter recognizes asked, accepted finding, commented, and connected. Every other verb is title-cased mechanically.",
      "Live production writes currently come from External lifecycle events and agent-task settlement. The broader edited/opened/connected/commented vocabulary is mostly seeds and tests, not proof of working producer journeys.",
      "A target ID can support navigation, but the current target kind is not a closed resource discriminant and the label alone is not authority.",
      "History search compares the raw stored verb while the UI displays a transformed label, so a phrase visible under What may not match when searched."
    ],
    contract: [
      { concern: "Stored event", decision: "Use a closed ActivityAction union plus actor, occurredAt, target reference, and optional secondary subject—not display prose." },
      { concern: "Historical labels", decision: "Freeze actor and target display labels on the event so history remains readable after rename or account changes." },
      { concern: "Display and search", decision: "One projection maps action + target kind to a concise sentence and searchable terms. Producers never invent user-facing verbs." },
      { concern: "Navigation", decision: "“Where” opens a validated current project target. Missing/deleted targets remain readable but explicitly unavailable." },
      { concern: "Schema transition", decision: "Replace current fixtures and writers together. Add no aliases or readers for old arbitrary verbs." }
    ],
    alternatives: [
      { option: "Typed action + formatter", benefit: "Consistent language, exhaustive handling, reliable filtering, and safe navigation.", cost: "Every producer must move in one current-schema change.", decision: "recommend" },
      { option: "Standardized verb strings", benefit: "Smaller representation edit.", cost: "Still allows untyped drift and couples storage to English display copy.", decision: "reject" },
      { option: "Store complete sentences", benefit: "The UI becomes trivial.", cost: "Sentences cannot adapt by target type, localization, or later copy refinement.", decision: "reject" }
    ],
    sequence: [
      "Inventory every live activity producer and define the closed action vocabulary.",
      "Replace the representation and seeds, then centralize human-language projection.",
      "Make target resolution project-owned and return an explicit unavailable state.",
      "Use the same row and inspector contract in Project Overview and Agents Library."
    ],
    acceptance: [
      "Every action identifier has one tested sentence for each supported target shape.",
      "No capability or component writes a display verb or complete sentence.",
      "Searching for the displayed What phrase returns the entry even when its canonical action ID differs.",
      "Every available Where target opens the correct resource; unavailable targets do not become dead tabs.",
      "Activity copy remains readable after the referenced resource is renamed or deleted."
    ],
    evidence: [
      { path: "app/src/lib/representation/store/tables/collaboration.ts", finding: "Activity verbs and target kinds are open strings; actor and target labels are frozen snapshots." },
      { path: "app/src/lib/app-views/categories/project-overview/procedures/activity-label.ts", finding: "Only four activity phrases are explicit; all other values are mechanically title-cased." },
      { path: "app/src/lib/capabilities/project/api/read-project-history/read-project-history.ts", finding: "Search uses the raw stored verb rather than the user-facing activity label." },
      { path: "app/src/lib/capabilities/external-files/api/shared/history.ts", finding: "External file lifecycle is one of only two live activity-producing areas found." },
      { path: "app/src/lib/capabilities/agents/api/shared/execute-agent-task.ts", finding: "Agent-task settlement is the other live activity producer found." }
    ]
  },
  {
    id: "panel-disclosure",
    number: "09",
    label: "Panel behavior",
    prompt: "Which External panel sections should collapse?",
    status: "bounded",
    verdict: "Collapse long supporting evidence, never identity, status, or primary action.",
    answer:
      "The existing panel primitive already provides an accessible disclosure pattern. The missing decision is information priority: file identity, status, exact facts, and primary actions must remain immediately visible; detected structure and long technical evidence may collapse. History and directory contents are primary navigation, not supporting detail.",
    observed: [
      "PanelSection already implements an accessible collapsible heading and accepts an initial open state.",
      "Its own component guidance distinguishes primary information that starts open from qualifying content that starts shut.",
      "The External inspector contains both short operational controls and potentially long semantic/reference content, so applying one disclosure rule to the whole inspector would hide essential state.",
      "External History is itself the panel’s primary content. It currently renders a long static list, so the remedy is search/select/open behavior—not collapsing the list."
    ],
    contract: [
      { concern: "Always visible", decision: "File identity, availability/semantic status, concise file facts, and primary actions." },
      { concern: "Open by default", decision: "Generated Description and its short Purpose block when present." },
      { concern: "Closed by default", decision: "Detected structure and technical detail. Keep any warning/error count visible on the closed trigger." },
      { concern: "History", decision: "Keep the searchable history list open as its own inspector view. Disclose long entry detail, not the activity list itself." },
      { concern: "References", decision: "Keep non-zero references visible because they block deletion; summarize or collapse only the zero/long-detail state without hiding the blocker." },
      { concern: "Directories", decision: "Keep child Contents navigation visible. Only secondary aggregate technical counts may collapse." },
      { concern: "Context overview", decision: "Keep compact metrics flat; do not put every metric inside its own disclosure." },
      { concern: "State lifetime", decision: "Keep disclosure local to the mounted inspector unless a demonstrated workflow needs tab-persistent state." }
    ],
    alternatives: [
      { option: "Priority-based disclosure", benefit: "Compact rails without hiding the current file’s essential state.", cost: "Each section needs a deliberate priority classification.", decision: "recommend" },
      { option: "Everything collapsible", benefit: "Maximum manual control.", cost: "Adds chrome and lets essential actions/status disappear.", decision: "reject" },
      { option: "Nothing collapsible", benefit: "All information is discoverable at once.", cost: "Long evidence and history bury frequent controls in a narrow rail.", decision: "reject" }
    ],
    sequence: [
      "Classify inspector sections as essential, primary evidence, or supporting evidence.",
      "Reuse PanelSection for only the latter two groups with deliberate initial state.",
      "Test focus, keyboard activation, narrow rails, and very long material profiles.",
      "Add persistence only if user testing demonstrates a cross-remount need."
    ],
    acceptance: [
      "A user can identify the file, see its status, and reach primary actions without opening a disclosure.",
      "Long structural evidence does not push primary controls beyond the initial viewport.",
      "Warnings, recovery actions, and deletion-blocking references remain visible without guessing which section to open.",
      "Disclosure buttons expose aria-expanded state and work by keyboard.",
      "History remains searchable/selectable/openable, and directory child navigation remains intact at compact and zoomed widths."
    ],
    evidence: [
      { path: "app/src/lib/components/authored/panel/panel-section.svelte", finding: "The existing reusable section owns accessible disclosure and initial-open behavior." },
      { path: "app/src/lib/app-views/categories/external/inspector/file.svelte", finding: "The file inspector composes operational facts, actions, semantic evidence, references, and history." },
      { path: "app/src/lib/app-views/categories/external/components/file-semantic-status.svelte", finding: "Generated description and structural evidence can grow independently and need different prominence." }
    ]
  }
];
