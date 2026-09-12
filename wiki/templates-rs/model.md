---
name: {{Model name}}
environment: server
model-directory: {{path/to/src/model/...}}
runtime-construction: {{path/to/src/runtime/models/build.rs}}
runtime-binding: {{path/to/src/runtime/models/bind.rs}}
commit-mode: {{staged, immediate, or read-only}}
---

# {{Model name}} model

> Copy this file to `wiki/models/<model-name>.md` and replace every
> `{{placeholder}}`. Keep the document synchronized with production source.
> Show exact signatures and meaningful implementation code; do not use
> pseudocode where the real code is short enough to review directly.

## Purpose and ownership

`{{Model name}}` owns {{state and behavior this model owns}}.

Its public consumers receive {{the acquired port or translated values}}.

`{{Model name}}` is owned by the server runtime. The runtime creates exactly
one production instance for its process and owns that instance until shutdown.
Tests may construct isolated state and adapters without creating additional
production singletons.

## Purity and authority boundary

- State is data only. It contains no function pointers, closures, adapters,
  locks, clocks, random generators, environment access, or global handles.
- Model operations are free functions. State is always an explicit first
  argument such as `get_body(&state)`; behavior is never attached to state as
  an inherent method or getter.
- Queries borrow state immutably and return values.
- Commands return a new state snapshot and their result. They never mutate the
  supplied state.
- An operation may call an explicitly supplied interface with mutators. Such an
  interface is authority passed by the caller, never discovered through globals,
  runtime registries, environment variables, or imports.
- Model modules import only their own model modules and approved pure
  `core`/`std` types. Runtime binding owns infrastructure and external-crate
  adaptation.
- The adapter is the only owner allowed to replace the committed state snapshot.

## Source map

| File | Role |
| --- | --- |
| `mod.rs` | Closed module graph and deliberate crate-visible exports |
| `state.rs` | Data-only state snapshot |
| `types/{{category}}.rs` | Exact input, value, context, command, result, and error contracts |
| `port.rs` | Acquired port contract and state-to-port adapter |
| `methods/{{operation}}/{{operation}}.rs` | {{Describe the public free model operation}} |
| `methods/{{operation}}/{{helper}}.rs` | {{Describe the supporting pure operation}} |
| `runtime/.../models/build.rs` | Mandatory pure dependency-to-state construction |
| `runtime/.../models/bind.rs` | Singleton adapter binding and runtime registration |
| `runtime/.../models/types.rs` | Runtime-only acquisition context and adapter contracts |
| `tests/...` | Construction, pure-operation, transition, and lifecycle evidence |

## State

{{Describe every state field, its type, and its invariant. Explain whether
snapshots are cloned directly or use persistent/atomically shared values.}}

```rust
// state.rs
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct {{StateType}} {
    /// {{Description of what the field represents.}}
    pub(crate) {{state_field}}: {{StateValueType}},
}

// types/state.rs
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct {{StateValueType}} {
    // Exact data fields.
}
```

| Field | Type | Description |
| --- | --- | --- |
| `{{state_field}}` | `{{StateValueType}}` | {{Description of what the field represents}} |

State snapshots are treated as immutable after construction. Rust field
visibility supports module access; architecture checks, rather than public
constructors on the state type, enforce that production construction occurs only
in runtime.

## Runtime construction

`create_model_state` is mandatory even when construction is trivial. It is a
pure, independently testable translation from explicit runtime dependencies, if
any, into the exact initial state. It must not read ambient process state.

```rust
// runtime/.../models/build.rs
pub(crate) fn {{create_model_state}}(
    {{dependencies_if_any}}
) -> {{StateType}} {
    {{StateType}} {
        {{state_field}}: {{translated_dependency}},
    }
}
```

For a model with no dependencies, retain the boundary with a zero-argument
function:

```rust
pub(crate) fn {{create_model_state}}() -> {{StateType}} {
    {{StateType}} {
        {{state_field}}: {{initial_value}},
    }
}
```

Document the construction test that supplies controlled dependencies and asserts
the complete resulting state.

## Runtime adapter contract

Rust uses an associated port type rather than erasing each model's distinct port
behind `dyn Any`.

```rust
// runtime/.../models/types.rs
pub(crate) trait RuntimeAdapter {
    type Port;

    fn acquire(
        &self,
        context: &RuntimeAcquisitionContext,
    ) -> Result<Self::Port, AdapterError>;

    fn release(&self, port: Self::Port) -> Result<(), AdapterError>;

    fn close(&self) -> Result<(), AdapterError>;
}
```

`RuntimeAcquisitionContext` is a small runtime-owned lifecycle context. It is
not a container for user input, model dependencies, other models, or ambient
authority. A model that does not need it accepts `_context` and ignores it.

## Adapter

{{Describe the private committed snapshot, acquisition behavior, revision or
conflict mechanism, release behavior, and shutdown behavior. The exact locking
or transaction primitive belongs here, never in state or a model operation.}}

```rust
// port.rs
pub(crate) struct {{ModelAdapter}} {
    // Private committed snapshot and lifecycle mechanism.
}

pub(crate) struct {{ModelPort}} {
    // Private base revision, draft snapshot, and publication handle.
    // This type is intentionally not Clone.
}

pub(crate) fn {{bind_state}}(
    state: {{StateType}},
) -> {{ModelAdapter}} {
    {{ModelAdapter}} {
        // Bind the initial committed snapshot.
    }
}

impl RuntimeAdapter for {{ModelAdapter}} {
    type Port = {{ModelPort}};

    fn acquire(
        &self,
        _context: &RuntimeAcquisitionContext,
    ) -> Result<Self::Port, AdapterError> {
        // Capture a base revision and create a private draft snapshot.
    }

    fn release(&self, port: Self::Port) -> Result<(), AdapterError> {
        // Consuming the port makes later use impossible.
    }

    fn close(&self) -> Result<(), AdapterError> {
        // Refuse future acquisition and resolve open resources.
    }
}
```

| Transition | Guarantee |
| --- | --- |
| `acquire(context)` | {{Fresh facade, scoped draft, snapshot, or transaction rule}} |
| `commit()` | {{Atomic publication, checkpoint, or documented no-op}} |
| `release(port)` | {{Discard/release behavior; ownership prevents reuse after release}} |
| `close()` | {{Process-lifetime teardown and later-call behavior}} |

### Commit modes

- **Read-only:** operations only query the snapshot; `commit()` is a documented
  no-op.
- **Immediate:** each successful command publishes its returned snapshot;
  `commit()` is a documented no-op or checkpoint.
- **Staged:** each acquired port owns a draft snapshot; commands replace that
  draft; `commit()` validates and publishes it atomically; release without
  commit discards it.

### Concurrency and failure semantics

- **Concurrent acquisitions:** {{Isolation and shared-resource behavior}}.
- **Commit:** {{Atomicity, durability, retry, and revision behavior}}.
- **Release without commit:** {{Discard or immediate-effect behavior}}.
- **Conflicts:** {{Detection mechanism, returned error, and resolution owner}}.
- **Faults:** {{Error precedence, rollback, and recovery behavior}}.
- **Close:** {{Open-port and resource cleanup behavior}}.
- **Multiple server processes:** {{Durable transaction or compare-and-swap rule;
  an in-process singleton alone is not cross-process coordination}}.

## Acquired port

{{Describe the exact operations exposed to consumers. The port hides state and
adapts consumer calls to free state-first model functions.}}

```rust
// port.rs
pub(crate) trait {{ModelPortContract}} {
    fn {{query}}(
        &self,
        input: {{QueryInput}},
    ) -> Result<{{QueryResult}}, {{OperationError}}>;

    fn {{command}}(
        &mut self,
        input: {{CommandInput}},
    ) -> Result<{{CommandResult}}, {{OperationError}}>;

    fn commit(&mut self) -> Result<(), {{CommitError}}>;
}
```

The port wrapper contains no domain decisions. It supplies its private snapshot
to the free operation and retains the returned snapshot:

```rust
fn {{command}}(
    &mut self,
    input: {{CommandInput}},
) -> Result<{{CommandResult}}, {{OperationError}}> {
    let transition = {{command}}(&self.draft_state, input)?;
    self.draft_state = transition.next_state;
    Ok(transition.result)
}
```

## Operations

Repeat the appropriate subsection for every public operation and document every
supporting function beneath it.

### Query: `{{query_function_name}}`

{{Explain the query, its inputs and output, its state reads, and every supporting
function beneath it.}}

```mermaid
flowchart LR
    Port["Acquired port"] -->|"{{query}}(input)"| Query["{{query}}(&state, input)"]
    Query --> Helper["{{supporting_query}}(&state, ...)"]
    Helper --> Result["Result"]
```

```rust
// methods/<query>/<query>.rs
pub(crate) fn {{query}}(
    state: &{{StateType}},
    input: {{QueryInput}},
    {{explicit_interfaces_if_any}}
) -> Result<{{QueryResult}}, {{OperationError}}> {
    {{supporting_query}}(state, input)
}

// types/<query>.rs
pub(crate) struct {{QueryInput}} {
    // Exact input fields.
}

pub(crate) struct {{QueryResult}} {
    // Exact result fields.
}
```

```rust
// methods/<query>/<helper>.rs
pub(crate) fn {{supporting_query}}(
    state: &{{StateType}},
    input: {{SupportingQueryInput}},
) -> Result<{{SupportingQueryResult}}, {{OperationError}}> {
    // Exact supporting decision.
}

// types/<query>.rs
pub(crate) struct {{SupportingQueryInput}} {
    // Exact supporting input fields.
}

pub(crate) struct {{SupportingQueryResult}} {
    // Exact supporting result fields.
}
```

### Command: `{{command_function_name}}`

A command is still a pure state transformation. It receives the current snapshot
and returns the next snapshot plus its public result.

```mermaid
flowchart LR
    Port["Acquired port"] -->|"{{command}}(input)"| Command["{{command}}(&draft, input)"]
    Command --> Helper["{{supporting_command}}(&draft, ...)"]
    Helper --> Transition["StateTransition { next_state, result }"]
    Transition --> Draft["Replace private draft"]
```

```rust
// types/transition.rs
pub(crate) struct StateTransition<State, Output> {
    pub(crate) next_state: State,
    pub(crate) result: Output,
}

// methods/<command>/<command>.rs
pub(crate) fn {{command}}(
    state: &{{StateType}},
    input: {{CommandInput}},
    {{explicit_interfaces_if_any}}
) -> Result<
    StateTransition<{{StateType}}, {{CommandResult}}>,
    {{OperationError}},
> {
    let decision = {{supporting_command}}(state, &input)?;

    Ok(StateTransition {
        next_state: {{StateType}} {
            // Build a new snapshot; do not mutate `state`.
        },
        result: {{CommandResult}} {
            // Return consumer-visible output.
        },
    })
}

// types/<command>.rs
pub(crate) struct {{CommandInput}} {
    // Exact command fields.
}

pub(crate) struct {{CommandResult}} {
    // Exact result fields.
}
```

```rust
// methods/<command>/<helper>.rs
pub(crate) fn {{supporting_command}}(
    state: &{{StateType}},
    input: &{{CommandInput}},
) -> Result<{{SupportingCommandResult}}, {{OperationError}}> {
    // Exact supporting decision.
}

// types/<command>.rs
pub(crate) struct {{SupportingCommandResult}} {
    // Exact supporting result fields.
}
```

## Explicit mutator interfaces

If an operation must call an effectful mutator, define the smallest required
interface in the owning model and receive it explicitly. Runtime supplies the
implementation; tests supply a deterministic fake.

```rust
// types/<authority>.rs
pub(crate) trait {{RequiredMutator}} {
    fn {{mutate}}(
        &mut self,
        command: {{MutationCommand}},
    ) -> Result<{{MutationResult}}, {{MutationError}}>;
}

// methods/<operation>/<operation>.rs
pub(crate) fn {{operation_with_authority}}<M: {{RequiredMutator}}>(
    state: &{{StateType}},
    input: {{OperationInput}},
    mutator: &mut M,
) -> Result<{{OperationResult}}, {{OperationError}}> {
    // Authority is explicit and replaceable in tests.
}
```

This function is authority-pure and deterministically testable, but it is not
mathematically pure because the supplied interface may mutate external state.
Prefer returning explicit mutation intents from the functional core when atomic
commit coordination is required.

## Runtime binding

The server composition root creates one state and binds one adapter. It may store
an `Arc` to that adapter in the runtime registry, but model operations never read
that registry.

```rust
// runtime/.../models/bind.rs
pub(crate) fn {{build_runtime_model}}(
    dependencies: {{ModelDependencies}},
) -> {{ModelAdapter}} {
    let state = {{create_model_state}}(dependencies);
    {{bind_state}}(state)
}
```

## Enforcement and evidence

These checker names are the intended Rust enforcement surface. Mark each as
implemented only after it has adversarial mutation tests.

| Guarantee | Rust static checker | Runtime/unit evidence |
| --- | --- | --- |
| Data-only state | `rust-model-state-is-data` | `{{test path}}` |
| Mandatory pure state construction | `rust-model-state-construction` | `{{test path}}` |
| Free explicit-state operations | `rust-model-operations-are-free` | `{{test path}}` |
| Functional command transitions | `rust-model-commands-return-transitions` | `{{test path}}` |
| Exact acquired-port lifecycle | `rust-model-port-has-one-lifecycle` | `{{test path}}` |
| Runtime-only construction and binding | `rust-runtime-alone-builds-models` | `{{test path}}` |
| Closed imports, authority, and exports | `rust-pure-island-*` | `{{test path}}` |
| Staging, commit, release, and conflict semantics | `{{checker if statically provable}}` | `{{test path}}` |
| {{Other guarantee}} | `{{static checker}}` | `{{test path}}` |

## Known limits and next proof

{{State what this model does not prove and identify the next test needed to
exercise those semantics.}}

## Complete source

Include exact production source for the module declarations, state, types, port,
every operation and supporting function, runtime construction, runtime binding,
and any admission boundary that materially defines the model. Use one labeled
Rust block per file.

### `{{path/to/file.rs}}`

```rust
// Exact current source.
```
