# capabilities

The one crossing. A capability is what a view is allowed to ask, and the only
route from a surface to stored state.

**One directory per subject, entered at its index.** A capability that crosses to
the server is `index.remote.ts`, and callers name that file — a directory import
resolves to `index.ts`, which SvelteKit does not transform into remote functions.

**A capability exists once it answers something.** There are no placeholders: a
directory holding an empty index is a door with nothing behind it, and it reads
as built to everything that looks at the tree.

`store` is four procedures over the server store, one per operation. `workspace`
reads and writes the one workspace state a person has per project. `development`
holds stand-ins that read `configuration/dev.yaml`, each to be replaced by a real
capability rather than grown into one.

The rest are one subject each: `document`, `slide-deck` and `spreadsheet` take
the edits their editor makes and answer with what the server now holds;
`comments` carries threads and remarks against any of them; `variables` holds a
project's named values; `templates` reads and instantiates them; and
`project-resources` lists and creates what a project owns.

What the views call and nothing provides is a compile error naming the missing
module, which is the honest form of the same list a tree of empty directories was
keeping.
