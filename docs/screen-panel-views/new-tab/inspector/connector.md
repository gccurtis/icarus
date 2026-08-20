# A connector, from the launcher

| Selecting | What it is | Sections |
| --- | --- | --- |
| A connector in Bring in, existing or new | Connecting to an outside system, or repairing a connection | Provider · Scope · Authentication |

The launcher's short form. The full connector view, with delivery and sync
history, lives on [Project Overview](../../project-overview/inspector/connector.md).

## Layout

| 300px |
| --- |
| provider |
| scope |
| authentication |

## Provider

Which system, and what connecting it does.

**Shows** — `Provider · SharePoint`, `Purpose · Sync a document library into the
project as external files`

**Needs** — the provider definition, including what it brings in.

## Scope

What it will be permitted to read. Chosen explicitly, never inferred from the
provider.

**Shows** — `Sites.Read.All`

**Needs** — the scope set a provider offers, and which are required.

## Authentication

State, and the way to fix it.

**Shows** — `Expired`, with **Reconnect**

**Needs** — auth state, and an OAuth callback that returns to this same launcher
tab with its selection restored.

**Open** — a callback that lands on a tab which has since been closed needs a
defined outcome.
