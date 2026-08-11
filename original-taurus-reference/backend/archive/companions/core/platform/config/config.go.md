# config.go

Application configuration schema: loads from YAML, overlays defaults. Defines
`Config`, all sub-types (Server, Storage, Documents, Jobs, Intelligence,
Knowledge, Connectors, Agents), and the `Load` / `Overlay` / `LocalPath` helpers.
See repo conventions (AGENTS.md).

## `Intelligence.Embedding` — pacing, not preference

`intelligence.embedding` (`max_batch_inputs`, `max_wait`, `backoff`) bounds how an
embedding batch reaches the provider. It sits under `intelligence` rather than
`knowledge` because it describes the *endpoint*: any caller embedding a large batch
meets the same per-request and per-minute limits, whatever it is embedding for.

`max_batch_inputs` is the load-bearing one. A large ingest has only bad shapes
without it — one request too large to accept, or one request per source, which is
what a per-minute rate limit exists to stop.

`max_wait` replaced a `max_attempts`, and the replacement is not cosmetic. Rate
limits are enforced over windows measured in minutes, so an attempt count bounds the
wait only as a side effect of the backoff curve: the four attempts that used to sit
here, at a doubling second, were **seven seconds** of patience against a
sixty-second window. A time budget states the intent directly, and `backoff` is
demoted to what it always should have been — the fallback for a provider that
refuses without saying for how long, since one that sends `Retry-After` is honoured
instead.

## The bounds that guard a cost, not a preference

Most fields here express a preference. A few express a ceiling, and it is worth
saying which:

- **`Knowledge.Cluster.MaxPool`** is the crossover between the exact and sparse
  clustering constructions. It still guards the exact path's allocation — the
  complete n×n matrix is n²·8 bytes *regardless of vector dimension*, 128 MB at
  4,000 and 20 GB at 50,000 — but a pool above it is clustered over the k-NN graph,
  never refused. There is no mechanism flag: the neighbors block carries only
  tuning (`K`, `Cells`, `PCADims`) and the local-repair bounds
  (`RepairMaxFraction`, `RepairMaxDrift`) — how much change a rebuild may absorb as
  a repair of the persisted index, and how far the pinned threshold may drift,
  before the level consolidates in full. The repair bounds read three ranges — 0
  default, negative disables.
- **`Connectors.MaxFileBytes`** bounds one synced file's content (default 1 MiB,
  matching the chat attachment bound). A file over it is skipped — and pruned if
  previously indexed — rather than failing the sync. It reads three ranges, not
  two: 0 takes the default, negative means unbounded, positive sets the bound, so
  "no limit" is something configuration can say deliberately while silence still
  gets the safe value.
- **`Connectors.Sync`** bounds the sync loop itself: `MaxAttempts` (3),
  `Backoff` (30s), `MaxBackoff` (15m), `DetectInterval` (2s). These are ceilings on
  *spend*, not preferences. Sync is reconciliation, so it has no memory of having
  tried; without a cap a connector whose provider is broken re-reads its source and
  re-embeds every window on every detect interval, indefinitely, at provider rates.
  Unlike `MaxFileBytes` there is no unbounded mode — unbounded retrying is the
  defect these values exist to remove, so no value asks for it.

## Code breakdown

### `Config` — one struct, mirroring the manifest

`Config` holds one field per top-level YAML key (`mode`, `server`, `logging`,
`storage`, `access`, `documents`, `jobs`, `intelligence`, `knowledge`,
`connectors`, `agents`), each a named sub-type. The correspondence is deliberate
and total: reading the manifest and reading this struct are the same activity, so a
new section is a new field here and nowhere else.

`Mode` selects the composition path (`prod` or `dev`) and also governs TLS — dev
generates a self-signed certificate when none is configured; prod refuses to start
without a real one.

### `Server`, `TLS`, `Logging`, `Storage`, `Access` — the process's own shape

Listen address and certificate paths; whether requests are logged and to which
directory (empty means standard error, which is the dev shape — production sets a
dir so logs are a shippable file rather than a stream out of a long-lived
process); the SQLite DSN; and the session TTL as a Go duration string.

### `Documents` — resource tuning and prompt resolution

`RebaseThreshold` (how many pending change sets fold into a new base) and
`HistoryLimit` (how many revision summaries survive a re-base; 0 keeps
everything). `Layout` carries integer typographic points copied into each *new*
document — copied, so a later configuration change cannot silently repaginate
existing content. `TrashRetention` is how long a trashed document lives before
purge.

`Prompt` configures prompt-block resolution: a `PromptCast` for each of the two
steps (plan and synthesis), retrieval bounds, and optional `PromptStep` template
overrides whose blank fields fall back to the built-in defaults — so a manifest
only has to name what it changes.

### `PromptCast` and `Cast` — semantic coordinates, and where they land

A `PromptCast` is four coordinates (purpose, strength, speed, cost) and carries no
provider or model. A `Cast` is one row of a cast table: the same four coordinates
plus the provider and model they resolve to, with an optional per-row `Effort` so a
cheap model can be told to think harder on one route.

The split is the point. Callers ask for a *kind* of model; only the table knows
which model that is today, and swapping one is a manifest edit rather than a code
change.

### `Jobs` — the durable queue's pacing

Worker count, poll interval, and how many attempts a job gets before it is marked
failed.

### `Intelligence`, `Provider`, `Casts` — the model backends

`Providers` is keyed by name (`openrouter`), each with an API key, an optional base
URL, and a `Timeout` bounding one provider HTTP call. The timeout is a deliberate
product constraint rather than only a safety valve: how fast a model answers is
part of whether it is usable here, so one that cannot respond inside the budget is
cut.

`Casts` groups the tables by endpoint kind (`reasoning`, `inference`, `embedding`),
because the same semantic cast resolves differently per kind.

An API key is a secret and is expected to arrive through the gitignored local
overlay, never the committed manifest.

### `Knowledge` — window, cluster, descent, retrieval

`Window` is the sentence-aware geometry in runes (~4 runes ≈ 1 token). `Cluster`
calibrates the level-relative threshold (`Percentile`, `Floor`) plus the crossover
and its sparse tuning, discussed above. `Retrieval.CharBudget` caps the total
region text one retrieval returns.

`Embedding` bounds how a batch reaches the provider; see the section above for why
`MaxWait` is a duration and not a count.

`Descent` (`Beam`, `Threshold`) *tunes* directed descent — it does not select it.
Retrieval is descent; the exact scan survives only as the test oracle
(`Knowledge.RetrieveExact`), and there is no audit mode. Both of those were config
flags once and were removed on the principle that mechanics do not carry switches
(records 0148–0149).

### `Agents` — deployment-frozen prompts, schemas, and bounds

The General persona template materialized lazily per project, the system
instruction and output schema per agent mode, the optional live-web retrieval
endpoint (empty endpoint means the web source is simply unavailable), and the chat
attachment bound. Blank prompts and schemas fall back to built-in defaults inside
`agent.Policy`, so the committed manifest only needs to set the persona identity.

### `Default` — every setting has a built-in value

`Default()` returns a complete, valid configuration. This is what makes a partial
or entirely absent manifest safe: the overlay model below has something to overlay
onto, so a missing key is never a zero value that happens to mean something.

### `Load` and `Overlay` — defaults, then overlay

`Load` starts from `Default()` and unmarshals the manifest over it, so a key the
file omits keeps its default. It returns the still-defaulted config *alongside* any
error, letting the caller decide whether a missing file is fatal (it is not, at the
default path; it is, at an explicitly requested one).

`Overlay` applies the same model to an already-loaded config, and treats a
non-existent file as success — which is what lets the local secrets manifest simply
be absent.

### `LocalPath` — where secrets live

Maps `etc/config.yaml` to `etc/config.local.yaml`. That sibling is gitignored and
overlaid on top of the committed manifest, so the template itself never carries a
key.
