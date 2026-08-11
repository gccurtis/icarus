# `ActivitySpace.svelte` — the monitor

Two groups and nothing else: **Working now** (queued / running / waiting — `ACTIVE_STATES`) and
**Recently finished**. A monitor earns its keep by being glanceable; more structure than
live-versus-settled would be organisation for its own sake.

Both groups are the standard center container (panel-toned header with the count, work-toned
body) delegating rows to [`TaskList`](TaskList.svelte.md). Working-now is bounded (`max-h-72`) so
a busy day cannot push the finished group off-screen; Recently-finished takes the remaining
height. Selection passes straight through to the console, which shows the task in the detail
panel.

## Room for the AI bar

The outer column carries `pb-24` so [`LibraryQuarterback`](LibraryQuarterback.svelte.md), which
anchors to the foot of the work surface, never covers this space's last row.
