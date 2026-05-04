# Phase 7.8-5 dogfood checklist

> dogfood 実施中の作業ノート。完了後にこのファイルを `phase-7.8-5-dogfood-help-report.md` に統合 or 別添する想定。
> Plan: `.claude/PRPs/plans/phase-7.8-5-dogfood-help.plan.md` Task 5 / Task 6 の作業領域。

## 期間

- 開始: 2026-05-XX (オーナー dogfood 開始日を記入)
- 終了予定: 開始日 +7 日
- 対象: 実業務でのスクショ注釈 30 画像以上

## 目的

Phase 7.8-1/-2/-3 (Auto-next-A、Auto-next-B、フォントサイズ UI) を実業務で 1 週間回し:

1. PRD §Success Metrics を実測値で埋める
2. 主要定数 3 つの据置 or 調整を決定
3. HelpModal の発見性が dogfood 中に十分かを確認

Smart snap (Phase 4) は defer 済 (2026-05-04 ユーザー判断、stash@{0})。本 dogfood で「snap が無くて困った」状況が頻発するなら別 phase で再実装を検討。

---

## 計測指標 (PRD §Success Metrics)

| Metric | Target | 実測 | 達成 |
|---|---|---|---|
| 矢印+テキスト 3 連発 所要時間 | 15 秒以内 (Phase 7.7 比 50% 短縮) | __ 秒 | ☐ |
| 1 画像あたり注釈数中央値 | Phase 7.7 比 1.5 倍 | __ vs __ | ☐ |
| 次手予測「邪魔」頻度 | 1 セッション 1 回未満 | __ 回 / __ セッション | ☐ |
| Smart snap「邪魔」頻度 | (defer のため計測対象外) | N/A | N/A |
| フォントサイズ変更が必要な場面で実際に変更できる | 100% | __ / __ 場面 | ☐ |
| Yjs 多人数で次手予測が暴発しない | データ崩壊なし | ☐ |  |

### 計測方法

- **3 連発所要時間**: 適当な画像 1 枚で「矢印+テキスト × 3 連続」をストップウォッチ (mac の Stopwatch app など) で 5 試行、中央値
- **注釈数中央値**: 1 週間中の保存画像をカウントして 1 画像あたりの注釈数を集計。Phase 7.7 期 (2026-04-XX 〜) との比較は room id でフィルタ可能なら自動、なければ感覚値で OK
- **邪魔頻度**: 「サジェストで困った」「Esc で消した」「BS で予期せず消えた」を 1 セッション = 1 画像作業中にカウント。1 日終わりに集計
- **フォントサイズ**: 「サイズ変えたい」と思った場面で実際にボタン or `[`/`]` で変えられたかを yes/no カウント

---

## チューニング対象定数

| 定数 | 現値 | 場所 | dogfood 後の判断 |
|---|---|---|---|
| AUTO_NEXT_TEXT_OFFSET_PX | 8 | apps/web/src/lib/autoNextOffset.ts:6 | (据置 / __ px に変更) |
| AUTO_ARROW_DEFAULT_LENGTH_PX | 100 | apps/web/src/lib/autoArrowDefault.ts:5 | (据置 / __ px に変更) |
| FONT_SIZE_STEP | 2 | apps/web/src/lib/fontSize.ts:8 | (据置 / __ px に変更) |

判断基準:

- **OFFSET_PX**: text が矢印終端に近すぎ/遠すぎないか。8/12/16 の 3 案を mental compare
  - 近すぎ → 矢印鏃と text が重なる
  - 遠すぎ → 視線移動が増える
- **DEFAULT_LENGTH_PX**: 矩形→矢印プレビューの長さが「指したい場所」と概ね一致するか。100/80/120 の 3 案
- **FONT_SIZE_STEP**: `[`/`]` で 1 回押すたびの 2px が刻みすぎ / 粗すぎないか。1/2/4 の 3 案

---

## 観察ポイント (自己申告)

- [ ] **矢印終端の text offset は近すぎ/遠すぎないか** (OFFSET_PX 据置可否の根拠)
- [ ] **矩形→矢印の既定 (右下 45° / 100px) で 8 割の指摘がカバーできるか** (DEFAULT_LENGTH_PX + 角度据置可否の根拠)
- [ ] **フォントサイズ `[`/`]` を 1 セッションで何回押すか / Δ2 が刻みすぎていないか** (FONT_SIZE_STEP 据置可否の根拠)
- [ ] **キャンセル誤操作 (BS で矩形まで消えてしまった等) が起きるか** (UX バグの兆候)
- [ ] **HelpModal の「次手予測」セクションが、新規にツアーするユーザーから見て発見できるか** (機会があれば 1 名以上に触ってもらう)
- [ ] **Smart snap が無くて困る場面があるか** (再実装の必要性根拠)
- [ ] **Shottr に戻りたいと思うか** (overall qualitative)

---

## 完了条件 (Plan Task 5)

- [ ] 30 画像以上に注釈
- [ ] 上記 metric を全て計測 (1 つでも未計測ならその理由を明記)
- [ ] 3 定数の据置 / 調整を判定
- [ ] PRD §Success Metrics 表に実測値を反映 (or このファイルへのリンクで代替)
- [ ] HelpModal の発見性チェック (オーナー以外 1 名以上の機会があれば)

## 完了後アクション (Plan Task 6)

- [ ] 値を変える定数があれば該当 `.ts` 編集 + コメント末尾「dogfood で再評価する」を実施日 + 結論に書き換え
- [ ] 値変更時は `apps/web/e2e/auto-next-*.spec.ts` の regression を確認 (`pnpm -F @snap-share/web test:e2e`)
- [ ] このファイルを `phase-7.8-5-dogfood-help-report.md` に統合 (or `[checklist](./phase-7.8-5-dogfood-checklist.md)` リンクで残す)
- [ ] PRD の Phase 5 行を `complete` に変更

---

## 観察ログ (実施中追記欄)

### 2026-05-XX

- 例: 1 画像 6 注釈 / 矢印+text 3 連発 14 秒 / Esc 0 回 / BS 0 回 / フォントサイズ変更 1 回 (90 → 12px)

### 2026-05-XX

-

---

*Generated: 2026-05-04 (Phase 7.8-5 plan Task 4)*
