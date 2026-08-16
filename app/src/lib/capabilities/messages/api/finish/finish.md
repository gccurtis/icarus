# API: `finish`

Closes a turn a responder was still producing.

Registered as `api.capabilities.messages.finish`, built from `projectMutation`.

## Procedure Tree

```text
finish(ctx, scope, messageId, outcome)
├── requireMessage(ctx, scope, messageId)   require-message.ts
└── ctx.db.patch(messageId, { state })      finish.ts
```

## The only write after a post, and only while streaming

Messages are append-only, so a turn that already ended is refused rather than
rewritten — finishing a settled turn would change what somebody is recorded as
having said. A turn opened before its content exists is not an exception to
append-only: it is one append arriving in two parts, and this is the second.

## The state follows from the error

`MessageOutcome` carries no `state`. Sending both would let them disagree — a
turn marked `complete` carrying the error that killed it — so `error` present
means `error` and absent means `complete`, and there is no way to write the
contradiction.

**The blocks are stored either way.** A turn that failed halfway still said
something, and what it managed to say along with the tools it managed to call is
the record of how far it got. Discarding it would leave a failure with no account
of itself.

## `requireMessage` is here rather than in `shared/`

`finish` is its only caller. A procedure is promoted when it preserves an
invariant spanning functions; `list` has no id to check, because it reads a range
that is already scoped.
