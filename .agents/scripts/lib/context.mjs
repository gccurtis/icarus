import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../../../', import.meta.url));

export function output(command, args, cwd = root) {
  try {
    return execFileSync(command, args, {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000
    }).trim();
  } catch {
    return undefined;
  }
}

export function revision(directory = root) {
  const status = output('git', ['status', '--porcelain=v1', '--untracked-files=normal'], directory);
  return {
    branch: output('git', ['branch', '--show-current'], directory) || '(detached)',
    head: output('git', ['rev-parse', 'HEAD'], directory) || '(unavailable)',
    changes: status === undefined ? null : status.split('\n').filter(Boolean)
  };
}

export function main(url, run) {
  if (!process.argv[1] || resolve(process.argv[1]) !== fileURLToPath(url)) return;
  Promise.resolve().then(run).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
