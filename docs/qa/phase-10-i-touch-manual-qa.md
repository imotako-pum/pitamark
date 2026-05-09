# Phase 10.I — 実機タッチ手動 QA チェックリスト

**Date**: 2026-05-09 起票
**対象**: iPhone Safari (iOS 17+) + Android Chrome (Pixel 5/6/7 系)
**目的**: PRD `phase-10-i-touch-optimization.prd.md` の Acceptance Criteria のうち、自動化が困難な項目を実機消費可能な手順に落とす
**実施手順 (共通)**:
1. `pnpm dev` でローカル起動 (web: 5173 / api: 8787)
2. ngrok or 同 LAN で 5173 を実機からアクセス可能にする (例: `ngrok http 5173` → 発行 URL を実機 Safari/Chrome で開く)
3. 各セクションを実機で消費し、結果欄を埋める
4. すべて完了したら `phase-10-i-umbrella-report.md` の Acceptance Criteria 達成度 table に値を反映

---

## 1. 基本機能パリティ — 4 形状 × 3 操作 = 12 ケース

> 自動 (`apps/web/e2e/touch-acceptance.spec.ts`) で mobile-chrome (Pixel 5 emulation) 通過済。実機での再消費は emulation と挙動差がないか確認するための保険。

### iPhone Safari

| # | 操作 | iPhone Safari | 備考 |
|---|---|:--:|---|
| 1 | 矩形を 1 本指 drag で追加 (60,60→160,160) | ☐ | 100×100 程度の矩形が描けること |
| 2 | 矢印を 1 本指 drag で追加 (50,50→200,200) | ☐ | 鏃は始点側、Auto-next-A で text 自動配置 |
| 3 | ハイライトを 1 本指 drag で追加 (70,70→170,170) | ☐ | 半透明の矩形 |
| 4 | テキストを tap で追加 (100,100) | ☐ | IME 立ち上がる、Esc で確定 |
| 5 | 矩形を select ツール + drag で移動 | ☐ | 選択 → 中央 drag で動く |
| 6 | 矢印を select ツール + drag で移動 | ☐ | 矢印本体 drag で from/to 連動 |
| 7 | ハイライトを select ツール + drag で移動 | ☐ | |
| 8 | テキストを select ツール + drag で移動 | ☐ | |
| 9 | 矩形を選択 → 削除ボタン tap で削除 | ☐ | |
| 10 | 矢印を選択 → 削除ボタン tap で削除 | ☐ | Auto-next-A の text も別途削除する |
| 11 | ハイライトを選択 → 削除ボタン tap で削除 | ☐ | |
| 12 | テキストを選択 → 削除ボタン tap で削除 | ☐ | |

### Android Chrome (Pixel)

| # | 操作 | Pixel Chrome | 備考 |
|---|---|:--:|---|
| 1〜12 | (同上) | ☐ | |

---

## 2. 誤操作率 — 5 試行

**手順**: 各デバイスで「画像投入 → 任意の構成で 5 つの annotation を追加 → 5 つすべてを移動 → 5 つすべてを削除」のタスクを 5 回繰り返す。各タスクで「意図しない描画 / ジェスチャ衝突 (例: 描画したいのにピンチ起動 / 既存図形を動かしたいのに新規描画) が発生した回数」をカウントする。

**Acceptance**: 5 試行平均で 1 タスク中 1 回未満。

### iPhone Safari

| 試行 # | 誤操作回数 | コメント |
|---|:--:|---|
| 1 | _ |  |
| 2 | _ |  |
| 3 | _ |  |
| 4 | _ |  |
| 5 | _ |  |
| **平均** | _ | < 1 が Pass |

### Android Chrome

| 試行 # | 誤操作回数 | コメント |
|---|:--:|---|
| 1 | _ |  |
| 2 | _ |  |
| 3 | _ |  |
| 4 | _ |  |
| 5 | _ |  |
| **平均** | _ | < 1 が Pass |

---

## 3. selection handle ヒット率 — 5 試行 × 4 形状 × 2 デバイス = 40 試行

**手順**: 各形状を 1 つ追加 → select ツールで shape を選択 → 表示された **selection handle (Transformer anchor / arrow endpoint Circle)** を指 1 本で **掴む** ことを 5 回試行する。1 回で掴めれば成功、ハンドルを外して掴めなければ失敗。

**Acceptance**: 40 試行中 36 件以上成功 (90%)。

### iPhone Safari

| 形状 | 試行 1 | 試行 2 | 試行 3 | 試行 4 | 試行 5 | 成功率 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 矩形 | _ | _ | _ | _ | _ | _ |
| 矢印 (from / to handle) | _ | _ | _ | _ | _ | _ |
| ハイライト | _ | _ | _ | _ | _ | _ |
| テキスト (Transformer なし、shape 自体の tap で代替) | _ | _ | _ | _ | _ | _ |

### Android Chrome

| 形状 | 試行 1 | 試行 2 | 試行 3 | 試行 4 | 試行 5 | 成功率 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 矩形 | _ | _ | _ | _ | _ | _ |
| 矢印 | _ | _ | _ | _ | _ | _ |
| ハイライト | _ | _ | _ | _ | _ | _ |
| テキスト | _ | _ | _ | _ | _ | _ |

| **40 試行合計成功率** | _ | 36/40 (90%) 以上が Pass |

---

## 4. リアルタイム共同編集 (mobile → PC) — 同期遅延

**手順**:
1. PC Chrome で `pnpm dev` を開き Room 作成 → URL を実機にコピー
2. 実機 Safari で同 URL を開く
3. 実機で「矩形 → 矢印 → ハイライト → テキスト」を順に 1 つずつ追加
4. PC 側で各 annotation が表示されるまでのストップウォッチ計測

**Acceptance**: 各 annotation で 1 秒以内に PC 側に反映。

### iPhone Safari → PC

| 形状 | 反映時間 (ms) | 備考 |
|---|:--:|---|
| 矩形 | _ | |
| 矢印 | _ | |
| ハイライト | _ | |
| テキスト | _ | |

### Android Chrome → PC

| 形状 | 反映時間 (ms) | 備考 |
|---|:--:|---|
| 矩形 | _ | |
| 矢印 | _ | |
| ハイライト | _ | |
| テキスト | _ | |

---

## 5. CWV — Lighthouse mobile profile

**手順**:
1. PC Chrome DevTools の Lighthouse タブを開く
2. Mode: Navigation (default) / Device: Mobile / Categories: Performance のみ ON
3. 実機 Safari でも同 URL を開いて、`Lighthouse mobile` を実行 (PWA Installer の URL として `chrome://inspect` 経由で実機接続でも可)
4. LCP / INP / CLS の値を記録

**Acceptance**: 既存 PRD 基準を割らない (LCP < 2.5s / INP < 200ms / CLS < 0.1)。

### Lighthouse mobile (Chromium DevTools emulation)

| Metric | 値 | Pass? |
|---|:--:|:--:|
| LCP | _ ms | < 2500ms |
| INP | _ ms | < 200ms |
| CLS | _ | < 0.1 |

### 実機 (任意、推奨)

iPhone Safari + Pixel Chrome の Real User Monitoring データは Phase 10.G の 1 ヶ月 Analytics 観察で収集する設計のため、本 docs での実機 CWV は spot check 任意。

---

## 6. 既知の問題 / 推奨事項

> ドッグフード時に発見した問題を著者がここに書き足す。Phase 10.I 完了後の引き継ぎ事項として umbrella report に集約。

- (空欄)
- (空欄)

---

## 7. 完了チェックリスト

- [ ] §1 iPhone Safari 12 ケースすべて Pass
- [ ] §1 Android Chrome 12 ケースすべて Pass
- [ ] §2 誤操作率 平均 < 1/5 (両デバイス)
- [ ] §3 handle hit 40 試行で 36/40 以上 (90%)
- [ ] §4 mobile→PC 同期 8 件すべて < 1000ms
- [ ] §5 CWV LCP < 2500ms / INP < 200ms / CLS < 0.1
- [ ] §6 既知の問題に新規発見を反映
- [ ] umbrella report の Acceptance Criteria 表に結果転記
