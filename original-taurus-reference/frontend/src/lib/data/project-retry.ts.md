# src/lib/data/project-retry.ts — breakdown

Companion to [project-retry.ts](project-retry.ts). A single wrapper that recovers from
a 409 ("select a project first") by selecting the project and retrying the API call
once. Used by every project-scoped API that can hit a stale session cell.

## Imports

### The error guard and the project selector

```ts
import { isApiError } from './api';
import { openProject } from './projects';

```

`isApiError` narrows a thrown value to the typed API error so its `status` can be
inspected; `openProject` is the recovery action — it selects the project server-side
before the call is retried.

## The retry wrapper

### Recover from stale session cells automatically

```ts
/**
 * Wrap an API call so that a 409 ("select a project first") is recovered
 * automatically: select the project, then retry the call once. Used by
 * resources, activity, and document loaders — every project-scoped API
 * that can hit a stale session cell on direct load or reload.
 */
export async function withProject<T>(
  projectId: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isApiError(e) && e.status === 409) {
      await openProject(projectId);
      return await fn();
    }
    throw e;
  }
}
```

The pattern replaces three duplicated try/catch/retry blocks in `resources.ts`,
`overview.ts`, and `runtime.ts`. `withProject` takes a projectId and a thunk; if the
thunk throws a 409, it selects the project via `openProject` and calls the thunk
again. Any other error propagates.
