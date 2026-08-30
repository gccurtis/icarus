# The Runtime

Execution. Nothing else in `lib/` runs — this is where the application is built,
held, started and shut down.

It is small on purpose, and should stay that way.

```text
runtime/
├── client/
│   ├── start.ts         buildClientModel, then the instance, then clientModel()
│   ├── types.ts         ClientModel, ClientModelInput
│   ├── client.md
│   └── test/            graph, lifetime, isolation
└── server/
    ├── start.server.ts  buildServerModel, the instance, the accessor, shutdown
    ├── types.ts         ServerModel
    ├── scope.server.ts  a request → who is asking, and about which project
    ├── server.md
    └── test/            construction, lifetime, scope
```

**One file per environment, read top to bottom.** Composing the graph and holding
it were two modules; they are one now, because both are execution and neither is
long. The order in the file is the order the application comes up in: build,
hold, hand out, and on the server, close.

**The builder is not exported.** `init<Environment>Model` is the only way to
build a graph, and it returns what it built — so a test that wants two calls it
twice and asserts on the two values. Exporting the builder as well would publish
a second way to stand a graph up, which is the one failure this shape exists to
prevent, and doing it for tests would have been exactly that.

**What is not here.** The objects. A model object — what it owns, its surface,
its state, its methods — is definitional and lives in
[`model/`](../model/model.md). This tree calls their constructors; it does not
define them.

**`scope.server.ts` is here because it executes, not because it starts.** It runs
per request and reads the one server graph to do it. Identity is the one thing
that cannot be imported: it arrives with the request, which is why it is an entry
of its own rather than something reachable off an object.

Nothing checks this tree yet. `scripts/lint/model/` governs `model/`, so the
rules about construction order, the single holder and the accessor's guards are
unenforced until a runtime standard is written.
