// 英語辞書。**Status: draft** — 翻訳は実装者の 1 回 pass で、idiom / terseness /
// capitalization の i18n レビューが未着手。
//
// 重要: このファイルは `ja.ts` の全 key を必ず網羅すること。`Record<I18nKey, string>`
// で TypeScript がコンパイル時に欠落 / 余剰 key を検出し、`i18n.test.ts` が runtime
// でも double-check する。

import type { I18nKey } from './keys';

export const en: Record<I18nKey, string> = {
  // アプリ全体で共有する文言。
  'common.appName': 'pitamark',
  'common.langToggle.label': 'Language',
  'common.langToggle.ja': '日本語',
  'common.langToggle.en': 'English',

  // Toolbar — ツール選択。
  'toolbar.group.label': 'Editing tools',
  'toolbar.tool.select': 'Select',
  'toolbar.tool.rectangle': 'Rectangle',
  'toolbar.tool.arrow': 'Arrow',
  'toolbar.tool.text': 'Text',
  'toolbar.tool.highlight': 'Highlight',

  // Toolbar — アクションボタン。
  'toolbar.action.undo': 'Undo',
  'toolbar.action.redo': 'Redo',
  'toolbar.action.delete': 'Delete',
  'toolbar.action.exportPng': 'Save PNG',
  'toolbar.action.clearAll': 'Clear all annotations',
  'toolbar.action.help': 'Keyboard shortcuts',

  // Context menu — Phase 10.J-2 long-press context menu.
  // Material-style ordering (destructive last) for misstap safety.
  'contextMenu.duplicate': 'Duplicate',
  'contextMenu.bringFront': 'Bring to front',
  'contextMenu.sendBack': 'Send to back',
  'contextMenu.delete': 'Delete',

  // Toolbar — URL コピーボタン。
  'toolbar.copyUrl.aria': 'Copy room URL',
  'toolbar.copyUrl.idle': 'Copy URL',
  'toolbar.copyUrl.copied': 'Copied',
  'toolbar.copyUrl.toastSuccess': 'URL copied to clipboard',
  'toolbar.copyUrl.toastError': 'Failed to copy URL',

  // Toolbar — フォントサイズ操作。
  'toolbar.fontSize.groupLabel': 'Font size',
  'toolbar.fontSize.decreaseAria': 'Decrease font size',
  'toolbar.fontSize.increaseAria': 'Increase font size',
  'toolbar.fontSize.decreaseLabel': 'Smaller [',
  'toolbar.fontSize.increaseLabel': 'Larger ]',

  // Toolbar — カラーパレット。
  'toolbar.colorPalette.groupLabel': 'Color palette',
  'toolbar.colorPalette.swatchAria': 'Color: {color}',

  // Canvas overlay。
  'canvas.textEditor.aria': 'Edit annotation text',

  // DropZone (画像未読込時の placeholder UI)。
  'dropzone.headline': 'Drop an image here',
  'dropzone.instructionPrefix': 'Click to choose, or paste with',
  'dropzone.instructionSuffix': '',
  'dropzone.formats': 'PNG / JPEG / WebP / SVG (up to 10MB)',
  'dropzone.loading': 'Loading image…',

  // 全削除確認ダイアログ。
  'dialog.clearAll.title': 'Clear all annotations in this room?',
  'dialog.clearAll.description': 'This will be visible to other participants and cannot be undone.',
  'dialog.clearAll.cancel': 'Cancel',
  'dialog.clearAll.confirm': 'Clear',

  // 接続状態バッジ (room モード)。
  'connection.connecting': 'Connecting…',
  'connection.connected': 'Synced',
  'connection.disconnected': 'Reconnecting…',

  // ルームのパスワードゲート。
  'gate.heading': 'This room is password-protected',
  'gate.password.label': 'Password',
  'gate.password.placeholder': 'Password',
  'gate.password.aria': 'Room password',
  'gate.button.submit': 'Enter',
  'gate.button.submitting': 'Authenticating…',
  'gate.error.wrongPassword': 'Incorrect password',
  'gate.error.rateLimited': 'Too many attempts. Please wait a moment and try again.',
  'gate.error.network': 'A network error occurred',
  'gate.error.unexpected': 'Failed to enter the room',
  // LocalEditor (画像未読込画面) のパスワード保護パネル。
  'localEditor.protectPassword.label': 'Protect with password (optional)',
  'localEditor.protectPassword.required': 'Please enter a password',
  'gate.toast.passwordRequired': 'Please enter a password',
  'gate.toast.authenticating': 'Authenticating — please wait a moment before retrying',
  'gate.toast.authFailed': 'Authentication failed. Please try again.',

  // 画像 validation エラー (drag-and-drop / paste)。
  'error.image.unsupportedFormat': 'Please drop an image file (PNG / JPEG / WebP / SVG).',
  'error.image.tooLarge': 'Image is too large (10MB limit).',

  // 画像 upload エラー (server-side)。
  'error.upload.rateLimited': 'Too many requests. Please wait a moment and try again.',
  'error.upload.blocked': 'This image cannot be uploaded',
  'error.upload.turnstileFailed': 'Authentication failed. Please try again.',
  'error.upload.invalidFormat': 'This file format cannot be uploaded',
  'error.upload.network': 'Network error. Please check your connection.',

  // ルーム not-found ページ (TTL 切れ / 誤った URL)。
  'notFound.title': 'Room not found',
  'notFound.ttlNotice': 'The URL may have expired (default 24 hours, max 7 days).',
  'notFound.backToTop': 'Back to top',

  // Toast (export 系)。
  'toast.export.success': 'PNG saved',
  'toast.export.error': 'Failed to save PNG',

  // local user (Awareness presence)。
  'localUser.namePrefix': 'Guest-',

  // Help cheat-sheet — 最上位タイトル + description。
  'help.title': 'Keyboard shortcuts',
  'help.description':
    'Every action is keyboard-driven. Press Esc or click outside to close. Confirm arrow→text / rectangle→arrow suggestions with Enter, dismiss with Esc.',
  'help.key.wheel': 'Wheel',
  'help.key.drag': 'Drag',
  'help.row.zoomReset': '100%',

  // Help cheat-sheet — セクションタイトル。
  'help.section.tools': 'Tools',
  'help.section.colors': 'Colors',
  'help.section.text': 'Text',
  'help.section.predict': 'Predict',
  'help.section.edit': 'Edit',
  'help.section.zoom': 'Zoom',
  'help.section.export': 'Export',
  'help.section.help': 'Help',

  // Landing 面 (en draft — 「ja 確定 + en draft」運用に従う。native polish は別 PR で
  // 拾う想定)。
  'landing.hero.headline': 'Annotate any image. Share by URL.',
  'landing.hero.subhead':
    'Drop a file, mark it up, send the link. No login, real-time collaboration built in.',
  'landing.hero.previewAlt':
    'pitamark editor preview — arrows, rectangles, and text overlaid on an image',
  'landing.features.heading': 'What it does',
  'landing.features.urlShare.title': 'Instant URL share',
  'landing.features.urlShare.body': 'Upload, get a URL. No account needed.',
  'landing.features.collab.title': 'Real-time collaboration',
  'landing.features.collab.body': 'Open the same URL — everyone can annotate.',
  'landing.features.ttl.title': 'Auto cleanup',
  'landing.features.ttl.body': 'Default 24 h, max 7 days. Nothing lingers.',
  'landing.howto.heading': 'Three steps',
  'landing.howto.step1': 'Drop an image',
  'landing.howto.step2': 'Annotate',
  'landing.howto.step3': 'Copy & send the URL',
  'landing.faq.heading': 'FAQ',
  'landing.faq.q1': 'Where are images stored?',
  'landing.faq.a1': 'On Cloudflare R2, auto-deleted after the TTL (default 24 h, max 7 days).',
  'landing.faq.q2': 'Is it free?',
  'landing.faq.a2': 'Yes — core features are free.',
  'landing.faq.q3': 'Who can edit?',
  'landing.faq.a3': 'Anyone with the URL. You can also enable password protection.',
  'landing.faq.q4': 'Are there ads?',
  'landing.faq.a4': 'A slot is reserved for future monetization. No ads are served right now.',

  // AdSense placeholder。
  'ad.placeholder.label': 'Sponsored',
  'ad.placeholder.note': 'Reserved for future ads',
  'ad.placeholder.aria': 'Sponsored placeholder',

  // Help — row label。
  'help.row.select': 'Select',
  'help.row.rectangle': 'Rectangle',
  'help.row.arrow': 'Arrow',
  'help.row.text': 'Text',
  'help.row.highlight': 'Highlight',
  'help.row.nextColor': 'Next color',
  'help.row.prevColor': 'Previous color',
  'help.row.fontSizeIncrease': 'Font size +2',
  'help.row.fontSizeDecrease': 'Font size -2',
  'help.row.suggestionAccept': 'Accept suggestion',
  'help.row.suggestionDismiss': 'Dismiss suggestion',
  'help.row.pendingClear': 'Clear pending',
  'help.row.undo': 'Undo',
  'help.row.redo': 'Redo',
  'help.row.delete': 'Delete',
  'help.row.deselect': 'Deselect',
  'help.row.fitView': 'Fit to view',
  'help.row.zoom': 'Zoom',
  'help.row.pan': 'Pan',
  'help.row.exportPng': 'Save PNG',
  'help.row.toggleHelp': 'This panel',
};
