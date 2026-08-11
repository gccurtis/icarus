# 0129 — Test what we ship

The suites had been writing their own cast tables. Because the config overlay
replaces a YAML list wholesale, each suite silently discarded the shipped
tables and ran models nobody deploys — so a green run was a claim about a
configuration that did not exist. This makes the shipped manifest the thing
under test, and that change alone uncovered four production defects.

## The rule

The cast a caller sends is **hard-coded in the application by design** —
nothing exposes model strength to a user, and retrieval is entirely our
orchestration. So the cast is part of what we test, never a knob a test turns.
The only thing that legitimately varies is which model a cast maps to, and that
mapping lives in a config file. Trying different models therefore means
pointing at a **different manifest**, never rewriting cast rows in a suite.

- `lib.sh` copies `etc/config.yaml` verbatim as the base. Test-specific values
  (port, database, certificate) go in the sibling overlay, which replaces only
  the fields it names.
- Only the **API key** is taken from the developer's `etc/config.local.yaml`,
  not the whole file. On this machine that file turned out to be a full
  225-line manifest carrying its own 83 cast rows — still routing to DeepSeek —
  so copying it would let local drift decide which models a test exercises.
  Worth knowing separately: that file overlays `etc/config.yaml` at runtime, so
  the committed config is not what this machine actually runs.
- `bench-models.sh` now compares whole manifests, named after their files.

## What running the real config found

**A panic on a provider hiccup.** `POST /connectors/:id/sync` returned
`500 Internal Server Error` from `index out of range [0] with length 0` —
`embedWindows` indexed the provider's vector slice without checking it.
Guarded now at the boundary (`intelligence.Embed` rejects a vector count that
does not match the inputs, naming the model and both counts) and again at the
indexing site, plus one bounded retry on the same route, since embedding casts
have no fallback by design.

**A blank window poisoning whole batches.** `windowSpans` could emit a window
that was empty or whitespace-only. That is not harmless: OpenRouter answers an
embeddings batch containing an empty string with **HTTP 200**, an empty `data`
array, and an error object — so one blank window zeroes the vectors for every
window beside it. Blank windows are dropped at the source now. The bug had
existed for as long as the window builder had; `text-embedding-3-small`
tolerated the empty string and hid it.

**A 200 that carried an error.** `post()` trusted the status code, so that
reply parsed as a success with no data. It now treats a declared error as a
failure at any status. `declaredError` is deliberately separate from
`openRouterError`, which falls back to echoing the body — correct for a known
failure, catastrophic when asked about a success (the first attempt at this
made every good call look like an error and broke three tests).

**A test harness less resilient than production.** `action`, `agents` and
`chats` pinned `jobs.max_attempts` to 1 while production retries five times —
and that retry is exactly what absorbs a transient `engine_overloaded` from the
provider. The suites were failing on hiccups production rides out.

## The embedding model, decided under load

`qwen/qwen3-embedding-4b` answered isolated probes perfectly and produced
**121 HTTP 429s** during a full suite run. Only sustained workload volume shows
a throughput ceiling. Every earlier full run on OpenAI's embedding endpoint was
green under that same load, so the general tiers moved there.

This reverses the reasoning in [0125](0125-backups-and-a-reasoning-effort-knob.md):
open-weight multi-hosting is a genuine uptime argument for **reasoning** models
— it is why the cross-vendor backup is `gpt-oss-120b` — but for embeddings,
sustained throughput on one endpoint mattered more. Two open-weight embedders
were tried and both failed on throughput rather than quality: the free Nemotron
returned empty vector lists, Qwen rate-limited.

Recorded beside the table: **changing an embedding model invalidates every
stored vector**, because they live in different spaces. It is a migration, not
a swap, and it is free only while there is no real data.

## Result

`./dev-test/run.sh all` — **all suites passed** against the shipped manifest,
about $0.014 per run. The runner now also names each failing suite and its exit
code: a suite can exit non-zero without printing a failed check (a build race, a
trap), and "some suites failed" alone sent the reader hunting.

## Open, deliberately not changed

The agent tool loop allows 16 rounds. An agent authoring a document one block
per round consumes them quickly — raising the test's story objective to 400
words exhausted the limit and failed the task, which is why the objective stays
realistic. If document authoring becomes a headline use case that ceiling is
the thing to revisit, with evidence, rather than nudged whenever a test bumps
into it.

## Two follow-on corrections

**One embedding model, everywhere.** The table still varied the embedder by
tier, which is wrong in a way reasoning tiers are not: every stored vector must
be comparable, and two models put vectors in different spaces, so varying by
strength/speed/cost would let a cast change silently make the corpus
unsearchable. All 27 general coordinates now resolve to
`openai/text-embedding-3-large` — the quality choice, since embeddings are
cheap next to reasoning, and one that has to hold up under sustained load.

**The harness accused the product of a bug it did not have.** `context-scope`
reported `answer missing 'Zephyrite'` while the stored document read *"The
power-generation technology described is the Zephyrite reactor."* The model had
written the name in quotes, and `json_field` parsed JSON with the regex
`"name":"([^"]*)"`, which stops at the first quote — it truncated the answer
mid-sentence and then asserted the missing word was missing. That is worse than
a flaky test: a false accusation sends someone hunting a scope bug that does
not exist. It parses with `jq` now.

**Result:** `./dev-test/run.sh all` — all suites passed, ~$0.0146 per run, on
the shipped manifest with a secrets-only local overlay.

## Final corrections

**One embedding model, actually.** The first attempt set all 27 *general* tiers
to one model but left 27 `code`-purpose rows pointing at Codestral — a second,
unused vector space sitting in the config waiting to be mistaken for a tier. The
retrieval lattice embeds under a single fixed general cast, so those rows served
nothing. Removed, along with the suite check that exercised them. The embedder
is OpenAI's `text-embedding-3-large`, reached through OpenRouter.

**The tool ceiling is 64 rounds.** Document authoring is a headline use case,
not an edge case, and an agent appends roughly one block per round. This had to
change at `hardToolLimits`: 16 was a *hard* ceiling that a caller could only
tighten, so raising it in wiring alone would have been silently clamped.

**A count I got wrong.** "121 HTTP 429s" counted log occurrences, and job-status
polling echoes the same `lastError` on every poll — one failing operation
appears dozens of times. A full run makes **34** embedding-backed operations.
The rate limiting was real; the magnitude was not.

## Known: the agent sometimes ignores an explicit instruction

`live-document` failed once on criterion 6 — "every prompt block uses the
finance context" — and passed twice standalone immediately after. The agent is
told to create each block `with include ["finance"]`; it creates them correctly
and occasionally omits the include.

This is deliberately NOT papered over with a retry, unlike the sampled
assertions elsewhere. Scoping is a correctness property: a block that silently
retrieves from the whole project instead of its declared source is wrong in a
way a user would not see. It belongs on the list of things a stronger model — or
a tool that refuses to create an unscoped prompt block — should fix, and it is
the same instruction-adherence weakness the frontier work found in cheaper
models.

## Still open

No bounded concurrency in front of embedding. A directory upload of hundreds of
files means hundreds of connector-sync embeddings with nothing limiting how many
are in flight; per-call retries do not help when the limiter is the problem. A
small fixed worker pool with backoff on 429 is the shape, but it is a policy
decision worth scoping rather than inventing.
