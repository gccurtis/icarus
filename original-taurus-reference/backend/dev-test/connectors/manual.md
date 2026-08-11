# Connectors — manual walkthrough

The `connector` resource kind: an external-source binding of a provider **subkind**
(the first is `local-folder`) with a provider **path**. This slice creates and
configures connectors and joins them to the unified resource catalog; it does not
yet sync anything into the knowledge lattice (that is the next slice).

`$B=https://127.0.0.1:8080`; `-b/-c cookies.txt` carries the session. Every call
needs `-k` (self-signed dev cert).

## Setup

```bash
curl -k -c cookies.txt -X POST $B/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"dev@taurus.local","password":"devpassword","name":"Ada"}'
curl -k -b cookies.txt -c cookies.txt -X POST $B/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"dev@taurus.local","password":"devpassword"}'
curl -k -b cookies.txt -X POST $B/projects -H 'Content-Type: application/json' -d '{"name":"Connectors"}'
# → 201 {"id":"<PROJECT_ID>",...}
curl -k -b cookies.txt -X POST $B/session/project -H 'Content-Type: application/json' -d '{"projectId":"<PROJECT_ID>"}'
```

## Create a connector

```bash
curl -k -b cookies.txt -X POST $B/connectors -H 'Content-Type: application/json' \
  -d '{"name":"Sales drive","subkind":"local-folder"}'
# → 201 {"id":"<CID>","kind":"connector","subkind":"local-folder","name":"Sales drive","path":"","createdAt":"...","updatedAt":"..."}
```

An unsupported subkind is rejected:

```bash
curl -k -b cookies.txt -X POST $B/connectors -H 'Content-Type: application/json' \
  -d '{"name":"nope","subkind":"dropbox"}'
# → 400 {"error":"connector subkind is not supported"}
```

## Configure the provider endpoint (non-empty required)

A connector points at its **provider endpoint** — the address of the external
watcher Omega polls for content. Run the watcher first:

```bash
go run ./cmd/connector-watcher -folder /path/to/watch -addr 127.0.0.1:9099
# logs: listening 127.0.0.1:9099 (watching /path/to/watch)
```

```bash
curl -k -b cookies.txt -X PUT $B/connectors/<CID>/config -H 'Content-Type: application/json' -d '{"path":"   "}'
# → 400 {"error":"connector path is invalid"}
curl -k -b cookies.txt -X PUT $B/connectors/<CID>/config -H 'Content-Type: application/json' -d '{"path":"http://127.0.0.1:9099"}'
# → 200 {... "path":"http://127.0.0.1:9099" ...}
```

## Read it back

```bash
curl -k -b cookies.txt $B/connectors/<CID>
# → 200 {"id":"<CID>","kind":"connector","subkind":"local-folder","name":"Sales drive","path":"http://127.0.0.1:9099",...}
```

## It joins the unified catalog

```bash
curl -k -b cookies.txt $B/resources
# → 200 {"availableKinds":["connector","document"], "resources":[{"id":"<CID>","kind":"connector","name":"Sales drive",...}], ...}
```

## Sync into the knowledge lattice (needs a provider key)

Sync — Omega pulls the current content from the watcher and embeds it into the
lattice under the `connector` source type, becoming retrievable. The response
carries the embedding `usage` (also logged centrally):

```bash
curl -k -b cookies.txt -X POST $B/connectors/<CID>/sync
# → 200 {"seq":1,"changed":true,"usage":{"promptTokens":7,"totalTokens":7}}
curl -k -b cookies.txt -X POST $B/dev/knowledge/retrieve -H 'Content-Type: application/json' \
  -d '{"query":"how do plants make energy","topK":3}'
# → 200 {"regions":[{"sourceType":"connector","sourceId":"<CID>", ... }], ...}
```

`GET /connectors/<CID>` reports `syncSeq` and `syncedAt`. A background detector
re-syncs a connector whose folder changed **without a manual call**, so after
editing a file `syncSeq` advances on its own within a few seconds.

## Rename / delete via the generic resource surface

Rename and delete flow through the generic resource surface:

```bash
curl -k -b cookies.txt -X PATCH $B/resources/connector/<CID> -H 'Content-Type: application/json' -d '{"name":"Finance drive"}'
# → 200 {... "name":"Finance drive" ...}
curl -k -b cookies.txt -X DELETE $B/resources/connector/<CID>
# → 200 {"status":"deleted"}
curl -k -b cookies.txt $B/connectors/<CID>
# → 404 {"error":"connector not found"}
```
