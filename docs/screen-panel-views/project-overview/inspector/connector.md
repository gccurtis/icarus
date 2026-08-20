# A connector

| Selecting | What it is | Sections |
| --- | --- | --- |
| A connector row, or the sync warning on the centre | One connection to an outside system: what it may read, how it delivers, and whether it is working | Connection · Scope and delivery · Synchronization · Actions |

The full connector view. The [actor lens](../../_shared/inspector/connector-actor.md)
is the short form of this, shown when a connector is named as "who did this".

## Layout

| 300px |
| --- |
| connection |
| scope and delivery |
| synchronization |
| actions |

## Connection

**Shows**

| | |
| --- | --- |
| Provider | SharePoint |
| Display name | Ops Reports |
| Status | Authentication expired |

**Needs** — `Connector` provider, display name and auth state.

## Scope and delivery

What it is permitted to read, and how material arrives. Both are chosen
explicitly and neither is inferred.

**Shows** — `Scopes · Sites.Read.All`, `Delivery · Scheduled pull, hourly`

**Needs** — the granted scope list and the delivery mode.

## Synchronization

The last attempt and what it produced.

**Shows** — `Last sync · 6 days ago`, `Error · Refresh token expired`, `Files · 312`

**Needs** — last sync time, last error, and a synced file count.

**Open** — one last-sync record is all there is. No sync history is modeled, so
this section must not imply a trend.

## Actions

**Reconnect** re-authenticates. **Sync now** is disabled while authentication is
expired — the order matters, and a disabled control that explains itself is
better than one that fails. **Disconnect** removes the connection.

**Open** — what happens to already-synced files on disconnect is undefined:
whether they stay as project resources, become orphaned, or are removed.
