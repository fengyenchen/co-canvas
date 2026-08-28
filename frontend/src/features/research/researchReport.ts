import { summarizeResearchRecords, type ResearchEventRecord } from './researchAnalysis'
import type { ResearchFileMetadata } from './researchPackage'

const colors = { accepted: '#585762', rejected: '#8b8a93', regenerated: '#c7c6cc' }

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

export function createActionChartSvg(records: ResearchEventRecord[]) {
  const summary = summarizeResearchRecords(records)
  const entries = [
    ['accepted', '接受'], ['rejected', '取消'], ['regenerated', '重新生成'],
  ] as const
  const bars = entries.map(([action, label], index) => {
    const y = 58 + index * 72
    const width = summary.total ? (summary.actionCounts[action] / summary.total) * 520 : 0
    const percent = summary.total ? Math.round((summary.actionCounts[action] / summary.total) * 1000) / 10 : 0
    return `<text x="28" y="${y}" font-size="15" fill="#20202a">${label}</text><rect x="112" y="${y - 18}" width="520" height="24" rx="6" fill="#efeff2"/><rect x="112" y="${y - 18}" width="${width}" height="24" rx="6" fill="${colors[action]}"/><text x="648" y="${y}" font-size="14" fill="#55545e">${summary.actionCounts[action]}（${percent}%）</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="270" viewBox="0 0 800 270" role="img" aria-label="AI 建議決策比例"><rect width="800" height="270" rx="18" fill="#ffffff"/><text x="28" y="30" font-size="18" font-weight="700" fill="#111827">AI 建議決策比例</text>${bars}</svg>`
}

export function createConditionChartSvg(records: ResearchEventRecord[], metadata: Record<string, ResearchFileMetadata>) {
  const groups = new Map<string, ResearchEventRecord[]>()
  records.forEach((record) => {
    const condition = metadata[record.sourceFile]?.condition.trim() || '未指定'
    groups.set(condition, [...(groups.get(condition) ?? []), record])
  })
  const entries = [...groups.entries()]
  const height = Math.max(150, 74 + entries.length * 62)
  const bars = entries.map(([condition, items], index) => {
    const rate = items.filter((item) => item.action === 'accepted').length / items.length
    const y = 72 + index * 62
    return `<text x="28" y="${y}" font-size="14" fill="#20202a">${escapeHtml(condition).slice(0, 26)}</text><rect x="210" y="${y - 18}" width="430" height="24" rx="6" fill="#efeff2"/><rect x="210" y="${y - 18}" width="${rate * 430}" height="24" rx="6" fill="#585762"/><text x="656" y="${y}" font-size="14" fill="#55545e">${Math.round(rate * 1000) / 10}%</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}" viewBox="0 0 800 ${height}" role="img" aria-label="各條件接受率"><rect width="800" height="${height}" rx="18" fill="#ffffff"/><text x="28" y="32" font-size="18" font-weight="700" fill="#111827">各條件接受率</text>${bars}</svg>`
}

export function createResearchHtmlReport(input: {
  records: ResearchEventRecord[]
  fileMetadata: Record<string, ResearchFileMetadata>
  quality: Record<string, number>
}) {
  const summary = summarizeResearchRecords(input.records)
  const actionChart = createActionChartSvg(input.records)
  const conditionChart = createConditionChartSvg(input.records, input.fileMetadata)
  const rows = Object.entries(input.quality).map(([metric, value]) => `<tr><th>${escapeHtml(metric)}</th><td>${value}</td></tr>`).join('')
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Co-Canvas 研究分析報告</title><style>body{margin:0;background:#f5f5f7;color:#20202a;font:16px/1.65 system-ui,sans-serif}main{max-width:960px;margin:auto;padding:48px 24px}section{background:#fff;border:1px solid #dedee3;border-radius:18px;padding:24px;margin:20px 0}h1{font-size:36px;margin:0 0 8px}h2{font-size:21px}small,p{color:#62616b}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.metric{background:#f5f5f7;border-radius:12px;padding:16px}.metric strong{display:block;font-size:26px}svg{max-width:100%;height:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #eee;padding:10px}</style></head><body><main><h1>Co-Canvas 研究分析報告</h1><p>產生時間：${new Date().toLocaleString('zh-TW')}</p><section><h2>摘要</h2><div class="metrics"><div class="metric"><small>分析事件</small><strong>${summary.total}</strong></div><div class="metric"><small>參與者</small><strong>${summary.actorCount}</strong></div><div class="metric"><small>接受率</small><strong>${(summary.actionRates.accepted * 100).toFixed(1)}%</strong></div><div class="metric"><small>修改率</small><strong>${(summary.editRate * 100).toFixed(1)}%</strong></div><div class="metric"><small>決策時間中位數</small><strong>${(summary.decisionTime.median / 1000).toFixed(1)} 秒</strong></div></div></section><section>${actionChart}</section><section>${conditionChart}</section><section><h2>資料品質</h2><table>${rows}</table></section><section><h2>解讀提醒</h2><p>本報告以描述性統計呈現目前資料，不單獨代表因果效果。正式報告應同時說明研究設計、樣本數、排除規則、任務與問卷／訪談結果。</p></section></main></body></html>`
}
