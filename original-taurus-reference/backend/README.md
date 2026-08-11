# Taurus Omega

A greenfield build of the Taurus product: a knowledge-aware workspace for
documents, workbooks, decks, boards, chats, files, and agent-assisted work.

This repository is being built **incrementally and by hand**, one small, working
piece at a time. It starts clean; code is added as it is actually built and
proven, not scaffolded up front.

## Run & integrate

To stand up the backend and drive it over HTTP — from a front-end cockpit,
harness, or agent — see the [backend guide](docs/backend-guide.md): how to run
the core, configure it, and call every endpoint, with a copy-pasteable
end-to-end walkthrough. In short:

```bash
go run ./core            # serves https://127.0.0.1:8443 (self-signed cert in dev)
./scripts/dev-setup.sh   # register a local dev account
./dev-test/run.sh        # exercise the whole platform end-to-end
```

## Architecture

To understand the codebase itself — its layers, the request lifecycle, and each
capability in depth — see [`docs/architecture/`](docs/architecture/README.md).
It is grounded in the current code, pairs concept with implementation, and links
straight to the source. Start with the [overview](docs/architecture/overview.md).

## Reference

Detailed prior design and planning material lives in
[`docs/reference/`](docs/reference/README.md). It describes the product we are
working toward and the evidence behind it. It is a reference to consult — not a
spec to implement wholesale, and not a description of what currently exists here.

## Working here

New here (human or agent)? Start with
[docs/orientation/](docs/orientation/README.md) — the single "read this first"
document that orients you to the repo, its architecture, vocabulary, and the
conventions to follow. Then see [AGENTS.md](AGENTS.md) for the working agreement.
