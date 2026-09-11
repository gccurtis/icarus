# Derived Output architecture development views

Seven purpose-built pages communicate and exercise the system from different angles.

- `components/procedure-flow.svelte` follows authoritative resource text into the Semantic
  Overlay, then follows a Prompt Block through generation and ID-based reading.
- `components/agent-runtime.svelte` specifies the run envelope, tool contracts, evidence
  registry, selected-text treatment, safety boundaries, and scaling seams.
- `components/resource-reading.svelte` refines direct reading into a specialized tool
  grammar, separates evidence-producing reads from contextual traversal, and maps the
  shared document/presentation projection seam.
- `components/material-layer.svelte` defines how tables, CSV data, charts, images, and
  code acquire deterministic profiles, interpreted descriptors, separate semantic
  facets, native read paths, and a material-only retrieval lane.
- `components/live-proof.svelte` creates a real document, drains its semantic
  job, runs direct-prompt or named-variable synthesis, and displays the value
  API plus copied evidence.
- `../slide-prompt-blocks/slide-prompt-blocks.svelte` isolates the slide-editor
  integration: in-place text conversion, presentation ownership, server-owned
  refresh, collaborative response publication, and the exact implementation
  seams. It is served at `/demo/semantic-overlay/slide-prompt-blocks`.
- `../semantic-ingestion-tools/semantic-ingestion-tools.svelte` is the
  current-implementation switchboard: every automatic authoring trigger, both
  durable processing lanes, and the complete sixteen-tool observation surface
  available to the answer-writing agent. It is served at
  `/demo/semantic-overlay/ingestion-and-tools`.

The document editor is also an executable surface now. An empty line converts
to Prompt through the normal Block selector; the inspector creates and links
the Derived Output, and the generated response becomes ordinary editable block
text with a settings star in the same pasteboard gutter as comment pins. The
Prompts rail only indexes blocks in the current document.

The presentation editor now provides the same relationship without making a new
visual object. Select a standalone text box and choose Prompt beside Comment;
the existing `SlideElement` retains its frame, paint, order, block ID, text,
marks, style, and format while its inner content becomes a `PromptBlock`. The
slide Prompt inspector creates and links the Derived Output, submits the same
server-coalesced refresh signal, renders evidence, and publishes response text
through native presentation atom/mark operations. Its editor-only star reopens settings,
and the presentation Prompts rail navigates existing blocks. Generated responses are
excluded from semantic projection.

The procedure page is now an implementation map: green marks inherited code,
orange marks code landed on this branch, blue marks an extended boundary, and
gray marks explicit follow-ups such as export resolution, transactional
first-link creation, automatic refresh policy, selected-text focus, and future
resource adapters. The ingestion-and-tools page records the live contract:
`read_selection`, `find_resources`, `retrieve_materials`, every specialized
reader, and every orientation tool now execute beside `retrieve`. `retrieve`
queries the exact-text Semantic Overlay; `retrieve_materials` queries the
separate interpreted-material index; every `read_*` tool resolves an
authoritative resource snapshot or content-addressed native bytes.

The durable target contract for this additional lane lives in
[`semantic-material-layer.md`](../../../../../docs/semantic-material-layer.md).

The full construction method, visual rationale, theme contract, failure found by
the live proof, and review checklist live in
[`development-reference-surfaces.md`](../../../../../docs/development-reference-surfaces.md).

The complete slide-specific decision and verification record lives in
[`slide-prompt-blocks.md`](../slide-prompt-blocks/slide-prompt-blocks.md).
