import { describe, it, expect } from 'vitest';
import { slug } from './utils';

describe('slug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slug('My Project')).toBe('my-project');
  });

  it('replaces multiple special characters with a single hyphen', () => {
    expect(slug('Hello!!! World???')).toBe('hello-world');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slug('---leading')).toBe('leading');
    expect(slug('trailing---')).toBe('trailing');
    expect(slug('-both-')).toBe('both');
  });

  it('handles empty strings', () => {
    expect(slug('')).toBe('untitled');
  });

  it('handles strings with only special characters', () => {
    expect(slug('!!!')).toBe('untitled');
    expect(slug('@#$%')).toBe('untitled');
  });

  it('preserves numbers', () => {
    expect(slug('Project 2026')).toBe('project-2026');
  });

  it('handles mixed case and underscores', () => {
    expect(slug('My_File_Name')).toBe('my-file-name');
  });

  it('handles already clean input', () => {
    expect(slug('already-clean')).toBe('already-clean');
  });

  it('collapses consecutive hyphens', () => {
    expect(slug('a   b')).toBe('a-b');
  });
});
