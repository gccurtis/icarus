# slide-deck

A deck's body, read.

One procedure. `readSlideDeckBody` hands back the leader snapshot for one deck —
a revision and a whole `SlideDeckBody` — or nothing, for a deck that has never
been written to.

**Nothing here writes.** A deck is edited in the browser and those edits are held
by the editor; the change-set path that will carry them to the store is not
built. A caller that wants to know what the store holds asks here, and a caller
that wants to change it has nowhere to ask yet.

**Which project is not a parameter.** It comes from the scope, and a deck whose
row belongs to another project is not found rather than refused, because a caller
that can tell "exists but not yours" from "does not exist" has been told
something about a project it cannot open.
