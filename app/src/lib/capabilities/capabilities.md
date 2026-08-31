# capabilities

The one crossing. A capability is what a view is allowed to ask, and the only
route from a surface to stored state.

**One directory per subject, entered at its index.** A capability that crosses to
the server is `index.remote.ts`, and callers name that file — a directory import
resolves to `index.ts`, which SvelteKit does not transform into remote functions.

**Most of them answer nothing yet.** Each is a directory, a document, and an
empty `index.ts`. What each owes is written in the views that call it, so a
capability is built by making the compiler quiet about one of them at a time.

Two answer today. `store` is four procedures over the server store, one per
operation. `development` holds stand-ins that read `configuration/dev.yaml`, each
to be replaced by a real capability rather than grown into one.
