# Workflows

Cross-cutting flows that span more than one capability — where the interesting
detail is the *sequence* and the *prompts/policies* involved, not any single
package. Capability docs (under [`../capabilities/`](../capabilities/)) describe
each part; these describe how the parts combine to do something end to end.

- **[Prompt resolution](prompt-resolution.md)** — how a prompt block is resolved:
  plan → retrieve → synthesize → incorporate, **including the full prompt
  templates** the model is given and why they are worded the way they are. The
  prompts are configurable, so this is the reference for tuning them.
