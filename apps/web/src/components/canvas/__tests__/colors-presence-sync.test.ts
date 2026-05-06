// Konva hex の `AWARENESS_USER_PALETTE` と `tokens.css` の OKLCH `--color-presence-N`
// CSS 変数を物理的に同期させる (CLAUDE.md cross-cutting rule 4 — Konva は CSS 変数を
// 解決しない)。OKLCH→sRGB の完全等価チェックには `culori` と deltaE 許容差が必要で、
// 検出したい drift に対して overkill。現実的な regression は「片方に presence color を
// 追加してもう片方を忘れる」パターンなので、count / indexing / OKLCH parse で十分捕まる。

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
