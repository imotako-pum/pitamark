import { expect, test } from '@playwright/test';
import { setupEditorViaApi } from './fixtures/editor-fixture';
import { buildSolidPng } from './fixtures/upload';

// フォントサイズ変更 UI の E2E。`activeFontSize` を SSOT にし、Toolbar の A-/A+ と
// `[`/`]` shortcut の双方が「常に active 更新 + 選択中 text なら適用」で動作する
// こと、min/max でクランプされること、text 編集中は shortcut が browser default に
// 素通しされることを担保する。

const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';
const DEFAULT_FONT_SIZE = 18;
const STEP = 2;
const MIN_FONT_SIZE = 8;

type AnnotationSnapshot = ReadonlyArray<Record<string, unknown>>;

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'font-size はキー入力依存で chromium 1 プロジェクトで検証する',
  );

const SAMPLE = buildSolidPng(800, 600);

const readAnnotations = async (page: import('@playwright/test').Page) =>
  page.evaluate(
    (k) =>
      ((window as unknown as Record<string, AnnotationSnapshot>)[k] ?? []) as AnnotationSnapshot,
    ANNOTATIONS_KEY,
  );

const setupRoomWithImage = async (page: import('@playwright/test').Page) => {
  await setupEditorViaApi(page, { buffer: SAMPLE, fileName: 'font-size.png' });
  const stage = page.locator('.konvajs-content canvas').first();
  const box = await stage.boundingBox();
  if (!box) throw new Error('canvas bounding box が取得できなかった');
  return box;
};

const clickStageAt = async (
  page: import('@playwright/test').Page,
  box: { x: number; y: number },
  offset: { x: number; y: number },
) => {
  await page.mouse.click(box.x + offset.x, box.y + offset.y);
};

const fontSizeIndicator = (page: import('@playwright/test').Page) =>
  page.getByTestId('font-size-value');

test.describe('font size — Toolbar A-/A+ + [/] shortcut', () => {
  test('Toolbar に現在の activeFontSize 18px が表示される', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoomWithImage(page);
    await expect(fontSizeIndicator(page)).toHaveText(`${DEFAULT_FONT_SIZE}px`);
  });

  test('A+ 1 回クリック → activeFontSize +2 → 新規 text が +2px で作成される', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    const box = await setupRoomWithImage(page);

    await page.getByRole('button', { name: 'フォントサイズを大きくする' }).click();
    await expect(fontSizeIndicator(page)).toHaveText(`${DEFAULT_FONT_SIZE + STEP}px`);

    // text ツール → クリックで空 text 作成 → 文字打鍵 → Enter で確定
    await page.getByRole('button', { name: 'テキスト' }).click();
    await clickStageAt(page, box, { x: 200, y: 200 });
    const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
    await expect(textarea).toBeVisible();
    await textarea.fill('hello');
    await textarea.press('Enter');

    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);
    const annotations = await readAnnotations(page);
    const t = annotations.find((a) => a.type === 'text') as { fontSize: number } | undefined;
    expect(t?.fontSize).toBe(DEFAULT_FONT_SIZE + STEP);
  });

  test('] shortcut で activeFontSize +2、[ shortcut で -2 (text 未編集中)', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoomWithImage(page);

    await page.keyboard.press(']');
    await expect(fontSizeIndicator(page)).toHaveText(`${DEFAULT_FONT_SIZE + STEP}px`);
    await page.keyboard.press(']');
    await expect(fontSizeIndicator(page)).toHaveText(`${DEFAULT_FONT_SIZE + STEP * 2}px`);
    await page.keyboard.press('[');
    await expect(fontSizeIndicator(page)).toHaveText(`${DEFAULT_FONT_SIZE + STEP}px`);
  });

  test('既存 text 選択中に A+ → その text の fontSize も追従する', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    const box = await setupRoomWithImage(page);

    // text 1 個作成
    await page.getByRole('button', { name: 'テキスト' }).click();
    await clickStageAt(page, box, { x: 200, y: 200 });
    const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
    await expect(textarea).toBeVisible();
    await textarea.fill('a');
    await textarea.press('Enter');
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    // V キー → text を click で再選択
    await page.keyboard.press('v');
    await clickStageAt(page, box, { x: 205, y: 205 });

    // A+ で active も text の fontSize も +2 に
    await page.getByRole('button', { name: 'フォントサイズを大きくする' }).click();

    await expect(fontSizeIndicator(page)).toHaveText(`${DEFAULT_FONT_SIZE + STEP}px`);
    await expect
      .poll(async () => {
        const a = (await readAnnotations(page)).find((x) => x.type === 'text') as
          | { fontSize: number }
          | undefined;
        return a?.fontSize;
      })
      .toBe(DEFAULT_FONT_SIZE + STEP);
  });

  test('MIN(8) で − ボタンが disabled、それ以上下がらない', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoomWithImage(page);

    // 18 → 16 → 14 → 12 → 10 → 8(下限)を 5 回押下で到達
    for (let i = 0; i < 5; i++) await page.keyboard.press('[');
    await expect(fontSizeIndicator(page)).toHaveText(`${MIN_FONT_SIZE}px`);
    await expect(page.getByRole('button', { name: 'フォントサイズを小さくする' })).toBeDisabled();

    // もう 1 回 [ を押しても 8 のまま(クランプ)
    await page.keyboard.press('[');
    await expect(fontSizeIndicator(page)).toHaveText(`${MIN_FONT_SIZE}px`);
  });

  test('rect 選択中の [ は activeFontSize だけ変更し、Cmd+Z 1 回で矩形が消える', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    const box = await setupRoomWithImage(page);

    // 矩形を 1 つ描く → 自動選択
    await page.getByRole('button', { name: '矩形' }).click();
    await page.mouse.move(box.x + 80, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(1);

    // rect 選択中に [ を 3 回 → activeFontSize は 18 → 12 に
    await page.keyboard.press('[');
    await page.keyboard.press('[');
    await page.keyboard.press('[');
    await expect(fontSizeIndicator(page)).toHaveText(`${DEFAULT_FONT_SIZE - STEP * 3}px`);

    // 注釈は依然として 1 件 (rect には fontSize 適用されない)
    expect((await readAnnotations(page)).length).toBe(1);

    // Cmd+Z 1 回で矩形が消える (= 空 undo step が積まれていない)。
    // room mode は Yjs の type guard で元から OK だが、handler 側 gate (M1 修正)
    // との二重防御で local mode の useAnnotationsStore でも正しく振る舞うこと
    // を担保する E2E 期待値。
    await page.keyboard.press('Meta+z');
    await expect.poll(() => readAnnotations(page).then((a) => a.length)).toBe(0);
  });

  test('text 編集中の [ / ] は文字入力としてスルーされる(shortcut 発火しない)', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    const box = await setupRoomWithImage(page);

    await page.getByRole('button', { name: 'テキスト' }).click();
    await clickStageAt(page, box, { x: 200, y: 200 });
    const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
    await expect(textarea).toBeVisible();

    // textarea の値を [ ] 含む文字列で埋めて Enter で確定
    await textarea.fill('a]b');
    await textarea.press('Enter');

    // activeFontSize は 18 のまま(] が shortcut 化していない)
    await expect(fontSizeIndicator(page)).toHaveText(`${DEFAULT_FONT_SIZE}px`);
    const annotations = await readAnnotations(page);
    const t = annotations.find((a) => a.type === 'text') as { text: string } | undefined;
    expect(t?.text).toBe('a]b');
  });
});
