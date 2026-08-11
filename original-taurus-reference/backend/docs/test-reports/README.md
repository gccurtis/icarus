# Test reports

Measured results from live runs against real providers, and the documents that
explain what was being measured.

Only the suites that exercise a **reasoning model** appear here. Of the 40
dev-test suites, 25 make no model calls at all and have nothing to say about one.

Two of the remaining 15 — `knowledge` and `connectors` — make **only embedding
calls**. An embedding does not change with the reasoning model under test, so
their rows read identically for every model and can never discriminate between
them. They are a different kind of test and are not reported here. They still
run and they still cost money, so they stay in `run.sh`'s intelligence group:
that grouping is about spend, this directory is about comparison, and the two
questions have different answers.

That leaves 13 suites with a report.

Across all of them, [model-choice.md](model-choice.md) compares candidate models
by **cast** — the (purpose, strength, speed, cost) tuple the application actually
asks for. That is the document to read when the question is "which model should
we ship", because a model can win at one cast and lose at another.

## Layout

```
docs/test-reports/
  intelligence-suites/
    <suite>/
      0-suite.md   what the suite does, step by step, with every prompt it uses
      1.md         a measured report
      2.md         the next one
```

`0-suite.md` is written by hand and describes the suite as it stands: the fixtures,
each step in order, what each step asserts, which model calls it makes, and how to
read a failure back to a step. It is the document to read first — a report is a
column of numbers until you know what produced them.

The numbered reports are generated. Each covers one suite across every model that
ran it, because that is the comparison worth making: the same steps, the same
assertions, different models.

## Generating a report

Run the suites, capturing the output:

```
./dev-test/run.sh intelligence 2>&1 | tee /tmp/run-<model>.log
```

Then, for each suite, build the next numbered report from those logs:

```
./dev-test/suite-report.sh <suite> <index> /tmp/run-*.log > \
  docs/test-reports/intelligence-suites/<suite>/<index>.md
```

The generator reads the per-call telemetry each run emits at the intelligence
boundary, so a report can only be as complete as the log it was built from. It
never estimates.

## What the numbers are

Every figure is measured. Token counts are the provider's own per-call usage, not
an approximation from text length. Cost is those counts at each model's published
rate, and each model's report states the rates it was priced at.

The main table's key column is the **call type**, with absolute and share columns
paired:

| Call type | What its volume means |
| --- | --- |
| Input | prompt tokens |
| Output | completion tokens, including any reasoning tokens |
| Model wait | no volume — carries the time spent waiting on the provider |
| Tool calls | the number of tool calls, and the time our own handlers took |

Two things are worth knowing before reading a table:

**Input and output cannot be timed apart.** The provider returns one latency per
call, not a breakdown of reading versus generating, so those cells say "not
separable" and a Model wait row carries the whole of it. Splitting it would mean
inventing a ratio.

**Reasoning tokens are not a third category.** They are a share of the completion
count, billed at the completion rate, so they are reported inside the Output row
rather than priced separately.

## A caution about attributing failures

A failed check is not automatically a model-quality failure. More than one
apparent model failure in these suites turned out to be a gap in our own prompt —
a rule the model was never given, being enforced anyway. Before recording a
failure as a model's, read the suite's `0-suite.md` and the prompt it names, and
check that the behaviour being asserted was actually asked for.
