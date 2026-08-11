# `wiring.go`

The composition root. This file is the boot DAG and the process lifecycle, and
nothing else.

`main` is a thin shell over `Run`. Everything the process needs is created here,
in one function, in dependency order — which makes the order itself readable:
you can see that documents exist before agent workflows, and that the reference
graph is built after the document service it reads from.

What used to live alongside it — the cross-capability adapters, config
translation, TLS resolution — now sits in sibling files named for the boundary
each one bridges (`document_prompt.go`, `reference_document.go`,
`chat_engine.go`, `config.go`, `tls.go`, and the rest). That separation is the
point: a capability never imports another capability, so every seam between two
of them is a small private adapter, and those adapters are *composition*, not
*boot*. Keeping them out of this file leaves `Run` reading as a sequence of
decisions rather than a mix of decisions and translations.

## Code breakdown

### Package doc — what a composition root is responsible for

Two responsibilities are stated up front: create the application's initial
objects (including the access objects transport enforces), and own the process
lifecycle. It also records the standing rule that the core **always serves
HTTPS** — dev generates a self-signed pair, prod refuses to start without a real
certificate. `tls.go` implements that; the rule is documented here because it is
a property of how the process boots.

### Boot constants

`defaultConfigPath` (`etc/config.yaml`) is where the manifest lives when
`TAURUS_OMEGA_CONFIG` says nothing. `defaultDevCert` / `defaultDevKey` are the
`var/` paths dev writes a self-signed certificate to. They are the process's
"where things live by default" and stay with the boot path, though the code that
consumes them lives in `config.go` and `tls.go`.

### `Run` — configuration and the fatal checks

The first stretch is deliberately unforgiving, because everything after it
assumes a coherent configuration.

1. `loadConfig()` resolves the manifest and its local overlay.
2. **Logging is redirected immediately after** — a file under `logging.dir`, or
   stderr when empty — so every line from the config load onward is captured.
   This is the first thing done after the config precisely because it is the
   earliest point at which the destination is known.
3. The mode is validated against prod/dev. An unrecognized mode is fatal here,
   which is why `resolveTLS` needs no default case.
4. `resolveTLS(cfg)` settles the certificate paths.
5. `access.session_ttl` and `jobs.poll_interval` are parsed with a fatal on
   error. Boot is the right place to reject a malformed duration; discovering it
   at the first request is not.

### One store, many capabilities

```go
store, err := sqlite.Open(cfg.Storage.DSN)
```

A single durable SQLite store backs every capability — users, sessions,
projects, memberships, documents, references, comments, files, connectors,
resources, contexts, tasks and the job queue. That is the single most
consequential shape in this file: capabilities are independent in code but share
one database, so everything survives a restart together and nothing needs
cross-store coordination. The `defer store.Close()` sits immediately after.

### The construction order

The rest of `Run` builds services in dependency order, with adapters supplied
from the sibling files. The order encodes real constraints:

- **Queue before anything that enqueues.** `job.NewQueue` comes early because
  tasks, documents and workflows all take an `Enqueuer`.
- **Intelligence before knowledge.** The lattice embeds through
  `knowledgeEmbedder`, bound to one fixed general cast.
- **Personas and tasks before documents.** Documents take a prompt model, a
  retriever and a persona resolver.
- **Documents and references are circular**, and the cycle is broken with a
  late-bound indexer created before documents and back-patched after references:

  ```go
  refIndexer := &lazyReferenceIndexer{}
  docs := document.New(store, document.Options{ReferenceIndexer: refIndexer, ...})
  // ...
  refIndexer.refs = references
  ```

- **Resources before agent workflows**, so the workflows' document tools can be
  given `documentAuthorizer` and honour exactly the per-resource access the HTTP
  routes do.
- **Contexts after both**, wired to the catalog and connector-file adapters, and
  then back into documents via `UseScopeResolver` / `UseScopeReferences`.
- **Ask and Workflows before chats**, since `chatEngine` drives both.

Optional pieces degrade rather than block: the live-web retriever is built only
when `agents.web.endpoint` is set, and stays `nil` otherwise, which simply makes
the web source unavailable.

### The composition root is where a `logging.Logger` is chosen

Capabilities depend on the `logging.Logger` port, never on the standard logger,
so this is the only place that decides what one actually is. `knowledge.Options`
takes `Logger: logging.New()` and `connectors.UseLogger(logging.New())` supplies
the same. A capability constructed without one gets a `Nop` rather than a nil,
so nothing has to guard a log call.

This is the same inversion the `telemetry.Recorder` adapters use one section
below, and for the same reason: a capability reports *that* something happened;
where the report goes is a deployment decision and belongs here.

### The corpus rebuild is registered like any other background job

`knowledge.New` receives the job `queue` as its `Enqueuer`, and
`knowledge.JobTypeRebuildCorpus` is registered against the shared registry beside
`document.JobTypeRebase` and `agent.JobTypeRun`.

That is the whole of what makes the lattice's write path fast: a write drops the
corpus tier and schedules its rebuild here, instead of clustering the project's
entire frontier inside its own write transaction. It reuses the existing durable
queue rather than growing a second scheduler, which also means a rebuild that
fails is retried with backoff like anything else.

The `knowledge.cluster.neighbors` block passes through to `knowledge.Options`
the same way the rest of the clustering calibration does — the composition root
forwards, it does not decide. Everything in it is a number: the k-NN tuning (`k`,
`cells`, `pca_dims`) and the repair bounds (`repair_max_fraction`,
`repair_max_drift`). The mechanics carry no flags at all: the crossover and the
presence of a stored index decide which construction runs, and retrieval is
directed descent unconditionally — the descent block passes only its beam and
threshold tuning through.

### The connector's bounds are forwarded here too

`connectors.UseMaxFileBytes` and `connectors.UseSyncRetry` take the
`connectors` config section, the same forward-don't-decide way.

The retry bound is the one worth naming. Connector sync is reconciliation — the
decision to sync comes from comparing the source's fingerprint to the stored one,
not from a queue — so it has no memory of having tried. Without a cap, a connector
whose provider is broken re-reads its source and re-embeds every window on every
detector tick, indefinitely, at provider rates. The three numbers
(`max_attempts`, `backoff`, `max_backoff`) are what bound that, and the detector's
own interval (`detect_interval`) is passed to `runConnectorDetector` for the same
reason: it is how often that comparison happens.

### Chat attachments cross three capabilities, so the wiring joins them here

Two adapters bind chat attachments to the rest of the system, and both live in
`attachment_lattice.go` because the chat capability imports neither knowledge nor
file:

```go
chats.UseAttachmentIndexer(attachmentLatticeWriter{know: know, files: files})
// ...
Attachments: chatAttachmentLister{attachments: store, know: know},
```

The first admits an uploaded file's content to the lattice, so a turn retrieves
and cites an attachment through the same path as any document. The second lets an
Ask enumerate a conversation's attachments and report which are readable.

Note that the *lister* is passed to `agent.New` while the *indexer* is set on
`chats`. They are two directions of the same relationship — one writes attachment
content into Knowledge, the other reads back what made it — and they are supplied
to different services because the writing happens at upload time and the reading
happens during a turn. Both close over the same `know`, which is what keeps the
two consistent: readability is decided by asking the lattice, never by
re-deriving the indexing rules.

`chatEngine` no longer takes the attachment store or the file capability. It once
inlined attachment bytes into each prompt; that content was uncitable, so grounded
answers resting on it were rejected. Admitting the content to Knowledge replaced
that path entirely.

### Background work, all bound to one context

The job pool, the stuck-task reaper, the trash purge and the connector change
detector are all started under a single `jobCtx`:

```go
jobCtx, jobCancel := context.WithCancel(context.Background())
```

One cancel stops all of them. That is what makes shutdown a two-line affair
instead of a fan-out of individual stop channels, and it guarantees no
background goroutine outlives the store it writes to.

### The server, and the shutdown sequence

`transport.New` receives every service — this is the one call that hands the
whole application to the HTTP layer — plus the private adapters (`resourceGenerator`)
and the handful of config values transport reads directly.

The listener starts in a goroutine so `Run` can block on `SIGINT`/`SIGTERM`.
The shutdown order is the interesting part and it is the reverse of the
dependency order:

1. `e.Shutdown(ctx)` with a 10-second window, draining in-flight requests.
2. **Then** `jobCancel()` and `pool.Wait()`.

Stopping the workers first would abandon jobs that requests had just enqueued.
Draining the listener first means nothing new arrives, and the in-flight jobs get
to finish before the deferred `store.Close()` and `sessions.Stop()` run.

### Agent tool limits

Both agent wirings (Ask/Plan/Action and the chat engine) pass the same envelope:
`MaxRounds: 64, MaxCallsPerRound: 8, MaxCalls: 256, MaxTotalTokens: 512 * 1024`.

The numbers are sized for **document authoring**, not for a toy loop. An agent
writing a structured document appends roughly one block per round, so the
previous 16-round envelope covered a title, three sections and little else — a
live run asking for a 400-word story exhausted it and the task failed outright.
These sit at the hard ceiling in `intelligence.ToolLimits`; a request may pass
lower values, but nothing can raise them.

### Prompt-block resolutions are attributed to their block

`document.New` receives `Attributor: intelligence.WithSubject`. That one line is
what lets a resolution's plan and synthesis calls be charged to
`document:<id>#<block>` in the telemetry log, while the document capability keeps
importing neither intelligence nor telemetry — it holds a function, not a
dependency.

The agent capability sets its own attribution directly (`task:<id>` for a durable
run, `chat:<id>` or `ask:<project>` for an inline Ask), because it already
imports intelligence and needs no port to do it.

### Document retention comes from configuration, and defaults to keeping everything

Alongside the attributor, `document.New` receives `RebaseThreshold` and
`HistoryLimit` straight from the manifest. The threshold decides when a
document's change sets are folded into a new base; the limit caps how many
already-folded change sets are then retained, and the jobs system does the
pruning.

`history_limit` ships as `0`, which means keep all of it. That is the safe
default for a system whose history is a user-visible feature: losing revisions is
not recoverable, and a deployment that wants bounded storage can say so
explicitly.

### Whole-source reads leave by the door content came in

`know.UseSourceReader(sourceOriginReader{...})` is wired after every origin exists,
because it dispatches across all three of them.

It is the mirror of the writer adapters: content enters the lattice through
`connectorLatticeWriter` and `attachmentLatticeWriter`, and whole-source reads go back
out to the capability that owns the origin — never to a second copy inside the
lattice. Knowledge imports none of those capabilities; the composition lives here, for
the same reason the writers do.

`FlattenDocument` is also passed to the transport options, so the dev handler that
admits a document and the reader that reads one back share one definition of what a
document's text is.
