# development

Stand-ins. Every procedure here answers from `configuration/dev.yaml` rather than
from anything the application stores, and every one of them is replaced by a real
capability rather than grown into one.

It is a capability rather than a value in a view so that the replacement is an
import path and a call signature, both of which a compiler can find.

| procedure | answers | replaced by |
| --- | --- | --- |
| `username` | `scope.username`, which `resolveSession` reads from `dev.yaml` | authentication |
