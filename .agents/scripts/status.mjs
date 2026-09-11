import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { main, output, revision, root } from './lib/context.mjs';
import { cacheProcesses, processVisibility } from './lib/processes.mjs';
import { readLease } from './lib/lease.mjs';

main(import.meta.url, () => {
  if (process.argv.includes('--help')) {
    console.log('node .agents/scripts/status.mjs [--json]\nRead-only worktree, toolchain, task, lease, and Linux cache-process report. No environment values or credentials are printed.');
    return;
  }
  if (process.argv.slice(2).some((arg) => arg !== '--json')) throw new Error('Unknown option. Use --help.');
  const tree = revision();
  const report = {
    root, branch: tree.branch, head: tree.head, changedEntries: tree.changes?.length ?? 'unknown',
    toolchain: { node: process.version, pnpm: output('pnpm', ['--version']) ?? 'unavailable: use nix develop ./infra/devshell', nix: output('nix', ['--version']) ?? 'unavailable' },
    dependenciesInstalled: existsSync(join(root, 'app/node_modules/vite/bin/vite.js')),
    lease: readLease(root),
    processVisibility: processVisibility(),
    cacheProcesses: cacheProcesses(join(root, 'app')),
    tasks: readdirSync(join(root, '.agents/tasks'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && existsSync(join(root, '.agents/tasks', entry.name, 'handoff.md')))
      .map((entry) => `.agents/tasks/${entry.name}/handoff.md`)
  };
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${report.root}\n${report.branch} @ ${report.head}\nChanged entries: ${report.changedEntries}`);
    console.log(`Node: ${report.toolchain.node} | pnpm: ${report.toolchain.pnpm}\nDependencies: ${report.dependenciesInstalled ? 'present' : 'missing'}`);
    console.log(`Lease: ${report.lease ? JSON.stringify(report.lease) : 'none'}`);
    console.log(`Process visibility: ${report.processVisibility}`);
    console.log('Cache users:', report.cacheProcesses ?? 'unavailable on this platform');
    console.log('Task handoffs:', report.tasks);
    console.log('Process inspection is best effort. Sandboxed/unreadable process lists cannot establish that a worktree is idle.');
  }
});
