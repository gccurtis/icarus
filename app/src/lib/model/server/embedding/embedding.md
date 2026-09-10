# Embedding

One process-wide, server-only port over Jina Embeddings v4. It owns immutable
provider configuration and the API credential for the process lifetime; it
holds no request or project state.

The six operations are deliberately explicit:

- `tokenField(text)` requests contextual 128-dimensional vectors and visible
  token labels for deterministic translation;
- `windowedPassages(spans)` sends finalized spans from one source together and
  requests dense vectors with late chunking;
- `passage(text)` sends one complete passage without late chunking and returns
  one dense vector;
- `passages(texts)` independently embeds unrelated complete passages;
- `image(input)` embeds original image bytes or an HTTP image in the same
  retrieval-passage coordinate space;
- `query(text)` requests the matching asymmetric retrieval-query vector.

Callers only receive validated vectors and normalized usage metadata. A
`windowedPassages` call must never mix spans from different semantic sources.
Every operation also accepts the caller's optional abort signal and forwards it
to the active provider request without replacing the provider timeout.

The credential is read from `configuration/local.yaml` at startup and is never
returned, logged, or included in an error.

## Ownership Boundary

One server-model instance owns the provider configuration, request transport,
and credential. Capabilities can request embeddings through the model port but
cannot reach the transport or provider secret.

## Lifetime

The object is constructed once with the server graph and remains immutable for
that graph's lifetime. Individual calls retain no project state and require no
release work.

## Invariants

- Every returned vector is finite and has the configured dimensionality.
- Passage and query vectors use the declared asymmetric task modes.
- One windowed request contains spans from only one semantic source.
- Provider bodies and credentials never escape through results or errors.
