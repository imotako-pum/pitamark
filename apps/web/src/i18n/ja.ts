// Phase 10.E: Japanese dictionary — the single source of truth for which i18n
// keys exist in the app. `keys.ts` derives `I18nKey = keyof typeof ja`, so
// adding a new string anywhere means: (1) add the key here, (2) TypeScript
// will then require the matching key in `en.ts`. No need to maintain a
// separate union manually.
//
// Naming convention: `{surface}.{element}.{purpose}` — surface = which screen
// or feature owns it (toolbar / dialog / gate / connection / canvas / dropzone
// / help / error / toast / localUser / common). Keys stay stable across
// dict edits so other dicts can rely on them.

export const ja = {
  // Application-wide / shared.
  'common.appName': 'snap-share',
  'common.langToggle.label': '言語',
  'common.langToggle.ja': '日本語',
  'common.langToggle.en': 'English',

  // Toolbar — tool selection.
  'toolbar.group.label': '編集ツール',
  'toolbar.tool.select': '選択',
  'toolbar.tool.rectangle': '矩形',
  'toolbar.tool.arrow': '矢印',
  'toolbar.tool.text': 'テキスト',
  'toolbar.tool.highlight': 'ハイライト',

  // Toolbar — action buttons.
  'toolbar.action.undo': '元に戻す',
  'toolbar.action.redo': 'やり直し',
  'toolbar.action.delete': '削除',
  'toolbar.action.exportPng': 'PNG 保存',
  'toolbar.action.clearAll': '注釈をすべて削除',
  'toolbar.action.help': 'ショートカット一覧',

  // Toolbar — copy URL button.
  'toolbar.copyUrl.aria': 'ルームURLをコピー',
  'toolbar.copyUrl.idle': 'URL コピー',
  'toolbar.copyUrl.copied': 'コピー完了',
  'toolbar.copyUrl.toastSuccess': 'URL をコピーしました',
  'toolbar.copyUrl.toastError': 'URL のコピーに失敗しました',

  // Toolbar — font size control.
  'toolbar.fontSize.groupLabel': 'フォントサイズ',
  'toolbar.fontSize.decreaseAria': 'フォントサイズを小さくする',
  'toolbar.fontSize.increaseAria': 'フォントサイズを大きくする',
  'toolbar.fontSize.decreaseLabel': '小さく [',
  'toolbar.fontSize.increaseLabel': '大きく ]',

  // Toolbar — color palette.
  'toolbar.colorPalette.groupLabel': '色パレット',
  // {color} is a hex string like #ff5722; substituted at render time.
  'toolbar.colorPalette.swatchAria': '色: {color}',

  // Canvas overlays.
  'canvas.textEditor.aria': '注釈テキストを編集',

  // DropZone (画像未読込時の placeholder UI).
  'dropzone.headline': '画像をドロップしてください',
  'dropzone.instructionPrefix': 'クリックで選択、または',
  'dropzone.instructionSuffix': 'で貼り付け',
  'dropzone.formats': 'PNG / JPEG / WebP / SVG (10MB まで)',

  // Confirm clear-all dialog.
  'dialog.clearAll.title': 'ルーム内の注釈をすべて削除しますか？',
  'dialog.clearAll.description': 'この操作は他の参加者にも反映されます。元に戻すことはできません。',
  'dialog.clearAll.cancel': 'キャンセル',
  'dialog.clearAll.confirm': '削除する',

  // Connection badge (room mode).
  'connection.connecting': '接続中…',
  'connection.connected': '同期中',
  'connection.disconnected': '再接続中…',

  // Room password gate.
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
  // LocalEditor (画像未読込画面) のパスワード保護パネル。Phase 5+ で追加。
  'localEditor.protectPassword.label': 'パスワードで保護する（任意）',
  'localEditor.protectPassword.required': 'パスワードを入力してください',
  'gate.toast.passwordRequired': 'パスワードを入力してください',
  'gate.toast.authenticating': '認証中です。少し待ってから再度お試しください',
  'gate.toast.authFailed': '認証に失敗しました。再度お試しください',

  // Image validation errors (drag-and-drop / paste).
  'error.image.unsupportedFormat': '画像ファイルをドロップしてください (PNG / JPEG / WebP / SVG)。',
  'error.image.tooLarge': '画像サイズが大きすぎます (上限 10MB)。',

  // Image upload errors (server-side).
  'error.upload.rateLimited': 'しばらく経ってからお試しください（アクセスが多すぎます）',
  'error.upload.blocked': 'この画像はアップロードできません',
  'error.upload.turnstileFailed': '認証に失敗しました。再度お試しください',
  'error.upload.invalidFormat': 'アップロードできない形式です',
  'error.upload.network': '通信に失敗しました。ネットワークを確認してください',

  // Toast (export).
  'toast.export.success': 'PNG を保存しました',
  'toast.export.error': 'PNG の保存に失敗しました',

  // Local user (Awareness presence).
  'localUser.namePrefix': 'ゲスト-',

  // Help cheat-sheet — top-level title + description.
  'help.title': 'キーボードショートカット',
  'help.description':
    'すべての操作はキーボードで完結できます。閉じるには Esc か外側をクリック。矢印→テキスト・矩形→矢印 のサジェストは Enter で確定 / Esc で破棄。',
  'help.key.wheel': 'ホイール',
  'help.key.drag': 'ドラッグ',
  'help.row.zoomReset': '100%',

  // Help cheat-sheet — section titles.
  'help.section.tools': 'ツール',
  'help.section.colors': '色',
  'help.section.text': 'テキスト',
  'help.section.predict': '次手予測',
  'help.section.edit': '編集',
  'help.section.zoom': 'ズーム',
  'help.section.export': '出力',
  'help.section.help': 'ヘルプ',

  // Help — verbose row labels (some overlap with toolbar.tool.* by happenstance,
  // but they are kept separate so the cheat-sheet copy can drift independently).
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
