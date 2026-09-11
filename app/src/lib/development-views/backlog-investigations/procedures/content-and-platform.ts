import type { Investigation } from "$development-views/backlog-investigations/types";

export const CONTENT_AND_PLATFORM: readonly Investigation[] = [
  {
    id: "linked-copy",
    number: "04",
    label: "Copy system",
    prompt: "How should linked native objects and rich clipboard transfer work?",
    status: "resolved",
    verdict: "Canonical objects own meaning; placements own presentation; the clipboard carries both native and interoperable forms.",
    answer:
      "Icarus does not yet have the canonical analytic identity required by the backlog. Charts are currently values embedded in their resource and the only explicit chart-copy path rasterizes a PNG. The new system should establish an analytic resource ID first, then copy a validated native envelope for fidelity alongside HTML, plain text, and image fallbacks for external applications.",
    observed: [
      "A presentation stores a chart as an inline untyped spec; documents have no chart block in the current content-block union.",
      "The shared ChartSpec is a renderer value, not a persisted canonical analytic resource with ownership and revision history; its function-valued formatters also make it unsuitable as a stored representation unchanged.",
      "The only chart-copy procedure paints the rendered SVG into a 2× PNG and writes only image/png; it is currently consumed only by a development view, so production has no chart-copy workflow.",
      "Spreadsheet paste receives a rectangular array of strings and applies typed values/formulas; it has no Icarus-native multi-format envelope.",
      "Document paste relies on ProseMirror/browser behavior and presentation text copy is plain text; neither has a current Icarus-native envelope or a declared sanitization/fidelity contract.",
      "Chromium’s async clipboard can exchange text/plain, text/html, image/png, and opt-in web custom formats. Custom web formats are for app-to-app fidelity and cannot replace standard fallbacks."
    ],
    contract: [
      { concern: "Canonical identity", decision: "Persist one project-owned analytic resource with stable ID, current revision, data bindings, chart specification, and history." },
      { concern: "Placement", decision: "Each document, presentation, or spreadsheet embedding stores only resource reference plus local geometry, crop, size, and other presentation choices." },
      { concern: "Native copy", decision: "Write a bounded validated Icarus clipboard envelope containing source project, resource kind/ID/revision, selected placement payload, and a portable value snapshot." },
      { concern: "Default paste", decision: "Within the same authorized project, paste another linked placement of the same analytic. Cross-project paste always creates an independent authorized copy. Expose Duplicate/Detach as an explicit new-resource operation." },
      { concern: "External formats", decision: "Also write HTML and plain text, plus PNG for charts. Read the richest safe supported form in order: current native envelope, HTML, image, text." },
      { concern: "Inbound fidelity", decision: "Normalize sanitized HTML from Word/Google Docs, HTML or TSV tables, and explicit/plain-text Markdown. Preserve supported structure and marks; report or safely discard unsupported styling." },
      { concern: "Outbound fidelity", decision: "Export semantic text as HTML + plain text, tables as HTML + TSV, and charts as PNG. Promise best-supported structure, not full round-trip fidelity through foreign applications." },
      { concern: "Loss and deletion", decision: "Access revocation makes a placement explicitly unavailable immediately. Deletion is dependency-aware and requires removing placements or creating authorized independent duplicates." },
      { concern: "Edit boundary", decision: "Data, bindings, series, axes, and semantic chart settings edit the shared analytic; position, bounding box, crop, and local caption edit one placement." }
    ],
    alternatives: [
      { option: "Native envelope + fallbacks", benefit: "Linked fidelity inside Icarus and predictable degradation outside it.", cost: "Requires canonical analytics, security validation, and multiple serializers.", decision: "recommend" },
      { option: "Always copy by value", benefit: "Simple ownership and no broken references.", cost: "Defeats the settled linked-chart behavior and creates divergent copies.", decision: "reject" },
      { option: "Native custom format only", benefit: "Maximum same-app fidelity with one serializer.", cost: "Paste into Word, Google Docs, Markdown tools, or another desktop app becomes empty or opaque.", decision: "reject" }
    ],
    sequence: [
      "Create the current-schema analytic aggregate and make editors reference it through independently owned placement types.",
      "Define and validate one current native clipboard envelope; never trust a clipboard resource ID as proof of project access.",
      "Add serializers and importers for HTML, plain text/Markdown structure, and PNG, with deterministic fidelity rules.",
      "Implement linked paste, duplicate/detach, dependency-aware deletion, and explicit unavailable placements.",
      "Test editor-to-editor matrices and real Chromium clipboard round trips before adding richer external export formats."
    ],
    acceptance: [
      "Copying one chart into two native editors creates three placements that resolve one analytic ID and reflect a shared data/spec edit.",
      "Moving or resizing one placement does not change the other placements.",
      "A forged or unauthorized cross-project envelope is refused without leaking source content; an authorized cross-project paste creates an independent analytic at revision 1.",
      "Fixture captures from Word, Google Docs, Markdown, and tabular sources normalize to the documented structure with unsupported content handled explicitly.",
      "Paste into an external HTML-capable target receives meaningful HTML (and chart PNG where supported); plain-text targets receive useful text.",
      "Revocation and deletion never show stale private chart data and never leave a silent blank block."
    ],
    evidence: [
      { path: "app/src/lib/representation/data/types/presentations/body.ts", finding: "Presentation chart elements currently hold an inline Record<string, unknown> spec." },
      { path: "app/src/lib/representation/data/types/content/content-block.ts", finding: "The current shared document content-block union has text, formula, image, table, and prompt blocks, but no canonical chart reference." },
      { path: "app/src/lib/components/authored/chart/chart-spec.ts", finding: "ChartSpec defines renderable chart meaning but no stored project identity, ownership, or revision." },
      { path: "app/src/lib/components/authored/chart/copy-chart.ts", finding: "The only chart clipboard procedure rasterizes to PNG and writes image/png." },
      { path: "app/src/lib/app-views/categories/spreadsheet-editor/procedures/clipboard.ts", finding: "Spreadsheet paste operates on a rectangular string matrix, with scalar replication and typed/formula parsing." },
      { path: "W3C Clipboard API and Events", href: "https://www.w3.org/TR/clipboard-apis/", finding: "The standard defines mandatory text/plain, text/html, and image/png clipboard data and permission-controlled async access." },
      { path: "Chrome: Web custom formats for the Async Clipboard API", href: "https://developer.chrome.com/blog/web-custom-formats-for-the-async-clipboard-api/", finding: "Chromium supports opt-in web custom formats for same-application fidelity, using the web-prefixed MIME convention." }
    ]
  },
  {
    id: "personal-assets",
    number: "05",
    label: "Ownership",
    prompt: "What common model should personal and project assets use?",
    status: "direction",
    verdict: "Share the ownership/versioning contract, not one generic content table.",
    answer:
      "Templates, personas, and future Skills need the same scope, owner, version, and copy-provenance rules, but their bodies and invariants are different. A common asset identity header plus kind-specific aggregates gives consistent authorization and transfer without reducing every asset to an unreviewable JSON blob.",
    observed: [
      "Templates currently carry both projectId and userId and have immutable version rows, but projection always treats them as project assets even though the library exposes a Personal filter.",
      "Personas are project-scoped and revisioned but have no separate immutable version table.",
      "Template duplicate creates a new project template by value, but there is no represented personal-library scope or cross-scope copy provenance.",
      "The capability scope proves the current project and user but carries no project membership role, so future destination-write policy needs an explicit authorization source.",
      "Skills do not yet have a product persistence model in the current tree."
    ],
    contract: [
      { concern: "Asset identity", decision: "Each kind-specific table embeds the same typed header values: ID, kind, scope, owner, createdBy, current revision, timestamps, and optional copied-from provenance." },
      { concern: "Scope", decision: "Use a closed union: personal { userId } or project { projectId }. An asset belongs to exactly one scope." },
      { concern: "Content", decision: "Keep template, persona, Skill, and future asset bodies in kind-specific current/version rows with kind-specific validation." },
      { concern: "Versioning", decision: "Every reusable asset gets immutable versions; references that must be reproducible name an asset revision, while library views resolve current revision." },
      { concern: "Cross-scope copy", decision: "One transaction creates a new ID and version 1 in the destination, records source kind/ID/revision and copying actor/time, and then evolves independently." },
      { concern: "Referenced resources", decision: "Validate every embedded scope/reference for the destination. Never smuggle inaccessible project resources into a personal copy through a serialized body." },
      { concern: "Shared tables", decision: "Share identity, ownership, provenance, and version metadata. Keep content, editors, and behavioral constraints asset-specific." }
    ],
    alternatives: [
      { option: "Common header + typed bodies", benefit: "Uniform policy with reviewable type-specific rules and room for future asset kinds.", cost: "Reads join identity metadata to a kind-specific revision." , decision: "recommend" },
      { option: "One universal asset JSON table", benefit: "Adding a nominal kind is fast.", cost: "Validation, indexing, ownership rules, and migrations collapse into kind switches and opaque blobs.", decision: "reject" },
      { option: "Independent tables only", benefit: "Each feature remains locally simple.", cost: "Ownership, copy provenance, authorization, and version semantics drift across assets.", decision: "reject" }
    ],
    sequence: [
      "Define the closed personal/project scope and common asset/version/provenance fields as current representation types.",
      "Move templates and personas together so there is no interim dual ownership interpretation; replace seeds and capabilities without legacy readers.",
      "Implement one atomic copy aggregate procedure used by personal→project and project→personal entry points.",
      "Add Skills on the established header/version contract rather than inventing a third ownership shape.",
      "Test ownership, destination reference admission, independent version evolution, and exact provenance."
    ],
    acceptance: [
      "Every asset resolves exactly one personal or project owner and every capability proves access server-side.",
      "A cross-scope copy has a new ID/revision lineage and records the exact source revision; later source edits never modify it.",
      "A copy with an inaccessible embedded project reference is refused or explicitly stripped according to a tested kind-specific rule.",
      "Template, persona, and Skill history can reconstruct the exact execution/editable version used at a prior time.",
      "No compatibility aliases, old-scope readers, or migration fallback remain after the current-schema transition."
    ],
    evidence: [
      { path: "app/src/lib/representation/store/tables/templates.ts", finding: "Templates currently carry projectId and userId; immutable TemplateVersion rows retain body and holes." },
      { path: "app/src/lib/representation/store/tables/agents.ts", finding: "Personas are project-scoped and revisioned but have no immutable persona-version aggregate." },
      { path: "app/src/lib/capabilities/templates/api/duplicate-template/duplicate-template.ts", finding: "Current duplication deep-copies a template inside the active project without cross-scope provenance." },
      { path: "app/src/lib/capabilities/templates/test/non-functional/ownership.test.ts", finding: "Existing template capability contracts already enforce project ownership at the server boundary." }
    ]
  },
  {
    id: "structured-extraction",
    number: "06",
    label: "Structured data",
    prompt: "What should inspectable text-to-table extraction produce?",
    status: "resolved",
    verdict: "Generate a cited proposal; publish a native table only after explicit review.",
    answer:
      "The current material system profiles and retrieves existing tables, CSVs, charts, and spreadsheets; it does not model a correctable extraction proposal. Extraction should therefore produce a versioned proposal whose typed cells retain exact source anchors, raw text, normalized value, unit, and uncertainty. User corrections are authored overlays, and acceptance atomically materializes a native table or spreadsheet while preserving the proposal as evidence.",
    observed: [
      "Material profiles infer only broad column types—empty, boolean, number, date, text, or mixed—and record samples, counts, and warnings.",
      "Derived-output tools can read bounded authoritative native table, CSV, and chart values, but that is retrieval from existing structure rather than creating reviewed structure from prose.",
      "The current tree has no first-class extraction proposal, per-cell source span, correction overlay, or acceptance lifecycle.",
      "Native spreadsheet values already distinguish typed scalars and formulas, providing a publication target but not an extraction audit model."
    ],
    contract: [
      { concern: "Proposal", decision: "Store source resource ID/revision/hash, extractor/model provenance, proposed schema, rows, warnings, and lifecycle pending/accepted/dismissed/superseded." },
      { concern: "Cell value", decision: "Retain raw text, normalized typed value, semantic type, optional unit/currency/time zone, source locator(s), and evidence classification: exact, interpreted, ambiguous, or missing." },
      { concern: "Types", decision: "Support empty, text, boolean, number, date, datetime, duration, currency, percentage, and range. Keep range endpoints rather than flattening to text." },
      { concern: "Evidence", decision: "Every generated cell can reveal its exact supporting text and location; unsupported inferred values are visibly flagged." },
      { concern: "Corrections", decision: "Record user-authored overrides separately with actor/time and the source/proposal revision they amend. Never disguise a correction as model output." },
      { concern: "Regeneration", decision: "Create a new proposal revision. Reapply an override only when its stable row/column key and source anchor still match; surface conflicts for review." },
      { concern: "Confidence", decision: "A bounded numeric model score may supplement the evidence classification but never becomes authority or hides missing support." },
      { concern: "Publication", decision: "Explicit acceptance atomically creates an independent native table/spreadsheet, lineage, and acceptance record. Later regeneration never mutates it; do not synthesize formulas unless requested."
      }
    ],
    alternatives: [
      { option: "Cited proposal then publish", benefit: "Correctable, auditable, reversible, and safe for quantitative work.", cost: "Adds a review state before data is immediately editable as a native resource.", decision: "recommend" },
      { option: "Direct native table", benefit: "Fastest path from text to cells.", cost: "Model guesses become authoritative data and regeneration/corrections lose provenance.", decision: "reject" },
      { option: "Keep all values as text", benefit: "Avoids normalization errors.", cost: "Prevents useful formulas, sorting, units, date arithmetic, and numerical validation.", decision: "reject" }
    ],
    sequence: [
      "Define the proposal, typed cell, source locator, override, and decision representations with strict bounds.",
      "Implement extraction as a durable operation against an immutable source revision and validate its structured output.",
      "Build a side-by-side review surface with source highlighting, column typing, cell correction, and conflict indicators.",
      "Publish through one transaction into a native table/spreadsheet plus immutable acceptance provenance.",
      "Test regeneration, changed source anchors, mixed units, locale-sensitive values, ranges, partial failure, and recovery."
    ],
    acceptance: [
      "Every proposed cell either opens its supporting source span or is explicitly marked unsupported.",
      "Currency, percentage, date/time, duration, unit-bearing number, and range round-trip without losing their semantic type.",
      "User corrections survive safe regeneration and conflicts are surfaced rather than silently overwritten.",
      "A failed acceptance transaction creates neither a partial table nor a false accepted decision; retry is idempotent.",
      "Published native data remains traceable to the exact proposal and immutable source revision."
    ],
    evidence: [
      { path: "app/src/lib/representation/data/types/semantic/material.ts", finding: "Existing table/CSV profiles provide coarse inferred types, structure, samples, and warnings—not extracted cells with source evidence." },
      { path: "app/src/lib/capabilities/derived-output/api/shared/resource-reading-structured-tools.ts", finding: "Current tools read bounded authoritative structure from existing resources." },
      { path: "app/src/lib/representation/data/types/spreadsheets/live.ts", finding: "The spreadsheet live model is a viable native publication target with its own cell semantics." },
      { path: "app/src/lib/representation/store/tables/investigation.ts", finding: "The existing proposal/evidence patterns for research demonstrate why generated output and accepted project knowledge should remain distinct." }
    ]
  },
  {
    id: "keyboard-shortcuts",
    number: "07",
    label: "Input",
    prompt: "What keyboard-shortcut architecture should replace Commands?",
    status: "resolved",
    verdict: "Use context-owned shortcuts with a thin Chromium-host adapter; defer customization.",
    answer:
      "The existing Commands model should be removed as the backlog directs, but its global key listener must not simply become another global switch statement. Editor-local editing gestures stay with their editor, workspace/tab shortcuts go through one focused dispatcher with modal and text-input guards, and a future Electron host maps platform accelerators without owning product behavior.",
    observed: [
      "The current command registry contains only command-bar open and tab close/next/previous; the command palette is therefore more architecture than product capability.",
      "Its window-level dispatcher matches chords everywhere, including form fields and contenteditable surfaces, and prevents the browser default before checking whether the command is enabled.",
      "The dispatcher ignores held-key repeats and normalizes Control or Meta to one $mod token, both useful behaviors to preserve.",
      "No Electron host implementation exists in this tree today, so desktop-only claims must be expressed as a host contract rather than falsely tested product behavior.",
      "Electron distinguishes focused-window menu/local shortcuts from globalShortcut registrations that fire while the app is unfocused; the latter can fail when the OS owns a chord."
    ],
    contract: [
      { concern: "Ownership", decision: "Editor editing shortcuts remain in each editor. Workspace/tab navigation uses one application shortcut controller. Modals and focused overlays get first refusal." },
      { concern: "Text entry", decision: "Never intercept ordinary typing or editing chords from input, textarea, contenteditable, composition/IME, or an active editor unless that owner explicitly handles them." },
      { concern: "Browser", decision: "Ship only Chromium-observable chords and do not promise reserved browser combinations. Keep alternate UI actions reachable." },
      { concern: "Desktop host", decision: "Map app/menu accelerators through a thin Electron adapter using CommandOrControl. Register no unfocused global shortcuts initially." },
      { concern: "Conflict", decision: "A closed catalog declares context, precedence, platform bindings, repeat policy, and preventDefault policy; validation rejects duplicate active chords in one context." },
      { concern: "Customization", decision: "Defer until the catalog and desktop host stabilize. If later required, store user-scoped overrides—not project/workspace data—with conflict validation." }
    ],
    alternatives: [
      { option: "Context-owned catalog", benefit: "Predictable focus behavior, direct procedures, and a clean future desktop bridge.", cost: "Requires explicit precedence and input-boundary tests.", decision: "recommend" },
      { option: "Rename Commands to Shortcuts", benefit: "Minimal source movement.", cost: "Retains the command palette/registry abstraction the settled backlog removes and keeps global interception hazards.", decision: "reject" },
      { option: "Electron global shortcuts", benefit: "Actions work even when Icarus is unfocused.", cost: "Unnecessary OS-level capture, registration conflicts, and surprising behavior for ordinary editing/navigation.", decision: "reject" }
    ],
    sequence: [
      "Inventory the actually required shortcut intents and classify each as editor, modal, workspace, browser-safe, or desktop-host-only.",
      "Add direct action procedures and a focus-aware in-app dispatcher, preserving repeat suppression and platform normalization.",
      "Delete the command bar, Commands model, registry, persisted binding assumptions, and all now-dead documentation in scope.",
      "Define the Electron adapter contract separately when the desktop host exists; bind focused-window accelerators only.",
      "Add customization only after a stable catalog and concrete user need."
    ],
    acceptance: [
      "Every shortcut has an owner, context, precedence, repeat policy, platform mapping, and visible non-keyboard action.",
      "Typing, selection, IME composition, and normal browser text editing are unchanged in every field/editor unless explicitly owned.",
      "Modal Escape/Enter behavior wins over workspace actions; editor shortcuts do not leak to inactive tabs.",
      "Chromium tests cover focused inputs, contenteditable, repeated keys, modal precedence, and browser-reserved fallbacks.",
      "The source tree contains no Commands model, command palette, compatibility alias, or hidden global binding fallback."
    ],
    evidence: [
      { path: "app/src/lib/model/client/commands/types.ts", finding: "The current four-command catalog and binding commentary expose both the limited scope and browser-reservation problem." },
      { path: "app/src/lib/surfaces/app/effects/dispatch-commands.svelte.ts", finding: "The window listener dispatches matched chords globally without focus/editability/composition guards." },
      { path: "app/src/lib/components/authored/sheet-surface/sheet-surface-editor.ts", finding: "Spreadsheet-local key handling already demonstrates an editor owning selection jumps and edit entry." },
      { path: "Electron keyboard shortcuts", href: "https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts/", finding: "Electron documents local, menu, and global shortcut mechanisms as distinct scopes." },
      { path: "Electron globalShortcut", href: "https://www.electronjs.org/docs/latest/api/global-shortcut/", finding: "Global shortcuts work without focus and may fail to register when another application owns the chord." },
      { path: "Electron Accelerator", href: "https://www.electronjs.org/docs/latest/api/accelerator", finding: "CommandOrControl provides the platform abstraction for focused-window application accelerators." }
    ]
  }
];
