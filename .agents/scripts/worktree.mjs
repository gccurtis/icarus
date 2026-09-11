import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { main, root } from './lib/context.mjs';
import { startWorktree } from './lib/worktrees/start.mjs';
import { inspectWorktree, readyWorktree } from './lib/worktrees/status.mjs';
import { removeWorktree } from './lib/worktrees/remove.mjs';

main(import.meta.url, () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { path: { type: 'string' }, confirm: { type: 'string' }, help: { type: 'boolean' } }
  });
  if (values.help) {
    console.log(`node .agents/scripts/worktree.mjs start <task> [--path <absolute>]
node .agents/scripts/worktree.mjs status [--path <registered-worktree>]
node .agents/scripts/worktree.mjs ready [--path <registered-worktree>]
node .agents/scripts/worktree.mjs remove <task> --confirm <task>

Start fetches origin/main, creates work/<task> in a sibling directory (or --path),
and records its base/handoff. It does not copy data/secrets/caches or install packages.
Status is read-only. Ready fetches origin/main and reports Git preflight, not test
certification. Remove refuses dirty, unmerged, locked, active, or data-bearing
worktrees, including ignored caches/logs; it never forces removal or deletes branches.
No command merges, rebases, commits, or pushes. Use --help before choosing an action.`);
    return;
  }
  const [action, task, extra] = positionals;
  if (extra || !['start', 'status', 'ready', 'remove'].includes(action)) throw new Error('Choose one worktree action; use --help.');
  if (values.confirm && action !== 'remove') throw new Error('--confirm is only for remove.');
  if (action === 'remove' && values.path) throw new Error('Remove identifies its target by registered task branch, not --path.');
  if (['status', 'ready'].includes(action) && task) throw new Error('Status/ready take --path, not a task name.');
  const directory = values.path ? resolve(values.path) : root;
  let report;
  if (action === 'start') report = startWorktree(root, task, values.path);
  if (action === 'status') report = inspectWorktree(directory);
  if (action === 'ready') report = readyWorktree(directory);
  if (action === 'remove') report = removeWorktree(root, task, values.confirm);
  console.log(JSON.stringify(report, null, 2));
  if (action === 'ready' && !report.gitReady) process.exitCode = 1;
});
