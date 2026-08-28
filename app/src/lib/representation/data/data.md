# data

Everything the system knows, in the one vocabulary both processes read.

Two directories, and the split is the rule: **a file either declares a shape or
does something to one.**

| | |
| --- | --- |
| `types/` | declarations, and nothing that survives compilation |
| `behavior/` | pure functions over those declarations |

A file that did both is why this is a directory split rather than a naming
convention: it is the arrangement where importing a type quietly drags a runtime
value along with it, and where "may I import this?" has no answer you can read
off the path.

**Nothing here touches the process it runs in.** No filesystem, no environment,
no framework — which is what makes every file safe for either side to take.
