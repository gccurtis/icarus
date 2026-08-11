# `logging.go`

The application's logging port. Capabilities depend on a narrow leveled
interface rather than on the standard logger, so reporting an operational
condition never carries a decision about where the line goes or how it renders —
the composition root supplies that.

The package exists alongside `platform/telemetry`, and the split is deliberate.
Telemetry carries **measurements**: typed events with fields a run is aggregated
over — tokens, durations, which model actually served a call. This carries
**narration**: conditions an operator needs told about that have no natural
aggregate, like a corpus tier that was skipped because its pool exceeded the
clustering bound. Rendering a measurement as a log line is telemetry's job; this
is for what was never a measurement.

## Code breakdown

### The `Logger` port

Three methods — `Infof`, `Warnf`, `Errorf`. Three levels because that is the
distinction that changes what a reader *does*: Info records that something worth
knowing happened, Warn records that the system degraded but continued, Error
records that something failed.

There is deliberately no `Fatalf`. Deciding to stop the process belongs to the
composition root; a capability that can call `log.Fatal` can kill the server from
inside a request, and no caller can defend against it.

### `New` and `standard`

`New` returns the default implementation, backed by `log.Printf`. `standard`
prefixes each line with its level (`info: `, `warn: `, `error: `) so a log read
as plain text still says which lines mattered.

### `Nop` and `OrNop`

`Nop` discards everything. It exists so a `Logger` is never nil.

The reasoning is worth keeping: a capability that guards every log call with a
nil check eventually forgets one, and the forgotten call panics on exactly the
degraded path the log was added to explain. So construction substitutes `Nop`
instead and call sites log unconditionally. `OrNop` is the single place that nil
check lives — constructors run their incoming `Logger` through it and store the
result.
