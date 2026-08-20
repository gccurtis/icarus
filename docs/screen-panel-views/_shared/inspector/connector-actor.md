# A connector, as an actor

| Selecting | What it is | Sections |
| --- | --- | --- |
| A connector named as "who did this" | The connection that brought a file into the project | Connector · Why it shows as an actor · Actions |

Files a connector syncs are attributed to it, because no person put them there.
A row that reads "updated by SharePoint — Ops Reports" resolves here.

## Layout

| 300px |
| --- |
| connector |
| connector |
| why it shows as an actor |
| actions |

## Connector

Provider, connection status, and how much it has brought in.

**Shows**

| | |
| --- | --- |
| Provider | SharePoint |
| Status | Authentication expired |
| Files | 312 |

**Needs** — `Connector` provider, display name, auth state and synced file count.

## Why it shows as an actor

Stated for the same reason as on an Automation: the attribution is real and needs
an explanation the first time someone meets it.

**Needs** — nothing.

## Actions

**Reconnect** starts re-authentication. **Open connector** goes to the full
connector view, which carries scopes, delivery and sync history.

**Open** — where the full connector view lives is settled per screen; from here
it is a link, not a second copy of that panel.
