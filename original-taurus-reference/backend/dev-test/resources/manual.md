# Manual test: Resources and Activity

Start the core, register/login, create a Project, and select it as described in
the [projects manual](../projects/manual.md). Keep the session in `cookies.txt`.

## List and create

```bash
curl -ik -b cookies.txt https://127.0.0.1:8080/resources
# 200 {"resources":[],"availableKinds":["document"],"nextCursor":null}

curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/resources \
  -H 'Content-Type: application/json' -d '{"kind":"document","name":"Plan"}'
# 201 {"id":"<DOC_ID>","kind":"document",...}
```

The returned ID is the canonical Document ID; `GET /documents/<DOC_ID>` fetches
its content, while `GET /resources/document/<DOC_ID>` returns only current
canonical metadata (`id`, `kind`, `name`, `createdAt`, `updatedAt`). `slides`,
`spreadsheet`, `chat`, and `general` are known but unavailable and return 409.
Unknown kinds return 400.

## Rename, Activity, and aggregate Project time

```bash
curl -ik -b cookies.txt -X PATCH \
  https://127.0.0.1:8080/resources/document/<DOC_ID> \
  -H 'Content-Type: application/json' -d '{"name":"Launch Plan"}'

curl -ik -b cookies.txt 'https://127.0.0.1:8080/activity?limit=10'
curl -ik -b cookies.txt https://127.0.0.1:8080/projects
```

Activity contains immutable `created` and `renamed` snapshots. The Project's
`updatedAt` is at least the newest event time. Paging cursors are returned as
`nextCursor`; send one back unchanged to continue.

## Delete

```bash
curl -ik -b cookies.txt -X DELETE \
  https://127.0.0.1:8080/resources/document/<DOC_ID>
```

The Document and catalog entry disappear. Activity retains a `deleted` event
whose target name is `Launch Plan`, so history stays understandable after the
canonical content is gone. A later `GET /resources/document/<DOC_ID>` returns
404; an Activity client should keep displaying the stored event snapshot.
