import type { ProjectDocument } from '../types/project'
import { createProjectDocument } from './projectFile'

export const EXAMPLE_PROJECT_ID = 'example'

export function createExampleProjectDocument(): ProjectDocument {
  return createProjectDocument(
    [
      {
        id: 'example-root',
        type: 'concept',
        position: { x: 120, y: 80 },
        data: {
          title: '校園永續競賽題目發想',
          content: '從校園日常浪費中，找出具體且能被驗證的問題。',
          origin: 'user',
          color: 'purple',
        },
      },
      {
        id: 'example-problem',
        type: 'concept',
        position: { x: 120, y: 300 },
        data: {
          title: '午餐剩食難以被看見',
          content: '每天都有剩食，但學生與餐廳無法掌握哪些餐點、時段浪費最多。',
          origin: 'ai',
          color: 'pink',
        },
      },
      {
        id: 'example-user',
        type: 'concept',
        position: { x: 460, y: 300 },
        data: {
          title: '需要即時回饋',
          content: '學生想知道自己的選擇是否減少浪費，餐廳也需要調整備餐量的依據。',
          origin: 'ai',
          color: 'yellow',
        },
      },
      {
        id: 'example-idea',
        type: 'concept',
        position: { x: 800, y: 300 },
        data: {
          title: '剩食熱點地圖',
          content: '匿名記錄餐點、時段與剩食量，讓學生看見影響，也協助餐廳改善備餐。',
          origin: 'ai',
          color: 'green',
        },
      },
    ],
    [
      {
        id: 'example-edge-problem',
        source: 'example-root',
        target: 'example-problem',
        label: '聚焦問題',
        data: { label: '聚焦問題', origin: 'ai' },
      },
      {
        id: 'example-edge-user',
        source: 'example-problem',
        target: 'example-user',
        label: '使用者需求',
        data: { label: '使用者需求', origin: 'ai' },
      },
      {
        id: 'example-edge-idea',
        source: 'example-user',
        target: 'example-idea',
        label: '提案方向',
        data: { label: '提案方向', origin: 'ai' },
      },
    ],
    [
      {
        id: 'example-message-user',
        role: 'user',
        content:
          '我想參加校園永續競賽，請幫我從日常浪費中找一個具體、可以驗證的題目。',
        contextNodeId: 'example-root',
        createdAt: '2026-01-01T00:00:00.000Z',
        authorName: '我',
      },
      {
        id: 'example-message-ai',
        role: 'ai',
        content:
          '可以從 **校園午餐剩食** 切入：\n\n- **問題**：剩食每天發生，卻缺少可追蹤的資料。\n- **使用者**：學生需要看見選擇造成的影響，餐廳需要調整備餐量。\n- **提案方向**：建立「剩食熱點地圖」，匿名記錄餐點、時段與剩食量。\n\n你可以按下方的「產生節點」，把這些方向整理到畫布。',
        contextNodeId: 'example-root',
        createdAt: '2026-01-01T00:00:04.000Z',
        canGenerateNodes: true,
        latencyMs: 1200,
      },
    ],
    [],
  )
}
