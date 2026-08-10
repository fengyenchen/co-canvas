import type { AiSuggestion } from '../types/suggestion'

export function createMockSuggestion(
  prompt: string,
): AiSuggestion {
  return {
    nodes: [
      {
        tempId: 'suggestion-1',
        title: '釐清目標',
        content: `確認「${prompt}」希望達成的具體結果。`,
      },
      {
        tempId: 'suggestion-2',
        title: '拆解執行步驟',
        content: '將目標拆成可以逐步完成的行動。',
      },
      {
        tempId: 'suggestion-3',
        title: '檢查風險',
        content: '找出可能遇到的問題與替代方案。',
      },
    ],
    relations: [
      {
        sourceTempId: 'suggestion-1',
        targetTempId: 'suggestion-2',
        label: '接著',
      },
      {
        sourceTempId: 'suggestion-2',
        targetTempId: 'suggestion-3',
        label: '最後',
      },
    ],
  }
}
