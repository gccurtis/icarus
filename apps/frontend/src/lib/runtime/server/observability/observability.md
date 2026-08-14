# Observability

One root logger for the process, behind an application-owned port.

Callers depend on `Logger` — four methods — rather than on Pino, so swapping the
backend is one file, and so instrumentation stays explicit at boundaries instead
of arriving through a library's ambient global.

## Destinations differ in ownership, not in file descriptor

```yaml
destination:
  kind: piped   # this process retains nothing; whatever runs it owns collection
  kind: file    # this process owns creating the file and closing it
```

Only a file destination yields a stream to close. **A piped destination must
never be closed** — ending descriptor 1 or 2 would take stdout or stderr away
from everything else in the process. That is why the runtime holds the stream
only when it opened one, rather than holding a descriptor and a flag.

Shutdown flushes before ending the stream. Pino buffers, so the reverse order
drops records it has accepted but not yet written — usually including the
failure that caused the shutdown.

## What goes in a record

Application data goes in one predictable field, `data`. Pino owns the envelope —
time, level, message, bindings — and serializes it safely, including the cycles
and getters an application value might carry.

`errorFields` reduces an unknown thrown value to a name and a message. It lives
here because reducing a fault to log fields is a logging concern; in the backend
it sat in the web server, which made every capability's instrumentation depend
on the transport.

## The unused key is not rejected

A `directory` left in place while running piped is how someone switches back
tomorrow. This is configuration a person edits, not untrusted input, and failing
startup over a harmless leftover would punish the ordinary case.
