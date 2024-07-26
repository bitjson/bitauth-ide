import { expect, loadTemplate, test } from './test-utils';

test('renders spacers as expected', async ({ page }) => {
  await loadTemplate(page, 'tests/fixtures/spacers.json');
  await page.getByRole('button', { name: 'True' }).click();
  await expect(page.getByRole('heading', { name: 'True P2SH' })).toBeVisible();
  await page.waitForFunction(
    `window._IDE_E2E_TESTING_VIEW_CONFIG !== undefined`,
  );
  await page.evaluate(
    `window._IDE_E2E_TESTING_VIEW_CONFIG.setFrames2SplitHeight(10)`,
  );
  await expect(page).toHaveScreenshot();
  await page.getByRole('button', { name: 'False' }).click();
  await expect(page).toHaveScreenshot();
});

test('renders error as expected for a non-push opcode in unlocking script', async ({
  page,
}) => {
  await loadTemplate(page, 'tests/fixtures/non-push-unlocking-opcode.json');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Unlock', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Unlocking bytecode may contain only push operations.'),
  ).toBeVisible();
  await expect(page).toHaveScreenshot();
});

test('displays evaluation of tested scripts', async ({ page }) => {
  await loadTemplate(page, 'tests/fixtures/state-merkle-trees.json');
  await page.getByRole('button', { name: 'Empty Leaf', exact: true }).click();
  await expect(page).toHaveScreenshot();
  await page.getByRole('button', { name: 'Filled Leaf', exact: true }).click();
  await expect(page).toHaveScreenshot();
  await page.getByRole('button', { name: 'Left Sibling', exact: true }).click();
  await expect(page).toHaveScreenshot();
  await page
    .getByRole('button', { name: 'Right Sibling', exact: true })
    .click();
  await expect(page).toHaveScreenshot();
  await page
    .getByRole('button', { name: 'New Merkle Root', exact: true })
    .click();
  await expect(page).toHaveScreenshot();
  await page
    .getByRole('button', { name: 'Replace Empty Leaf', exact: true })
    .click();
  await expect(page.locator('.state.highlight.success')).toContainText('1');
});

test('displays evaluation of tested scripts with custom scenarios', async ({
  page,
}) => {
  await loadTemplate(
    page,
    'libauth/src/lib/transaction/fixtures/templates/cash-channels-v1.json',
  );
  await page.getByRole('button', { name: 'Is 2 Bytes' }).click();
});

test('ignores misleading unicode characters, shows compilation on hover', async ({
  page,
}) => {
  await loadTemplate(page, 'tests/fixtures/empty.json');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.locator('.ScriptEditor-locking .monaco-editor').click();
  await page.locator('.editor .view-line').last().click();
  await page.keyboard.type(`<'ﬁt'> <'fit'>\nOP_EQUAL `);
  await page.getByText('<').first().hover();
  await expect(page.getByText('Compiled: 0x03666974')).toBeVisible();
  await expect(page).toHaveScreenshot();
});

test('renders loops as expected', async ({ page }) => {
  await loadTemplate(page, 'tests/fixtures/loops.json');
  await page.getByRole('button', { name: 'Nested Loops', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Nested Loops P2SH', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot();
  await page.locator('.loop-start').first().hover();
  await page.locator('.loop-start').first().click();
  await page.locator('.bp5-slider-label').nth(1).click();
  await expect(page).toHaveScreenshot();
  await page.locator('.loop-start').nth(2).hover();
  await page.locator('.loop-start').nth(2).click();
  await expect(page).toHaveScreenshot();
});
