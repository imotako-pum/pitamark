# Spike C — shadcn/ui + Vite + Tailwind v4

Phase 0 技術スパイク。Tailwind v4 と shadcn/ui の Vite 統合を確認し、snap-share UI 層への採用可否を判断する。

## ⚠️ 実装上の注意（Plan 逸脱）

Plan の Task 10 では `pnpm dlx shadcn@latest init` を CLI 対話で実行する想定だった。今回は **auto mode で対話 CLI が走らせられない** ため、CLI が生成するであろう以下のファイルを **手動で等価生成** している:

- `components.json`（shadcn 設定）
- `src/lib/utils.ts`（`cn()` ヘルパー）
- `src/components/ui/button.tsx` / `dialog.tsx` / `input.tsx`（New York スタイル相当）
- `src/index.css`（Tailwind v4 + shadcn テーマトークン）

**最終採用判断には、ユーザが手元で `pnpm dlx shadcn@latest init` を実行して摩擦を体感する必要がある**。本スパイクは「CLI が同等の結果を出すこと」「Tailwind v4 + Vite + Radix UI が組合せで動くこと」までを担保する。

## Goal

- `@tailwindcss/vite` プラグインで Tailwind v4 を Vite に統合
- `@/*` path alias を `tsconfig.json` (composite) と `vite.config.ts` の両方で解決
- shadcn の Button / Dialog / Input が Tailwind v4 のテーマで描画される
- 日本語ラベルが文字化けせず表示される
- Dialog が Esc キーで閉じる、フォーカストラップが動く

## Run

```sh
# リポジトリルートで一度だけ
pnpm install

pnpm --filter shadcn-vite dev
# -> http://localhost:5173

pnpm --filter shadcn-vite exec tsc --noEmit  # 型チェック
```

## What to verify

- [ ] 6種類の Button バリアントが個別に描画される
- [ ] Button クリックで Dialog が開く
- [ ] Dialog 内の Input に日本語入力できる
- [ ] Dialog の Esc キーでクローズできる
- [ ] 「送信」ボタンで state 更新・表示される
- [ ] `tsc --noEmit` がゼロエラーで通る
- [ ] hover / focus-visible スタイルが想定通り
- [ ] ブラウザ DevTools で OKLCH カスタムプロパティが適用されている

## Adoption Decision Criteria

採用条件:
- 上記すべて ✅
- `pnpm dlx shadcn@latest init` を手元で実行して 30 秒以内に完了する
- 自前で書いていた `index.css` のテーマトークンが CLI 生成物と矛盾しない

不採用条件:
- Tailwind v4 + Vite で hot reload が安定しない
- shadcn が Tailwind v4 と競合する
- `cn()` / `cva` の体験が snap-share の最小UIに対して過剰

## Observations

(実機で動かしてここに書く: install 摩擦, hot reload 体感, 日本語表示, 採用判断)
