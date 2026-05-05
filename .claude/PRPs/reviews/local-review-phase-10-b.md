# Local Review: Phase 10.B — 公開リリース最低限整備

**Reviewed**: 2026-05-05
**Branch**: `feat/phase-10-launch-prep` (7 commits ahead of `main`)
**Mode**: Local review (PR 未作成、`git diff main...HEAD` ベース)
**Decision**: **APPROVE with minor comments** — CRITICAL / HIGH 0 件、MEDIUM 1 件、LOW 2 件

## Summary

Phase 10 PRD で確定した「TTL 仕様変更 (default 24h / max 7d / per-room override)」「CHANGELOG 起票」「TOS / プライバシーポリシー draft」「通報窓口」「OGP / meta」の 5 項目を 7 commit で完了。コード変更は TTL のみで、shared schema → service → route → tests の 4 層を一貫して TDD で実装。残りはドキュメント整備で破壊的変更は無い。

## Files Reviewed

| File | Change | Assessment |
|---|---|---|
| `packages/shared/src/room.ts` | DEFAULT 24h、MAX_ROOM_TTL_MS 新設 | OK |
| `packages/shared/src/__tests__/room.test.ts` | アサーション分割 | OK |
| `apps/api/src/services/room-service.ts` | RoomCreateOptions.ttlMs + assertValidRequestedTtlMs | OK |
| `apps/api/src/__tests__/services/room-service.test.ts` | 7 件のテスト追加 | OK |
| `apps/api/src/routes/rooms.ts` | uploadFormSchema に ttlMs 追加、handler 配線 | OK |
| `apps/api/src/__tests__/rooms.test.ts` | 4 件の integration テスト追加 | OK |
| `apps/api/wrangler.toml` | ROOM_TTL_MS = 86400000 (24h) | OK |
| `apps/api/src/__tests__/helpers/build-env.ts` | DEFAULT_TTL_MS を 24h に同期 | OK |
| `apps/web/index.html` | og:image 削除 + site_name/twitter:title/robots index 追加 | OK |
| `CHANGELOG.md` (新規) | Keep a Changelog 形式、v0.9.0-mvp 起点 | M1 |
| `docs/legal/terms-ja.md` (新規) | 11 条、TBD 明示 | OK |
| `docs/legal/privacy-ja.md` (新規) | 13 節、TBD 明示 | OK |
| `.github/ISSUE_TEMPLATE/abuse-report.yml` (新規) | GitHub Issue Forms | OK |
| `README.md` | TTL 説明更新 + 通報窓口セクション | OK |
| `.claude/PRPs/prds/snap-share.prd.md` | Open Question close + Decisions Log 3 行追加 | OK |
| `.claude/PRPs/prds/phase-10-direction.prd.md` | Phase 10.B status 更新 | OK |
| `.claude/PRPs/plans/phase-10-b-launch-prep.plan.md` (新規) | Plan ドキュメント | OK |

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

**M1: `CHANGELOG.md` 末尾の compare/tag リンクが、まだ作成されていない `v0.9.0-mvp` タグを参照している**

`CHANGELOG.md:87-88`:
```markdown
[Unreleased]: https://github.com/imotako-pum/snap-share/compare/v0.9.0-mvp...HEAD
[0.9.0-mvp]: https://github.com/imotako-pum/snap-share/releases/tag/v0.9.0-mvp
```

タグが未作成の段階では両リンクが 404 になる。Keep a Changelog 規約上はリンクを維持するのが推奨されているが、機能的に支障は無い。

**Suggested action**: PR merge 後、もしくは Phase 10.F (公開リリース実走) で本格運用入りするタイミングで `git tag v0.9.0-mvp <commit>` と `gh release create v0.9.0-mvp` を実行する。Phase 10.F の Plan に明示的なタスクとして追加することを推奨。

### LOW

**L1: form validator が ttlMs 以外の field error も "image field is required" と返す既存パターン**

`apps/api/src/routes/rooms.ts:266`:
```typescript
return c.json(errorEnvelope('INVALID_REQUEST', 'image field is required'), 400);
```

`uploadFormSchema` はマルチフィールド (image / password / cf-turnstile-response / ttlMs) を持つが、validator のエラーメッセージは固定で "image field is required" を返す。例えば ttlMs="7d" の場合も同じメッセージになり、利用者には根本原因が見えにくい。

これは Phase 7 から続く既存パターンで本 PR で導入した issue ではない (line 266 の周辺コードは未変更)。クライアント側がフィールドごとのエラーを必要とするケースが顕在化したら、`result.error.issues` を envelope に乗せる改修を別 Phase で検討。

**Suggested action**: 今回は noop。将来 issue として PRD `Open Questions` に追加するのも可。

**L2: GitHub Issue Forms の dropdown に "選択してください" placeholder が無い**

`.github/ISSUE_TEMPLATE/abuse-report.yml:23-32`:
```yaml
  - type: dropdown
    id: violation-category
    attributes:
      options:
        - 著作権 / 商標権侵害
        - ...
```

GitHub Issue Forms の `dropdown` は最初の option がデフォルト選択状態になる。利用者が変更し忘れた場合「著作権 / 商標権侵害」が誤選択される可能性。

**Suggested action**: 軽微。気になれば後続 commit で先頭に空の placeholder 行 (例: `- 選択してください`) を追加し、validation で除外する。優先度は LOW。

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check (`pnpm typecheck`) | Pass | Full Turbo cache hit |
| Lint (`pnpm lint`) | Pass | Biome ci 緑、195 files checked |
| Tests (`pnpm test`) | Pass | shared 70 + api 187 + web 292 = 549 件 (新規 11 件含む) |
| Build (`pnpm build`) | Pass | Vite + wrangler dry-run 緑 |

## CLAUDE.md Compliance

`CLAUDE.md` 関連チェック:

- ✅ **API レスポンス schema は `packages/shared` に集約**: 本 PR は *request* schema (`uploadFormSchema`) に ttlMs を追加。`uploadFormSchema` は元々 `apps/api/src/routes/rooms.ts` 内なので既存規約と整合 (response schema は packages/shared、request schema は route 内、という現行パターンを踏襲)。
- ✅ **共通エラー envelope `{ ok: false, error: { code, message } }`**: 新規 `assertValidRequestedTtlMs` は `AppError(400, 'INVALID_REQUEST', ...)` を投げ、共通の error handler 経由で envelope 化される。
- ✅ **Catalog-managed deps**: 本 PR で deps 変更なし。
- ✅ **TypeScript 規約 (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`)**: 新規コードは型安全、`MAX_ROOM_TTL_MS` を `import` で取り込む。
- ✅ **Biome ルール (`noConsole: warn`)**: console 文の追加なし。

## Security Review

- ✅ **公開メッセージのリーク防止**: `assertValidRequestedTtlMs` は `requestedTtlMs` を logContext に閉じ込め、公開メッセージは `'Invalid ttlMs'` 固定。Phase 8.x error-envelope review #11 のパターンを継承。テスト `does not echo the requested ttlMs in the public 400 message` で担保。
- ✅ **R2 orphan 防止**: `opts.ttlMs` の検証は R2 / Turnstile / 認証ハッシュより前に実行 (`room-service.ts:135`)。コメントでも明示されている。
- ✅ **Integer overflow**: `Number("9".repeat(20))` は `1e20` を返すが `Number.isFinite` & `Number.isInteger` を通り、最終的に `> MAX_ROOM_TTL_MS` で 400 になる。`Number.isFinite` で `Infinity` も弾く。
- ✅ **Regex DoS**: `^\d+$` は線形時間。リスクなし。
- ✅ **TOS / Privacy**: GDPR / CCPA grandstanding を避け「draft」と明示。日本法 + 東京地裁を専属管轄に明記。Phase 10.F で再レビュー前提。
- ✅ **abuse report form**: 機微情報を貼らせない warning + チェックボックス強制。

## Performance Review

- ✅ TTL 検証は O(1)。`Number()` 呼び出しもボトルネックではない。
- ✅ index.html の OGP 修正で SNS scraper の 404 リクエストを回避 (微小改善)。
- ⚠️ 既存 `dist/` は git-tracked っぽいが (`apps/web/dist/index.html` が grep に出る)、これは別 issue。本 PR の範囲外。

## Recommendations

1. **APPROVE** — Phase 10.B 自走可能範囲は完了、ブロッカー無し。
2. M1 (CHANGELOG タグ) は Phase 10.F の Plan に明記して回収。
3. L1 / L2 は将来別 Phase で検討、今回は noop で OK。
4. 残作業 (Cloudflare Analytics ダッシュボード確認 / GitHub `report-abuse` ラベル作成 / OGP image 作成) は **Phase 10.F 直前のチェックリスト** にまとめて配置を推奨。

## Next Steps

- `feat/phase-10-launch-prep` ブランチを push して PR 作成 (オーナー判断)
- もしくは Phase 10.E (i18n) を同 branch に積んでから PR (1 PRD = 1 PR の方針に沿う)
