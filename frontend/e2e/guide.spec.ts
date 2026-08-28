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
