import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'

const csv = `eventId,clientEventId,actorId,action,contextNodeId,aiMode,edited,decisionTimeMs,nodeCount,occurredAt,recordedAt
event-1,client-1,actor-a,accepted,node-1,gemini,true,1000,3,2026-08-01T00:00:00Z,2026-08-01T00:00:01Z
event-2,client-2,actor-a,rejected,node-1,gemini,false,3000,1,2026-08-01T00:01:00Z,2026-08-01T00:01:01Z
event-3,client-3,actor-b,regenerated,node-2,mock,false,5000,2,2026-08-02T00:00:00Z,2026-08-02T00:00:01Z`

test('可匯入研究 CSV、調整篩選並顯示分析結果', async ({ page }) => {
  await page.goto('/research/analyze')

  await expect(
    page.getByRole('heading', { name: '研究資料分析工具' }),
  ).toBeVisible()
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'study.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) },
    { name: 'baseline.csv', mimeType: 'text/csv', buffer: Buffer.from(csv.replaceAll('client-', 'baseline-client-').replaceAll('event-', 'baseline-event-').replaceAll('actor-', 'baseline-actor-')) },
  ])

  await expect(page.getByText('3 筆有效事件')).toHaveCount(2)
  const analyzedMetric = page.getByText('進入分析事件').locator('..')
  await expect(analyzedMetric.getByText('4', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '行為比例' })).toBeVisible()
  await expect(page.getByText(/目前採用完整描述分析/)).toBeVisible()
  await expect(page.getByRole('button', { name: '下載完整 ZIP 報表' })).toBeEnabled()
  await page.getByLabel('研究設計').selectOption('between')
  await expect(page.getByText("Fisher's exact test（決策分布）")).toBeVisible()

  await page.getByRole('checkbox', { name: /納入 Mock 模式/ }).check()
  await expect(analyzedMetric.getByText('6', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '參與者比較' })).toBeVisible()
  await expect(page.getByRole('button', { name: '下載完整 ZIP 報表' })).toBeVisible()

  const zipDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: '下載完整 ZIP 報表' }).click()
  const downloadedZip = await zipDownload
  await expect(downloadedZip.suggestedFilename()).toBe('co-canvas-research-package.zip')
  const zipPath = await downloadedZip.path()
  expect(zipPath).not.toBeNull()
  const archive = await JSZip.loadAsync(await readFile(zipPath!))
  expect(archive.file('report.html')).not.toBeNull()
  expect(Object.keys(archive.files).some((name) => name.endsWith('.svg'))).toBe(false)
  expect(Object.keys(archive.files).some((name) => name.endsWith('.png'))).toBe(false)
})

test('研究分析頁在手機寬度不產生整頁水平捲動', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/research/analyze')

  await expect(page.getByRole('heading', { name: '研究資料分析工具' })).toBeVisible()
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  await expect(page.getByRole('button', { name: '選擇 CSV' })).toBeVisible()
})
