# 0127 — The model frontier is flat, so pick quality

We had been choosing models from list prices and a comment that said DeepSeek
was "cost-efficient". This measures instead: `dev-test/bench-models.sh` runs the
whole live intelligence group — eight suites, real provider calls — once per
candidate model and records what passed and what the run cost.

Every number here was taken **after** the decoder fix in
[0126](0126-unusable-structured-responses-are-retryable.md). Measurements taken
before it are void: a decoder that only accepted bare JSON would have scored a
model on whether it fenced its output rather than on whether it was right.

## Results

Reasoning model varied, embedding held at `openai/text-embedding-3-small`,
one repetition each.

| basket | suites | cost/run | list price (in/out per M) |
| --- | --- | --- | --- |
| **openai/gpt-4o-mini** | **8/8** | $0.004434 | $0.15 / $0.60 |
| openai/gpt-oss-120b | 7/8 | $0.006414 | $0.04 / $0.17 |
| openai/gpt-4.1-nano | 6/8 | $0.004378 | $0.10 / $0.40 |
| qwen/qwen3-30b-a3b-instruct | 6/8 | $0.004489 | $0.05 / $0.19 |
| qwen/qwen-2.5-7b-instruct | 5/8 | $0.004163 | $0.04 / $0.10 |
| gpt-4o-mini + qwen3-embedding-4b | 7/8 | $0.004445 | (embedding axis) |

## The finding: token price is not cost

Across models whose **token** prices span roughly 4×, the **run** cost spans
about 1.5× — and not in the order you would guess. `gpt-oss-120b` has tokens
roughly 4× cheaper than `gpt-4o-mini` and costs **45% more per run**, because it
is a reasoning model that emits far more tokens to reach the same answer.

The cheapest run in the table, `qwen-2.5-7b`, saves about **6%** against the
baseline and loses three suites. There is no meaningful money on the table below
the baseline, so the axis that actually differs is quality — and one model
passed everything.

## How the cheap models fail

Not by getting things wrong. By being imprecise:

- **gpt-4.1-nano**, `context-scope`: retrieval was correctly scoped every time —
  it answered "solar technology" and "wind technology" from the right sources —
  but it paraphrased instead of using the exact source name the instruction
  asked for. The scope mechanism works on nano; the quoting does not.
- **gpt-4.1-nano**, `prompt-persona`: told to answer in all lowercase, it
  returned "the Eiffel Tower is 300 meters tall and stands on the champ de mars
  in paris" — most of the instruction followed, one proper noun not.

That is the right way to read the ladder: cheap models keep the machinery
working and lose fidelity at the edges. Wherever an exact name or a literal
instruction is load-bearing — citations, personas, scoped quotes — that
fidelity is the product.

## What changed in the config

- medium and high strength → `openai/gpt-4o-mini`
- low strength → `openai/gpt-4.1-nano` (fine where precision is not load-bearing)
- high strength + high cost → `anthropic/claude-3.5-sonnet`, the premium corner
- every reasoning/inference tier gets a **cross-vendor** backup, usually
  `openai/gpt-oss-120b` — open-weight, so OpenRouter load-balances it across
  hosts. Costing more per run is irrelevant for a route that only fires on
  failure.
- the free `nvidia/nemotron-3-embed-1b:free` embedding row is gone: it
  intermittently returns an **empty vector list**, which is a silent retrieval
  failure rather than a loud one.

## Honest limits of this measurement

- **One repetition per basket.** This is a screening pass, enough to separate
  "passes everything" from "loses whole suites". The chosen primary has stronger
  evidence: `gpt-4o-mini` has now taken the full group green nine times (the
  eight consecutive runs in [0123](0123-live-suite-repairs.md) plus this one).
- **DeepSeek was not re-measured after the decoder fix.** Its first basket here
  was killed mid-run when the ladder was stopped, so that log is truncated and
  is not reported as a result. It is excluded on price rather than on quality:
  `deepseek-chat` costs more per token than the winner and `deepseek-r1` costs
  4.7× more, so neither can win a frontier the winner already tops.
- **The embedding axis is one data point.** `qwen3-embedding-4b` drove the
  knowledge and retrieval suites fine; the single failure in that basket was the
  unrelated free Nemotron model in the `intelligence` suite.
- The suites exercise the `medium/*/*` and `high/medium/medium` tiers. Other
  tiers are set by the same rule but are not directly measured.

## Superseded: the embedding choice

The note above that "`qwen3-embedding-4b` drove the knowledge and retrieval
suites fine" was drawn from a single basket run and did not survive contact with
real load — a full suite run produced 121 HTTP 429s from that model while
isolated probes of it succeeded every time. The general embedding tiers now use
OpenAI's endpoint, which carried the same workload without one. See
[0129](0129-test-what-we-ship.md); the reasoning-model results here still stand.
