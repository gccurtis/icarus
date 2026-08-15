# Method: `{{methodName}}`

Lives at `methods/{{method-name}}/{{method-name}}.md`.

{{What this method is for, who calls it, and when it should be used instead of a
neighboring method.}}

## Classification

- **Effect:** {{mutator / accessor}}
- **Entry:** [`{{method-name}}.ts`]({{method-name}}.ts)
- **Exposed as:** `{{objectName}}.{{methodName}}()` on `{{ObjectType}}`
- **Synchronous:** {{yes / no, and what it awaits}}

## Signature

```ts
export const {{methodName}} = (
  state: {{StateType}},
  {{inputName}}: {{InputType}}
): {{OutputType}} => ...;
```

State arrives as a parameter from the definition. Nothing here is read from
module scope, so two instances of `{{ObjectType}}` cannot interfere.

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `{{inputName}}` | `{{InputType}}` | {{Meaning, and any constraint the caller must satisfy}} |

## Output

`{{OutputType}}`

{{What the caller receives, including the meaningful success variants. If the
caller receives a value it must not mutate, say so and say what protects it.}}

## Failures

| Failure | Cause |
| ------- | ----- |
| `{{failure}}` | {{The condition that produces it}} |

{{Distinguish a decision from a fault: a rejection this object chose and states
is not the same as something that went wrong.}}

## Effects

State "None" when the method only reads and changes nothing observable.

- {{State assigned on the instance, if any.}}
- {{Resource acquired or released, if any.}}
- {{Write to storage or another owned dependency, if any.}}

## Concurrency

{{What happens when this method runs against state another call is changing: a
synchronous method is indivisible and can say so in one line; an async method
must say what it re-reads after each await and what it does when the state it
started from is gone.}}

## Method Tree

The tree is also this directory's layout. Name real paths — a rename that does
not update the tree is a detectable defect rather than a stale comment. Use `||`
for conditional branches.

```text
{{methodName}}(state, {{input}})
├── {{firstStep}}()                 {{first-step}}.ts
├── {{sharedStep}}()                ../shared/{{shared-step}}.ts
├── {{branchingStep}}()             {{branching-step}}/{{branching-step}}.ts
│   ├── {{subStep}}()               {{branching-step}}/{{sub-step}}.ts
│   || {{condition}}
│   │   └── {{conditionalStep}}()   {{branching-step}}/{{conditional-step}}.ts
│   || {{alternative condition}}
│       └── {{alternativeStep}}()   {{branching-step}}/{{alternative-step}}.ts
└── {{the state assignment or value this method returns}}
```

## Supporting Methods

Files in this directory, used by this method alone. A method a second public
method needs moves to [`../shared/`](../shared/shared.md) rather than being
imported across method directories.

A supporting method with support of its own is a directory containing a `.ts` of
the same name, not a pile of siblings here. It carries no document — this tree
already names every path in it.

| Method | Responsibility | File |
| ------ | -------------- | ---- |
| `{{supportingMethodName}}` | {{What it does for this method}} | [{{supporting-method}}.ts]({{supporting-method}}.ts) |

## Shared Methods Used

| Method | Why this method needs it |
| ------ | ------------------------ |
| `{{sharedMethodName}}` | {{The object-wide invariant it preserves here}} |
