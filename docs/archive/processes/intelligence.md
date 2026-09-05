# Intelligence

Model and provider settings. **This has no tables.** It is
[configuration](../../app/configuration/) and the file exists to say so, and to fix the vocabulary everything
else refers to.

```yaml
# app/configuration/intelligence.yaml
intelligence:
  providers:
    anthropic:
      apiKey: ...
    openrouter:
      apiKey: ...
      baseUrl: ...
  bindings:
    agent:      { provider: anthropic,  model: ..., maxOutputTokens: 8192 }
    fast:       { provider: anthropic,  model: ... }
    embedding:  { provider: openrouter, model: ..., dimensions: 1536 }
```

## Why it is not a model

Providers and bindings looked like documents — they have names, they can be
listed, they can be edited. But nothing about them is project content: they are
not authored, not versioned, not attributed, not searched, and not scoped to a
project's isolation boundary.

What they actually are is deployment settings that happen to be structured.
`app/configuration/` already exists for exactly that, `local.yaml` already carries
a provider key, and putting the same thing in a table would mean two places to
look and two places to get out of sync.

## Bindings are named indirection

Nothing in the system names a model directly. A
[persona](../data-models/ai/persona.md) references `"agent"`; a
[derived output](../data-models/knowledge/derived-output.md) references
`"agent"`; the [lattice](../data-models/knowledge/knowledge-lattice.md) references
`"embedding"`. The binding says what those currently mean.

Model identifiers change on someone else's schedule — deprecated, renamed,
superseded. Without the indirection, an upgrade means editing every persona and
every stored configuration mentioning the old name, and missing one is a silent
fallback to something worse.

Binding names are strings rather than an enum so a new purpose does not require a
change anywhere but the configuration file.

## What the lattice records, and why

Configuration has no history, so the one place a model identifier *is* persisted
is the [lattice version](../data-models/revisions/lattice-version.md), which stores both the
binding name and the model it resolved to when the index was built.

That pair is what detects drift. Repointing `embedding` at a different model
invalidates the entire lattice — vectors from two models are not comparable — and
comparing the stored model against the current binding is how that is caught
rather than silently producing meaningless distances.

Nothing else needs to record what a binding resolved to. A chat answer generated
by an older model is still a valid answer; an index built by one is not a valid
index.

## Credentials

Provider keys live in `local.yaml`, which is git-ignored. No key appears in any
document, any log line, or any client bundle. A
[connector's](../data-models/special-resources/connector.md)
`credentialRef` follows the same principle from the other direction — a document
that needs a secret stores a pointer, never the secret.

## What is not here

No usage records, no cost accounting, no rate-limit state. Those are operational
telemetry with a different lifetime and a different consumer, and they are not
configuration.

## Related

[persona](../data-models/ai/persona.md) ·
[agent task](../data-models/ai/agent-task.md) ·
[lattice version](../data-models/revisions/lattice-version.md) ·
[configuration](../../app/configuration/)
