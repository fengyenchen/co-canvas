import { expect, test } from '@playwright/test'
import {
  PROJECT_ID,
  VERSION_ID,
  createProject,
  emptyDocument,
  installE2eMocks,
} from './fixtures'

test('登入後進入雲端專案列表', async ({ page }) => {
  await installE2eMocks(page, { authenticated: false })
  await page.goto('/auth/sign-in?returnTo=%2Fprojects')

  await page.getByLabel('電子郵件').fill('e2e@example.com')
  await page.getByLabel('密碼').fill('e2e-password')
  await page.getByRole('button', { name: '登入', exact: true }).click()

  await expect(page).toHaveURL(/\/projects$/)
  await expect(page.getByTitle('e2e@example.com')).toBeVisible()
})

test('註冊後進入驗證等待頁並限制立即重寄', async ({ page }) => {
  await installE2eMocks(page, { authenticated: false })
  await page.goto('/auth/sign-up?returnTo=%2Fprojects')

  await page.getByLabel('名稱').fill('待驗證使用者')
  await page.getByLabel('電子郵件').fill('pending@example.com')
  await page.getByLabel('密碼', { exact: true }).fill('password123')
  await page.getByLabel('確認密碼').fill('password123')
  await page.getByRole('button', { name: '建立帳號' }).click()

  await expect(page).toHaveURL(/\/auth\/verify-email\?/)
  await expect(
    page.getByRole('heading', { name: '查看驗證信' }),
  ).toBeVisible()
  await expect(page.getByText('pending@example.com')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /秒後可重新寄送/ }),
  ).toBeDisabled()
})

test('未驗證帳號登入時回到驗證等待頁', async ({ page }) => {
  await installE2eMocks(page, { authenticated: false })
  await page.goto('/auth/sign-in?returnTo=%2Fprojects')

  await page.getByLabel('電子郵件').fill('unverified@example.com')
  await page.getByLabel('密碼').fill('password123')
  await page.getByRole('button', { name: '登入', exact: true }).click()

  await expect(page).toHaveURL(/\/auth\/verify-email\?/)
  await expect(
    page.getByRole('heading', { name: '查看驗證信' }),
  ).toBeVisible()
  await expect(page.getByText('unverified@example.com')).toBeVisible()
})

test('管理者可查看帳號驗證狀態與匿名清理紀錄', async ({ page }) => {
  await installE2eMocks(page, { authenticated: true, authAdmin: true })
  await page.goto('/')

  await page.getByRole('link', { name: '帳號管理' }).click()
  await expect(page).toHaveURL(/\/admin\/auth$/)
  await expect(
    page.getByRole('heading', { name: '帳號驗證管理' }),
  ).toBeVisible()
  await expect(page.getByText('已驗證', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('等待驗證', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('永久退信', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('verified@example.com')).toBeVisible()
  await expect(page.getByText('aaaaaaaaaaaa…aaaaaaaa')).toBeVisible()
})

test('可從搜尋旁的問號開啟操作導覽', async ({ page }) => {
  await installE2eMocks(page, {
    projects: [createProject()],
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  const helpButton = page.getByRole('button', { name: '開啟操作導覽' })
  const searchButton = page.getByRole('button', { name: '搜尋節點' })

  await expect(helpButton).toBeVisible({ timeout: 30_000 })
  await expect(searchButton).toBeVisible()
  await helpButton.click()

  const tourDialog = page.getByRole('alertdialog')
  await expect(
    tourDialog.getByText('歡迎使用 Co-Canvas', { exact: true }),
  ).toBeVisible()
  await tourDialog.getByRole('button', { name: /^下一步/ }).click()
  await expect(
    tourDialog.getByText('新增節點', { exact: true }),
  ).toBeVisible()
  await tourDialog.getByRole('button', { name: '跳過' }).click()
  await expect(tourDialog).toHaveCount(0)
})

test('影片節點可選擇本機 MP4 並在目前分頁預覽', async ({ page }) => {
  await installE2eMocks(page, {
    projects: [createProject()],
  })
  await page.goto(`/projects/${PROJECT_ID}`)

  await page.getByRole('button', { name: '新增節點' }).click()
  await page.getByRole('button', { name: '影片節點' }).click()

  const fileInput = page.locator('input[type="file"][accept*=".mp4"]')
  await fileInput.setInputFiles({
    name: 'competition-demo.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('e2e-video'),
  })

  await expect(page.getByText(/competition-demo\.mp4 ·/)).toBeVisible()
  await expect(page.locator('video')).toHaveAttribute('src', /^blob:/)
  await expect(page.getByLabel('標題')).toHaveValue('competition-demo')
})

test('建立專案、儲存節點並複製分享連結', async ({ page }) => {
  const state = await installE2eMocks(page)
  await page.goto('/projects')

  await page.getByRole('button', { name: '新增專案', exact: true }).click()
  const createDialog = page.getByRole('dialog', { name: '新增專案' })
  await createDialog.getByLabel('專案名稱').fill('E2E 研究計畫')
  await createDialog.getByRole('button', { name: '建立專案', exact: true }).click()

  await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_ID}$`))
  await page.getByRole('button', { name: '新增節點' }).click()
  await page.getByRole('button', { name: '文字節點' }).click()
  await page.getByLabel('標題').fill('已儲存的節點')

  await expect.poll(() => state.projectUpdates.length).toBeGreaterThan(0)
  await expect.poll(() => {
    const latestUpdate = state.projectUpdates.at(-1)
    return JSON.stringify(latestUpdate?.document ?? '')
  }).toContain('已儲存的節點')

  await page.getByRole('button', { name: '開啟專案選單' }).click()
  await page.getByRole('button', { name: '複製分享連結' }).click()
  await expect(page.getByRole('button', { name: '已複製連結' })).toBeVisible()
})

test('從版本紀錄恢復先前畫布', async ({ page }) => {
  const currentDocument = emptyDocument()
  currentDocument.nodes.push({
    id: 'current-node',
    type: 'concept',
    position: { x: 0, y: 0 },
    data: { title: '目前節點', content: '', origin: 'user' },
  })
  const restoredDocument = emptyDocument()
  restoredDocument.nodes.push({
    id: 'restored-node',
    type: 'concept',
    position: { x: 0, y: 0 },
    data: { title: '已恢復節點', content: '', origin: 'user' },
  })
  const project = createProject({ document: currentDocument })
  const versions = new Map([
    [
      PROJECT_ID,
      [
        {
          id: VERSION_ID,
          name: '基準版本',
          kind: 'manual' as const,
          createdAt: '2026-01-01T00:00:00.000Z',
          document: restoredDocument,
        },
      ],
    ],
  ])
  await installE2eMocks(page, { projects: [project], versions })
  await page.goto(`/projects/${PROJECT_ID}`)

  await expect(page.getByText('目前節點', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '開啟專案選單' }).click()
  await page.getByRole('button', { name: '版本紀錄' }).click()
  await page.getByRole('button', { name: '恢復', exact: true }).click()
  await page.getByRole('button', { name: '確認恢復' }).click()

  await expect(page.getByText('已恢復節點', { exact: true })).toBeVisible()
  await expect(page.getByText('目前節點', { exact: true })).toHaveCount(0)
})

test('影片片段會隨對話送往分析 API', async ({ page }) => {
  const document = emptyDocument()
  document.nodes.push(
    {
      id: 'clip-note',
      type: 'concept',
      position: { x: 0, y: 180 },
      data: {
        title: '片段筆記',
        content: '分析指定片段',
        origin: 'user',
        startTimeMs: 1_000,
        endTimeMs: 3_000,
      },
    },
    {
      id: 'video-source',
      type: 'video',
      position: { x: 0, y: 0 },
      data: {
        title: '測試影片',
        content: '公開 MP4',
        origin: 'user',
        sourceType: 'url',
        source: 'https://media.example.test/sample.mp4',
        durationMs: 10_000,
      },
    },
  )
  document.edges.push({
    id: 'video-to-note',
    source: 'video-source',
    target: 'clip-note',
    data: { origin: 'user', label: '片段' },
    label: '片段',
  })
  document.messages.push({
    id: 'other-user-message',
    role: 'user',
    content: '另一位使用者的既有訊息',
    contextNodeId: 'clip-note',
    createdAt: '2026-01-01T00:00:00.000Z',
    authorId: 'other-user',
    authorEmail: 'other@example.com',
    authorName: '王小明',
  })
  const state = await installE2eMocks(page, {
    projects: [createProject({ document })],
  })
  await page.route('https://media.example.test/**', (route) => route.abort())
  await page.goto(`/projects/${PROJECT_ID}`)

  const clipNode = page.locator('.react-flow__node').filter({ hasText: '片段筆記' })
  await clipNode.dblclick()
  await page.getByPlaceholder(/想問什麼/).fill('整理這段影片的重點')
  await page.getByRole('button', { name: '送出' }).click()

  await expect(page.getByText('我', { exact: true })).toBeVisible()
  await expect(page.getByText('王小明', { exact: true })).toBeVisible()
  await expect(page.getByText('AI', { exact: true })).toBeVisible()
  await expect(page.getByText('影片分析完成')).toBeVisible()
  await expect.poll(() => state.lastChatRequest).not.toBeNull()
  expect(state.lastChatRequest).toMatchObject({
    selectedNode: {
      id: 'clip-note',
      startTimeMs: 1_000,
      endTimeMs: 3_000,
      linkedVideo: {
        source: 'https://media.example.test/sample.mp4',
      },
    },
  })
})

test('研究事件會透過獨立端點同步', async ({ page }) => {
  const document = emptyDocument()
  document.suggestionEvents.push({
    id: 'decision-e2e',
    action: 'accepted',
    contextNodeId: 'node-e2e',
    aiMode: 'gemini',
    edited: false,
    decisionTimeMs: 1500,
    nodeCount: 2,
    createdAt: '2026-08-28T04:00:00.000Z',
  })
  const state = await installE2eMocks(page, {
    projects: [createProject({ document })],
  })

  await page.goto(`/projects/${PROJECT_ID}`)

  await expect.poll(() => state.researchEventSyncs.length).toBeGreaterThan(0)
  expect(state.researchEventSyncs.at(-1)).toMatchObject({
    projectId: PROJECT_ID,
    events: [{ id: 'decision-e2e', action: 'accepted' }],
  })
})
