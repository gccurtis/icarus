# Manual test: Formula name manager

This is the by-hand counterpart to [`run.sh`](run.sh). It exercises the
SQLite-backed, per-project namespace of scalars, typed tables, and functions,
then evaluates `formula/v1` expressions against that namespace. It makes no
model-provider calls.

Start the core, register/login, and create a Project as described in the
[projects manual](../projects/manual.md). Keep the session in `cookies.txt` and
note `<PROJECT_ID>`. These routes authorize membership against the Project ID in
the path; the Project does not need to be selected in the session.

## Scalars and evaluation

```bash
curl -ik -b cookies.txt -X PUT \
  https://127.0.0.1:8080/projects/<PROJECT_ID>/names/price/value \
  -H 'Content-Type: application/json' \
  -d '{"kind":"number","shape":{"fields":1,"rows":1},"number":"42"}'
# 200 {"status":"set"}

curl -ik -b cookies.txt -X POST \
  https://127.0.0.1:8080/projects/<PROJECT_ID>/evaluate \
  -H 'Content-Type: application/json' -d '{"source":"price * 2"}'
# 200 {"value":{...,"number":"84"}}
```

Entry names are Formula identifiers and may not shadow keywords or built-ins;
trying to store `SUM` returns 400.

## Construct a table incrementally

`POST .../table` creates a new empty table and refuses to overwrite an existing
name:

```bash
curl -ik -b cookies.txt -X POST \
  https://127.0.0.1:8080/projects/<PROJECT_ID>/names/orders/table \
  -H 'Content-Type: application/json' \
  -d '{"columns":[{"name":"qty","type":"number"}]}'
# 201 {"status":"created"}

# Repeating the same create returns 409.
```

Append rows and add a column atomically:

```bash
curl -ik -b cookies.txt -X POST \
  https://127.0.0.1:8080/projects/<PROJECT_ID>/names/orders/rows \
  -H 'Content-Type: application/json' \
  -d '{"rows":[[{"kind":"number","shape":{"fields":1,"rows":1},"number":"3"}]]}'

curl -ik -b cookies.txt -X POST \
  https://127.0.0.1:8080/projects/<PROJECT_ID>/names/orders/columns \
  -H 'Content-Type: application/json' \
  -d '{"name":"label","type":"text"}'
```

`PUT .../table` is the replacement form: it sets a complete `{columns, rows}`
value and may replace an existing entry.

## Stored functions

```bash
curl -ik -b cookies.txt -X PUT \
  https://127.0.0.1:8080/projects/<PROJECT_ID>/names/double/function \
  -H 'Content-Type: application/json' \
  -d '{"source":"FUNCTION(n, n * 2)"}'

curl -ik -b cookies.txt -X POST \
  https://127.0.0.1:8080/projects/<PROJECT_ID>/evaluate \
  -H 'Content-Type: application/json' -d '{"source":"double(9)"}'
# 200 {"value":{...,"number":"18"}}
```

## Read, list, and delete

```bash
curl -ik -b cookies.txt \
  https://127.0.0.1:8080/projects/<PROJECT_ID>/names/orders

curl -ik -b cookies.txt \
  https://127.0.0.1:8080/projects/<PROJECT_ID>/names

curl -ik -b cookies.txt -X DELETE \
  https://127.0.0.1:8080/projects/<PROJECT_ID>/names/double
# 200 {"status":"deleted"}
```

Read members may list, get, and evaluate. Only edit/owner members may create,
replace, mutate, or delete names.
