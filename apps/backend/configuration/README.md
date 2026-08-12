# configuration

Checked-in runtime configuration, one file per section.

Every `*.yaml` in this directory is read and merged into a single object, in sorted
order, with [`local.yaml`](#localyaml) applied last. Top-level keys do not overlap between
section files, so the order is otherwise immaterial. Dropping a new file in is all it takes to have
it loaded — a capability returning from `reference/` brings its own section with it.

Defaults for every field live in `DEFAULT_CONFIG` in
[`src/initialization/configuration/defaults.ts`](../src/initialization/configuration/defaults.ts),
so an absent file or an absent key falls back rather than failing.

## Sections

| File | Covers | Read by the spine today |
| --- | --- | --- |
| `server.yaml` | `server`, `workerPool`, `queue` | `server` only |
| `logging.yaml` | `logging` | yes |
| `project.yaml` | `projectId`, `userId` | no |
| `intelligence.yaml` | model providers and routing | no |
| `formula.yaml` | evaluation limits | no |
| `structured-data.yaml` | limits | no |
| `rich-text.yaml` | limits | no |
| `context.yaml` | context manager | no |
| `document.yaml` | limits and behaviour | no |
| `retention.yaml` | revision retention | no |

Only `server` and `logging` are read by anything right now. The rest describe capabilities that live
in [`reference/`](../reference/README.md) and are kept so a returning capability finds its
configuration already written.

`workerPool` and `queue` describe the hand-written job scheduler, which also moved to `reference/`.
They are retained for the same reason.

## `local.yaml`

**Git-ignored. Real secrets belong here and nowhere else.**

It is merged over everything else and applied last, so it always wins. Only the values you want to
change need to appear:

```yaml
intelligence:
  providers:
    openrouter:
      apiKey: sk-or-...
```

Its absence is not an error — a fresh checkout runs on the section files alone.

`OPENROUTER_API_KEY` exported in the environment also works, but only while the resolved value is
still the placeholder in `intelligence.yaml`. A key set here therefore takes precedence over one in the
environment.

It is read straight from `process.env`. No `.env` file is loaded — the backend has no dotenv
dependency — so the variable has to be genuinely exported, the way a container or a systemd unit would
provide it.

## How this directory is found

Through the `#configuration/*` alias in `package.json` `imports`, resolved by
[`src/initialization/paths.ts`](../src/initialization/paths.ts) — never by walking up from a module's
own location. See [../README.md](../README.md) for why that rule exists.
