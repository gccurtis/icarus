# Derived Output architecture development views

Three purpose-built pages communicate and exercise the system from different angles.

- `components/procedure-flow.svelte` follows authoritative resource text into the Semantic
  Overlay, then follows a Prompt Block through generation and ID-based reading.
- `components/agent-runtime.svelte` specifies the run envelope, tool contracts, evidence
  registry, selected-text treatment, safety boundaries, and scaling seams.
- `components/live-proof.svelte` creates a real document, drains its semantic
  job, runs direct-prompt or named-variable synthesis, and displays the value
  API plus copied evidence.

The document editor is also an executable surface now. An empty line converts
to Prompt through the normal Block selector; the inspector creates and links
the Derived Output, and the generated response becomes ordinary editable block
text with a right-edge settings marker. The Prompts rail only indexes blocks in
the current document.

The procedure page is now an implementation map: green marks inherited code,
orange marks code landed on this branch, blue marks an extended boundary, and
gray marks explicit follow-ups such as the deck adapter, durable generation
queue, selected-text focus, and read tools. The agent page keeps target
`read_selection`, `find_resources`, and direct resource `read` contracts visible
while labeling the current single `retrieve` tool accurately. `retrieve` is the
only Semantic Overlay query; `read` never touches the overlay.

The full construction method, visual rationale, theme contract, failure found by
the live proof, and review checklist live in
[`development-reference-surfaces.md`](../../../../../docs/development-reference-surfaces.md).
