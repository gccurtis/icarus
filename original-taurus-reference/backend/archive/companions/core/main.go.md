# main.go

`main.go` is the composition root's entry shell — the smallest possible
`package main`. Its only job is to be the binary's entry point and immediately
hand control to the composition root. It holds no configuration, no wiring, and
no lifecycle logic of its own; all of that lives in the `wiring` package.

Keeping `main` this thin is deliberate. It draws a hard line between "where the
program starts" (this file) and "how the program is assembled and run"
(`wiring.Run`). Everything interesting is testable and importable from other
packages; `main` itself is a one-liner that can't really go wrong.

The layering below `main` is one-way: `main` → `wiring` → `transport` →
`application` → `endpoint`. This file sits at the very top of that chain.

## Code breakdown

### Command documentation and package declaration

```go
// Command core is the core of the Taurus Omega application: the authoritative
// backend the rest of the system (including any frontend) is a view onto.
//
// main is a thin composition shell: it hands off to the composition root, which
// creates the initial objects and runs the server.
package main
```

The doc comment documents the *command* (the runnable binary), since this is
`package main`. The first paragraph states what core is — the authoritative
backend everything else is a view onto — and the second records this file's
narrow role: a thin shell that defers to the composition root. `package main`
marks this as the executable's entry package.

### Composition-root import

```go
import "github.com/gccurtis/taurus-omega/core/wiring"
```

The single import pulls in the `wiring` package — the composition root that
creates the initial objects and owns the process lifecycle. It is the only thing
`main` depends on.

### Entry point

```go
func main() {
	wiring.Run()
}
```

`main` is the program's entry point. It does exactly one thing: call
`wiring.Run`, which builds the server and blocks until the process is
signalled to shut down. Because all real work is delegated, `main` needs no error
handling or configuration of its own.
