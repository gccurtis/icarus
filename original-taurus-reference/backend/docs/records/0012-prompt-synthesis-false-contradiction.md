# 0012 — Synthesis prompt: killing the false-contradiction on refresh

A repeatable live test of prompt-block refresh exposed a real bug. When a source
fact changed (Eiffel Tower "300 meters" → "450 meters") and the block was
refreshed, the synthesis model (gpt-4o-mini) intermittently returned
`contradiction` — treating the **prior answer** (300) as a competing fact against
the new **evidence** (450). Measured with a change-and-refresh loop, it misfired
on roughly **half** of refreshes. This is the failure the previous prompt wording
was already trying to prevent; it wasn't strong enough for a weak model.

Root cause (confirmed from the stored block): the model received one evidence
item (450) plus the prior answer (300) and manufactured a contradiction across
those two channels — narrating "the previous response stated 300 meters." So the
prior-answer channel wasn't being reliably excluded from contradiction judgement.
It is not a model-tier problem to hide behind a stronger model — it is a prompt
clarity problem, so the fix makes the *cheap* model reliable.

## core/capability/document/prompt.go

### Rewrote the synthesis prompt (system-heavy, with a worked example)

```go
defaultSynthesisSystem = `... STATUS — judged from the EVIDENCE ALONE (decide as if no PRIOR ANSWER were present) ...
A contradiction can ONLY ever be a disagreement between EVIDENCE items ... With only one EVIDENCE item on the point, "contradiction" is impossible — use "ok".
... Treat the PRIOR ANSWER as an earlier draft ... NEVER mention the PRIOR ANSWER ... never compare ...
EXAMPLE ...
- EVIDENCE: "The tower is 450 meters tall." PRIOR ANSWER: "The tower is 300 meters tall."
- Correct -> status "ok" ...  Wrong -> status "contradiction" ...`

defaultSynthesisUser = `CURRENT PROMPT: ...
PRIOR PROMPT (wording/format sample only — not evidence): ...
PRIOR ANSWER (wording/format sample only — not evidence, facts may be stale): ...
EVIDENCE:
{{range .Evidence}}- {{.Text}}
{{else}}(none)
{{end}}`
```

**What it does / why:** three reinforcing moves close the trap — (1) status is
judged from the EVIDENCE alone, and a single evidence item makes `contradiction`
impossible; (2) the prior answer is reframed as a *draft to edit*, never a source
to compare, and the model is forbidden from mentioning it or narrating a change
(that narration was the visible tell); (3) a concrete worked example of the exact
trap, since examples land where abstract rules slip on a weak model. All rules
moved into the **system** message (the user message is now just labelled data),
per the design discussion. Evidence is now rendered as raw-text bullets (no source
ids) — provenance is tracked on the block, not asked of the model, keeping the
answer content clean.

**Verified:** a repeated change-and-refresh loop propagated the change **16/16**
with no false contradiction on gpt-4o-mini (was ~50% failure), while a genuine
evidence-vs-evidence conflict still yields `contradiction` and an unaddressed
prompt still yields `insufficient`.

## dev-test/prompt/run.sh

### Repeatable stability loop + raw-answer assertions

**What it does:** Part 1 now changes only the height in the source and refreshes
several times in a loop, asserting each time that the new value propagates, the
unchanged location prose is preserved, and the status is not a false
`contradiction`. Assertions read the block's **answer text** (`lastOutput`), not
the whole document JSON — the JSON also carries the evidence spans, so matching it
would test the source, not the answer. **Why:** the failure is intermittent, so a
single pass proved nothing; the loop shakes it out, and asserting on raw answer
text is what makes the check meaningful.

## dev-test/lib.sh

### Fixed a `set -e` trap in the usage helpers

```sh
# was:  [[ -n "${COST_FILE:-}" ]] && printf '%s\n' "$cost" >> "$COST_FILE"
# now:  if [[ -n "${COST_FILE:-}" ]]; then printf '%s\n' "$cost" >> "$COST_FILE"; fi
```

**What it does / why:** `track_usage` and `usage_summary` each ended in a
`[[ ]] && cmd` whose test is false on a direct run (no `COST_FILE`), returning
non-zero as the function's last statement and tripping `set -e` — killing the
suite *before* `finish` printed its summary, so a fully-passing run exited 1 with
no visible failure. Rewritten as `if` blocks so the functions return 0.

## Docs

Updated [prompt-resolution.md](../architecture/workflows/prompt-resolution.md)
(new templates, and the "why the synthesis prompt is worded this way" finding with
the three moves and the 16/16 result) and the
[prompt.go.md](../../core/capability/document/prompt.go.md) sidecar to match.
