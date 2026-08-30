import GuideContent from './guide/GuideContent.mdx'
import { GuideLayout } from './guide/GuideLayout'
import { guideMdxComponents } from './guide/guideMdxComponents'

const sections = [
  ['quick-start', '快速開始'],
  ['project-modes', '本機與雲端專案'],
  ['canvas-basics', '畫布基本操作'],
  ['nodes-edges', '節點與連線'],
  ['groups', '群組整理'],
  ['ai-chat', 'AI 對話與建議'],
  ['video', '影片節點與分析'],
  ['files', '文件與圖片節點'],
  ['cloud', '雲端協作與權限'],
  ['versions', '版本、備份與復原'],
  ['shortcuts', '快捷鍵'],
  ['troubleshooting', '常見問題'],
] as const

export function GuidePage() {
  return (
    <GuideLayout
      documentTitle="使用手冊｜Co-Canvas"
      headerTo="/guide"
      headerTitle="Co-Canvas 使用手冊"
      sections={sections}
      showResearchGuideLink
    >
      <GuideContent components={guideMdxComponents} />
    </GuideLayout>
  )
}
