# Derived Output architecture development views

Three purpose-built pages communicate and exercise the system from different angles.

- `components/procedure-flow.svelte` follows authoritative resource text into the Semantic
  Overlay, then follows a Prompt Block through generation and ID-based reading.
- `components/agent-runtime.svelte` specifies the run envelope, tool contracts, evidence
  registry, selected-text treatment, safety boundaries, and scaling seams.
- `components/live-proof.svelte` creates a real document, drains its semantic
  job, runs direct-prompt or named-variable synthesis, and displays the value
  API plus copied evidence.

The document editor is also an executable surface now. Its Prompts rail creates
and generates an ID-backed Prompt Block; the inline node view and inspector read
the canonical response and evidence live from the Derived Output capability.
The block stored in the document contains no generated answer cache.

The procedure page is now an implementation map: green marks inherited code,
orange marks code landed on this branch, blue marks an extended boundary, and
gray marks explicit follow-ups such as the deck adapter, durable generation
queue, selected-text focus, and read tools. The agent page keeps target
`find_resources` and `read` contracts visible while labeling the current single
`retrieve` tool accurately.
