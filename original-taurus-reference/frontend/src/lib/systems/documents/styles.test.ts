import { describe, it, expect } from 'vitest';
import {
  ALPHA_BLOCK_KINDS,
  TYPOGRAPHY_TOKENS,
  typographyStyleId,
  typographyStyleDefinition,
  defaultTypographyForKind,
  kindDefaultTypography,
  effectiveTypography,
  typographyCss,
  customTypographyCss,
  customTypographyEmpty
} from './styles';
import type { StyleRegistry } from './types';

describe('typographyStyleDefinition', () => {
  it('has a stable id and applies to every Alpha block kind', () => {
    const def = typographyStyleDefinition('heading');
    expect(def.id).toBe('typography-heading');
    expect(def.id).toBe(typographyStyleId('heading'));
    expect(def.typography).toBe('heading');
    // Omega requires each applicable kind to be listed explicitly (no wildcard).
    expect(def.appliesTo).toEqual([...ALPHA_BLOCK_KINDS]);
    expect(def.allowOverrides).toContain('typography');
  });

  it('names the definition from the token label', () => {
    expect(typographyStyleDefinition('body_small').name).toBe('Body small');
  });
});

describe('defaultTypographyForKind (the built-in convention)', () => {
  it('maps code → code, prompt → label, text/callout → body', () => {
    expect(defaultTypographyForKind('text')).toBe('body');
    expect(defaultTypographyForKind('callout')).toBe('body');
    expect(defaultTypographyForKind('code')).toBe('code');
    expect(defaultTypographyForKind('prompt')).toBe('label');
  });
});

describe('kindDefaultTypography', () => {
  const registry: StyleRegistry = {
    definitions: [typographyStyleDefinition('title')],
    defaults: [{ blockKind: 'text', styleId: 'typography-title' }]
  };

  it('returns the registry default style typography when set', () => {
    expect(kindDefaultTypography('text', registry)).toBe('title');
  });

  it('falls back to the convention when the kind has no default', () => {
    expect(kindDefaultTypography('code', registry)).toBe('code'); // convention
    expect(kindDefaultTypography('callout', registry)).toBe('body');
  });

  it('falls back to the convention when the default points at a missing definition', () => {
    const broken: StyleRegistry = {
      definitions: [],
      defaults: [{ blockKind: 'text', styleId: 'ghost' }]
    };
    expect(kindDefaultTypography('text', broken)).toBe('body');
  });
});

describe('effectiveTypography (resolution order)', () => {
  const registry: StyleRegistry = {
    definitions: [typographyStyleDefinition('heading'), typographyStyleDefinition('code')],
    defaults: [{ blockKind: 'text', styleId: 'typography-code' }]
  };

  it('1) an explicit override wins over everything', () => {
    const ref = { styleId: 'typography-heading', overrides: { typography: 'display' as const } };
    expect(effectiveTypography('text', ref, registry)).toBe('display');
  });

  it('2) the assigned style wins over the kind default', () => {
    expect(effectiveTypography('text', { styleId: 'typography-heading' }, registry)).toBe('heading');
  });

  it('3) the kind registry default applies when no styleRef', () => {
    expect(effectiveTypography('text', null, registry)).toBe('code');
  });

  it('4) the convention applies when nothing else resolves', () => {
    expect(effectiveTypography('prompt', null, registry)).toBe('label');
    // styleRef pointing at an unknown style falls through to the kind default/convention.
    expect(effectiveTypography('prompt', { styleId: 'ghost' }, registry)).toBe('label');
  });
});

describe('typographyCss', () => {
  it('produces a CSS fragment for every token', () => {
    for (const { value } of TYPOGRAPHY_TOKENS) {
      const css = typographyCss(value);
      expect(css).toMatch(/font-(size|family)/);
    }
  });

  it('uses a monospace family for code and italic for quote', () => {
    expect(typographyCss('code')).toContain('monospace');
    expect(typographyCss('quote')).toContain('italic');
  });
});

describe('customTypographyCss (real fonts)', () => {
  it('emits only the set fields, fg → color and bg → background-color', () => {
    expect(customTypographyCss({ fontSize: '20px' })).toBe('font-size: 20px');
    expect(customTypographyCss({ fontFamily: 'Source Serif 4', fg: '#b42318' })).toBe(
      'font-family: Source Serif 4; color: #b42318'
    );
    expect(customTypographyCss({ fg: '#111', bg: '#eee' })).toBe('color: #111; background-color: #eee');
  });

  it('returns empty string for null/blank', () => {
    expect(customTypographyCss(null)).toBe('');
    expect(customTypographyCss({ fontSize: '  ' })).toBe('');
  });
});

describe('customTypographyEmpty', () => {
  it('is true only when no field is set', () => {
    expect(customTypographyEmpty(null)).toBe(true);
    expect(customTypographyEmpty({})).toBe(true);
    expect(customTypographyEmpty({ fg: '   ' })).toBe(true);
    expect(customTypographyEmpty({ fg: '#000' })).toBe(false);
    expect(customTypographyEmpty({ bg: '#fff' })).toBe(false);
  });
});
