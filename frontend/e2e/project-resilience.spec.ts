import { expect, test } from '@playwright/test'
import {
  COPY_PROJECT_ID,
  PROJECT_ID,
  VERSION_ID,
  createProject,
  emptyDocument,
  installE2eMocks,
} from './fixtures'

function projectWithNode(accessRole: 'owner' | 'viewer' = 'owner') {
  const document = emptyDocument()
  document.nodes.push({
    id: 'conflict-node',
    type: 'concept',
    position: { x: 0, y: 0 },
    data: {
      title: '雲端原始標題',
      content: '衝突測試',
      origin: 'user',
    },
  })
  return createProject({ accessRole, document })
}

async function openVersions(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '專案', exact: true }).click()
  await page.getByRole('button', { name: '版本紀錄' }).click()
}

test('編輯者可建立具名版本並查看保存內容', async ({ page }) => {
  const state = await installE2eMocks(page, {
    projects: [projectWithNode()],
  })
  await page.goto(`/projects/${PROJECT_ID}`)
  await openVersions(page)

  await page.getByPlaceholder('版本名稱（選填）').fill('訪談前版本')
  await page.getByRole('button', { name: '建立版本' }).click()

  await expect(
    page.getByRole('region', { name: '已保存版本' }).getByText(
      '訪談前版本',
      { exact: true },
    ),
  ).toBeVisible()
  expect(state.versions.get(PROJECT_ID)).toEqual([
    expect.objectContaining({
      id: VERSION_ID,
      name: '訪談前版本',
      kind: 'manual',
    }),
  ])

  await page.getByRole('button', { name: '查看' }).click()
  await expect(page.getByRole('complementary').locator('dd').first()).toHaveText('1')
})

test('檢視者可查看版本內容但不能建立或恢復版本', async ({ page }) => {
  const project = projectWithNode('viewer')
  await installE2eMocks(page, {
    projects: [project],
    versions: new Map([
      [
        PROJECT_ID,
        [
          {
            id: VERSION_ID,
            name: '唯讀版本',
            kind: 'manual',
            createdAt: '2026-01-01T00:00:00.000Z',
            document: project.document,
          },
        ],
      ],
    ]),
  })
  await page.goto(`/projects/${PROJECT_ID}`)
  await openVersions(page)

  await expect(page.getByText('唯讀版本', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '建立版本' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '恢復', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '查看' }).click()
  await expect(page.getByRole('complementary').locator('dd').first()).toHaveText('1')
})

test('雲端更新衝突時可重新載入且不覆蓋伺服器內容', async ({ page }) => {
  const state = await installE2eMocks(page, {
    projects: [projectWithNode()],
    updateConflictCount: 1,
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  await page.locator('.react-flow__node').filter({ hasText: '雲端原始標題' }).click()
  await page.getByLabel('標題').fill('本機衝突標題')

  const conflictDialog = page.getByRole('dialog', { name: '偵測到編輯衝突' })
  await expect(conflictDialog).toBeVisible()
  await conflictDialog.getByRole('button', { name: '重新載入雲端版本' }).click()

  await expect(conflictDialog).toHaveCount(0)
  await expect(page.getByText('雲端原始標題', { exact: true })).toBeVisible()
  await expect(page.getByText('本機衝突標題', { exact: true })).toHaveCount(0)
  expect(state.projectUpdates).toHaveLength(0)
})

test('雲端更新衝突時可將本機內容保留為私人副本', async ({ page }) => {
  const state = await installE2eMocks(page, {
    projects: [projectWithNode()],
    updateConflictCount: 1,
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  await page.locator('.react-flow__node').filter({ hasText: '雲端原始標題' }).click()
  await page.getByLabel('標題').fill('需要保留的本機內容')
  const conflictDialog = page.getByRole('dialog', { name: '偵測到編輯衝突' })
  await expect(conflictDialog).toBeVisible()
  await conflictDialog.getByRole('button', { name: '保留目前內容為副本' }).click()

  await expect(page).toHaveURL(new RegExp(`/projects/${COPY_PROJECT_ID}$`))
  expect(state.projects).toContainEqual(
    expect.objectContaining({
      id: COPY_PROJECT_ID,
      name: 'E2E 專案（衝突副本）',
      visibility: 'private',
    }),
  )
})
