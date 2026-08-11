# End-to-end live-document demo (Slice I) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One terminal dev-test that runs the whole demo end to end and proves every acceptance criterion of the design: a mostly-prompt-block document, fed by connector-backed context variables, that refreshes when a context variable is swapped and when the underlying folder changes (system-attributed), plus a quarterback edit that authors and resolves new prompt blocks. It surfaces its token cost.

**Architecture:** A live `dev-test/live-document/run.sh` suite composing Slices A–H against a running server. It is **model-backed** (prompt resolution), so it **skips (exit 0) when no OpenRouter key is present** and, when it runs, sums and prints token usage via `track_usage`/`usage_summary` from `dev-test/lib.sh`. This slice adds no production code — it is the integration proof and the demo script.

**Tech Stack:** Bash + `curl` + `jq` over the running core, using `dev-test/lib.sh` helpers (`start_service`/`stop_service`, `request`, `expect_status`, `json_field`, `pass`/`fail`/`FAILURES`, `track_usage`, `usage_summary`, `finish`).

## Global Constraints

- **Depends on all of A–H.** Sequence last.
- Live model calls: read the key from the gitignored `etc/config.local.yaml`; **skip on no key** so CI stays green without secrets. Keep inputs tiny (short folder files, few blocks, cheap casts) so cost is negligible.
- **Surface the cost:** accumulate every resolve/response `usage` and print the total + estimated dollar cost at the end.
- No new `*.go`; this is a dev-test + its `manual.md`.
- One `docs/records/NNNN-*.md`.

---

## File structure

- `dev-test/live-document/run.sh` (create, executable) — the end-to-end suite.
- `dev-test/live-document/manual.md` (create) — the curl walkthrough with expected responses (this doubles as the demo runbook).
- `docs/records/NNNN-live-document-demo.md` (create).

---

## Task I1: Scaffold + setup (beats 1–2)

**Files:** `dev-test/live-document/run.sh`

- [ ] **Step 1: Write the skeleton**

```bash
#!/usr/bin/env bash
# Live-document demo: a mostly-prompt-block document fed by connector-backed
# context variables that refreshes on context swap and on external folder change
# (system-attributed), plus a quarterback edit that authors + resolves prompt
# blocks. Model-backed: SKIPS when no provider key is configured.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ../lib.sh

require_model_key_or_skip   # helper from lib.sh: exit 0 when no key (match the actual gate used by other live suites)

trap stop_service EXIT
start_service

# Fast auto-sync so the auto-refresh wait is short.
set_config connectors.detect_interval 1s   # match how other suites override config, or write etc/config.local overlay

info "Register + login + project"
request POST /auth/register "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\",\"name\":\"Ada\"}"; expect_status 201
request POST /auth/login "{\"email\":\"$DEV_EMAIL\",\"password\":\"$DEV_PASSWORD\"}"; expect_status 200
request POST /projects '{"name":"Live Document"}'; expect_status 201
PROJECT_ID="$(json_field id)"
request POST /session/project "{\"projectId\":\"$PROJECT_ID\"}"; expect_status 200
```

- [ ] **Step 2: Two connectors with distinguishable content**

```bash
DIR_A="$(mktemp -d)"; DIR_B="$(mktemp -d)"
printf 'Q3 revenue was 4.2M, up 18%% on new enterprise accounts.\n' > "$DIR_A/notes.txt"
printf 'The company mascot is a purple otter named Waffles.\n'        > "$DIR_B/notes.txt"

request POST /connectors '{"name":"Finance","subkind":"local-folder"}'; expect_status 201; CONN_A="$(json_field id)"
request PUT "/connectors/$CONN_A/config" "{\"path\":\"$DIR_A\"}"; expect_status 200
request POST "/connectors/$CONN_A/sync"; expect_status 200

request POST /connectors '{"name":"Trivia","subkind":"local-folder"}'; expect_status 201; CONN_B="$(json_field id)"
request PUT "/connectors/$CONN_B/config" "{\"path\":\"$DIR_B\"}"; expect_status 200
request POST "/connectors/$CONN_B/sync"; expect_status 200
```

- [ ] **Step 3: Run partial** (`./dev-test/live-document/run.sh` should reach here green when a key is set, skip otherwise).

---

## Task I2: Live document with a scoped prompt block (beat 3, criterion 3 baseline)

- [ ] **Step 1:** Create a document with a hard-coded header block + a template declaring a variable `finance` bound to connector A, and a prompt block including `finance`:

```bash
request POST /documents "{\"name\":\"Board update\",\"template\":{\"variables\":[
  {\"name\":\"finance\",\"boundResource\":{\"kind\":\"connector\",\"id\":\"$CONN_A\"}},
  {\"name\":\"trivia\",\"boundResource\":{\"kind\":\"connector\",\"id\":\"$CONN_B\"}}
]},\"rows\":[
  {\"blocks\":[{\"kind\":\"text\",\"subKind\":\"heading_1\",\"atoms\":[{\"kind\":\"text\",\"text\":\"Board update\"}]}]},
  {\"blocks\":[{\"id\":\"pb1\",\"kind\":\"prompt\",\"context\":{\"include\":[\"finance\"]},\"data\":{\"instruction\":\"State this quarter's revenue and the driver, from the sources.\"}}]}
]}"; expect_status 201
DOC_ID="$(json_field id)"
```

(Confirm the create endpoint accepts `template` + block `context` + prompt `data` inline; if create does not accept `context`/`template` inline, set them via `POST /documents/:id/changes` with `set_context_variable` (resource binding, Slice D) and `set_block_context` (Slice E) right after create.)

- [ ] **Step 2:** Resolve `pb1` and wait for the job:

```bash
request POST "/documents/$DOC_ID/blocks/pb1/resolve" '{"mode":"reload"}'; expect_status 202
JOB="$(json_field jobId)"; wait_job "$JOB"   # helper: poll /jobs/:id to done
track_usage_from "/documents/$DOC_ID"        # accumulate the block's usage for the summary
```

- [ ] **Step 3:** Assert the block text mentions the A-source fact (revenue/4.2M) and **not** the B-source fact (otter/Waffles):

```bash
BODY="$(request GET "/documents/$DOC_ID" && printf '%s' "$LAST_BODY")"
echo "$BODY" | grep -qi "4.2M\|revenue" && pass "A content present" || { fail "A content missing"; FAILURES=$((FAILURES+1)); }
echo "$BODY" | grep -qi "otter\|Waffles" && { fail "B content leaked into A-scoped block"; FAILURES=$((FAILURES+1)); } || pass "B content correctly absent"
```

---

## Task I3: Swap context → output changes (beat 3, criterion 4)

- [ ] **Step 1:** `set_block_context` to swap `pb1` from `finance` to `trivia` (Slice E op), which clears `ResolvedAt`:

```bash
request POST "/documents/$DOC_ID/changes" "{\"submissionId\":\"s-swap\",\"expectedRevision\":<rev>,\"operations\":[
  {\"op\":\"set_block_context\",\"blockId\":\"pb1\",\"blockContext\":{\"include\":[\"trivia\"]}}]}"; expect_status 200
```

(Read the current revision from `GET /documents/:id` for `expectedRevision`.)

- [ ] **Step 2:** Resolve `refresh` (must NOT skip, because the selection change cleared `ResolvedAt`); wait; assert the block now reflects B (otter/Waffles) and not A.
- [ ] **Step 3:** `pass`/`fail` on the content flip.

---

## Task I4: External change → auto-refresh, system-attributed (criterion 3)

- [ ] **Step 1:** Swap `pb1` back to `finance` and resolve (baseline A content).
- [ ] **Step 2:** Change connector A's folder **without any document/API call**:

```bash
printf 'Q3 revenue was 5.0M, up 42%% after the Meridian deal closed.\n' > "$DIR_A/notes.txt"
```

- [ ] **Step 3:** Wait (bounded, e.g. up to ~15s) for the detector to re-sync **and** the cascade to re-resolve `pb1` — poll `GET /documents/:id` until the block text mentions `5.0M`/`Meridian`. `pass` when it updates on its own; `fail` on timeout.
- [ ] **Step 4:** `GET /activity` and assert a recent edit on `DOC_ID` is attributed to the **system** actor (kind `system`), proving the refresh is logged and accountable.

---

## Task I5: Exclusion is exact (criterion 5)

- [ ] **Step 1:** Add a variable `everything`... — since there is no project-wide "everything" primitive, model it by including both `finance` and `trivia` and **excluding** `trivia`:

```bash
# set pb1 context to include finance+trivia but exclude trivia
{"op":"set_block_context","blockId":"pb1","blockContext":{"include":["finance","trivia"],"exclude":["trivia"]}}
```

- [ ] **Step 2:** Resolve; assert the output contains A content and **never** B content — the exclude removed B even though it was included. `pass`/`fail`.

---

## Task I6: Quarterback splits a section into live prompt blocks (beat 5, criterion 6)

- [ ] **Step 1:** Run an Action task instructing the agent to split `pb1` into two prompt blocks (an overview and a detail), keep the `finance` context, and resolve both:

```bash
request POST /agent/actions "{\"objective\":\"In document $DOC_ID, split the revenue prompt block into two prompt blocks — one overview, one detail — both using the finance context, and resolve them.\",\"context\":[],\"persona\":{\"id\":\"general\",\"version\":1}}"; expect_status 201
TASK="$(json_field id)"; wait_task "$TASK"   # helper: poll /agent/tasks/:id to a terminal state
```

- [ ] **Step 2:** Assert the document now has two prompt blocks (not one), each with an instruction and `finance` context, and each with resolved (non-empty) text. Assert the original single block id is gone. `pass`/`fail`.
- [ ] **Step 3:** Accumulate agent task usage into the run total.

---

## Task I7: Cost summary, full-suite, record

- [ ] **Step 1:** End with `usage_summary` (prints total tokens + estimated dollar cost) then `finish`.
- [ ] **Step 2:** Run it with a key: `./dev-test/live-document/run.sh` — all `pass`, `FAILURES=0`, cost printed. Run without a key: it **skips** (exit 0).
- [ ] **Step 3:** `go vet ./... && ./dev-test/run.sh` — the whole suite green (this one skips without a key).
- [ ] **Step 4:** Write `dev-test/live-document/manual.md` — the same flow as copy-pasteable `curl`, with expected responses; it is the human demo runbook.
- [ ] **Step 5:** Create `docs/records/NNNN-live-document-demo.md`: the demo, which criteria each beat proves, and that it is the integration gate over Slices A–H.
- [ ] **Step 6:** Commit `git commit -m "Add end-to-end live-document demo dev-test"`

---

## Self-review

- **Spec coverage:** exercises all seven acceptance criteria — connector create (1), auto re-sync (2), external-change auto-refresh + system attribution (3), context swap → output change (4), exact scoping incl. exclude (5), agent split into live prompt blocks (6), token-cost-surfaced dev-test with green checks (7).
- **Honesty:** model-backed, so it skips without a key rather than faking success; asserts on **scope membership** (which source's fact appears), not model wording, so it verifies the plumbing, not the model's phrasing.
- **No placeholders:** the flow is concrete; a few helper names (`require_model_key_or_skip`, `wait_job`, `wait_task`, `track_usage_from`, `set_config`) must be matched to `dev-test/lib.sh`'s actual helpers (or added there) — flagged. Inline `template`/`context` on document create must be confirmed against the create handler; the fallback (set via `/changes`) is specified.
- **Dependency:** last in the sequence; requires A–H merged.
