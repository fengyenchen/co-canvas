import { expect, test, type Page } from '@playwright/test'
import {
  PROJECT_ID,
  createProject,
  emptyDocument,
  installE2eMocks,
  type E2eProject,
} from './fixtures'

function projectWithRole(
  accessRole: E2eProject['accessRole'],
  overrides: Partial<E2eProject> = {},
): E2eProject {
  const document = emptyDocument()
  document.nodes.push({
    id: 'permission-node',
    type: 'concept',
    position: { x: 0, y: 0 },
    data: {
      title: '權限測試節點',
      content: '只有具備權限的人可以修改',
      origin: 'user',
    },
  })

  return createProject({ accessRole, document, ...overrides })
}

async function openProjectMenu(page: Page) {
  await page.getByRole('button', { name: '開啟專案選單' }).click()
}

async function enterNodeConversation(page: Page) {
  const node = page.locator('.react-flow__node').filter({
    hasText: '權限測試節點',
  })
  await node.dblclick()
}

test('擁有者可以編輯、管理權限及刪除專案', async ({ page }) => {
  await installE2eMocks(page, {
    projects: [projectWithRole('owner')],
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  await expect(page.getByRole('button', { name: '新增節點' })).toBeVisible()
  await openProjectMenu(page)
  await expect(
    page.getByRole('button', { name: '重新命名', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '權限管理' })).toBeVisible()
  await expect(page.getByRole('button', { name: '移到垃圾桶' })).toBeVisible()
  await openProjectMenu(page)
  await page
    .getByRole('button', { name: '重新命名「E2E 專案」' })
    .click()
  await expect(
    page.getByRole('heading', { name: '重新命名專案' }),
  ).toBeVisible()
})

test('編輯者可以修改畫布但不能管理權限或刪除專案', async ({ page }) => {
  await installE2eMocks(page, {
    projects: [projectWithRole('editor')],
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  await expect(page.getByRole('button', { name: '新增節點' })).toBeVisible()
  await enterNodeConversation(page)
  await expect(page.getByPlaceholder(/想問什麼/)).toBeVisible()
  await openProjectMenu(page)
  await expect(
    page.getByRole('button', { name: '重新命名', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '權限管理' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '移到垃圾桶' })).toHaveCount(0)
})

test('檢視者只能查看專案內容', async ({ page }) => {
  await installE2eMocks(page, {
    projects: [projectWithRole('viewer')],
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  await expect(page.getByText('權限測試節點', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增節點' })).toHaveCount(0)
  await expect(page.getByPlaceholder(/想問什麼/)).toHaveCount(0)
  await openProjectMenu(page)
  await expect(
    page.getByRole('button', { name: '重新命名', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: '權限管理' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '匯入 JSON' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '移到垃圾桶' })).toHaveCount(0)
})

test('未登入訪客可以查看公開專案', async ({ page }) => {
  await installE2eMocks(page, {
    authenticated: false,
    projects: [
      projectWithRole('viewer', {
        visibility: 'public',
        publicAccessRole: 'viewer',
      }),
    ],
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}$`))
  await expect(page.getByText('權限測試節點', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增節點' })).toHaveCount(0)
  await expect(page.getByPlaceholder(/想問什麼/)).toHaveCount(0)
})

test('未授權使用者無法開啟私人專案', async ({ page }) => {
  await installE2eMocks(page, {
    authenticated: true,
    projects: [projectWithRole('viewer')],
    projectGetError: {
      status: 403,
      detail: '你沒有權限查看此私人專案',
    },
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  await expect(page.getByRole('heading', { name: '無法載入專案' })).toBeVisible()
  await expect(page.getByText('你沒有權限查看此私人專案')).toBeVisible()
  await expect(page.getByRole('link', { name: '返回專案列表' })).toBeVisible()
})
