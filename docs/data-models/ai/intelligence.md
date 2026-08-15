# Intelligence

Model and provider configuration. Which models are reachable, with which
credentials, and which one gets used for what.

It sits in `ai/` rather than `knowledge/` because it is not knowledge-specific —
[agent tasks](agent-task.md), [research](../research/research.md), [derived
outputs](../knowledge/derived-output.md), and lattice embedding all draw on it.

```ts
interface Provider {
  projectId?: Id<"projects">;  // absent = configured for the deployment
  name: string;                // "anthropic", "openai", "bedrock"
  credentialRef?: string;      // pointer into the secret store
  baseUrl?: string;            // self-hosted or proxied endpoints
  enabled: boolean;
  updatedAt: number;
}

interface ModelBinding {
  projectId?: Id<"projects">;
  key: string;                 // "agent", "research", "embedding", "fast"
  providerId: Id<"providers">;
  model: string;               // the provider's own identifier
  purpose: "chat" | "embedding";
  maxOutputTokens?: number;
  temperature?: number;
  updatedAt: number;
}
```

## Bindings are named indirection

Nothing in the system names a model directly. A [persona](persona.md) references
`"agent"`; a derived output references `"agent"`; embedding references
`"embedding"`. The binding says what those currently mean.

Model identifiers change on someone else's schedule — deprecated, renamed,
superseded. Without the indirection, upgrading means editing every persona,
every automation, and every stored configuration that mentioned the old name,
and missing one is a silent fallback to something worse.

`key` is a string rather than a union so a new purpose does not require a schema
change.

## Credentials are referenced

`credentialRef` points into the secret store, exactly as with a
[connector](../special-resources/connector.md#credentials-are-referenced-never-stored).
No API key appears in this document.

It is optional because a provider can be reachable without one — a local model
server, or a deployment where credentials come from the environment.

## Deployment and project scope

Both types allow an absent `projectId`, meaning deployment-wide. A project
overrides by defining its own binding for the same `key`; project-scoped wins.

This is what lets one project bring its own API key or pin a specific model
without every other project inheriting the change, and lets the common case —
one set of credentials for everything — be configured once.

## Embedding bindings are near-permanent

Changing the `embedding` binding invalidates the entire [knowledge
lattice](../knowledge/knowledge-lattice.md#embeddings-live-on-the-node), because
vectors from two models are not comparable. The model does not prevent it; it is
recorded here so the consequence is written down where the change is made.

## What is not here

No usage records, no cost accounting, no rate limit state. Those are operational
telemetry with a different lifetime and a different consumer, and they do not
belong in configuration that every request reads.

## Related

[persona](persona.md) · [agent task](agent-task.md) ·
[knowledge lattice](../knowledge/knowledge-lattice.md)
