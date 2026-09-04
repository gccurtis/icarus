# Embedding

One process-wide, server-only port over Jina Embeddings v4. It owns immutable
provider configuration and the API credential for the process lifetime; it
holds no request or project state.

`tokenField` requests contextual 128-dimensional vectors and visible token
labels for deterministic translation. `passages` requests dense passage
vectors with late chunking. `query` requests the matching asymmetric query
vector. Callers only receive validated vectors and normalized usage metadata.

The credential is read from `configuration/local.yaml` at startup and is never
returned, logged, or included in an error.
