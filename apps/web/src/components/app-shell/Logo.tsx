import { useTranslation } from '../../i18n';

// Y1 logo: pitamark の "i" を SVG ↑ 矢印 + ●ドットで置換。角丸赤枠で囲み、-5° に傾ける。
//
// 設計メモ:
// - SVG の `overflow: visible` により path が viewBox (0 0 8 20) を縦に超えて描画される。
//   path "M4 49 L4 -22" で shaft が text 上下にそれぞれ ~22 単位 (font-size の ~1.4 倍)
//   突き抜ける。font-size 20px (text-xl) なら ~28px ぶん上下にはみ出す。
// - ヘッダの py 設定 (EditorShell.tsx) で矢印の縦突き抜けぶんの padding を確保すること。
// - Konva の color 同期は無関係 (canvas 外の DOM)。Y1 赤は DEFAULT_SYNC_COLOR (#e74c3c)
//   と同じ oklch(60% 0.22 28) を使う。
// - フォントサイズは Tailwind の text-xl (20px) を採用し、PC 表示でブランド要素として
//   十分な存在感を持たせる。md 未満は h1 自体が hidden。
export const Logo = () => {
  const t = useTranslation();
  return (
    <h1
      aria-label={t('common.appName')}
      className="pointer-events-auto hidden self-center text-xl md:block"
    >
      <span
        className="relative inline-block px-2 py-0.5"
        style={{ transform: 'rotate(-5deg)', transformOrigin: '30% 50%' }}
      >
        <span
          className="relative z-[2] select-none whitespace-nowrap font-bold tracking-[-0.015em]"
          style={{ color: 'oklch(18% 0 0)' }}
        >
          p
          <svg
            aria-hidden="true"
            viewBox="0 0 8 20"
            className="inline-block"
            style={{
              width: '0.32em',
              height: '1.05em',
              verticalAlign: '-0.05em',
              overflow: 'visible',
            }}
          >
            <path
              d="M4 49 L4 -22 M0.4 -20 L4 -28 L7.6 -20"
              stroke="oklch(60% 0.22 28)"
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="4" cy="49" r="2.2" fill="oklch(60% 0.22 28)" />
          </svg>
          tamark
        </span>
        <span
          aria-hidden="true"
          className="absolute z-[1] pointer-events-none"
          style={{
            top: '1px',
            left: '-1px',
            right: '2px',
            bottom: '0',
            border: '2px solid oklch(60% 0.22 28)',
            borderRadius: '8px',
          }}
        />
      </span>
    </h1>
  );
};
