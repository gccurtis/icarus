export type DerivedAgentToolMode = "evidence" | "orientation";

export type DerivedAgentEvidenceKind =
  | "exact text"
  | "descriptor"
  | "structured"
  | "code"
  | "visual";

export type DerivedAgentToolContract = {
  readonly name: string;
  readonly mode: DerivedAgentToolMode;
  readonly family: "discover" | "navigate" | "inspect" | "read";
  readonly description: string;
  readonly sees: string;
  readonly input: string;
  readonly returns: string;
  readonly evidence?: DerivedAgentEvidenceKind;
  readonly gate: string;
};

/**
 * Client-safe catalogue of the exact tool surface registered for one Derived
 * Output synthesis attempt. Runtime tool definitions consume the same names and
 * descriptions, while development references add the observation contract.
 */
export const DERIVED_AGENT_TOOL_CATALOG = [
  {
    name: "retrieve",
    mode: "evidence",
    family: "discover",
    description: "Search only exact authored text in the current Semantic Overlay. Returns consolidated spans with evidence IDs.",
    sees: "Semantically matching authored passages across the scoped exact-text lane.",
    input: "query · topK ≤ 20",
    returns: "Consolidated spans, source revision, locators, score, overlay generation, evidenceId.",
    evidence: "exact text",
    gate: "Forced first when no user selection exists; may be called again with focused queries."
  },
  {
    name: "retrieve_materials",
    mode: "evidence",
    family: "discover",
    description: "Search interpreted material facets for tables, CSV, charts, images, and code. Use native read_* tools for exact claims.",
    sees: "Semantic summaries and deterministic profiles for non-prose material.",
    input: "query · kinds? · topK ≤ 20",
    returns: "Material handle, kind, name, profile, description, matched facets, source, score, evidenceId.",
    evidence: "descriptor",
    gate: "Descriptor evidence supports broad claims only; exact details require a native reader."
  },
  {
    name: "read_selection",
    mode: "evidence",
    family: "read",
    description: "Read the current user selection directly from its authoritative resource and issue exact evidence.",
    sees: "The authoritative text range selected when the Derived Output run began.",
    input: "{} — coordinates are application supplied",
    returns: "Selected span, source revision/hash, intersecting locators, evidenceId.",
    evidence: "exact text",
    gate: "Available only when the run carries a selection; then it is the forced first call."
  },
  {
    name: "find_resources",
    mode: "orientation",
    family: "navigate",
    description: "Find project resource handles by title and kind. Navigation only; no evidence IDs.",
    sees: "Names and refs for documents, presentations, spreadsheets, and external files.",
    input: "query? · kinds? · cursor? · limit ≤ 100",
    returns: "Paged resource refs and names.",
    gate: "Project and Resource Set filters are applied server-side."
  },
  {
    name: "list_document_blocks",
    mode: "orientation",
    family: "navigate",
    description: "List document blocks, nested paths, and exact-text ranges in reading order. Navigation only; no factual content or evidence IDs.",
    sees: "Document areas, block types, nested block paths, and coordinates—but not block text.",
    input: "resourceId · area? · cursor? · limit ≤ 100",
    returns: "Revision plus paged block IDs/types/paths and projected ranges.",
    gate: "The document must be in scope."
  },
  {
    name: "list_presentation_slides",
    mode: "orientation",
    family: "navigate",
    description: "List slide IDs in presentation order. Navigation only; no evidence IDs.",
    sees: "The ordered inventory of visible slide IDs.",
    input: "resourceId · cursor? · limit ≤ 100",
    returns: "Paged slide IDs and one-based positions.",
    gate: "Hidden slides are omitted and the presentation must be in scope."
  },
  {
    name: "inspect_slide",
    mode: "orientation",
    family: "inspect",
    description: "Inspect slide item types, bounds, and material handles. Context only; no evidence IDs.",
    sees: "Element IDs, paths, types, frames, rotations, text ranges, notes, background, and material handles.",
    input: "resourceId · slideId",
    returns: "Current slide anatomy and links to the tools that can read its native material.",
    gate: "The slide must exist in an in-scope presentation."
  },
  {
    name: "view_slide",
    mode: "orientation",
    family: "inspect",
    description: "View a schematic slide layout for spatial orientation. Supporting context only, not a production render, and never citable.",
    sees: "A generated SVG of element bounds, rotations, type labels, and abbreviated authored text.",
    input: "resourceId · slideId",
    returns: "A schematic image plus a supporting-context marker.",
    gate: "Not production fidelity; Prompt response text is deliberately omitted."
  },
  {
    name: "inspect_dataset",
    mode: "orientation",
    family: "inspect",
    description: "Inspect bounded dataset structure and native-read handles. Context only; no evidence ID.",
    sees: "Table/CSV dimensions, headers, inferred column types, nulls, coverage, and warnings.",
    input: "materialHandle",
    returns: "Dataset profile and the correct native reader name.",
    gate: "The handle must have been issued during the same attempt and still be current."
  },
  {
    name: "inspect_code",
    mode: "orientation",
    family: "inspect",
    description: "Inspect code symbols and exact line ranges without returning code content. Context only.",
    sees: "File name, language, line count, and symbol inventory.",
    input: "materialHandle",
    returns: "Code structure without source text.",
    gate: "The handle must resolve to current in-scope code material."
  },
  {
    name: "read_text",
    mode: "evidence",
    family: "read",
    description: "Read one bounded UTF-16 range directly from a current project resource and issue exact evidence.",
    sees: "Authoritative document, slide, or external-text content at exact coordinates.",
    input: "kind · resourceId · from · to",
    returns: "Up to 20,000 UTF-16 units, source revision/hash, locators, evidenceId.",
    evidence: "exact text",
    gate: "The range cannot cross a hard resource boundary such as a slide boundary."
  },
  {
    name: "read_table",
    mode: "evidence",
    family: "read",
    description: "Read bounded native table cells and issue structured evidence.",
    sees: "Current document/slide table cells or spreadsheet cells in a selected rectangle.",
    input: "materialHandle · row range? · column range?",
    returns: "At most 100 rows × 50 columns of native values plus evidenceId.",
    evidence: "structured",
    gate: "The material handle must be current and in scope."
  },
  {
    name: "read_csv",
    mode: "evidence",
    family: "read",
    description: "Read bounded authoritative CSV rows/columns and issue structured evidence.",
    sees: "Selected cells decoded from the content-addressed original CSV bytes.",
    input: "materialHandle · rows ≤ 100 · columns ≤ 50",
    returns: "Selected headers and row values plus evidenceId.",
    evidence: "structured",
    gate: "Native CSV bytes must be available and the issued handle must still be current."
  },
  {
    name: "read_chart",
    mode: "evidence",
    family: "read",
    description: "Read normalized native chart values and issue structured evidence.",
    sees: "The current native slide-chart specification, optionally narrowed to named series.",
    input: "materialHandle · series? ≤ 50",
    returns: "Selected series and a bounded native chart spec plus evidenceId.",
    evidence: "structured",
    gate: "Currently resolves native charts placed in presentations."
  },
  {
    name: "read_code",
    mode: "evidence",
    family: "read",
    description: "Read an exact bounded line range from authoritative code and issue verbatim evidence.",
    sees: "Original content-addressed code text for an exact line range.",
    input: "materialHandle · fromLine · toLine (≤ 500 lines)",
    returns: "Language, exact line range, verbatim code, evidenceId.",
    evidence: "code",
    gate: "Native bytes must be available and the issued handle must still be current."
  },
  {
    name: "read_image",
    mode: "evidence",
    family: "read",
    description: "Read content-addressed original image pixels, optionally bind the citation to crop coordinates, and issue visual evidence.",
    sees: "Original image pixels, optionally with a validated crop attached to the citation.",
    input: "materialHandle · crop?",
    returns: "Image input for the model, asset hash/media type/crop, evidenceId.",
    evidence: "visual",
    gate: "Current implementation requires imported file-backed pixels; URL/storage adapters remain bounded."
  }
] as const satisfies readonly DerivedAgentToolContract[];

export type DerivedAgentToolName = (typeof DERIVED_AGENT_TOOL_CATALOG)[number]["name"];

/** Keep executable tool registration and the served catalogue on one description. */
export const describedAgentTool = (name: DerivedAgentToolName): {
  name: DerivedAgentToolName;
  description: string;
} => {
  const contract = DERIVED_AGENT_TOOL_CATALOG.find((entry) => entry.name === name);
  if (contract === undefined) throw new Error(`Unknown Derived Output agent tool '${name}'`);
  return { name, description: contract.description };
};
