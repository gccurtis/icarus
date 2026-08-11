# Completion-baseline dev gate

Run:

```bash
./dev-test/completion-baseline/run.sh
```

This is the black-box entry point for the Ω-001 executable contract. By
default it runs source-derived route and schema inventories, the capability,
packet, architecture, dependency, Alpha-request, and Yesod-resource gates, then
format, build, test, and race checks.

Useful variants:

```bash
./dev-test/completion-baseline/run.sh --inventory-only
./dev-test/completion-baseline/run.sh --with-free-dev-tests
```

The default and inventory-only modes make no provider calls. The optional
`--with-free-dev-tests` mode runs `./dev-test/run.sh free`, whose paid/model and
live-web suites are explicitly excluded. Paid live certification remains a
separate, visible operator choice:

```bash
./dev-test/run.sh intelligence
```

Every intelligence suite skips when its credential is absent and prints tokens
and estimated cost when it runs. A skipped live suite is not a pass.
