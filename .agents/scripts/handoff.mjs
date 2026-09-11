import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { main, revision, root } from './lib/context.mjs';

export function createHandoff(directory, task) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(task ?? '') || task.length > 80) {
    throw new Error('Use a task name of 1–80 lowercase letters/digits separated by hyphens.');
  }
  const tree = revision(directory);
  const values = { TASK: task, ROOT: directory, BRANCH: tree.branch, HEAD: tree.head, DATE: new Date().toISOString() };
  const template = readFileSync(join(directory, '.agents/tasks/_template/handoff.md'), 'utf8');
  const contents = template.replace(/\{\{([A-Z]+)\}\}/gu, (match, key) => values[key] ?? match);
  if (/\{\{[A-Z]+\}\}/u.test(contents)) throw new Error('The handoff template contains an unsupported placeholder.');
  const destination = join(directory, '.agents/tasks', task);
  mkdirSync(destination); // Fail if the task already exists; never overwrite its handoff.
  const file = join(destination, 'handoff.md');
  writeFileSync(file, contents, { flag: 'wx' });
  return file;
}

main(import.meta.url, () => {
  if (process.argv.includes('--help')) {
    console.log('node .agents/scripts/handoff.mjs <task-name>\nCreate a tracked Markdown handoff with current branch/HEAD. Never overwrites an existing task.');
    return;
  }
  if (process.argv.length !== 3) throw new Error('Provide exactly one task name. Use --help.');
  console.log(createHandoff(root, process.argv[2]));
});
