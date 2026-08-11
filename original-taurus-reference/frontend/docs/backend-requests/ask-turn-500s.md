# Backend request — Ask turns 500, and the cause is not recorded

**Priority:** **High** · **Status:** Open, rewritten 2026-07-28 with measurements · **Filed:** 2026-07-28
**Blocks:** the Quarterback answering reliably. A user asks a question and gets an error where
an answer belongs.

> **Standalone.** Everything needed is here: the measurements, what they eliminate, the three
> candidate causes, and three concrete changes. All of the code named below is Omega's
> (`core/capability/agent/ask.go`, `core/handlers/chat/chat.go`,
> `core/transport/requestlog/`); Alpha only receives the 500.

---

## The symptom

`POST /agent/chats/:chatID/turns` returns **`500 {"error":"chat operation failed"}`**. The user
turn is persisted, no agent turn is written, the client shows an error. Latencies of the
failures run 5.7s–62.6s, so a real model call happened first.

## What we measured

Same prompt, same project shape, one variable changed:

| Persona | Ask turns | 500s |
| --- | --- | --- |
| A project persona whose guidance is "Be concise." | 56 | 5 (~9%) |
| The requester's default persona | 24 | **0** |

If the default persona failed at the same rate, zero failures across 24 turns would happen
about 10% of the time — so the persona (or the terseness its guidance produces) is implicated,
though not proven.

**This eliminates the prompt** (identical in both arms) and **eliminates Plan/Action**: 108
turns we had initially counted as "successes" were Plan/Action, which spawn a task and never
reach this contract at all. The genuine comparison is the table above.

**The successful custom-persona turns are also informative.** They answer conversationally —
*"Ping received. Ready to edit."*, *"Success. Proceed with edits."* — whereas a default-persona
Ask against an empty project answers *"There is no available evidence to provide …"*. The same
prompt is being routed down two different paths (triage says retrieval is / is not needed), and
only one of them can fail this way.

## Ask 1 — record the cause you already intend to record

**Do this first: it is small, and it converts the rest of this document into one grep.**

Three distinct rejections all collapse into the same opaque 500 — `ErrMissingCitation`,
`ErrInvalidModelOutput`, `ErrUnknownCitation` — and we cannot tell which we are hitting.

Omega already means to record it. `chatErr` sets `resp.Err = err` under the comment *"the cause
travels to the request log, because a 500 with no recorded reason cannot be diagnosed
afterwards"*; `transport/response.go` calls `requestlog.AttachError(c, resp.Err)`; and
`requestlog.Record` has `Error string \`json:"error,omitempty"\``.

**It never arrives.** A real failure line, complete:

```json
{"time":"2026-07-28T23:18:56Z","method":"POST","uri":"/agent/chats/…/turns","status":500,
 "latency":"5.768s","request":{"message":"Ping from the editor persona.","web":false},
 "response":{"error":"chat operation failed"}}
```

No top-level `error`. The cause is dropped between the handler and the sink. Fixing that is the
highest-value change here, and it is a bug against Omega's own stated intent.

## Ask 2 — do not require prose when the flag is set

`decodeAnswer` rejects an empty answer **unconditionally**:

```go
output.Answer = strings.TrimSpace(output.Answer)
if output.Answer == "" {
    return answerOutput{}, fmt.Errorf("%w: answer is empty", ErrInvalidModelOutput)
}
```

But the schema already carries the fact structurally:

```go
InsufficientEvidence bool `json:"insufficientEvidence"`
```

So a model that correctly reports "I have no evidence" and returns no prose is treated as
having produced invalid output. **That asks the model to phrase something the caller can
phrase itself** — and makes a terse persona more likely to fail than a verbose one, which is
exactly the correlation measured above.

**Requested:** check the flag first, and when it is set, accept an empty answer.

```go
func decodeAnswer(raw json.RawMessage) (answerOutput, error) {
    var output answerOutput
    if err := decodeStructured(raw, &output); err != nil { … }
    output.Answer = strings.TrimSpace(output.Answer)
    // Insufficient evidence is a STRUCTURED outcome. The caller renders the
    // message; the model does not have to produce prose to report it.
    if output.InsufficientEvidence {
        return output, nil
    }
    if output.Answer == "" { … }
    return output, nil
}
```

The principle we would like applied generally: **when an outcome can be a field, it should not
also have to be a sentence.** Anything the product wants to say about "no evidence" is copy the
client owns, and copy is not something a language model should be on the hook for.

## Ask 3 — the citation rule itself

Once Ask 1 lands we will know how much of the 9% this actually is. The concern to confirm or
eliminate: a model that does **not** set the flag, answers anyway, and cites nothing gets
`ErrMissingCitation` → 500. If that is happening, the user is getting an error in place of an
answer the model was willing to give.

Note this is entangled with [automatic document ingestion](document-knowledge-ingestion.md):
today **no project has any indexed evidence**, so there is never anything to cite, and every
retrieval-routed Ask depends on the model choosing the flag correctly. That request may reduce
this one substantially — please re-measure after it ships rather than assuming either way.

**Requested:** a model answer that fails the grounding contract should not be a 500. Either
re-prompt once with the contract restated, or fall through to the direct-answer path Ask already
has for questions needing no retrieval.

## Also worth logging (small, high leverage)

- **The triage decision** per turn (`NeedsRetrieval`). We are currently inferring it from the
  shape of the answer text.
- **The raw rejected model output** on any validation failure. Right now the one artefact that
  would settle this is discarded at the moment it becomes interesting.

## How we will verify

1. Force each of the three rejections; the request log carries a distinguishable cause each time.
2. A model reply of `{"insufficientEvidence": true, "answer": ""}` succeeds, and the turn is
   recorded with the flag.
3. Run the "Be concise" persona 30× against an empty project → no 500s.
4. Default-persona behaviour is unchanged.

## Current front-end fallback

None. Alpha surfaces "Could not reach the agent" and drops the optimistic user message. We will
not auto-retry a 500 — a blind retry against a paid model call is not a decision a client should
make on its own.
