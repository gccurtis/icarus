/**
 * A project id may become a directory name, so it has to be one safely.
 *
 * Rejecting rather than sanitizing: a silently rewritten id would open a
 * *different* project's database, which is the worst possible outcome for a
 * mistake this cheap to catch. `..` and separators are the attack; everything
 * else here is keeping ids legible across filesystems.
 *
 * **Lowercase only, deliberately.** Case-insensitive would admit `Foo` and
 * `foo` as distinct ids that the registry keys separately — while APFS and
 * NTFS fold them to one directory. Two projects would then share a database,
 * held by two single-connection instances at once. Latent on Linux, live on a
 * macOS dev machine, and it defeats the structural scoping the whole design
 * rests on.
 */
const SAFE_PROJECT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const assertSafeProjectId = (projectId: string): void => {
  if (!SAFE_PROJECT_ID.test(projectId)) {
    throw new Error(
      `Project id '${projectId}' is not usable as a directory name — expected 1-64 lowercase letters, digits, hyphens, or underscores, starting with a letter or digit`
    );
  }
};
