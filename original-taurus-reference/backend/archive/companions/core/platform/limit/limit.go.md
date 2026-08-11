# limit.go

The shared shape of "a bound was reached". One struct, `Exceeded`, carrying the
machine-readable code a client branches on, a human message, the arithmetic (what
the bound was, what was asked for), and the subject that hit it — plus `Body` for
the response payload and `From` for reading one back out of an error chain. It
depends on nothing but the standard library and names no particular limit. See repo
conventions (AGENTS.md).

## Why it is shared, and why it is in platform

Every capability that bounds something eventually has to tell someone so, and before
this each did it its own way: a sentinel error whose message was the entire story.
The consequences were visible in the responses. The *same* file-size bound reached a
client as `file: content exceeds the maximum size` from the file routes and
`file is too large` from the chat attachment route — one bound, two messages — and
neither said what the bound was or what exceeded it. "Your file is 31 MB and the
limit is 25 MB" was not a sentence the system could say.

It is shared rather than defined per-capability for the reason those handlers had
already diverged: they must all map it identically, and a shape living in one
capability gets mapped by imitation everywhere else. It sits in `platform` because
it is vocabulary rather than domain — and because a capability importing another
capability just to report a limit is the coupling this avoids.

What it deliberately does **not** hold is the list of limits. Codes belong to
whoever enforces the bound (`file.CodeTooLarge`, `connector.CodeFileTooLarge`,
`chat.CodeTooManyFiles`), the same way `document` owns its conflict codes. A
registry here would have to import every capability to stay honest, or drift.

## Code breakdown

### `Exceeded` — named for the event, not for being an error

`Code`, `Message`, `Limit`, `Actual`, `Subject`, all with JSON tags because the
struct is serialized straight into an error body — the same thing
`document.AdmissionConflict` does.

`Code` is the field that earns the type. Prose gets reworded; a front end matching
on prose breaks the next time someone improves a message. `Subject` matters for
batches: a directory upload or a folder sync needs to say *which* member failed.

The name is `Exceeded` rather than `Error` for a concrete reason beyond taste. A
capability that wants to add its own sentinel identity embeds this — and a struct
field named `Error` would collide with the `Error() string` method it has to
promote. `file.sizeLimit` is that case.

### `Error` — the arithmetic goes in the text too

The message, with `(N exceeds the limit of M)` appended when there is a limit, and
the subject prefixed when there is one.

Duplicating the numbers into the string is deliberate: this is what reaches the
request log, and nothing there is going to destructure a struct. A nil receiver
answers empty rather than panicking, so a logging path can be careless.

### `Body` — one payload shape, defined once

`error` carries the message, so a limit reads like every other error body in the
system; `code` sits beside it; `limit`, `actual` and `subject` are included only
when set.

Omitting rather than zeroing them is the point of that last part: a client rendering
"the limit is 0" is worse than one rendering nothing.

It lives here rather than in each handler so the mapping cannot drift again. The
*status* is still the handler's call, because it genuinely varies — an oversized
upload is `413`, while a project that cannot hold more artifacts is not the
request's size being wrong.

### `From` — the question, not the ceremony

A wrapper over `errors.As` so call sites read as `if e, ok := limit.From(err); ok`.

Reaching *through* a chain is the part that matters. It is what lets a capability
keep a sentinel identity on top of the limit without hiding the numbers from the
handler underneath — provided it also exposes an `Unwrap`, which embedding alone
does not give it.
