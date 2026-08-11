# dev-test

End-to-end tests that exercise the running platform the way a user would: start
the service, make real HTTP calls with `curl`, and confirm the responses. This is
the central way we check that Taurus Omega actually works — not just that units
compile and pass, but that you can make a call and get the right thing back.

## Run everything

```bash
./dev-test/run.sh
```

This runs every suite and exits non-zero if any check fails. Each suite starts
its own service instance (in dev mode, over HTTPS with a per-run self-signed
certificate, against an isolated SQLite database) and shuts it down when done.
There is no seeded user — suites register the accounts they need via the API, the
same way [`scripts/dev-setup.sh`](../scripts/dev-setup.sh) sets up a local dev
account by hand.

## Free vs. intelligence-backed suites

Some suites make **real model calls** and cost money (`intelligence`,
`knowledge`, `prompt`); the rest run entirely offline. Run one group or the
other:

```bash
./dev-test/run.sh free          # only the offline suites — no provider calls, no cost
./dev-test/run.sh intelligence  # only the model-backed suites
```

The intelligence-backed suites each **report their own estimated cost**, and the
runner prints the **total** across them. They only make calls when an OpenRouter
key is present in `etc/config.local.yaml`; without one they skip. So `free` is
always safe to run, and `intelligence` is where any spend happens — visibly.

## Run one suite

```bash
./dev-test/core-http/run.sh
```

Override the listen address if the default port is busy:

```bash
ADDR=":9099" ./dev-test/core-http/run.sh
```

## Layout

Each suite is a directory containing two paired files:

| File | Purpose |
|------|---------|
| `run.sh` | Automated: starts the service, makes the calls, logs and asserts the responses. |
| `manual.md` | The same test written as a human walkthrough — the exact commands to run by hand and the responses to expect. |

Shared machinery lives in [`lib.sh`](lib.sh): building and starting the service,
making logged requests (`request`), and asserting results (`expect_status`,
`expect_body`).

Suites:

- [`core-http/`](core-http/) — the public HTTP surface: the health check, and
  that gated endpoints reject anonymous callers.
- [`gateway/`](gateway/) — the login gateway: register / login / logout, and how
  a session opens and closes access to the gated endpoints.
- [`projects/`](projects/) — project management and selection: list / create /
  select / delete (owner only) / leave (self), and the membership checks.
- [`links/`](links/) — role-carrying share links: an owner mints read/edit links,
  others join (or upgrade) by token, upgrade-only, with the visibility master switch.
- [`documents/`](documents/) — documents, the first project-scoped resource:
  create / list / get / delete within a selected project (a document is a name
  plus rows of typed blocks).
- [`resources/`](resources/) — the unified canonical Resource lifecycle and
  semantic Activity feed, including persistence through SQLite-backed routes.
- [`names/`](names/) — the Formula name manager: persisted scalars, typed tables,
  functions, constructive table mutation, and evaluation against a Project
  namespace.
- [`changesets/`](changesets/) — editing documents: appending layout/content
  operations, undo/redo, and reading back the resolved document.
- [`jobs/`](jobs/) — background jobs: re-basing a document is async, so the request
  enqueues a job (202) and a worker runs it off the request path; poll to done.
- [`intelligence/`](intelligence/) — the intelligence endpoints (reason / infer /
  embed): a request resolves a semantic cast to a model. Makes a live provider call
  when a key is present, otherwise exercises the unconfigured-provider path.
- [`knowledge/`](knowledge/) — the knowledge lattice `/dev` endpoints: adding a
  document embeds and clusters it, and retrieval descends the lattice to cited
  spans. Requires a real key (skips without one), since it asserts retrieval
  *quality* against live embeddings.
- [`prompt/`](prompt/) — the prompt block: a source is indexed into the lattice,
  a prompt block is resolved (plan → retrieve → synthesize) into a grounded
  answer with evidence, and refresh keeps it stable. Requires a real key (skips
  without one).

## Adding a suite

1. Create a directory, e.g. `dev-test/<feature>/`.
2. Add a `run.sh` that `source ../lib.sh`, calls `start_service`, makes requests
   with `request` and assertions with `expect_status` / `expect_body`, sets an
   `EXIT` trap to `stop_service`, and ends with `finish`.
3. Add a `manual.md` walking through the same steps by hand.

`dev-test/run.sh` picks up the new suite automatically.
