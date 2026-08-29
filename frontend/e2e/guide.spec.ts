import { expect, test } from '@playwright/test'
import { installE2eMocks } from './fixtures'

test('登入後可瀏覽首頁、以新分頁開啟手冊並從專案列表返回', async ({
  page,
}) => {
  await installE2eMocks(page)
  await page.goto('/')

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: '進入專案' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '登出' })).toBeVisible()

  await page.getByRole('link', { name: '查看完整使用範例' }).click()
  await expect(page).toHaveURL(/\/guide\/example$/)
  const exampleTour = page.getByRole('alertdialog')
  await expect(
    exampleTour.getByText('新增文字節點', { exact: true }),
  ).toBeVisible()
  await exampleTour.getByRole('button', { name: /^下一步/ }).click()
  await expect(
    exampleTour.getByText('開啟節點對話', { exact: true }),
  ).toBeVisible()
  await exampleTour.getByRole('button', { name: /^下一步/ }).click()
  await expect(
    exampleTour.getByText('與 AI 對話', { exact: true }),
  ).toBeVisible()
  await exampleTour.getByRole('button', { name: /^下一步/ }).click()
  await expect(
    exampleTour.getByText('從回覆產生節點', { exact: true }),
  ).toBeVisible()
  await exampleTour.getByRole('button', { name: /^下一步/ }).click()
  await expect(
    exampleTour.getByText('自動排版', { exact: true }),
  ).toBeVisible()
  await exampleTour.getByRole('button', { name: '完成' }).click()
  await expect(
    page
      .getByTestId('rf__node-example-root')
      .getByText('校園永續競賽題目發想'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '產生節點' })).toBeVisible()

  await page.goto('/')

  const guidePagePromise = page.waitForEvent('popup')
  await page.getByRole('link', { name: /使用手冊/ }).first().click()
  const guidePage = await guidePagePromise

  await expect(guidePage).toHaveURL(/\/guide$/)
  await expect(
    guidePage.getByRole('heading', { name: '從想法到清晰脈絡' }),
  ).toBeVisible()
  await expect(
    guidePage.getByRole('link', {
      name: /GitHub Repository：fengyenchen\/co-canvas/,
    }),
  ).toHaveAttribute('href', 'https://github.com/fengyenchen/co-canvas')
  await expect(
    guidePage.getByRole('link', { name: '研究資料指南', exact: true }),
  ).toHaveAttribute('target', '_blank')

  await guidePage.goto('/guide/research')
  await expect(
    guidePage.getByRole('heading', { name: '研究資料利用方式' }),
  ).toBeVisible()
  await expect(
    guidePage.getByRole('link', { name: '開始分析 CSV ↗' }),
  ).toHaveAttribute('href', '/research/analyze')
  await guidePage.getByRole('link', { name: 'CSV 欄位字典', exact: true }).click()
  const researchHeading = guidePage.getByRole('heading', {
    name: '03 · CSV 欄位字典',
  })
  await expect(researchHeading).toBeInViewport()
  const headingBox = await researchHeading.boundingBox()
  expect(headingBox?.y).toBeGreaterThanOrEqual(80)

  await page.getByRole('link', { name: '進入專案' }).first().click()
  await expect(page).toHaveURL(/\/projects$/)
  await page.getByRole('link', { name: '首頁', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('互動使用範例在手機寬度可操作且不產生水平捲動', async ({ page }) => {
  await installE2eMocks(page)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/guide/example')

  const exampleTour = page.getByRole('alertdialog')
  await expect(
    exampleTour.getByText('新增文字節點', { exact: true }),
  ).toBeVisible()
  await exampleTour.getByRole('button', { name: '跳過' }).click()
  await expect(page.getByRole('button', { name: '產生節點' })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
})
