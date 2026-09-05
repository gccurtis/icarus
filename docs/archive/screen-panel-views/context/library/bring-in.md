# Bring in

| View | What it is for | Sections |
| --- | --- | --- |
| Bring in | Getting outside material into the project | Upload · Your connectors · Add a connector |

Neither uploading a file nor connecting a system opens an editor, so neither
competes with the three things this tab exists to make. Both live here.

## Layout

| 300px |
| --- |
| upload |
| upload |
| your connectors |
| add a connector |

## Upload

**Shows** — *Choose files…* — Extraction starts on arrival

Extraction starting immediately is worth stating: an uploaded file is not
retrievable material until text comes out of it, and the delay is real.

**Needs** — an upload endpoint, and an extraction job started on arrival.

## Your connectors

Connections that already exist, with their state, so a broken one is fixed from
where you noticed it.

**Shows** — *SharePoint — Ops Reports* — Authentication expired; *Google Drive —
Filings* — Synced 2h ago

**Needs** — `Connector` records with sync state.

## Add a connector

Providers that can be connected.

**Shows** — *SharePoint*, *Google Drive*

**Needs** — the list of supported providers.

**Open** — the provider list is deployment configuration, not project data. Where
it comes from is undefined.
