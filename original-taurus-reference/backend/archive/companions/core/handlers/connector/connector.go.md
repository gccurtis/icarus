# connector.go

The connector HTTP handlers: create a connector (name + provider subkind), read
one back, set its provider path, force a sync, and list its synced files — the
connector-specific surface the generic resource catalog cannot express. Each
handler delegates to `*connector.Connectors`, projects the record into a JSON
view, and maps capability errors to HTTP statuses (404 not found, 400 bad
name/subkind/path). Registered on the project-scoped group when
`Options.Connectors` is set. See repo conventions (AGENTS.md).

## Code breakdown

### `connectorJSON` — identity, config, and how the sync is going

Beyond identity and config, the view carries the sync's health: `syncSeq` and
`syncedAt` for the last success, and `failedAttempts`, `lastError`, `retryAfter`
and `needsAttention` when one is failing. All four are `omitempty`, so a healthy
connector's response is exactly what it was before.

`needsAttention` is the one a client has to branch on. The other three describe a
sync that is still being retried, which needs no action; `needsAttention` says the
retrying has stopped and will not resume on its own — the signal a client turns
into "this connector's sync is failing, contact your administrator" instead of
leaving a stale source looking current.

### `view` is a method

```go
func (h Handlers) view(c connectorcap.Connector) connectorJSON
```

It became a method on `Handlers` because `needsAttention` is derived from the
configured attempt cap, and only the service knows that cap. Deriving it here from
a hard-coded number would be a second copy of a configuration value; asking the
service keeps one.

### `Create`, `Get`, `Configure`

Each binds its body (a malformed one is a 400 before the capability is reached),
delegates, and answers with the view. `Configure` sets the provider endpoint —
whose format is the provider's concern, validated when the provider is actually
reached, so no transport knowledge lives here.

### `Sync` — `POST /connectors/:connectorID/sync`

Forces a re-sync, answering with the new sequence, whether anything changed, the
token cost, and — when there is anything to report — `skipped`.

The status stays **200 even when files were skipped**, because the sync succeeded:
one unusable file is a reason to leave that file out, never to abandon everything
beside it. What changes is that the response says so, with a code, the bound and the
actual value per file, so a client can name the files that did not arrive instead of
showing an unqualified success for a folder that is partly missing.

`skipped` is omitted entirely when nothing was skipped, so its presence is the
signal and a client needs no length check to decide whether to warn.

It is also the escape hatch from the retry cap. An explicit sync ignores the
backoff and restarts the attempt count, so a connector that has stopped retrying
is retried by asking for it — which is what makes "contact your administrator" an
actionable message rather than a dead end.

### `Files` — `GET /connectors/:connectorID/files`

Returns each synced file's provider key beside the lattice id that addresses it.

The two names exist on purpose and neither replaces the other. A lattice source id
is composed of minted ids so nothing in it is a filename and nothing in it is
unprintable — which is what lets it survive being cited by a model. The cost is
that a caller holding a name cannot construct the id, and every scope selection is
by id. This endpoint is the bridge.

It hangs off the connector rather than the lattice because the connector owns the
relationship: it minted the ids, and it knows what its provider calls a member. An
equivalent listing on knowledge would have to understand that a local-folder key
is a path and a cloud key is not, which is exactly the knowledge that should not
leak there.

### `mapErr` — capability errors to statuses, with the cause attached

A limit is checked first and answers with `limit.Exceeded.Body()` under a 413, so
this route reports a bound the same way every other route does. Then the sentinels:
not-found is 404; an invalid name, subkind or path is 400. Anything else is a 500
with an opaque body, so internal detail never reaches the client.

Every arm now goes through `failed`, which sets `endpoint.Response.Err`. The body is
unchanged — a client still learns nothing internal — but the transport hands `Err` to
the request log, so an operator stops having to guess.

That default arm is where record 0121's sync race hid. An intermittent 500 answered
`{"error":"connector error"}`, the request log recorded nothing further, and the
failure had to be reproduced in order to be seen at all. The field had existed since
the transport contract was written; nothing in the system set it.
