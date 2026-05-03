import { expect, test } from '@playwright/test';
import { buildSolidPng, dropImageBuffer } from './fixtures/upload';

// Phase 7.7-3 E2E: Stage transform (scale + position) のキーボード/wheel/Space-drag
// 経路を検証する。
//
// Playwright headless Chromium では Meta+0 / Meta+1 がブラウザ側で先に
// 横取りされて keydown が JS に届かないことがある。代わりに EditorShell が
// 公開している `window.__SNAP_SHARE_TRANSFORM_ACTIONS__` を呼んで
// transform pipeline (= clampPan / setTransform / Stage 反映) を直接踏む。
// useKeyboardShortcuts の binding 自体は keyboard-shortcuts.spec.ts (V/R/A/T/H
// + Cmd+S) が同じ window keydown 機構で動くことを担保している。

const TRANSFORM_KEY = '__SNAP_SHARE_STAGE_TRANSFORM__';
const ACTIONS_KEY = '__SNAP_SHARE_TRANSFORM_ACTIONS__';
const ANNOTATIONS_KEY = '__SNAP_SHARE_ANNOTATIONS__';

type Transform = { scale: number; x: number; y: number };

const skipNonChromium = (testInfo: import('@playwright/test').TestInfo) =>
  test.skip(
    testInfo.project.name !== 'chromium',
    'Stage transform / wheel pinch / Space pan は chromium 1 プロジェクトで検証する',
  );

const readTransform = (page: import('@playwright/test').Page): Promise<Transform> =>
  page.evaluate((k) => (window as unknown as Record<string, Transform>)[k], TRANSFORM_KEY);

// 2000×1500: viewport (Playwright Desktop Chrome 1280×720) より大きく、かつ
// clampPan の virtual 領域 (各辺 50% margin = 3000×2250) が viewport を完全に
// 上回る。これで pan/zoom が clampPan によって無効化されない。1×1 / 320×240 の
// 小さい画像では、画像が viewport より小さいと clampPan が常に画像を中央に
// 固定するため pan/zoom が観測できない (これ自体は仕様: 迷子防止のため画像
// 周辺だけパン可)。
const SAMPLE_PNG = buildSolidPng(2000, 1500);

const setupRoom = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await dropImageBuffer(page, SAMPLE_PNG, 'zoom-pan-sample.png');
  await expect(page).toHaveURL(/\/r\/[A-Za-z0-9_-]{21}$/, { timeout: 10_000 });
  await page.waitForFunction(
    (k) => Array.isArray((window as unknown as Record<string, unknown>)[k]),
    ANNOTATIONS_KEY,
    { timeout: 10_000 },
  );
  // 画像 onLoad → setImageSize → fit が走るのを待つ。IDENTITY (scale:1,x:0,y:0)
  // のままだと fit がまだ走っていないので、IDENTITY 以外の値を fit 完了の
  // signal にする。
  await page.waitForFunction(
    (k) => {
      const t = (window as unknown as Record<string, { scale: number; x: number; y: number }>)[k];
      if (typeof t !== 'object' || t === null) return false;
      return t.scale !== 1 || t.x !== 0 || t.y !== 0;
    },
    TRANSFORM_KEY,
    { timeout: 10_000 },
  );
  // Actions も準備できていることを確認 (EditorShell の useEffect 完了まで)。
  await page.waitForFunction(
    (k) => typeof (window as unknown as Record<string, unknown>)[k] === 'object',
    ACTIONS_KEY,
    { timeout: 5_000 },
  );
};

test.describe('Stage transform — fit / 100% / wheel zoom / Space pan', () => {
  test('画像投入直後は fit-to-viewport で scale < 1 になり、画像が水平方向に中央寄せされる', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    const t = await readTransform(page);
    expect(t.scale).toBeLessThan(1);
    expect(t.scale).toBeGreaterThan(0);
    expect(t.x).toBeGreaterThan(0);
  });

  test('setHundredPercent で scale = 1 になり、fitToViewport で fit に戻る', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    const initial = await readTransform(page);

    await page.evaluate((k) => {
      const actions = (window as unknown as Record<string, { setHundredPercent: () => void }>)[k];
      actions.setHundredPercent();
    }, ACTIONS_KEY);
    await expect.poll(() => readTransform(page).then((t) => t.scale)).toBe(1);

    await page.evaluate((k) => {
      const actions = (window as unknown as Record<string, { fitToViewport: () => void }>)[k];
      actions.fitToViewport();
    }, ACTIONS_KEY);
    await expect.poll(() => readTransform(page).then((t) => t.scale)).toBeCloseTo(initial.scale);
    const refit = await readTransform(page);
    expect(refit.x).toBeCloseTo(initial.x);
    expect(refit.y).toBeCloseTo(initial.y);
  });

  test('Cmd/Ctrl+wheel (= macOS pinch zoom) で scale が増加する', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    const before = await readTransform(page);
    const canvas = page.locator('.konvajs-content canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Konva canvas bounding box が取得できなかった');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // page.mouse.wheel は内部で _modifiers を CDP に渡すので keyboard.down で
    // 押された Control が ctrlKey: true として届く。これで macOS trackpad の
    // pinch zoom と同じ wheel イベントが発火する。
    await page.mouse.move(cx, cy);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');

    await expect.poll(() => readTransform(page).then((t) => t.scale)).toBeGreaterThan(before.scale);
  });

  test('panBy で transform.x / y が変化し、scale は不変', async ({ page }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    const before = await readTransform(page);
    await page.evaluate(
      ({ k, dx, dy }) => {
        const actions = (
          window as unknown as Record<string, { panBy: (dx: number, dy: number) => void }>
        )[k];
        actions.panBy(dx, dy);
      },
      { k: ACTIONS_KEY, dx: 100, dy: 50 },
    );

    // React の re-render → window.__SNAP_SHARE_STAGE_TRANSFORM__ 反映を待つ。
    await expect.poll(() => readTransform(page).then((t) => t.x)).toBeGreaterThan(before.x);
    const after = await readTransform(page);
    expect(after.scale).toBeCloseTo(before.scale);
    expect(after.y).toBeGreaterThan(before.y);
  });

  test('input フォーカス中に Space を打ってもツール切替や transform が反応しない', async ({
    page,
  }, testInfo) => {
    skipNonChromium(testInfo);
    await setupRoom(page);

    await page.keyboard.press('t');
    const stage = page.locator('.konvajs-content canvas').first();
    const box = await stage.boundingBox();
    if (!box) throw new Error('Konva canvas bounding box が取得できなかった');
    await page.mouse.click(box.x + 120, box.y + 120);

    const textarea = page.getByRole('textbox', { name: '注釈テキストを編集' });
    await expect(textarea).toBeVisible({ timeout: 5_000 });

    const before = await readTransform(page);
    // Space を打つ → textarea に空白が入る、CanvasStage の Space pan listener
    // は isEditableTarget でガードされているため transform 不変。
    await textarea.type('hello world');
    const after = await readTransform(page);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(after.scale).toBeCloseTo(before.scale);

    await textarea.press('Enter');
    await expect(textarea).toBeHidden();
  });
});
