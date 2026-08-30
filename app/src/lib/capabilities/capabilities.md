# capabilities

The one crossing. A capability is what a view is allowed to ask, and the only
route from a surface to stored state.

**One directory per subject, and `index.ts` is the whole of what a panel
imports.** `$capabilities/resource` resolves to that file and to nothing deeper,
so which side of the boundary a capability answers from is its own business.

**None of them answers anything yet.** Each is a directory, a document, and an
empty `index.ts`. What each owes is written in the views that call it, so a
capability is built by making the compiler quiet about one of them at a time.

`store` is the exception: it is the only one with procedures, and it is what the
others will reach through.
