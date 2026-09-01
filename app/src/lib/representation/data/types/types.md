# types

Declarations only. Every file here compiles to nothing.

The domains mirror what the system stores, and each is one subject: `core`
underneath the rest, `content` for what is authored, `investigation` and
`knowledge` for what is worked out.

`documents`, `slide-decks` and `spreadsheets` are one domain each, holding that
resource's body, its ops and its snapshot vocabulary. Nothing is shared between
the three.

A constant, a lookup table, a guard — anything still there at runtime — belongs
in `../behavior/`, however small it is.
