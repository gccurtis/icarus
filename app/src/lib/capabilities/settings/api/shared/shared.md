# Shared Procedures

Three, and each is here because it preserves an invariant spanning functions
rather than because more than one file wanted the code.

| Procedure | Invariant it preserves | Used by |
| --- | --- | --- |
| [`canonicalKey`](canonical-key.ts) | all three agree on what a key **is** | `set`, `get` |
| [`record`](record.ts) | every call leaves the same trace, in the same shape | all three procedures |
| [`stated`](stated.ts) | a refusal reaches the browser; a fault does not | all three remote wrappers |

## `canonicalKey`

If `set` admitted a form `get` refused, a caller could write a setting it could
never read back. That is the invariant, and it is why the check lives above all
three rather than being repeated in two of them.

Trimming is deliberate and case-folding is not. Surrounding whitespace is a
transcription artifact nobody means. A different case is a different key someone
chose, and quietly merging `Theme` into `theme` would silently join two settings.

## `record`

Resolves the logger itself rather than taking one, because there is one logger
per process and it depends on nothing the caller knows. Only the database is
scoped, and so only the database is passed.

It distinguishes a **decision** from a **fault**: a `SettingsError` is something
this capability chose and stated with a code, and is recorded at `warn`; anything
else is recorded at `error`. Collapsing the two makes every ordinary rejection
read like a bug, and then real bugs stop standing out.

**What goes in `fields` is bounded by what a log outlives.** A key is an
identifier and is recorded. A value is whatever someone stored, and is not — logs
are copied, shipped, and retained far longer than the rows they describe.

## `stated`

The same decision-versus-fault line as `record`, drawn at the other boundary.

A `SettingsError` thrown inside a remote function reaches the browser as
`500 Internal Error`: kit hides thrown values deliberately and cannot tell one of
ours from a null dereference. So a view had no way to distinguish "that key is
not valid" from "the server is broken", and the only honest thing it could show
was the second.

`stated` translates a code into a `400` carrying it, and lets everything else
stay a `500` with nothing in it.

**Only the remote wrappers call it.** A server-side caller catches
`SettingsError` directly and has no use for an HTTP status, which is why this is
at the boundary rather than inside `record` or the procedures.

This was found by calling the real endpoint, not by reading the code.
