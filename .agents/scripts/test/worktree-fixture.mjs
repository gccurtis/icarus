import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from '../lib/context.mjs';
import { git } from '../lib/worktrees/git.mjs';
import { startWorktree } from '../lib/worktrees/start.mjs';

/** Real Git repositories, including a local bare origin; never contacts the product remote. */
export function repository(t) {
  const container = mkdtempSync(join(tmpdir(), 'icarus-agent-worktree-test-'));
  t.after(() => rmSync(container, { recursive: true, force: true }));
  const primary = join(container, 'primary');
  const origin = join(container, 'origin.git');
  mkdirSync(primary);
  git(primary, 'init', '--initial-branch=main');
  git(primary, 'config', 'user.name', 'Worktree test');
  git(primary, 'config', 'user.email', 'worktree-test@example.invalid');
  git(primary, 'config', 'commit.gpgsign', 'false');
  git(primary, 'config', 'core.hooksPath', join(container, 'no-hooks'));
  mkdirSync(join(primary, '.agents/tasks/_template'), { recursive: true });
  cpSync(join(root, '.agents/tasks/_template/handoff.md'), join(primary, '.agents/tasks/_template/handoff.md'));
  cpSync(join(root, '.agents/scripts'), join(primary, '.agents/scripts'), {
    recursive: true, filter: (path) => !path.startsWith(join(root, '.agents/scripts/test'))
  });
  writeFileSync(join(primary, '.agents/.gitignore'), 'runtime/\n');
  writeFileSync(join(primary, '.gitignore'), '.env\napp/node_modules/\ndata/\n');
  writeFileSync(join(primary, 'AGENTS.md'), '# Test repository\n');
  commit(primary, 'Initial fixture');
  git(container, 'init', '--bare', '--initial-branch=main', origin);
  git(primary, 'remote', 'add', 'origin', origin);
  git(primary, 'push', '-u', 'origin', 'main');
  return { container, primary, origin };
}

export function commit(directory, message = 'Task work') {
  git(directory, 'add', '--all'); // Only this disposable fixture is owned by the test.
  git(directory, 'commit', '-m', message);
  return git(directory, 'rev-parse', 'HEAD').trim();
}

export function taskOf(fixture, name = 'test-task') {
  return startWorktree(fixture.primary, name, join(fixture.container, name));
}

export function integrate(fixture, task, publish = true) {
  git(fixture.primary, 'merge', '--ff-only', task.branch);
  if (publish) git(fixture.primary, 'push', 'origin', 'main');
}

export function cli(directory, ...args) {
  return spawnSync(process.execPath, ['.agents/scripts/worktree.mjs', ...args], {
    cwd: directory, encoding: 'utf8', timeout: 30000
  });
}
