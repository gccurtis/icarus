# Operation flight methods

`definition.ts` declares the process-owned state and delegates each action here.
Derived refresh methods share one promise by correlation key. Research methods
own the controller, two-stage stop transition, deadline, and release. Agent-task
methods share one promise by task id and own its immediate stop and deadline. Shared
helpers only assert the open lifetime and expose a read-only research handle.
