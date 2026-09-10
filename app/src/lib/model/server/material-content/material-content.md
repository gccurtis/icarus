# Material content

The server-only, hash-addressed byte store used for native semantic materials
that cannot be represented as authored text alone.

## Ownership Boundary

One server-model instance owns the configured content directory and filesystem
access. Capabilities provide a content hash and receive validated bytes; they do
not construct paths or open the backing files themselves.

## Lifetime

The model is constructed with the server graph and holds only its immutable
directory. Reads open and close their own file handles, so shutdown has no
additional release work.

## Invariants

- A requested hash is a canonical SHA-256 value before it becomes a path.
- Returned bytes hash to the requested identity.
- Missing content returns `undefined`; malformed or corrupted content fails.
- A caller-owned abort signal reaches the filesystem read, so the operation that
  owns a semantic preparation can end without waiting for unrelated I/O.
- No legacy filename or unhashed lookup path is accepted.
