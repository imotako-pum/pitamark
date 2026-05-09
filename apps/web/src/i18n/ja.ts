// 日本語辞書。アプリで存在する i18n key の SSOT。`keys.ts` が
// `I18nKey = keyof typeof ja` を導出するので、新文言の追加は (1) ここに key を足す
// → (2) TS が `en.ts` の対応 key を要求してくる、の 2 ステップで済む。union を
// 手動メンテする必要は無い。
//
// 命名規約: `{surface}.{element}.{purpose}` — surface はどの画面/機能が所有するか
// (toolbar / dialog / gate / connection / canvas / dropzone / help / error / toast /
// localUser / common)。key は他の辞書が依存できるよう、辞書編集をまたいで安定させる。

export const ja = {
  // アプリ全体で共有する文言。
  'common.appName': 'pitamark',
  'common.langToggle.label': '言語',
  'common.langToggle.ja': '日本語',
  'common.langToggle.en': 'English',

  // Toolbar — ツール選択。
  'toolbar.group.label': '編集ツール',
  'toolbar.tool.select': '選択',
  'toolbar.tool.rectangle': '矩形',
  'toolbar.tool.arrow': '矢印',
  'toolbar.tool.text': 'テキスト',
  'toolbar.tool.highlight': 'ハイライト',

  // Toolbar — アクションボタン。
  'toolbar.action.undo': '元に戻す',
  'toolbar.action.redo': 'やり直し',
  'toolbar.action.delete': '削除',
  'toolbar.action.exportPng': 'PNG 保存',
  'toolbar.action.clearAll': '注釈をすべて削除',
  'toolbar.action.help': 'ショートカット一覧',

  // Context menu — Phase 10.J-2 長押しコンテキストメニュー。
  // 項目順は Material 寄り (削除を最後) で誤タップ回避。
  'contextMenu.duplicate': '複製',
  'contextMenu.bringFront': '前面へ移動',
  'contextMenu.sendBack': '背面へ移動',
  'contextMenu.delete': '削除',

  // Toolbar — URL コピーボタン。
  'toolbar.copyUrl.aria': 'ルームURLをコピー',
  'toolbar.copyUrl.idle': 'URL コピー',
  'toolbar.copyUrl.copied': 'コピー完了',
  'toolbar.copyUrl.toastSuccess': 'URL をコピーしました',
  'toolbar.copyUrl.toastError': 'URL のコピーに失敗しました',

  // Toolbar — フォントサイズ操作。
  'toolbar.fontSize.groupLabel': 'フォントサイズ',
  'toolbar.fontSize.decreaseAria': 'フォントサイズを小さくする',
  'toolbar.fontSize.increaseAria': 'フォントサイズを大きくする',
  'toolbar.fontSize.decreaseLabel': '小さく [',
  'toolbar.fontSize.increaseLabel': '大きく ]',

  // Toolbar — カラーパレット。
  'toolbar.colorPalette.groupLabel': '色パレット',
  // {color} は #ff5722 のような hex string で、render 時に置換される。
  'toolbar.colorPalette.swatchAria': '色: {color}',

  // Canvas overlay。
  'canvas.textEditor.aria': '注釈テキストを編集',

  // DropZone (画像未読込時の placeholder UI)。
  'dropzone.headline': '画像をドロップしてください',
  'dropzone.instructionPrefix': 'クリックで選択、または',
  'dropzone.instructionSuffix': 'で貼り付け',
  'dropzone.formats': 'PNG / JPEG / WebP / SVG (10MB まで)',
  'dropzone.loading': '画像を読み込んでいます…',

  // 全削除確認ダイアログ。
  'dialog.clearAll.title': 'ルーム内の注釈をすべて削除しますか？',
  'dialog.clearAll.description': 'この操作は他の参加者にも反映されます。元に戻すことはできません。',
  'dialog.clearAll.cancel': 'キャンセル',
  'dialog.clearAll.confirm': '削除する',

  // 接続状態バッジ (room モード)。
  'connection.connecting': '接続中…',
  'connection.connected': '同期中',
  'connection.disconnected': '再接続中…',

  // ルームのパスワードゲート。
  'gate.heading': 'このルームはパスワードで保護されています',
  'gate.password.label': 'パスワード',
  'gate.password.placeholder': 'パスワード',
  'gate.password.aria': 'ルームのパスワード',
  'gate.button.submit': '入室',
  'gate.button.submitting': '認証中…',
  'gate.error.wrongPassword': 'パスワードが違います',
  'gate.error.rateLimited': 'しばらく経ってからお試しください（試行回数が多すぎます）',
  'gate.error.network': 'ネットワークエラーが発生しました',
  'gate.error.unexpected': '入室処理に失敗しました',
  // LocalEditor (画像未読込画面) のパスワード保護パネル。
  'localEditor.protectPassword.label': 'パスワードで保護する（任意）',
  'localEditor.protectPassword.required': 'パスワードを入力してください',
  'gate.toast.passwordRequired': 'パスワードを入力してください',
  'gate.toast.authenticating': '認証中です。少し待ってから再度お試しください',
  'gate.toast.authFailed': '認証に失敗しました。再度お試しください',

  // 画像 validation エラー (drag-and-drop / paste)。
  'error.image.unsupportedFormat': '画像ファイルをドロップしてください (PNG / JPEG / WebP / SVG)。',
  'error.image.tooLarge': '画像サイズが大きすぎます (上限 10MB)。',

  // 画像 upload エラー (server-side)。
  'error.upload.rateLimited': 'しばらく経ってからお試しください（アクセスが多すぎます）',
  'error.upload.blocked': 'この画像はアップロードできません',
  'error.upload.turnstileFailed': '認証に失敗しました。再度お試しください',
  'error.upload.invalidFormat': 'アップロードできない形式です',
  'error.upload.network': '通信に失敗しました。ネットワークを確認してください',

  // ルーム not-found ページ (TTL 切れ / 誤った URL)。文言は TTL 仕様
  // (default 24h / max 7d) と整合させる。
  'notFound.title': 'ルームが見つかりません',
  'notFound.ttlNotice':
    'URL の有効期限が切れている可能性があります（デフォルト 24 時間 / 最大 7 日）。',
  'notFound.backToTop': 'トップに戻る',

  // Toast (export 系)。
  'toast.export.success': 'PNG を保存しました',
  'toast.export.error': 'PNG の保存に失敗しました',

  // local user (Awareness presence)。
  'localUser.namePrefix': 'ゲスト-',

  // Help cheat-sheet — 最上位タイトル + description。
  'help.title': 'キーボードショートカット',
  'help.description':
    'すべての操作はキーボードで完結できます。閉じるには Esc か外側をクリック。矢印→テキスト・矩形→矢印 のサジェストは Enter で確定 / Esc で破棄。',
  'help.key.wheel': 'ホイール',
  'help.key.drag': 'ドラッグ',
  'help.row.zoomReset': '100%',

  // Help cheat-sheet — セクションタイトル。
  'help.section.tools': 'ツール',
  'help.section.colors': '色',
  'help.section.text': 'テキスト',
  'help.section.predict': '次手予測',
  'help.section.edit': '編集',
  'help.section.zoom': 'ズーム',
  'help.section.export': '出力',
  'help.section.help': 'ヘルプ',

  // Landing — 画像未ロード時の first-impression 面。コピーは意図的に簡潔・ポップ
  // (「簡潔・ポップ・分かりやすく」) にし、Google 検索から冷めた状態で来訪した
  // 訪問者の conversion を狙う。
  'landing.hero.headline': '画像にサクッと注釈、URL で一瞬共有',
  'landing.hero.subhead': 'ドラッグして注釈を書くだけ。会員登録なし、URL で共同編集。',
  'landing.hero.previewAlt': 'pitamark エディタの利用イメージ — 画像に矢印・矩形・テキスト注釈',
  'landing.features.heading': 'できること',
  'landing.features.urlShare.title': 'URL 一発共有',
  'landing.features.urlShare.body': 'アップロード即発行。会員登録は不要。',
  'landing.features.collab.title': '共同編集',
  'landing.features.collab.body': '同じ URL を開けば、相手もそのまま書き込める。',
  'landing.features.ttl.title': 'ゆるい TTL',
  'landing.features.ttl.body': 'デフォルト 24 時間で自動消失。残さない設計。',
  'landing.howto.heading': '使い方は 3 ステップ',
  'landing.howto.step1': '画像をドラッグ',
  'landing.howto.step2': '注釈を書く',
  'landing.howto.step3': 'URL をコピーして送る',
  'landing.faq.heading': 'よくある質問',
  'landing.faq.q1': '画像はどこに保存される？',
  'landing.faq.a1':
    'Cloudflare R2 に保存し、TTL（デフォルト 24 時間 / 最大 7 日）で自動削除されます。',
  'landing.faq.q2': '無料で使える？',
  'landing.faq.a2': 'はい、基本機能は無料です。',
  'landing.faq.q3': '誰が編集できる？',
  'landing.faq.a3': 'URL を知っている人なら誰でも。パスワード保護も設定できます。',
  'landing.faq.q4': '広告は出る？',
  'landing.faq.a4': '将来の収益化に向けて表示枠を用意しています。現在は配信していません。',

  // AdSense placeholder。実 `<ins class="adsbygoogle">` 配線時に CLS を起こさないよう、
  // 固定寸法で領域を確保する。`aria` は英語固定 — accessibility tooling と AdSense
  // policy の両方が "Sponsored" の semantics を見るため。
  'ad.placeholder.label': '広告枠',
  'ad.placeholder.note': '将来配信予定',
  'ad.placeholder.aria': 'Sponsored placeholder',

  // Help — 詳細 row label (toolbar.tool.* と重複するものもあるが、cheat-sheet 側の
  // コピーが独立して drift できるよう別 key で持つ)。
  'help.row.select': '選択',
  'help.row.rectangle': '矩形',
  'help.row.arrow': '矢印',
  'help.row.text': 'テキスト',
  'help.row.highlight': 'ハイライト',
  'help.row.nextColor': '次の色',
  'help.row.prevColor': '前の色',
  'help.row.fontSizeIncrease': 'フォントサイズ +2',
  'help.row.fontSizeDecrease': 'フォントサイズ -2',
  'help.row.suggestionAccept': 'サジェスト確定',
  'help.row.suggestionDismiss': 'サジェスト破棄',
  'help.row.pendingClear': 'pending クリア',
  'help.row.undo': '元に戻す',
  'help.row.redo': 'やり直し',
  'help.row.delete': '削除',
  'help.row.deselect': '選択解除',
  'help.row.fitView': '全体表示',
  'help.row.zoom': 'ズーム',
  'help.row.pan': 'パン',
  'help.row.exportPng': 'PNG 保存',
  'help.row.toggleHelp': 'このパネル',
} as const;
