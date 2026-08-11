# Manual test: intelligence

This is the by-hand version of [`run.sh`](run.sh). The **intelligence** service is
the single boundary to model providers. Callers never name a model — they ask for
a semantic **cast** `(purpose, strength, speed, cost)`, and configuration maps
that cast to a concrete provider and model, per endpoint kind (reasoning,
inference, embedding).

The core serves **HTTPS** (self-signed in dev), so `curl` uses `-k`, and you send
the session cookie with `-b cookies.txt`. The endpoints are gated, so sign in
first (see the [gateway manual](../gateway/manual.md)).

## Prerequisites

- Go toolchain; run from the **project root** (`taurus-omega/`).
- Intelligence configured in your manifest. The committed
  [`etc/config.yaml`](../../etc/config.yaml) has the cast tables with a **blank**
  OpenRouter key. Put your real key in a gitignored `etc/config.local.yaml`, which
  is overlaid on top at startup:

  ```yaml
  # etc/config.local.yaml  (never committed)
  mode: dev
  intelligence:
    providers:
      openrouter:
        api_key: "sk-or-..."
  ```

Without a key the endpoints still work — a request for a configured cast just
reports the provider is unavailable (503), so you can exercise everything but the
live call.

## 1. The endpoints are gated

```sh
curl -k -X POST https://127.0.0.1:8080/intelligence/infer \
  -H 'Content-Type: application/json' \
  -d '{"cast":{"purpose":"general","strength":"low","speed":"high","cost":"low"},
       "messages":[{"role":"user","content":"hi"}]}'
# → 401 {"error":"sign in required"}
```

Sign in (register + login) as in the gateway manual, keeping the cookie jar.

## 2. Inference by cast

```sh
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/intelligence/infer \
  -H 'Content-Type: application/json' \
  -d '{"cast":{"purpose":"general","strength":"low","speed":"high","cost":"low"},
       "messages":[{"role":"user","content":"Reply with the single word: pong"}]}'
# with a key → 200 {"text":"pong","usage":{...}}
# without a key → 503 {"error":"intelligence provider not configured"}
```

`reason` works the same way against the reasoning cast table:

```sh
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/intelligence/reason \
  -H 'Content-Type: application/json' \
  -d '{"cast":{"purpose":"general","strength":"high","speed":"low","cost":"high"},
       "messages":[{"role":"user","content":"Name one prime number."}]}'
```

## 3. Structured output

Add a `schema` to `reason` or `infer` to constrain the output to JSON. The
response comes back under `json` instead of `text`:

```sh
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/intelligence/infer \
  -H 'Content-Type: application/json' \
  -d '{"cast":{"purpose":"general","strength":"low","speed":"high","cost":"low"},
       "messages":[{"role":"user","content":"Give me a colour as JSON."},
       "schema":{"type":"object","properties":{"colour":{"type":"string"}},"required":["colour"]}}'
# → 200 {"json":{"colour":"blue"},"usage":{...}}
```

## 4. Embeddings

```sh
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/intelligence/embed \
  -H 'Content-Type: application/json' \
  -d '{"cast":{"purpose":"general","strength":"high","speed":"low","cost":"high"},
       "inputs":["hello","world"]}'
# → 200 {"vectors":[[...],[...]],"usage":{...}}
```

## 5. An unconfigured cast

A cast with no configured row for its endpoint kind is refused — there is no
fallback:

```sh
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/intelligence/infer \
  -H 'Content-Type: application/json' \
  -d '{"cast":{"purpose":"general","strength":"high","speed":"high","cost":"low"},
       "messages":[{"role":"user","content":"hi"}]}'
# → 400 {"error":"no model configured for cast: inference cast general/high/high/low"}
```
