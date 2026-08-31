import { expect, test } from '@playwright/test'
import {
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
  await page.getByRole('button', { name: '開啟專案選單' }).click()
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

test('同時編輯時自動合併本機與雲端的不同欄位', async ({ page }) => {
  const state = await installE2eMocks(page, {
    projects: [projectWithNode()],
    updateConflictCount: 1,
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  await page.locator('.react-flow__node').filter({ hasText: '雲端原始標題' }).click()
  await page.getByLabel('標題').fill('本機衝突標題')
  const remoteNode = state.projects[0].document.nodes[0]
  remoteNode.data = {
    ...(remoteNode.data as Record<string, unknown>),
    content: '另一位使用者更新的內容',
  }
  state.projects[0].updatedAt = '2026-01-01T00:00:10.000Z'

  const conflictDialog = page.getByRole('dialog', { name: '偵測到編輯衝突' })
  await expect(conflictDialog).toHaveCount(0)
  await expect.poll(() => state.projectUpdates.length).toBeGreaterThan(0)
  expect(state.projects[0].document.nodes[0]).toMatchObject({
    data: {
      title: '本機衝突標題',
      content: '另一位使用者更新的內容',
    },
  })
  await expect(page.getByLabel('標題')).toHaveValue('本機衝突標題')
  await expect(page.getByLabel('內容')).toHaveValue('另一位使用者更新的內容')
})

test('同欄位競爭時保留目前輸入並自動重試', async ({ page }) => {
  const state = await installE2eMocks(page, {
    projects: [projectWithNode()],
    updateConflictCount: 1,
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  await page.locator('.react-flow__node').filter({ hasText: '雲端原始標題' }).click()
  await page.getByLabel('標題').fill('需要保留的本機內容')
  const conflictDialog = page.getByRole('dialog', { name: '偵測到編輯衝突' })
  await expect(conflictDialog).toHaveCount(0)
  await expect.poll(() => state.projectUpdates.length).toBeGreaterThan(0)
  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}$`))
  expect(state.projects[0].document.nodes[0]).toMatchObject({
    data: { title: '需要保留的本機內容' },
  })
})

test('無本機修改時會即時套用另一位使用者的更新', async ({ page }) => {
  const state = await installE2eMocks(page, {
    projects: [projectWithNode()],
  })
  await page.goto(`/projects/${PROJECT_ID}`)
  await expect(page.getByText('雲端原始標題', { exact: true })).toBeVisible()

  state.projects[0].document.nodes.push({
    id: 'remote-node',
    type: 'concept',
    position: { x: 240, y: 0 },
    data: {
      title: '其他使用者新增節點',
      content: '即時同步內容',
      origin: 'user',
    },
  })
  state.projects[0].updatedAt = '2026-01-01T00:00:20.000Z'

  await expect(
    page.getByText('其他使用者新增節點', { exact: true }),
  ).toBeVisible({ timeout: 5_000 })
})
