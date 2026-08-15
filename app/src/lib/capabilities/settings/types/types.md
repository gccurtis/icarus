# Types

Two files, split by which side of the remote boundary a type lives on. That is
the only distinction worth making here, and it carries a security property.

| File | Holds | Seen by |
| --- | --- | --- |
| [`settings.ts`](settings.ts) | `Setting`, `SettingInput`, `SettingValue` | procedures, and any server caller |
| [`requests.ts`](requests.ts) | `SetRequest`, `GetRequest`, `ListRequest` | the browser, through the remote wrappers |

## The one field between them

A request carries a **project token**; a procedure input does not.

That is not tidiness. A client instance must name which project it is talking
about, because a remote function cannot see the page that called it — kit serves
them all from `/_app/remote/…` with empty route params, so there is no route to
read a project from. But the token is a *reference*, not authority: it is
resolved within the asking user's own handles, and one that is not there resolves
to no project at all.

By the time a procedure runs, the token is gone and a `Scope` has taken its
place. Writing that as two types rather than one optional field means the
distinction cannot be lost by someone adding a field to the wrong interface.

**Neither type names a user.** That comes only from the session cookie.

## Why `SettingValue` is not `unknown`

The column is `jsonb`, so a value that cannot survive a round trip through JSON
cannot be stored. Saying so in the type moves that failure from a runtime
surprise to a compile error for every server-side caller.

A browser caller is not bound by the type — it sends whatever it likes — which is
why admission checks the same property at runtime rather than trusting it.
