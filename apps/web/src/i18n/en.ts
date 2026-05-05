// Phase 10.E: English dictionary. **Status: draft** — translations were
// produced by the implementer in one pass and need an i18n review pass
// (idiom, terseness, capitalization). Owner-flagged TODOs welcome.
//
// IMPORTANT: this file MUST cover every key in `ja.ts`. The
// `Record<I18nKey, string>` annotation lets TypeScript surface missing /
// extra keys at compile time, and `i18n.test.ts` double-checks at runtime.

import type { I18nKey } from './keys';

export const en: Record<I18nKey, string> = {
  // Application-wide / shared.
  'common.appName': 'pitamark',
  'common.langToggle.label': 'Language',
  'common.langToggle.ja': '日本語',
  'common.langToggle.en': 'English',

  // Toolbar — tool selection.
  'toolbar.group.label': 'Editing tools',
  'toolbar.tool.select': 'Select',
  'toolbar.tool.rectangle': 'Rectangle',
  'toolbar.tool.arrow': 'Arrow',
  'toolbar.tool.text': 'Text',
  'toolbar.tool.highlight': 'Highlight',

  // Toolbar — action buttons.
  'toolbar.action.undo': 'Undo',
  'toolbar.action.redo': 'Redo',
  'toolbar.action.delete': 'Delete',
  'toolbar.action.exportPng': 'Save PNG',
  'toolbar.action.clearAll': 'Clear all annotations',
  'toolbar.action.help': 'Keyboard shortcuts',

  // Toolbar — copy URL button.
  'toolbar.copyUrl.aria': 'Copy room URL',
  'toolbar.copyUrl.idle': 'Copy URL',
  'toolbar.copyUrl.copied': 'Copied',
  'toolbar.copyUrl.toastSuccess': 'URL copied to clipboard',
  'toolbar.copyUrl.toastError': 'Failed to copy URL',

  // Toolbar — font size control.
  'toolbar.fontSize.groupLabel': 'Font size',
  'toolbar.fontSize.decreaseAria': 'Decrease font size',
  'toolbar.fontSize.increaseAria': 'Increase font size',
  'toolbar.fontSize.decreaseLabel': 'Smaller [',
  'toolbar.fontSize.increaseLabel': 'Larger ]',

  // Toolbar — color palette.
  'toolbar.colorPalette.groupLabel': 'Color palette',
  'toolbar.colorPalette.swatchAria': 'Color: {color}',

  // Canvas overlays.
  'canvas.textEditor.aria': 'Edit annotation text',

  // DropZone.
  'dropzone.headline': 'Drop an image here',
  'dropzone.instructionPrefix': 'Click to choose, or paste with',
  'dropzone.instructionSuffix': '',
  'dropzone.formats': 'PNG / JPEG / WebP / SVG (up to 10MB)',
  'dropzone.loading': 'Loading image…',

  // Confirm clear-all dialog.
  'dialog.clearAll.title': 'Clear all annotations in this room?',
  'dialog.clearAll.description': 'This will be visible to other participants and cannot be undone.',
  'dialog.clearAll.cancel': 'Cancel',
  'dialog.clearAll.confirm': 'Clear',

  // Connection badge.
  'connection.connecting': 'Connecting…',
  'connection.connected': 'Synced',
  'connection.disconnected': 'Reconnecting…',

  // Room password gate.
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
  // LocalEditor (no-image screen) password protection panel.
  'localEditor.protectPassword.label': 'Protect with password (optional)',
  'localEditor.protectPassword.required': 'Please enter a password',
  'gate.toast.passwordRequired': 'Please enter a password',
  'gate.toast.authenticating': 'Authenticating — please wait a moment before retrying',
  'gate.toast.authFailed': 'Authentication failed. Please try again.',

  // Image validation errors (drag-and-drop / paste).
  'error.image.unsupportedFormat': 'Please drop an image file (PNG / JPEG / WebP / SVG).',
  'error.image.tooLarge': 'Image is too large (10MB limit).',

  // Image upload errors (server-side).
  'error.upload.rateLimited': 'Too many requests. Please wait a moment and try again.',
  'error.upload.blocked': 'This image cannot be uploaded',
  'error.upload.turnstileFailed': 'Authentication failed. Please try again.',
  'error.upload.invalidFormat': 'This file format cannot be uploaded',
  'error.upload.network': 'Network error. Please check your connection.',

  // Room not-found page.
  'notFound.title': 'Room not found',
  'notFound.ttlNotice': 'The URL may have expired (default 24 hours, max 7 days).',
  'notFound.backToTop': 'Back to top',

  // Toast (export).
  'toast.export.success': 'PNG saved',
  'toast.export.error': 'Failed to save PNG',

  // Local user (Awareness presence).
  'localUser.namePrefix': 'Guest-',

  // Help cheat-sheet — top-level title + description.
  'help.title': 'Keyboard shortcuts',
  'help.description':
    'Every action is keyboard-driven. Press Esc or click outside to close. Confirm arrow→text / rectangle→arrow suggestions with Enter, dismiss with Esc.',
  'help.key.wheel': 'Wheel',
  'help.key.drag': 'Drag',
  'help.row.zoomReset': '100%',

  // Help cheat-sheet — section titles.
  'help.section.tools': 'Tools',
  'help.section.colors': 'Colors',
  'help.section.text': 'Text',
  'help.section.predict': 'Predict',
  'help.section.edit': 'Edit',
  'help.section.zoom': 'Zoom',
  'help.section.export': 'Export',
  'help.section.help': 'Help',

  // Phase 10.H: Landing surface (en draft — Phase 10.E "ja confirmed +
  // en draft" cadence applies; native polish is a Phase 11+ follow-up).
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

  // Phase 10.H: AdSense placeholder.
  'ad.placeholder.label': 'Sponsored',
  'ad.placeholder.note': 'Reserved for future ads',
  'ad.placeholder.aria': 'Sponsored placeholder',

  // Help — row labels.
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
