# `config.go`

Loading the configuration manifest, and translating what it says into the types
the capabilities actually take.

Two related jobs. The first is resolution: find the manifest, load it, and
overlay the local secrets file. The second is translation — a config struct and
a capability's options struct describe the same thing in different vocabularies,
and something has to map between them. Both were inline in `Run`, and both are
noise there: `Run` should read as a boot sequence, not as a translation layer.

## Code breakdown

### `promptCast` — a configured cast reference

One line of translation. A `config.PromptCast` and an `intelligence.Cast` are
the same four semantic coordinates — purpose, strength, speed, cost — and the
cast deliberately names *no model*. Which model serves those coordinates is
resolved through the routing table, so retargeting a deployment is a routing
change, never an edit to the code that asks for reasoning.

### `castRoutes` — configured casts to routes

Maps a `[]config.Cast` onto `[]intelligence.Route`, splitting each entry into the
cast (the four coordinates) and its destination (`Provider` + `Model`, plus the
optional `Effort` that pins how hard the model thinks on that route). This is
the other half of the indirection above: `promptCast` produces the request,
`castRoutes` builds the table that answers it. `buildIntelligence` calls this
once per endpoint kind.

Configuration order is preserved, which is what makes a repeated cast tuple an
ordered fallback chain — the first row is the primary, later ones are backups.

### `loadConfig` — resolve, load, overlay

The path comes from `TAURUS_OMEGA_CONFIG`, falling back to `defaultConfigPath`
(`etc/config.yaml`, declared in `wiring.go`). Whether the path was *explicit* is
remembered, because it decides how a missing file is treated:

```go
if !explicit && errors.Is(err, os.ErrNotExist) {
	log.Printf("config: %s not found, using built-in defaults", path)
	return config.Default()
}
log.Fatalf("config: %v", err)
```

Missing at the default path is fine — a fresh clone boots on built-in defaults
with no setup. Missing at a path someone explicitly asked for is fatal, because
silently ignoring a requested manifest would run a cell on defaults while its
operator believed otherwise. A parse error is fatal either way.

**The local overlay** is where secrets live. If a sibling `config.local.yaml`
exists (gitignored) it is layered on top:

```go
localPath := config.LocalPath(path)
if _, statErr := os.Stat(localPath); statErr == nil { ... }
```

This is what keeps provider API keys out of the committed template — the
repository ships a manifest with no key in it, and the key is added by a file
git never sees. A missing local file is simply "no overrides", which is why the
`os.Stat` guard is a plain existence check rather than an error path. Both the
base and the overlay log the path they loaded, so a surprising runtime setting
can be traced to a file.

### `parseDurationOrZero` — lenient by design

Returns zero for an empty string *and* for an unparseable one. It is the only
lenient parser in the boot path — `access.session_ttl` and `jobs.poll_interval`
are parsed in `Run` with `time.ParseDuration` and a fatal on error — and the
asymmetry is intentional. It serves `documents.trash_retention`, where zero
means "no retention configured, do not purge". A typo there disables a
background maintenance sweep; a typo in a session TTL or a poll interval would
break the running system, so those must not be guessed at.

### `configuredAgentPolicy` — the frozen policy

Assembles the `agent.Policy` that Ask, Plan and Action all run under: four
prompts and four JSON schemas, lifted from config into `agent.Prompts` and
`agent.Schemas` (schemas as `json.RawMessage`, passed through unparsed).

Empty entries are *not* filled in here — they fall through to the built-in
defaults inside `agent.Policy.effective()`. So the policy is a sparse override
set: configure the one prompt you want to change and the rest stay canonical.
The policy is built once in `Run` and shared by both engines, which is what
makes it "frozen" — no request path can alter the prompts a run executes under.
