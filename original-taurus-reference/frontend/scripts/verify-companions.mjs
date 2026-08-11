#!/usr/bin/env node
// verify-companions — the staleness check for Practice 1 (AGENTS.md).
//
// Every hand-authored source/config file has a `<file>.md` companion that explains it in
// prose with illustrative snippets. Companions are NOT byte-exact mirrors of the source.
// This check enforces the one hard rule: a companion must never be older than the source
// it documents. For each source argument it confirms the companion exists and that the
// source has not changed more recently than the companion — so a source edit without a
// matching companion update is caught. "Last change" is the git commit time, with any
// working-tree change (staged, unstaged, or untracked) treated as newest; filesystem
// mtime is the fallback when git is unavailable.

import { existsSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: verify-companions.mjs <source-file>...');
  process.exit(2);
}

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// "When did this path last change", as a sortable number (higher = more recent). Any
// pending working-tree change ranks as Infinity (newest, not yet committed); otherwise
// the last commit's unix time; mtime is the fallback when git can't answer.
function lastChangeRank(path) {
  if (git(['status', '--porcelain', '--', path]) !== '') return Infinity;
  const committed = git(['log', '-1', '--format=%ct', '--', path]);
  if (committed) return Number(committed);
  try {
    return statSync(path).mtimeMs / 1000;
  } catch {
    return 0;
  }
}

/**
 * Blank out the parts of a source file that are pure presentation, so two
 * versions can be compared for BEHAVIOURAL difference.
 *
 * What counts as presentation: the value of a `class` attribute (and prop
 * variants like `triggerClass`), and `<style>` blocks. Restyling a component —
 * re-centring a control, changing a colour, adjusting spacing — changes only
 * these, and a companion that has to be edited for that is a tax with no reader
 * benefit. See AGENTS.md → Practice 1.
 *
 * Deliberately NOT treated as presentation: Svelte's `class:name={expr}`
 * directives (the expression is logic), and `.css` files (`app.css` carries the
 * design tokens, which are very much load-bearing).
 */
function withoutPresentation(text) {
  let out = text.replace(/<style[\s\S]*?<\/style>/g, '<style/>');
  // Quoted class attributes: class="…" / triggerClass='…'
  out = out.replace(/\b([A-Za-z]*[Cc]lass)=("[^"]*"|'[^']*')/g, '$1=""');
  // Braced ones: class={ … }, brace-matched so nested {} and cn(...) are handled.
  for (const attr of ['class', 'Class']) {
    let index = 0;
    for (;;) {
      const match = out.slice(index).match(new RegExp(`\\b[A-Za-z]*${attr}=\\{`));
      if (!match) break;
      const open = index + match.index + match[0].length - 1;
      let depth = 0;
      let close = -1;
      for (let i = open; i < out.length; i += 1) {
        if (out[i] === '{') depth += 1;
        else if (out[i] === '}') {
          depth -= 1;
          if (depth === 0) {
            close = i;
            break;
          }
        }
      }
      if (close < 0) break;
      out = out.slice(0, open + 1) + out.slice(close);
      index = open + 2;
    }
  }
  return out;
}

/** The source as it stood when the companion was last committed, or null. */
function sourceAtCompanionBaseline(source, companion) {
  const commit = git(['log', '-1', '--format=%H', '--', companion]);
  if (!commit) return null;
  try {
    return execFileSync('git', ['show', `${commit}:${source}`], { encoding: 'utf8' });
  } catch {
    return null;
  }
}

let failed = false;
for (const source of files) {
  const companion = source + '.md';
  if (!existsSync(companion)) {
    console.log(`NO COMPANION  ${companion}`);
    failed = true;
    continue;
  }
  // The companion must be at least as new as its source. Editing both together (same
  // working-tree change or same commit) passes; touching only the source flags STALE.
  if (lastChangeRank(source) > lastChangeRank(companion)) {
    // …unless everything that changed is presentation. A CSS-only edit does not
    // make the prose wrong, so demanding a companion edit for it only teaches
    // people to touch the file to silence the check.
    const before = sourceAtCompanionBaseline(source, companion);
    const after = existsSync(source) ? readFileSync(source, 'utf8') : null;
    if (before !== null && after !== null &&
        withoutPresentation(before) === withoutPresentation(after)) {
      console.log(`OK            ${source}  (presentation-only change since ${companion})`);
      continue;
    }
    console.log(`STALE         ${source}  (changed after ${companion} — update the companion)`);
    failed = true;
    continue;
  }
  console.log(`OK            ${source}`);
}

process.exit(failed ? 1 : 0);
