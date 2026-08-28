# store

The store, passed through. Four procedures over the server model's store, one
per operation, with no shape of their own.

A path is a string and a row is `unknown`, so what these check is that a caller
sent the right *kind* of thing — a table this store has, a non-empty path, an
object. What a field holds is checked by whichever capability replaces this one
for a subject that has real rules.
