# Spike B — Yjs + Cloudflare Durable Objects

Phase 0 技術スパイク。`y-durableobjects` を Hono + Cloudflare Workers + Durable Objects (Hibernation) で動かし、2クライアント間の Yjs 同期を確認する。

## Goal

- `y-durableobjects` v1.0.5 の `yRoute` shorthand で Workers 側を最小コードで配線
- Vite で React クライアントを建て、`y-websocket` で WebSocket 接続
- 2 タブ間で `Y.Text` の編集が同期される
- Hibernation 中も WS が維持され、5分以上アイドル後の再入力で復帰

## Run

ターミナル 2 つ必要。

```sh
# 1. Workers (Durable Object) を起動
cd spikes/yjs-durable-object
pnpm install
pnpm wrangler dev --port 8787  # 初回は Cloudflare ログイン不要(--local モード)

# 2. クライアント (別ターミナル) を起動
cd spikes/yjs-durable-object/client
pnpm vite --port 5174  # ルートからは `pnpm --filter yjs-durable-object-client dev` でも可
# -> http://localhost:5174 を 2 タブで開く
```

ヘルスチェック: `curl http://localhost:8787/health` -> `{"ok":true,"spike":"yjs-durable-object"}`

## What to verify

- [ ] Workers 起動時に migrations が適用される（`new_classes = ["YDurableObjects"]`）
- [ ] クライアント起動時に WS 接続状態が `connecting` -> `connected` に遷移
- [ ] 2 タブで textarea を編集すると 200ms 以内に反映
- [ ] `wrangler tail` でエラーログがゼロ
- [ ] 片方を 5 分以上アイドル → 戻ってきて入力 → 同期が継続
- [ ] DO が Hibernation 中も WS 接続が維持される（`web_socket_auto_reply_to_close` 有効、compatibility_date 2026-04-07 以降）

## Latency 測定

簡易計測: 片方の Console で `performance.now()` を記録し、他方の `observe` callback で記録、`wrangler tail` のタイムスタンプと突き合わせる。

## Observations

(実機で動かしてここに書く: 同期遅延 ms, Hibernation 復帰時間, 想定外の挙動, パッケージ名/バージョンのブレ)
