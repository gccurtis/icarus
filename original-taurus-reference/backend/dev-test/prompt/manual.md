# Manual test: the prompt block

This is the by-hand version of [`run.sh`](run.sh). A **prompt block** is a
document block whose text is **generated** — grounded by
[knowledge](../knowledge/manual.md) retrieval and produced through
[intelligence](../intelligence/manual.md) — rather than authored. Resolving one
runs **plan → retrieve → synthesize → incorporate**: the instruction becomes
retrieval queries, those pull grounded evidence from the lattice, a structured
model call writes the answer (or a stable `insufficient` / `contradiction`), and
the result is folded back into the block as ordinary editable text with its
evidence and status.

Resolution is inference-heavy, so it runs as a **background job**: the request
returns `202` + a job id to poll, like [re-base](../jobs/manual.md).

## Why this suite needs a real key

The pipeline only means anything against real models. Without a key the automated
[`run.sh`](run.sh) **skips**.

## Prerequisites

- Go toolchain; run from the **project root** (`taurus-omega/`).
- A real OpenRouter key in a gitignored `etc/config.local.yaml`.
- A **reasoning** cast at `general / high / medium / medium` (what
  `documents.prompt` uses for plan + synthesize) mapped to a model that supports
  structured (`json_schema`) output, and an **embedding** cast at
  `general / medium / medium / medium` (for retrieval):

  ```yaml
  intelligence:
    providers: { openrouter: { api_key: "sk-or-..." } }
    casts:
      reasoning:
        - { purpose: general, strength: high, speed: medium, cost: medium,
            provider: openrouter, model: "openai/gpt-4o-mini" }
      embedding:
        - { purpose: general, strength: medium, speed: medium, cost: medium,
            provider: openrouter, model: "openai/text-embedding-3-small" }
  ```

- Start the core (`go run ./core`), sign in, and **select a project**.

## 1. Give the lattice something to ground on

Create a source document and index it (see the [knowledge manual](../knowledge/manual.md)):

```sh
# create a document about photosynthesis, call its id <SOURCE_ID>, then:
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/dev/knowledge/documents/<SOURCE_ID>
```

## 2. Create a document with a prompt block

A prompt block has `kind: "prompt"` and a `data.instruction`. Give it an explicit
`id` so you can address it:

```sh
curl -k -b cookies.txt -X POST https://127.0.0.1:8080/documents \
  -H 'Content-Type: application/json' \
  -d '{"name":"Report","rows":[{"blocks":[
        {"id":"pb1","kind":"prompt","data":{"instruction":"How do plants convert sunlight into energy? Answer only from the sources."}}
      ]}]}'
```

The response shows the block as `"kind":"prompt"` and `"inferred":true` — its
content is generated, so it is kept out of the text fed to the lattice. Call the
document id `<REPORT_ID>`.

## 3. Resolve it

```sh
curl -k -b cookies.txt -X POST \
  https://127.0.0.1:8080/documents/<REPORT_ID>/blocks/pb1/resolve \
  -H 'Content-Type: application/json' -d '{"mode":"reload"}'
```

Response is `202 Accepted` with a job id:

```json
{"jobId":"<JOB_ID>","status":"queued"}
```

Poll it until done (a worker runs plan → retrieve → synthesize off the request
path):

```sh
curl -k -b cookies.txt https://127.0.0.1:8080/dev/jobs/<JOB_ID>
# ... "type":"document.resolve","status":"done" ...
```

## 4. Read the grounded answer

```sh
curl -k -b cookies.txt https://127.0.0.1:8080/documents/<REPORT_ID>
```

The prompt block now holds the generated text in its atoms, with
`data.status:"ok"` and `data.evidence` — the supporting spans, each carrying the
`sourceId` and byte range it came from. The text is ordinary atoms: it renders,
can be marked, and can be edited like any block.

## Reload vs. refresh

- **reload** (`{"mode":"reload"}`) always re-resolves.
- **refresh** (`{"mode":"refresh"}`) re-resolves only if something changed — a
  prompt edit, or the project's knowledge changing since the last resolve. When
  nothing changed it is a no-op and the current text stays.
- The empty mode is **auto**: a reload the first time (no text yet), a refresh
  after.

Both feed the current text into synthesis, so a re-generation stays close to
what was there unless the answer genuinely changed.

## Notes

- The endpoints are **gated** and need an **owner/editor** role.
- With **no key**, the resolve job fails with the provider-not-configured error
  (visible as the job's `"status":"failed"`).
- When the evidence does not support a confident answer, `status` is
  `insufficient` or `contradiction` and no answer is fabricated.
