import { summarizeResearchRecords, type ResearchEventRecord } from './researchAnalysis'
import type { ResearchFileMetadata } from './researchPackage'
import {
  analyzeActionDistribution,
  analyzeAllOutcomes,
  type StatisticalResult,
} from './researchStatistics'

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
  const qualityLabels: Record<string, string> = {
    analyzedRows: '進入分析事件',
    duplicateRows: '移除重複資料',
    excludedMockRows: '排除 Mock 事件',
    excludedOutlierRows: '排除決策時間離群值',
    importedRows: '匯入原始資料列',
    invalidRows: '無效資料列',
  }
  const qualityRows = Object.entries(input.quality)
    .map(([metric, value]) => `<tr><th scope="row">${escapeHtml(qualityLabels[metric] ?? metric)}</th><td>${value}</td></tr>`)
    .join('')
  const conditionGroups = new Map<string, ResearchEventRecord[]>()
  input.records.forEach((record) => {
    const metadata = input.fileMetadata[record.sourceFile]
    const condition = metadata?.condition.trim() || '未指定'
    conditionGroups.set(condition, [...(conditionGroups.get(condition) ?? []), record])
  })
  const conditionRows = [...conditionGroups.entries()].map(([condition, records]) => {
    const conditionSummary = summarizeResearchRecords(records)
    return `<tr><th scope="row">${escapeHtml(condition)}</th><td>${conditionSummary.total}</td><td>${conditionSummary.actorCount}</td><td>${(conditionSummary.actionRates.accepted * 100).toFixed(1)}%</td><td>${(conditionSummary.editRate * 100).toFixed(1)}%</td><td>${(conditionSummary.decisionTime.median / 1000).toFixed(1)} 秒</td></tr>`
  }).join('')
  const actorAliases = new Map(
    [...new Set(input.records.map((record) => record.actorId))]
      .sort()
      .map((actorId, index) => [
        actorId,
        `P${String(index + 1).padStart(3, '0')}`,
      ]),
  )
  const participantRows = summary.participants.slice(0, 20).map((participant) => `<tr><th scope="row"><code>${actorAliases.get(participant.actorId) ?? 'P---'}</code></th><td>${participant.total}</td><td>${participant.accepted}</td><td>${(participant.editRate * 100).toFixed(1)}%</td><td>${(participant.medianDecisionTimeMs / 1000).toFixed(1)} 秒</td></tr>`).join('')
  const formatStatisticalResult = (result: StatisticalResult | null) => result
    ? `${escapeHtml(result.name)}；統計量 ${result.statistic.toFixed(3)}；p = ${result.pValue.toFixed(4)}；${escapeHtml(result.effectName)} = ${Number.isFinite(result.effectSize) ? result.effectSize.toFixed(3) : '∞'}`
    : '資料不足，無法計算'
  const statisticalRows = analyzeAllOutcomes(input.records, input.fileMetadata)
    .map((analysis) => `<tr><th scope="row">${escapeHtml(analysis.label)}</th><td>${formatStatisticalResult(analysis.between)}</td><td>${formatStatisticalResult(analysis.within)}</td></tr>`)
    .join('')
  const actionDistribution = analyzeActionDistribution(
    input.records,
    input.fileMetadata,
  )
  const generatedAt = new Date().toLocaleString('zh-TW')
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Co-Canvas 研究分析報告</title>
  <style>
    :root{color-scheme:light;--ink:#171721;--muted:#62616b;--line:#dedee3;--surface:#fff;--canvas:#f5f5f7;--primary:#585762}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.7 system-ui,-apple-system,"Segoe UI",sans-serif}
    main{width:min(100% - 32px,1040px);margin:auto;padding:56px 0 72px}.eyebrow{margin:0;color:var(--primary);font-size:13px;font-weight:700;letter-spacing:.14em}.lead{max-width:720px;font-size:18px;color:var(--muted)}
    h1{max-width:760px;margin:8px 0 6px;font-size:clamp(32px,6vw,52px);line-height:1.15;letter-spacing:-.035em}h2{margin:0;font-size:23px;letter-spacing:-.015em}h3{margin:0 0 12px;font-size:17px}.meta{margin:0;color:var(--muted);font-size:14px}
    nav{display:flex;flex-wrap:wrap;gap:8px;margin:28px 0}nav a{border:1px solid var(--line);border-radius:999px;background:var(--surface);padding:8px 13px;color:var(--ink);font-size:13px;text-decoration:none}
    section{margin:20px 0;padding:28px;border:1px solid var(--line);border-radius:18px;background:var(--surface);box-shadow:0 8px 24px rgba(28,28,36,.035)}.section-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:20px}.section-head p{margin:0;color:var(--muted);font-size:14px}
    .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.metric{min-height:112px;padding:17px;border-radius:12px;background:var(--canvas)}.metric span{display:block;color:var(--muted);font-size:13px}.metric strong{display:block;margin-top:7px;font-size:28px;line-height:1.2;font-variant-numeric:tabular-nums}
    .chart{overflow-x:auto}.chart svg{display:block;width:100%;min-width:620px;height:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:12px 14px;border-bottom:1px solid #ececf0;text-align:right;font-variant-numeric:tabular-nums}th:first-child,td:first-child{text-align:left}thead th{background:var(--canvas);color:var(--muted);font-size:12px;letter-spacing:.04em}tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px}code{font-size:12px}.notice{border-left:4px solid var(--primary);background:var(--canvas);padding:16px 18px;border-radius:0 10px 10px 0;color:var(--muted)}
    footer{padding-top:18px;text-align:center;color:var(--muted);font-size:12px}@media(max-width:640px){main{width:min(100% - 20px,1040px);padding-top:32px}section{padding:20px}.section-head{display:block}.section-head p{margin-top:6px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media print{body{background:#fff}main{width:100%;padding:0}nav{display:none}section{break-inside:avoid;border-color:#bbb;box-shadow:none}.chart{overflow:visible}.chart svg{min-width:0}footer{display:none}}
  </style>
</head>
<body><main>
  <header><p class="eyebrow">CO-CANVAS RESEARCH</p><h1>研究分析報告</h1><p class="lead">AI 建議決策行為的描述性摘要、條件比較與資料品質檢查。</p><p class="meta">產生時間：${generatedAt}</p></header>
  <nav aria-label="報告章節"><a href="#overview">研究摘要</a><a href="#actions">決策分布</a><a href="#conditions">條件比較</a><a href="#participants">參與者</a><a href="#statistics">統計檢定</a><a href="#quality">資料品質</a><a href="#notes">解讀提醒</a></nav>
  <section id="overview"><div class="section-head"><div><p class="eyebrow">01</p><h2>研究摘要</h2></div><p>目前清理與篩選後的資料</p></div><div class="metrics"><div class="metric"><span>分析事件</span><strong>${summary.total}</strong></div><div class="metric"><span>參與者</span><strong>${summary.actorCount}</strong></div><div class="metric"><span>接受率</span><strong>${(summary.actionRates.accepted * 100).toFixed(1)}%</strong></div><div class="metric"><span>修改率</span><strong>${(summary.editRate * 100).toFixed(1)}%</strong></div><div class="metric"><span>決策時間中位數</span><strong>${(summary.decisionTime.median / 1000).toFixed(1)} 秒</strong></div><div class="metric"><span>平均建議節點數</span><strong>${summary.nodeCount.mean.toFixed(1)}</strong></div></div></section>
  <section id="actions"><div class="section-head"><div><p class="eyebrow">02</p><h2>決策分布</h2></div><p>接受、取消與重新生成</p></div><div class="chart">${actionChart}</div></section>
  <section id="conditions"><div class="section-head"><div><p class="eyebrow">03</p><h2>條件比較</h2></div><p>依匯入檔案的條件標籤彙整</p></div><div class="chart">${conditionChart}</div><h3>條件摘要</h3><div class="table-wrap"><table><thead><tr><th>條件</th><th>事件</th><th>參與者</th><th>接受率</th><th>修改率</th><th>決策中位數</th></tr></thead><tbody>${conditionRows}</tbody></table></div></section>
  <section id="participants"><div class="section-head"><div><p class="eyebrow">04</p><h2>參與者摘要</h2></div><p>依事件數排序，最多顯示 20 位</p></div><div class="table-wrap"><table><thead><tr><th>參與者</th><th>事件</th><th>接受</th><th>修改率</th><th>決策中位數</th></tr></thead><tbody>${participantRows}</tbody></table></div></section>
  <section id="statistics"><div class="section-head"><div><p class="eyebrow">05</p><h2>完整統計檢定</h2></div><p>同時輸出組間與組內假設，請依實際研究設計採用</p></div><div class="table-wrap"><table><thead><tr><th>主要指標</th><th>組間假設</th><th>組內假設</th></tr></thead><tbody>${statisticalRows}</tbody></table></div><div class="notice" style="margin-top:16px">決策分布：${formatStatisticalResult(actionDistribution)}</div></section>
  <section id="quality"><div class="section-head"><div><p class="eyebrow">06</p><h2>資料品質</h2></div><p>匯入、驗證與排除結果</p></div><div class="table-wrap"><table><tbody>${qualityRows}</tbody></table></div></section>
  <section id="notes"><div class="section-head"><div><p class="eyebrow">07</p><h2>解讀提醒</h2></div></div><div class="notice">本報告同時提供組間與組內假設下的檢定結果，不代表兩者都適用。正式報告必須依實際研究設計選用，並同時說明樣本數、排除規則、任務表現，以及問卷或訪談結果。</div></section>
  <footer>由 Co-Canvas 研究資料分析工具產生</footer>
</main></body></html>`
}
