# comments

What people say about a thing in the project, written.

Three procedures. `startThread` opens a thread on a resource — optionally at an
anchor inside it (a slide, an object, a cell, a passage) — and files the first
comment in it. `reply` adds a comment to a thread that exists. `resolveThread`
settles a thread or reopens it.

**Who is speaking is never a parameter.** The author and the project come from
the scope, so a caller cannot file a remark as someone else or into a project it
cannot open. A thread in another project is not found rather than refused.

**A template's working copy takes no comments.** `startThread` refuses a target
that a `templateStages` row names, because a comment is one of the things that
does not travel with a template; the panels say so where the composer would be.

**Reading is not here.** Threads and comments are rows, and a panel reads them
through `store` like any other table; this capability only adds to them.
