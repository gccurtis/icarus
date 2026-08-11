import { isApiError } from './api';
import { openProject } from './projects';

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
