# comments

What people say about a thing in the project, written.

Four procedures. `startThread` opens a thread on a resource — optionally at an
anchor inside it (a slide, an object, a cell, a passage) — and files the first
comment in it. `reply` adds a comment to a thread that exists. `resolveThread`
settles a thread or reopens it. `readComments` returns the caller's project-scoped
thread, remark, and safe person projection.

**Who is speaking is never a parameter.** The author and the project come from
the scope, so a caller cannot file a remark as someone else or into a project it
cannot open. A thread in another project is not found rather than refused.

**A template's working copy takes no comments.** `startThread` refuses a target
that a `templateStages` row names, because a comment is one of the things that
does not travel with a template; the panels say so where the composer would be.

**Anchors have one current shape.** Text anchors carry a non-empty `spans` list;
each span has a block id and atom-relative ends. Admission refuses flat text
anchors, and the read projection omits malformed rows rather than exposing them
to a browser.

**A thread starts atomically.** Its thread row and opening remark are created in
one transaction. Replies and resolution changes also resolve the thread inside
the scoped transaction before writing.
