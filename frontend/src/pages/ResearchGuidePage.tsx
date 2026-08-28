import { GuideLayout } from './guide/GuideLayout'
import { guideMdxComponents } from './guide/guideMdxComponents'
import ResearchGuideContent from './guide/ResearchGuideContent.mdx'

const sections = [
  ['research-export', '匯出方式'],
  ['research-participants', '參與者與多人協作'],
  ['csv-fields', 'CSV 欄位字典'],
  ['analysis-workflow', '研究處理流程'],
  ['derived-metrics', '常用衍生指標'],
  ['analysis-tools', '分析工具範例'],
  ['research-limits', '限制與研究倫理'],
] as const

export function ResearchGuidePage() {
  return (
    <GuideLayout
      documentTitle="研究資料利用方式｜Co-Canvas"
      headerTo="/guide/research"
      headerTitle="研究資料利用方式"
      sections={sections}
      returnLabel="返回使用手冊"
      returnTo="/guide"
    >
      <ResearchGuideContent components={guideMdxComponents} />
    </GuideLayout>
  )
}
