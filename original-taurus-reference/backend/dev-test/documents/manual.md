# Manual test: documents

This is the by-hand version of [`run.sh`](run.sh). Documents are the first
**project-scoped resource**: you must have a project selected, and every document
belongs to that project. A document is a **name** plus a **base** — page layout,
captured row metrics, and a list of **rows**. Each row has bounded height style
and blocks; each block has alignment style and inline text as ordered **atoms**.

The core serves **HTTPS** (self-signed in dev), so `curl` uses `-k`, and you send
the session cookie with `-b cookies.txt`.

## Prerequisites

- Go toolchain; run from the **project root** (`taurus-omega/`).
- Start the core (`go run ./core`), sign in (see the
  [gateway manual](../gateway/manual.md)), and **select a project** (see the
  [projects manual](../projects/manual.md)) — documents operate on your selected
  project.

## 1. Documents need a selected project

Before selecting one:

```bash
curl -ik -b cookies.txt https://127.0.0.1:8080/documents
```

Expected: **409 Conflict** — `{"error":"select a project first"}`. After you
`POST /session/project`, the requests below work.

## 2. List documents (empty at first)

```bash
curl -ik -b cookies.txt https://127.0.0.1:8080/documents
```

Expected: **200 OK** — `{"documents":[]}`.

## 3. Create a document

The body is a `name`, an optional `pageLayout`, and a list of `rows`, each with
a list of `blocks`. A block has a `kind` and an ordered list of `atoms`, and each
atom has a `kind` (`text`) and `text`. Row/block/atom ids are assigned by the
server if you omit them. The service also fills default row/block style and
captures its configured row metrics in `layoutRules`.

```bash
curl -ik -b cookies.txt -X POST https://127.0.0.1:8080/documents \
  -H 'Content-Type: application/json' \
  -d '{"name":"Meeting Notes","rows":[{"blocks":[
        {"kind":"text","subKind":"heading_1","atoms":[{"kind":"text","text":"Agenda"}]},
        {"kind":"text","atoms":[{"kind":"text","text":"Discuss the roadmap"}]}]}]}'
```

Expected: **201 Created** with the full document —
`{"id":"<DOC_ID>","projectId":"…","name":"Meeting Notes","base":{"pageLayout":…,"layoutRules":…,"rows":[…]},"revision":0,…}`.
The default layout is US Letter in whole typographic points. An empty name or
invalid page/content layout returns **400**; a read-only member gets **403**.

## 4. Fetch and list

```bash
curl -ik -b cookies.txt https://127.0.0.1:8080/documents/<DOC_ID>   # 200, full document
curl -ik -b cookies.txt https://127.0.0.1:8080/documents            # includes it
```

A document that belongs to another project — or doesn't exist — returns **404**
(you can't reach across projects).

## 5. Delete

```bash
curl -ik -b cookies.txt -X DELETE https://127.0.0.1:8080/documents/<DOC_ID>
```

Expected: **200 OK** — `{"status":"deleted"}`. A read-only member gets **403**.

---

**On the model:** the returned **base** is the resolved snapshot: stored base
plus pending change sets. Layout, row height, block alignment, atoms, and marks
all participate in that revisioned stream. Page membership is derived from the
base's layout/rules and ordered rows; it is not stored as mutable content. See
the [change-set manual](../changesets/manual.md) for editing, undo, and redo.
