# Embedding

One process-wide, server-only port over Jina Embeddings v4. It owns immutable
provider configuration and the API credential for the process lifetime; it
holds no request or project state.

The four operations are deliberately explicit:

- `tokenField(text)` requests contextual 128-dimensional vectors and visible
  token labels for deterministic translation;
- `windowedPassages(spans)` sends finalized spans from one source together and
  requests dense vectors with late chunking;
- `passage(text)` sends one complete passage without late chunking and returns
  one dense vector;
- `query(text)` requests the matching asymmetric retrieval-query vector.

Callers only receive validated vectors and normalized usage metadata. A
`windowedPassages` call must never mix spans from different semantic sources.

The credential is read from `configuration/local.yaml` at startup and is never
returned, logged, or included in an error.
