# Settings

Configuration that belongs to a **project** rather than to a person: keyed
values every collaborator on that project sees.

The counterpart is [`runtime/client/preferences`](../../../runtime/client/preferences),
which holds *this browser's* panel widths. The dividing question is who a value
follows. Panel geometry follows a person and never leaves their machine.
`editor.default-font` follows the project, and a colleague opening it should see
what was chosen.

## Why this capability exists

It is small enough to hold in your head and exercises every mechanism a
capability has: two doors, both call forms, a command and two queries, project
scoping, user identity, the initializer seam, and a procedure tree lint
resolves. Getting the wiring wrong here costs an afternoon; getting it wrong for
the first time inside something large costs a week of not knowing which half is
broken.

That is why it was built first, and it is worth keeping regardless.

## The shape of a setting

A key and a JSON value. The key **is** the identity — there is no surrogate id,
because there is no second thing to name and a surrogate would let two rows claim
the same key.

Keys are dotted lowercase paths (`editor.font-size`). Narrow on purpose: a key is
something a person types in two places and has to spell the same way both times,
so admitting arbitrary text would mean two keys that look identical in a list are
different rows.

## Scope, and what it guarantees

Every procedure takes a `Scope` first and its own input as the rest. Neither
input type has a field for a project or a user, so **there is no authorization
check inside this capability** — by the time a procedure runs, its authority has
already been established and cannot be argued with.

`updated_by` is the visible consequence: it is written from `scope.userId`, which
no caller can supply. If a browser could put a user id in a payload, that column
would be a record of what someone claimed rather than of what happened.

## Browser-reachable functions

Every function with a `.remote.ts` is directly reachable by an untrusted client
and **owns validating what it receives**, because remote functions are declared
`'unchecked'`.

| Function | Wrapper | Validates |
| --- | --- | --- |
| `set` | [`api/set/set.remote.ts`](api/set/set.remote.ts) | key shape, value representability, value size, forbidden keys |
| `get` | [`api/get/get.remote.ts`](api/get/get.remote.ts) | key shape |
| `list` | [`api/list/list.remote.ts`](api/list/list.remote.ts) | nothing beyond scope — it takes no input |

That table is the audit list. A new `.remote.ts` belongs in it before it belongs
in `index.ts`.

## What is deliberately absent

**No delete.** Nothing needs one yet, and a `set(key, undefined)` that sometimes
removed a row would be two operations sharing a name — with the one you get
depending on a value being absent, which is exactly what happens by accident.

**No paging on `list`.** A project's settings are bounded by how many things the
application has to configure, not by how much its users do.

**No defaults.** A setting that is not stored is absent, and the code that reads
it owns what to do about that. Defaults here would make a stored value
indistinguishable from a fallback.
