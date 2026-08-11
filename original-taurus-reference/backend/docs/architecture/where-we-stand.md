# Where we stand — the model boundary and what the tests prove

One place for the whole of this round of work: what the tests do, every bug
found and whether it is fixed, every configuration decision and its evidence,
and what is still open. Per-change detail lives in records
[0121](../records/0121-connector-sync-race.md)–[0129](../records/0129-test-what-we-ship.md);
this is the consolidated read.

---

## 1. Test status

`./dev-test/run.sh all` — **all suites pass** against the shipped manifest.

| | |
| --- | --- |
| Suites | ~40 total; 8 make live model calls |
| Cost | **$0.014–0.016** per full run |
| Embedding-backed operations | 34 per full run |
| Skipped | `web` only — it needs an external endpoint configured |

**What "the shipped manifest" means now.** The suites copy `etc/config.yaml`
verbatim and overlay only the port, database, certificate and API key. They no
longer write their own cast tables. This matters more than it sounds: the config
overlay replaces a YAML list wholesale, so every suite used to silently discard
the shipped tables and test models nobody deploys. A green run was a claim about
a configuration that did not exist.

Making that one change uncovered four production defects (BUG-A through BUG-D
below).

**The cast is not a test knob.** The cast a caller sends is hard-coded in the
application by design — nothing exposes model strength to a user, and retrieval
is entirely our orchestration. So the cast is part of what we test. The only
thing that legitimately varies is which model a cast maps to, and that lives in
a config file, so comparing models means pointing at a *different manifest*
(`bench-models.sh` does exactly that), never rewriting cast rows in a suite.

---

## 2. Bugs — all fixed

Ordered roughly by how much they mattered.

### BUG-A — Panic on a short embedding response · **FIXED** (`cb3d953`)

`POST /connectors/:id/sync` returned `500 Internal Server Error` from a real
panic: `index out of range [0] with length 0`. We indexed the provider's vector
list assuming one vector per input; it returned none.

Fixed at the boundary — `intelligence.Embed` rejects a vector count that does
not match the inputs, naming the model and both counts — and again at the
indexing site in `embedWindows`, which now checks rather than trusting the port.
Plus one bounded retry on the same route (embedding casts have no fallback by
design, so a transient must be retried on the same model or not at all).

### BUG-B — A blank window zeroing a whole batch · **FIXED** (`cb3d953`)

**Same incident as BUG-A: this is the cause, BUG-A is why it crashed instead of
erroring.** `windowSpans` could emit a window that was empty or whitespace-only.
OpenRouter answers an embeddings batch containing an empty string with HTTP 200,
an empty `data` array and an error object — so **one blank window zeroes the
vectors for every window beside it**.

Blank windows are dropped at the source now. The bug was as old as the window
builder; `text-embedding-3-small` tolerated the empty string and hid it for as
long as we used it.

### BUG-C — An HTTP 200 carrying an error read as success · **FIXED** (`cb3d953`)

OpenRouter returns rejections *and* "model busy" inside 200 responses. `post()`
trusted the status code, so those parsed as successes with no data.

It now treats a declared error as a failure at any status. `declaredError` is
deliberately separate from `openRouterError`, which falls back to echoing the
body — correct for a known failure, catastrophic when asked about a success. The
first attempt at this reused the wrong helper and made every good call look like
an error, breaking three tests.

### BUG-D — Test harness less resilient than production · **FIXED** (`d1dcf1c`)

`action`, `agents` and `chats` pinned `jobs.max_attempts: 1` while production
retries five times — and that retry is exactly what absorbs a transient
`engine_overloaded`. The suites were failing on hiccups production rides out.

### BUG-E — The harness accused the product of a bug it did not have · **FIXED** (`5871d2f`)

`context-scope` reported `answer missing 'Zephyrite'` while the stored document
read *"The power-generation technology described is the Zephyrite reactor."* The
model had written the name in quotes, and `json_field` parsed JSON with the
regex `"name":"([^"]*)"`, which stops at the first quote — it truncated the
answer mid-sentence and then asserted the missing word was missing.

Worse than a flaky test: a false accusation sends someone hunting a scope bug
that does not exist. It parses with `jq` now.

### Earlier in the same cycle · **all FIXED**

| Bug | Fix |
| --- | --- |
| Connector sync raced the background detector (data race, intermittent 500) | `bf342de` — per-connector keyed mutex |
| Scope change kept the prior answer, leaking out-of-scope content into a new scope | `b08efe2` — carryover cleared with `ResolvedAt` |
| Unusable structured output was fatal instead of retryable; error discarded the content | `8a1ba3a` — fall over, extract fenced/padded JSON, quote what came back |
| Every unknown URL returned 409 "select a project first" instead of 404 | `4ddbc8a` — own catch-all registered after the groups |
| Headings rendered their own markdown marker as content (`# Title`) | `4ddbc8a` — strip the marker the declared kind expresses |
| An action's fumbled final report discarded completed work | `0255e73` — bounded, tool-free corrective re-ask |

---

## 3. Configuration decisions and their evidence

### Reasoning models — measured, not assumed

`bench-models.sh` ran the whole live intelligence group per candidate:

| Model | Suites passed | Cost/run | List price (in/out per M) |
| --- | --- | --- | --- |
| **gpt-4o-mini** | **8/8** | $0.004434 | $0.15 / $0.60 |
| gpt-oss-120b | 7/8 | $0.006414 | $0.04 / $0.17 |
| gpt-4.1-nano | 6/8 | $0.004378 | $0.10 / $0.40 |
| qwen3-30b | 6/8 | $0.004489 | $0.05 / $0.19 |
| qwen-2.5-7b | 5/8 | $0.004163 | $0.04 / $0.10 |

**Token price is not run cost.** Models spanning ~4× in token price span ~1.5×
in run cost, in the wrong order — `gpt-oss-120b` has 4× cheaper tokens and costs
45% *more* per run, because it emits far more of them. The cheapest run saves
~6% and loses three suites. The frontier is flat, so quality is the only axis
that differs.

**How the cheap models fail matters.** Not by being wrong — by being imprecise.
`gpt-4.1-nano` scoped retrieval correctly every time and simply paraphrased
instead of quoting the exact source name; told to answer in lowercase it left
one proper noun capitalised. Wherever an exact name or literal instruction is
load-bearing — citations, personas, scoped quotes — that fidelity *is* the
product.

Current tables: `gpt-4o-mini` for medium/high strength, `gpt-4.1-nano` at low,
`claude-3.5-sonnet` at the premium corner.

**Caveat, stated plainly:** this measured five models *at or below* the
baseline. Nothing stronger was tested, and DeepSeek was excluded on price rather
than re-measured after the decoder fix. This established a floor, not a ceiling.

### DeepSeek removed

It was never the cost-efficient choice the old config comment claimed:
`deepseek-chat` costs more per token than `gpt-4o-mini`, and `deepseek-r1` costs
**4.7× more** *and* rate-limits (`429 … temporarily rate-limited upstream`).

### Backups must be cross-vendor

Every reasoning and inference tier has a backup, usually `gpt-oss-120b`
(open-weight, so OpenRouter load-balances it across hosts). The rule is
cross-*vendor*, not merely a different slug: a family-wide rate limit takes a
same-family backup with it.

A 429 already falls over to the backup automatically — `shouldFallover` treats
every provider error as grounds to advance. **Host-level routing was deliberately
not built:** OpenRouter's documented default already load-balances across hosts
to maximise uptime, and setting `sort` switches that off, so reaching for it
would likely make rate-limit exposure worse.

### Exactly one embedding model

`openai/text-embedding-3-large` — OpenAI's model, reached through OpenRouter
(hence the `openai/…` slug with provider `openrouter`).

**Why one and not a ladder.** Unlike reasoning, embedding has no tier to climb:
every stored vector must be comparable, and two models put vectors in different
spaces. Varying by strength/speed/cost would let a cast change silently make the
corpus unsearchable. All 27 general coordinates resolve to the same model on
purpose, and `intelligence.New` rejects an embedding cast with a fallback row at
boot.

Cost is not the deciding factor — embeddings are cheap next to reasoning — so
this is the quality choice. Two open-weight candidates were tried first and both
failed on **throughput, not quality**: the free Nemotron returned empty vector
lists, and `qwen3-embedding-4b` handled isolated probes perfectly then
rate-limited under a full suite run.

**Changing this invalidates every stored vector.** It is a migration, not a
swap — free only while there is no real data.

### Tool limits sized for document authoring

`MaxRounds: 64, MaxCallsPerRound: 8, MaxCalls: 256, MaxTotalTokens: 512k`.

An agent writing a structured document appends roughly one block per round, so
the previous 16-round ceiling covered a title, three sections and little else — a
live run asking for a 400-word story exhausted it and failed the task outright.
This had to change at `hardToolLimits`: 16 was a *hard* ceiling a caller could
only tighten, so raising it in wiring alone would have been silently clamped.

### No configuration divergence

`etc/config.local.yaml` was a full 225-line manifest carrying its own 83 cast
rows still pointing at DeepSeek. It overlays `etc/config.yaml` at runtime, so
this machine ran models the committed config had moved away from and no suite
ever exercised. It is now **secrets only**; the prior contents are in a
timestamped backup beside it. What we test is what runs.

---

## 4. Open items

### The agent sometimes ignores an explicit instruction

`live-document` failed once on criterion 6 — "every prompt block uses the
finance context" — and passed twice standalone immediately after. The agent is
told to create each block `with include ["finance"]`; it creates them correctly
and occasionally omits the include.

**Deliberately not papered over with a retry**, unlike the sampled assertions
elsewhere. Scoping is a correctness property: a block that silently retrieves
from the whole project instead of its declared source is wrong in a way a user
would never see. The fix is a stronger model, or a tool that refuses to create
an unscoped prompt block — not a greener test.

### No throttle in front of embedding

A directory upload of hundreds of files means hundreds of connector-sync
embeddings with **nothing bounding how many are in flight**. Per-call retries do
not help when the limiter is the problem.

The shape is a small fixed worker pool with backoff on 429, but the numbers are
a policy decision worth scoping deliberately. This is the most likely thing to
bite a real bulk upload.

### Built but unused

- **Reasoning-effort knob** — routes accept an optional
  `effort: low|medium|high` threaded to OpenRouter. Nothing sets it yet; it is
  the lever for "a cheap model told to think harder", which the frontier work
  never got to test.
- **Per-purpose casts for ask / action / plan** — the cast key already carries a
  `purpose` axis. Splitting the agent's three modes onto their own casts needs
  no code change, only config. Not worth chasing while `gpt-4o-mini` is this
  cheap, but the lever exists.

### Not measured

Anything stronger than `gpt-4o-mini`. `claude-3.5-sonnet` sits in the premium
corner of the config unmeasured. Since `gpt-4o-mini` passes every suite, a
stronger model has no failing test to fix — its value would show up in the
fidelity dimensions the suites do not measure, of which the instruction-adherence
gap above is the clearest example.

---

## 5. The lesson worth keeping

Four of the six failures in the first full-suite run were tests that had drifted
behind the code, and **two genuine defects were sitting underneath them**, where
a stale failure looks indistinguishable from a real one. The intelligence group
ran constantly and stayed honest; the rest rotted quietly.

Run `all` on a schedule, not just the group under active development — and keep
the test basket identical to the shipped one, because a suite that drifts from
production turns a passing run into a claim about a configuration nobody runs.
