# Derived Output architecture development views

Three purpose-built pages communicate and exercise the system from different angles.

- `components/procedure-flow.svelte` follows authoritative resource text into the Semantic
  Overlay, then follows a Prompt Block through generation and ID-based reading.
- `components/agent-runtime.svelte` specifies the run envelope, tool contracts, evidence
  registry, selected-text treatment, safety boundaries, and scaling seams.
- `components/live-proof.svelte` creates a real document, drains its semantic
  job, runs direct-prompt or named-variable synthesis, and displays the value
  API plus copied evidence.

The procedure page is now an implementation map: green marks inherited code,
orange marks code landed on this branch, blue marks an extended boundary, and
gray marks the explicit Prompt Block/read-tool follow-up. The agent page keeps
target `find_resources` and `read` contracts visible while labeling the current
single `retrieve` tool accurately.
