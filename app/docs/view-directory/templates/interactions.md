# {{View Name}} Interactions

Lives at `src/lib/views/{{view-name}}/interactions/interactions.md`. This is the
one document for the complete interaction tree. Nested interaction directories
do not carry their own Markdown files.

## Interaction Tree

Name entry files and the general procedures they call.

```text
TODO user intent                         TODO.ts
├── TODO model or capability call
└── TODO general procedure               ../procedures/TODO.ts
```

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every interaction appears here and is described under Contracts below.

<!-- generated:inventory:start -->
<!-- generated:inventory:end -->

## Contracts

Repeat this section for every interaction.

### `TODO`

- **User intent:** TODO
- **Input:** TODO
- **Called by:** TODO: Name the component and event translation.
- **Model methods:** TODO or `None`
- **Capability calls:** TODO or `None`
- **General procedures:** TODO or `None`

#### Flow

```text
1. TODO: Validate application-shaped input.
2. TODO: Apply optimistic state or begin the operation.
3. TODO: Call the owning model or capability.
4. TODO: Render success or recover from failure.
```

#### Result and recovery

- **Returned result:** TODO
- **Optimistic behavior:** TODO or `None`
- **Failure shown to the user:** TODO
- **Rollback or retry:** TODO

## Interaction Invariants

- TODO: State an invariant shared by multiple interactions.
