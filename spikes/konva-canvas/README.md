# Spike A — Konva Canvas

Phase 0 技術スパイク。Konva で画像描画 + 矩形 CRUD のローカル動作を確認する。

## Goal

- 画像 D&D アップロード（クライアント完結、URL.createObjectURL）
- Konva Stage で画像表示（resize 追従）
- 矩形 CRUD（クリックで追加 / ドラッグで移動 / Delete or Backspace で削除）
- 不変パターンの単体テスト 6 件以上 (`rect.ts`)

## Run

```sh
# リポジトリルートで一度だけ
pnpm install

# このスパイクを起動
pnpm --filter konva-canvas dev
# -> http://localhost:5173

# 単体テスト
pnpm --filter konva-canvas test

# 型チェック
pnpm --filter konva-canvas exec tsc --noEmit
```

## What to verify

- [ ] PNG / JPEG をD&Dすると Stage に表示される
- [ ] PDF など非画像ファイルをD&Dするとエラー文言が出る
- [ ] 10MB超の画像をD&Dすると警告される
- [ ] Stage 上をクリックすると 120x80 の矩形が追加される
- [ ] 矩形をドラッグすると最終位置に移動する（state は不変パターンで更新）
- [ ] 選択中（青枠太め）の矩形は Delete / Backspace で消える
- [ ] ウィンドウリサイズで Stage サイズが追従する
- [ ] vitest が `rect.ts` の 6 件以上を GREEN にする

## Bundle Size

`pnpm --filter konva-canvas build` 後に `dist/assets/*.js` の gzipped サイズを以下のように測る:

```sh
cd spikes/konva-canvas/dist/assets
for f in *.js; do printf "%-40s %s\n" "$f" "$(gzip -c "$f" | wc -c) bytes"; done
```

PRD の Konva 採用根拠 "~80KB gz" の妥当性を検証する。

## Observations

(実機で動かしてここに書く: Stage FPS, ドラッグ体感, bundle size 実測値, 想定外の挙動)
