# 0126 — An unusable structured response is retryable, not fatal

Found by chasing a result that made no sense: an expensive model looked *worse*
than a cheap one at the same task. It was not the models. Three defects sat in
one code path.

## The evidence that reframed it

A live run on production's models reported
`reasoning provider returned invalid JSON for a structured call` 90 times. The
obvious reading — "DeepSeek is bad at structured output" — was wrong. Sending
our exact payloads directly to the provider, including the full 1.3 KB Action
schema with `strict: true`, `deepseek/deepseek-r1`, `deepseek/deepseek-chat`
and `openai/gpt-4o-mini` **all returned valid JSON**.

The models could do it. Our decoder was refusing their answers.

## Defect 1 — the fallback chain was skipped for the failure it exists for

```go
if !json.Valid([]byte(content)) {
    return Result{}, fmt.Errorf(...)   // inside the candidate loop
}
```

A provider *error* fell over to the next candidate; a provider *response* that
did not parse returned immediately. So a single bad sample from the primary
killed the call while a configured backup sat unused — the one failure mode a
fallback absorbs best. It now records the error and continues, exactly like
every other failed call.

## Defect 2 — one accepted output shape

We require the whole response to be bare JSON. Strict schema mode is requested
on every structured call, but whether it is honoured depends on the upstream
host OpenRouter routes to, which varies per request and which we do not
control. Responses arrive fenced (` ```json … ``` `) or wrapped in a sentence
often enough to matter, and the value is right there.

`extractJSON` accepts bare content, a fenced block, or the widest brace/bracket
span that parses. `json.Valid` is the arbiter in every branch, so it cannot
invent a payload that was not there — a span that does not parse is still
rejected.

## Defect 3 — the error threw away the evidence

`"…returned invalid JSON…"` said nothing about what came back, which is why the
first occurrence could only be diagnosed by re-running against the live
provider and probing it by hand. The error now names the model and quotes the
content (bounded to 200 characters, `(empty response)` when blank).

## The tool loop: same tolerance, deliberately no fall-over

`ReasonWithToolsJSON` gets `extractJSON` and the same reporting, but must not
retry on another model: its tools have already run, and re-running would repeat
their side effects. That is also why the agent's corrective re-ask
([0124](0124-corrective-reask-for-invalid-reports.md)) is tool-free.

## Why this matters beyond one model

Every frontier measurement taken before this is void — a cheap model that
happens to emit bare JSON would beat a strong model that fences its output,
and we would have concluded the wrong thing about both. Measurement needs a
decoder that judges the answer, not its wrapper.

## Tests

Written first, all red before the change:

- `TestInvalidStructuredJSONFallsOverToBackup` — a primary returning prose must
  fall over and the backup's JSON must be returned.
- `TestStructuredJSONIsExtractedFromDecoratedContent` — fenced, bare-fenced,
  prose-wrapped and whitespace-padded content all yield the value, and the
  backup is never called when the primary's answer was usable.
- `TestUnusableStructuredResponseErrorCarriesTheContent` — when no candidate
  returns usable JSON, the error quotes the content and names the model.
- `TestToolLoopExtractsDecoratedJSONAndReportsContent` — the same extraction and
  reporting on the tool path.
