MEASURED on the live demo, two runs each, sorted by cost per run. Duration is
wall clock for the whole suite, which is what a user would feel.

| Model | Token price in/out (USD per 1M) | Cost per run (USD) | Time | Run 1 | Run 2 |
| --- | --- | --- | --- | --- | --- |
| gemini-2.5-flash | 0.30 / 2.50 | 0.000983 | 117s | pass | **fail** |
| gpt-4o-mini | 0.15 / 0.60 | 0.001332 | 45s | pass | pass |
| gpt-4.1-mini | 0.40 / 1.60 | 0.001344 | **40s** | pass | pass |
| gemini-3-flash-preview | 0.50 / 3.00 | 0.001346 | 108s | pass | pass |
| gpt-5.1 | 1.25 / 10.00 | 0.001415 | 112s | **fail** | pass |
| **gpt-5.6-luna** *(now shipped)* | 0.50 / 3.00 | 0.001517 | 54s | pass | pass |
| claude-haiku-4.5 | 1.00 / 5.00 | 0.001709 | 72s | **fail** | **fail** |
| gpt-5-mini | 0.25 / 2.00 | 0.003375 | 189s | **fail** | **fail** |

**Four models passed both runs:** gpt-4o-mini, gpt-4.1-mini, gemini-3-flash-preview
and gpt-5.6-luna. Two flipped between runs — gemini-2.5-flash passed then failed,
gpt-5.1 failed then passed — which is the single most important result here:
**one run per model cannot rank anything.**

**Token price barely predicts run cost.** gpt-5.1 costs 2.5x/3.3x luna per token
and **7% less per run**. An 8x spread in token price collapses into a 1.5x spread
in cost per run, and not in order.

**Time is the axis that actually separates them:** 40s to 189s, a 4.7x spread
that no price sheet shows. claude-haiku-4.5 fails purely on it — 72s against a
60s budget# Intelligence: next steps

Organised as **work streams**, so related changes land together instead of
jumping between the cast table, the embedder and model research. Current state
is in [where-we-stand.md](where-we-stand.md).

The thread running through all of it: **imprecision, not incorrectness, is our
failure mode.** Cheap models keep the machinery working and lose fidelity at the
edges — paraphrasing instead of quoting an exact name, dropping one clause of an
instruction, occasionally omitting a scope we explicitly asked for. Prompts will
only get more detailed, so the real question is how precision holds as prompt
complexity rises.

---

## Facts to argue from

### Reasoning and inference are NOT conflated

They are separate **kinds**, each with its own cast table
(`KindReasoning`, `KindInference`, `KindEmbedding`). `purpose` is an orthogonal
axis on top. So nothing is mixing them up.

What *is* worth knowing: **inference is not used by any product capability.** Its
only caller is the `/intelligence/infer` HTTP endpoint, which exists for the
dev-test suite. Its 54 configured rows currently serve nothing real.

### Which casts the product actually asks for

| Caller | Cast | Kind |
| --- | --- | --- |
| Prompt-block **plan** step | `general/high/medium/medium` | reasoning |
| Prompt-block **synthesis** step | `general/high/medium/medium` | reasoning |
| Agent planning + default (ask/plan/action) | `general/medium/medium/medium` | reasoning |
| Knowledge embedder | `general/medium/medium/medium` | embedding |

Four callers, two distinct coordinates, one kind doing all the work. The 54-row
reasoning table and 54-row inference table exist to serve **two** coordinates.

### The suites are not slow

Whole suite **4 min 8 s**; the demo (`live-document`) **36 s**; slowest single
suite (`prompt`) 51 s. A full run costs **0.014 USD–0.016**.

---

## WS-1 · Redesign the cast table

**The problem.** A cast maps to a *model* and nothing else. But choosing a model
is not the whole decision — effort level and the tool/token envelope are part of
"how much machine am I buying for this job", and they are currently scattered:
effort unset, tool limits hardcoded in wiring, both invisible from the config.

**The shape.** A cast entry becomes a complete envelope:

```text
purpose  →  model  +  effort  +  tool/token limits
```

And the selector becomes a **purpose label** describing the work, rather than a
strength/speed/cost cube nobody navigates. Today's 27-combination grid is
answering a question no caller asks: only two coordinates are ever requested,
and the axes are guesses about tradeoffs rather than statements about work.

- [ ] **1a. Replace the strength/speed/cost cube with purpose labels.** Proposed
      set: `prompt_plan`, `prompt_synthesis`, `agent_ask`, `agent_plan`,
      `agent_action`. Each names a job we actually dispatch.
- [ ] **1b. Carry `effort` in the cast row** (`low|medium|high`). The field
      already exists on a route and is threaded to OpenRouter; nothing sets it.
      Absent means the provider default (medium), which is fine as a starting
      point.
- [ ] **1c. Carry the tool/token envelope in the cast row** — `max_rounds`,
      `max_calls`, `max_calls_per_round`, `max_total_tokens`. These are hardcoded
      in wiring today and cannot be tuned without a rebuild.
- [ ] **1d. Give embedding its own shape.** Embedding has no tiers by
      construction — one model, or the corpus is unsearchable. Its config should
      be a label and a model, not a 27-row grid pretending there is a choice:

      ```yaml
      embedding:
        general: { provider: openrouter, model: "openai/text-embedding-3-small" }
      ```

- [ ] **1e. Decide what happens to the inference table.** Nothing in the product
      calls it. Either delete it and the endpoint, or keep one row for the
      dev-test surface. Carrying 54 rows for an unused kind is misleading.

**Note:** tool-limit raising (previously its own item) now waits for **1c** —
raise them *in the cast table*, not in code, so it is a config decision from
then on.

---

## WS-2 · Embedding

**Decision taken: `text-embedding-3-small`.** Large costs ~6.5× for a few
benchmark points, and its 3072 dimensions double both stored vector size and
comparison work — which lands directly on us because descent is off, so every
query dots against **every** window. Already switched in config.

- [x] Switch the model to `text-embedding-3-small`
- [ ] **2a. Restructure embedding config** to label → model (this is **1d**;
      tracked here because it is embedding work).
- [ ] **2b. Bulk ingestion under a time budget.** A directory of hundreds of
      files means hundreds of connector-sync embeddings with **nothing bounding
      how many are in flight**. Per-call retries do not help when the limiter is
      the problem. Needed: a bounded worker pool with backoff on 429, and a
      notion of "ingest this directory over N minutes" rather than as fast as
      the loop can push.
- [ ] **2c. Evaluate a different embedding API.** OpenRouter does not even list
      embedding models in its catalogue, and two candidates failed there on
      throughput. Going direct to OpenAI (or another embedding-native provider)
      may give better rate limits, batch endpoints and visibility. Worth pricing
      before building 2b, since the right throttle depends on the real ceiling.
- [ ] **2d. Confirm real embedding spend** from an invoice; catalogue prices are
      unavailable and published rates are unverified for our path.

**Standing constraint:** changing the embedding model invalidates every stored
vector — they live in different spaces. A migration, not a swap, and free only
while there is no real data.

---

## WS-3 · Model selection research

**Not part of the default test run.** The suite we always run tests **the
production configuration**. Everything below is research: separate manifests,
run deliberately, never in the default path.

**Downward testing is done.** The frontier is flat below `gpt-4o-mini` and
nothing cheaper passes everything. No reason to revisit.

### A single suite cannot choose a model (tried, reverted)

`gpt-4.1-mini` won the `live-document` ladder outright: 2/2 pass, fastest, stable
at 2 tool-loop rounds both runs, and about a third of the shipped model's cost.
It was switched in and run against all 40 suites.

It failed `action` and `agents`, both with:

```text
agent ask: answer cited evidence that was not retrieved: document<NUL><id><NUL>1<NUL>23
```

It fabricated citation locators against the document it had just edited, with
invented byte offsets. This was not a contract it could not satisfy: an Action
report accepts an empty citation list (`validateReport` passes
`InsufficientEvidence: true`), so citing nothing was correct and available. It
volunteered provenance that did not exist — the same failure `gpt-5.1` produced
earlier, and the one the citation validator exists to catch.

Reverted. `gpt-5.6-luna` remains shipped at 40/40.

Two things this settles:

- **Cost per run ranks candidates; only the full suite decides one.**
  `live-document` exercises authoring, not the grounding contract under an
  Action report. A model can be faster, cheaper and stabler there and be
  unusable.
- **The measured cost gap was real and did not matter.** `gpt-4.1-mini` ran the
  full suite at 0.0386 against luna's 0.0698–0.0799 USD. Half price for work that
  does not finish is not a saving.

### The candidates (verified against the live catalogue)

Per million tokens. `claude-sonnet-4` is **dropped — no structured outputs**, and
our whole reasoning path is schema-constrained.

| Model | In | Out | Notes |
| --- | --- | --- | --- |
| **gpt-4o-mini** *(current)* | 0.15 | 0.60 | the floor |
| gpt-4.1-mini | 0.40 | 1.60 | |
| gpt-5-mini | 0.25 | 2.00 | cheap in, expensive out |
| gemini-2.5-flash | 0.30 | 2.50 | |
| deepseek-r1 | 0.70 | 2.50 | reasoning model; rate-limited before |
| o4-mini | 1.10 | 4.40 | practical ceiling for now |
| gpt-5 | 1.25 | 10.00 | frontier |
| claude-sonnet-4.5 | 3.00 | 15.00 | ~1¢/run territory |

**Cost per run is not token price.** We have already measured this backwards:
`gpt-oss-120b` had 4× cheaper tokens and cost **45% more per run** because it
emitted far more. It can run the other way too — a stronger model that answers
in fewer tokens, with fewer retries and fewer tool rounds, can be genuinely
cheaper per run. Only a real run settles it.

- [x] **A discriminating test exists.** The `live-document` demo separates
      models: it caught under-delivery, duplication and a bad citation where the
      rest of the suite passes everything. It is not sufficient on its own —
      five models tie on it — but it is no longer true that nothing ranks above
      the floor. See [live-document-walkthrough.md](live-document-walkthrough.md).
- [ ] **3a. Build the precision probe — still blocking a ranking.** Every suite passes on
      `gpt-4o-mini`, so they cannot rank anything above it. Without a harder
      assertion set, running the ladder upward only proves that everything above
      the floor also clears the floor. The probe must test: exact-name quoting,
      multi-clause instruction adherence, and scope application under a
      genuinely detailed prompt.
- [ ] **3b. Test plan and synthesis SEPARATELY.** They are different jobs —
      planning turns an instruction into queries; synthesis writes the precise
      grounded answer. They may not want the same model, and the ladder should
      be climbed per purpose, not for "the reasoning model".
- [ ] **3c. Run the ladder upward** per purpose, reporting suites passed and
      **measured** cost per run.
- [ ] **3d. Report the table with `gpt-4o-mini` at the bottom** — measured, not
      estimated.

---

## WS-4 · Action quality

The agent's `action` mode is where instruction adherence actually bites, because
it has side effects.

**Known gap.** `live-document` failed once on "every prompt block uses the
finance context", passing twice standalone right after. The agent is told to
create each block `with include ["finance"]`, creates them correctly, and
occasionally omits the include. Deliberately **not** retried away: scoping is a
correctness property, and a block that silently retrieves from the whole project
instead of its declared source is wrong in a way a user would never see.

- [x] **Scope and citation rules made explicit in the prompts.** Each rule now
      carries its positive form AND the forbidden shapes, including the literal
      strings a model produced (`functions.document.prompt.create`, `call_ABC123`).
      A rule stated only in the abstract is easy to satisfy while still doing the
      wrong thing. Effect-attribution is pointed at `operations[].toolCallId`.
- [ ] **4a. Make the tool refuse an unscoped prompt block** when the document has
      context variables. A product guarantee that does not depend on model
      compliance — cheaper and more reliable than paying for a better model.
- [ ] **4b. Exercise action hard** — a suite that drives multi-step authoring
      with detailed, multi-clause instructions, which is what will refine the
      `agent_action` cast entry (model + effort + envelope) in WS-1.
- [ ] **4c. Use 4b's results to set the `agent_action` row**, likely a stronger
      model and/or higher effort than `agent_ask`.
- [x] **4d. State the obligation, not only its bounds** (record 0130). Two live
      failures had the same shape: every rule constrained what the model *may*
      do, none stated what it *must*. Ask's citation rules never said a citation
      was required, so a correct answer with `citations: []` was rejected; the
      synthesis prompt never said to answer the question asked, so "wind
      technology" passed every fact rule while answering nothing. Both now lead
      with the obligation and then name the specific misreading.

---

## WS-5 · Testing policy

- [x] The default run tests **the production configuration** — suites read
      `etc/config.yaml` verbatim, no suite writes cast rows.
- [x] The local overlay is secrets-only, so it cannot silently change what a run
      exercises.
- [ ] **5a. Keep variant-config runs out of the default path.** `bench-models.sh`
      compares whole manifests; that is research tooling, run on purpose.
- [ ] **5b. Run `all` on a schedule.** Four of six failures in the first full run
      were tests that had drifted, with two real defects hiding underneath.

---

## Suggested order

1. **WS-1** — the cast redesign; everything else expresses itself in its terms
   (and tool-limit raising is folded into 1c)
2. **WS-2a** — embedding config shape, alongside 1d since they are the same edit
3. **WS-4a** — the unscoped-block guard; independent of model choice, and closes
   a correctness gap now
4. **WS-3a** — the precision probe, which unblocks all model research
5. **WS-3b/3c/3d** — the upward ladder, per purpose
6. **WS-4b/4c** — action-specific tuning informed by the ladder
7. **WS-6** — telemetry, which every later measurement depends on
8. **WS-2c then 2b** — embedding provider evaluation, then the throttle, before
   any real directory import ships

---

## WS-6 · Telemetry around every model call

Single runs keep producing conclusions that the next run overturns — a model
"fails", then passes; a scoping bug "reproduces", then does not. Every ranking in
this document rests on one sample per model, which is exactly the evidence that
has misled us most.

The missing instrument is not more runs, it is **per-call measurement**, through
the centralised logger:

- [x] **6a. Latency per provider call.** Every call reports its wall-clock
      duration through the central logger, measured around the provider call
      alone so it is the model's response time and not our overhead.
- [x] **6b. Cost per call**, with the model that actually served it and the cast
      that selected it. Attributing a run to plan vs synthesis vs action is now a
      matter of reading the log rather than instrumenting for the occasion.
- [x] **6c. Tool-call counts and rounds per loop**, plus the fallback attempt
      number on every call, so a route that only succeeded on its backup is
      visible in a response that otherwise looks healthy.
- [ ] **6d. Report-validation failures with the offending value.** The citation
      bug was only diagnosable because the error quoted what came back; that
      should be the norm, not something added after each incident.
- [x] **6e. Every failed request records its cause** (record 0130). All 83
      internal-error returns in the handlers discarded the underlying error, so a
      500 said only that a request failed. `endpoint.Response.Err` now travels to
      the request log through `writeResponse` — never to the client, whose
      message stays opaque. This is the prerequisite the rest of WS-6 was
      missing: the two attachment defects were invisible until the log named
      them.

**What the instrument showed on its first full run** (record 0131). 158 provider
calls, **zero failures and zero fallback engagements** — the primary route served
everything, which is a health fact no response could have told us.

| Operation | Calls | Tokens | Prompt share |
|---|---|---|---|
| `reason.tools` | 6 | 58,792 | **90%** |
| `reasoning` | 73 | 36,010 | 84% |
| `embedding` | 78 | 1,671 | 100% |

**Prompt tokens are the bill.** 84–90% of everything spent is input, so *prompt
text length* and *tool-loop round count* drive cost — not output length. A single
Action loop was 23.0s and 20,508 tokens over 5 rounds, outweighing every other
call in that suite combined.

That has an immediate consequence worth naming: **the prompt hardening in record
0130 cost real money.** A prompt-block synthesis call measured 774 prompt tokens
before the rule was added and 922 after — **+19% on every call of that kind**,
measured on the same call type before and after. The rules bought two real bug
fixes and were worth it, but "add a rule to the prompt" is now a priced decision
rather than a free one, and this is the instrument that prices it.

**The suite's own cost line cannot be used for this, and telemetry is how we
found out.** Two runs with identical prompts came in at 0.021496 USD and 0.017849 USD —
so the suite-level movement first attributed to the prompt change was variance.
Worse, the cheaper-looking run actually spent *more*: 108,342 measured tokens
against 96,489. `track_usage` scrapes `totalTokens` from a response body with
`head -n1` and only where a suite calls it, so it has always been a partial
accounting. **Total the runner's cost from telemetry instead** — the obvious
follow-up, and until then the printed dollar figure is a floor, not a total.

The variance itself is now measurable: the same suite ran tool loops of 3/4/2/5
rounds one time and 2/4/2/8 the next, moving `reason.tools` from 58,792 to 71,158
tokens with nothing changed. Any model ranking built on single runs is measuring
this noise.

**Remaining gap: per-call is not yet per-task.** The log attributes a call to a
cast and a model, not to the task or chat turn that caused it. Summing a single
agent run's true cost still means correlating by timestamp. That is what 6b's
"and per task" half still needs.

**This blocks meaningful model selection.** WS-3's ladder cannot rank five models
that all pass, and cannot distinguish "slow model" from "our timeout" without
6a. Build the instrument, then run the ladder repeatedly and compare
distributions rather than anecdotes.

---

## WS-7 · Front-end requests of the back end

Placeholder for the work the client needs from us — endpoints, payload shapes,
and behaviours the UI depends on. Existing notes live in
[`docs/frontend-requests/`](../frontend-requests/); this stream is where they get
triaged, ordered, and turned into commitments rather than accumulating as
one-off documents.

- [ ] **7a. Inventory what the front end currently needs**, from
      `docs/frontend-requests/` and anything not yet written down.
- [ ] **7b. Decide what is a contract** versus what is incidental to the current
      client, so the API surface is deliberate rather than emergent.
