# types

Declarations only. Every file here compiles to nothing.

The domains mirror what the system stores, and each is one subject: `core`
underneath the rest, `content` for what is authored, `investigation` and
`knowledge` for what is worked out.

`documents`, `slide-decks` and `spreadsheets` are one domain each, holding that
resource's body, its ops and its snapshot vocabulary. Nothing is shared between
the three.

`views` is the same shape for what a person has open: the screen and panel
vocabularies, what one tab holds, and the ops that change it. What a tab starts
as — which screens are permanent, how wide a panel opens — is not here, because
no reader of a stored row consults it.

A constant, a lookup table, a guard — anything still there at runtime — belongs
in `../behavior/`, however small it is.
