# 0154 — A limit says what it was

Phase 3 of the resilient-ingest design
([spec](../superpowers/specs/2026-07-29-resilient-ingest-design.md)), first half.
Nothing is refused or dropped without saying so, in a shape a client can act on.

## Three limits, three vocabularies, no arithmetic

Every bound in the system was a sentinel error whose message was the entire story.
That produced two defects at once.

**The same bound spoke differently depending on the route.** An oversized upload
reached a client as `file: content exceeds the maximum size` from `/files` and as
`file is too large` from the chat attachment route. One bound, two messages, and
neither said what the bound *was* or what exceeded it — so "your file is 31 MB and
the limit is 25 MB" was not a sentence the system could produce.

**And one bound said nothing at all.** A connector file over `max_file_bytes` was
dropped with a `log.Warnf` and nothing reached `SyncResult`. A server's stderr is not
where the person who synced a folder is looking, so a 1,000-page textbook that
silently failed to arrive looked exactly like one that arrived.

## `core/platform/limit`

One struct — `Exceeded{Code, Message, Limit, Actual, Subject}` — plus `Body()` for
the response payload and `From()` for reading one back out of an error chain.

`Code` is what earns the type. Prose gets reworded; a front end matching on prose
breaks the next time someone improves a message. `Subject` is what a batch needs: a
directory upload or a folder sync has to say *which* member failed.

Two placement decisions:

- **In `platform`, not beside a capability.** It is vocabulary, not domain, and a
  capability importing another capability just to report a limit is the coupling this
  avoids. It shares the reason handlers were diverging in the first place: they must
  all map it identically, and a shape owned by one capability gets mapped by
  imitation everywhere else.
- **It holds no list of limits.** Codes belong to whoever enforces the bound
  (`file.CodeTooLarge`, `connector.CodeFileTooLarge`, `chat.CodeTooManyFiles`), the
  way `document` owns its conflict codes. A registry in `platform` would have to
  import every capability to stay honest, or drift.

It is named `Exceeded` rather than `Error` for a mechanical reason as well as a
readable one: a capability adding its own sentinel identity **embeds** it, and a field
named `Error` collides with the `Error() string` method it has to promote.

## The bug the test caught

`file.sizeLimit` embeds `*limit.Exceeded` and adds `Is` so
`errors.Is(err, ErrTooLarge)` keeps working — the `document.AdmissionConflict` device,
because enriching an error is exactly where a check that used to match silently stops
matching.

I wrote `TestUploadSizeCapCarriesTheArithmetic` to assert the sentinel *and* the
numbers together, and it failed on first run:

```
err = big.bin: file content exceeds the maximum size (9 exceeds the limit of 8)
      (*file.sizeLimit), want a limit a handler can report
```

Embedding promotes `Error()` and `Body()`, so the value **prints** like a limit and
looks like one — while `errors.As` fails, because the concrete type is `*sizeLimit`
and there is no chain to walk. It needed an explicit `Unwrap`. Without the test the
enriched error would have shipped looking correct and handlers would have silently
fallen through to the generic arm, which is the failure mode this whole phase is
about.

## The field almost nothing set

`endpoint.Response.Err` has existed since the transport contract was written and
`transport/response.go:44` has always fed it to `requestlog.AttachError`. **Exactly
one handler set it**: `chatErr`'s default arm, added by record 0130 with a comment
giving the right reason ("a 500 with no recorded reason cannot be diagnosed
afterwards"). The practice never spread from there.

*(Corrected: this record first said nothing set it, and the design doc's fourth
defect said "zero handlers". Both were wrong — see record 0155, which generalizes
record 0130's pattern rather than inventing one.)*

The isolation is why record 0121's sync race was so hard to see: the connector's
handler was not the one handler that had figured this out, so an intermittent 500
answered `{"error":"connector error"}`, the request log recorded nothing further, and
the failure had to be reproduced in order to be observed at all.

Every arm of the three handlers touched here now sets it. The body stays opaque — a
client learns nothing internal — and the cause goes to the log. Visible in the live
files suite:

```
"response":{"error":"file not found"},"error":"file: not found"
```

## `SyncResult.Skipped`

`SkippedFile{Path, Code, Detail, Size, Limit}`, returned in the sync response and
omitted entirely when empty, so its presence is the signal.

The status stays **200 when files were skipped**, because the sync succeeded: one
unusable file is a reason to leave that file out, never to abandon everything beside
it. What changes is that the response says which files did not arrive.

The fields mirror `limit.Exceeded` **without being one**, deliberately. A skip is not
a failure and modelling it as an error would misreport a successful sync. What the two
share is the obligation to name the bound and what crossed it.

The reason set will outlive the reason that built it: `too_large` retires when ingest
streams (the cap is going, per the design update in `fc757aa`), and what remains are
the failures a reader does not fix — an unreadable file, a binary with no text
extractor, a file that vanished between the snapshot and the read. Each is currently a
log line nobody sees.

## Gates

Four tests on the shape (body keys, omitted-when-unset, the arithmetic in `Error()`,
`From` through a wrapping chain), one on both of the file limit's identities, and two
on the connector — the skip reported with its numbers, and nothing reported when
everything fits. Live suites green: connectors (16 tokens), files, chat-attachments
(1,370 tokens).

## Still to come in this phase

The remaining handlers do not set `Response.Err` yet — 24 packages of mechanical
change, kept separate so it is easy to read and easy to revert. `workspace.ErrTooLarge`
is the one ad-hoc limit left unconverted and belongs in that commit, since it is
already touching every handler.

Status is deliberately **not** part of the shared mapping. An oversized upload is 413;
the project-artifact ceiling arriving in Phase 6 is not the request's size being
wrong. The body is what had to stop diverging.
