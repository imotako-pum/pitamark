// Phase 8.x SSOT review #1 L3 → re-evaluated as theme 3 follow-up: the
// Konva hex `AWARENESS_USER_PALETTE` and the OKLCH `--color-presence-N`
// CSS variables in `tokens.css` are kept in physical sync (CLAUDE.md
// cross-cutting rule 4 — Konva does not resolve CSS variables).
//
// A full OKLCH→sRGB equivalence check would require pulling in `culori`
// and a deltaE tolerance which is heavier than the drift it would catch.
// The realistic regression mode is "someone added a presence color in
// one file but forgot the other" — count, indexing, and the OKLCH parse
// are sufficient to surface that.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AWARENESS_USER_PALETTE } from '../colors';

const here = dirname(fileURLToPath(import.meta.url));
const TOKENS_CSS = resolve(here, '../../../styles/tokens.css');

const presenceTokenRegex = /--color-presence-(\d+)\s*:\s*oklch\([^)]+\)/g;

describe('AWARENESS_USER_PALETTE ↔ tokens.css presence palette sync', () => {
  it('exposes exactly 8 hex colors in colors.ts', () => {
    expect(AWARENESS_USER_PALETTE).toHaveLength(8);
    for (const hex of AWARENESS_USER_PALETTE) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('declares the same number of `--color-presence-N` tokens in tokens.css', () => {
    const css = readFileSync(TOKENS_CSS, 'utf8');
    const matches = Array.from(css.matchAll(presenceTokenRegex));
    expect(matches).toHaveLength(AWARENESS_USER_PALETTE.length);
  });

  it('numbers --color-presence-1 through --color-presence-8 contiguously', () => {
    const css = readFileSync(TOKENS_CSS, 'utf8');
    const indices = Array.from(css.matchAll(presenceTokenRegex)).map((m) => Number(m[1]));
    indices.sort((a, b) => a - b);
    expect(indices).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
