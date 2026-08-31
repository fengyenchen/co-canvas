import { expect, test, type Page } from '@playwright/test'
import {
  COPY_PROJECT_ID,
  PROJECT_ID,
  createProject,
  installE2eMocks,
} from './fixtures'

const SECOND_PROJECT_ID = '44444444-4444-4444-8444-444444444444'
const THIRD_PROJECT_ID = '55555555-5555-4555-8555-555555555555'

async function openProjectMenu(page: Page, name: string) {
  await page.getByRole('button', {
    name: `開啟「${name}」專案選單`,
  }).click()
}

test('預設依最近查看排序，並可切換更新時間與名稱排序', async ({ page }) => {
  await installE2eMocks(page, {
    projects: [
      createProject({
        id: PROJECT_ID,
        name: 'Beta 計畫',
        updatedAt: '2026-01-02T00:00:00.000Z',
        lastViewedAt: '2026-01-03T00:00:00.000Z',
      }),
      createProject({
        id: SECOND_PROJECT_ID,
        name: 'Alpha 研究',
        updatedAt: '2026-01-03T00:00:00.000Z',
        lastViewedAt: '2026-01-02T00:00:00.000Z',
      }),
      createProject({
        id: THIRD_PROJECT_ID,
        name: 'Gamma 筆記',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }),
    ],
  })
  await page.goto('/projects')

  const projectNames = page.locator('section[aria-labelledby="project-list-title"] ul h3')
  await expect(page.getByLabel('專案排序方式')).toHaveValue('viewed-desc')
  await expect(projectNames).toHaveText(['Beta 計畫', 'Alpha 研究', 'Gamma 筆記'])

  await page.getByLabel('專案排序方式').selectOption('updated-desc')
  await expect(projectNames).toHaveText(['Alpha 研究', 'Beta 計畫', 'Gamma 筆記'])

  await page.getByLabel('專案排序方式').selectOption('updated-asc')
  await expect(projectNames).toHaveText(['Gamma 筆記', 'Beta 計畫', 'Alpha 研究'])

  await page.getByLabel('專案排序方式').selectOption('name-asc')
  await expect(projectNames).toHaveText(['Alpha 研究', 'Beta 計畫', 'Gamma 筆記'])

  await page.getByPlaceholder('搜尋專案名稱').fill('beta')
  await expect(projectNames).toHaveText(['Beta 計畫'])
  await expect(page.getByText('Alpha 研究', { exact: true })).toHaveCount(0)
})

test('可從專案列表建立包含原畫布內容的副本', async ({ page }) => {
  const source = createProject({ name: '研究模板' })
  source.document.nodes.push({
    id: 'template-node',
    type: 'concept',
    position: { x: 0, y: 0 },
    data: { title: '模板節點', content: '', origin: 'user' },
  })
  const state = await installE2eMocks(page, { projects: [source] })
  await page.goto('/projects')

  await openProjectMenu(page, '研究模板')
  await page.getByRole('button', { name: '建立副本' }).click()

  await expect(page.getByText('研究模板（副本）', { exact: true })).toBeVisible()
  expect(state.projects).toContainEqual(
    expect.objectContaining({
      id: COPY_PROJECT_ID,
      name: '研究模板（副本）',
      document: expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 'template-node' }),
        ]),
      }),
    }),
  )
})

test('非擁有者可從自己的列表移除專案而不刪除專案', async ({ page }) => {
  const sharedProject = createProject({
    name: '受邀協作專案',
    accessRole: 'editor',
  })
  const state = await installE2eMocks(page, {
    projects: [sharedProject],
  })
  await page.goto('/projects')

  await openProjectMenu(page, '受邀協作專案')
  await expect(
    page.getByRole('button', { name: '移到垃圾桶' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: '從列表移除' }).click()

  await expect(
    page.getByText('受邀協作專案', { exact: true }),
  ).toHaveCount(0)
  expect(state.projects).toHaveLength(0)
  expect(state.trashedProjects).toHaveLength(0)
})

test('專案可移到垃圾桶、復原並經確認後永久刪除', async ({ page }) => {
  const state = await installE2eMocks(page, {
    projects: [createProject({ name: '待整理專案' })],
  })
  await page.goto('/projects')

  await openProjectMenu(page, '待整理專案')
  await page.getByRole('button', { name: '移到垃圾桶' }).click()
  await expect(page.getByText('待整理專案', { exact: true })).toHaveCount(0)
  expect(state.trashedProjects).toHaveLength(1)

  await page.getByRole('button', { name: '開啟垃圾桶' }).click()
  await expect(page.getByRole('heading', { name: '垃圾桶', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '復原', exact: true }).click()
  await expect(page.getByText('垃圾桶是空的')).toBeVisible()
  expect(state.projects).toHaveLength(1)

  await page.getByRole('button', { name: '返回專案' }).click()
  await openProjectMenu(page, '待整理專案')
  await page.getByRole('button', { name: '移到垃圾桶' }).click()
  await page.getByRole('button', { name: '開啟垃圾桶' }).click()
  await page.getByRole('button', { name: '永久刪除', exact: true }).click()

  const confirmDialog = page.getByRole('dialog', { name: '永久刪除專案？' })
  await expect(confirmDialog).toContainText('無法復原')
  await confirmDialog.getByRole('button', { name: '永久刪除', exact: true }).click()
  await expect(page.getByText('垃圾桶是空的')).toBeVisible()
  expect(state.trashedProjects).toHaveLength(0)
})
