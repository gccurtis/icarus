import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { main, root } from './lib/context.mjs';
import { startWorktree } from './lib/worktrees/start.mjs';
import { inspectWorktree, readyWorktree } from './lib/worktrees/status.mjs';
import { removeWorktree } from './lib/worktrees/remove.mjs';
import { linkWorktreeConfiguration } from './lib/worktrees/configuration.mjs';

main(import.meta.url, () => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { path: { type: 'string' }, confirm: { type: 'string' }, help: { type: 'boolean' } }
  });
  if (values.help) {
    console.log(`node .agents/scripts/worktree.mjs start <task> [--path <absolute>]
node .agents/scripts/worktree.mjs status [--path <registered-worktree>]
node .agents/scripts/worktree.mjs ready [--path <registered-worktree>]
node .agents/scripts/worktree.mjs configure [--path <registered-worktree>]
node .agents/scripts/worktree.mjs remove <task> --confirm <task>

Start fetches origin/main, creates work/<task> in a sibling directory (or --path),
records its base/handoff, and links ignored app/configuration/local.yaml from the
primary checkout when present. Configure applies that same link to an existing
linked worktree. Both preserve local files/different links and never read secrets.
Tracked configuration stays worktree-owned; no data/secrets/caches are copied or
packages installed. A missing primary local.yaml is reported; no new link is created.
Status is read-only. Ready fetches origin/main and reports Git preflight, not test
certification. Remove refuses dirty, unmerged, locked, active, or data-bearing
worktrees, including the ignored configuration link; after checking its exact path
and target, unlink only that worktree link before removal. Never delete its source.
No command merges, rebases, commits, or pushes. Use --help before choosing an action.`);
    return;
  }
  const [action, task, extra] = positionals;
  if (extra || !['start', 'status', 'ready', 'configure', 'remove'].includes(action)) throw new Error('Choose one worktree action; use --help.');
  if (values.confirm && action !== 'remove') throw new Error('--confirm is only for remove.');
  if (action === 'remove' && values.path) throw new Error('Remove identifies its target by registered task branch, not --path.');
  if (['status', 'ready', 'configure'].includes(action) && task) throw new Error('Status/ready/configure take --path, not a task name.');
  const directory = values.path ? resolve(values.path) : root;
  let report;
  if (action === 'start') report = startWorktree(root, task, values.path);
  if (action === 'status') report = inspectWorktree(directory);
  if (action === 'ready') report = readyWorktree(directory);
  if (action === 'configure') report = linkWorktreeConfiguration(directory);
  if (action === 'remove') report = removeWorktree(root, task, values.confirm);
  console.log(JSON.stringify(report, null, 2));
  if (action === 'ready' && !report.gitReady) process.exitCode = 1;
});
