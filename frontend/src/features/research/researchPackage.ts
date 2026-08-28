import JSZip from 'jszip'
import {
  createResearchSummaryCsv,
  summarizeResearchRecords,
  type ResearchEventRecord,
  type ResearchFilterOptions,
} from './researchAnalysis'
import { createActionChartSvg, createConditionChartSvg, createResearchHtmlReport } from './researchReport'
import { analyzeActionDistribution, analyzeOutcome, analyzeSequences, conditionEstimates, type ResearchOutcome, type StudyDesign } from './researchStatistics'

export type ResearchFileMetadata = {
  condition: string
  task: string
}

export type ResearchPackageOptions = {
  anonymizeActors: boolean
  fileMetadata: Record<string, ResearchFileMetadata>
  filters: ResearchFilterOptions
  outcome: ResearchOutcome
  studyDesign: StudyDesign
}

type EnrichedRecord = ResearchEventRecord & ResearchFileMetadata & { participantId: string }

function escapeCsv(value: string | number | boolean) {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function toCsv(headers: string[], rows: Array<Array<string | number | boolean>>) {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`
}

export function createActorAliases(records: ResearchEventRecord[]) {
  const actors = [...new Set(records.map((record) => record.actorId))].sort()
  return new Map(actors.map((actorId, index) => [actorId, `P${String(index + 1).padStart(3, '0')}`]))
}

export function enrichResearchRecords(
  records: ResearchEventRecord[],
  options: Pick<ResearchPackageOptions, 'anonymizeActors' | 'fileMetadata'>,
): EnrichedRecord[] {
  const aliases = createActorAliases(records)
  return records.map((record) => {
    const metadata = options.fileMetadata[record.sourceFile] ?? { condition: '', task: '' }
    return {
      ...record,
      ...metadata,
      participantId: options.anonymizeActors ? (aliases.get(record.actorId) ?? '') : record.actorId,
    }
  })
}

export function createEnrichedResearchCsv(records: EnrichedRecord[]) {
  const headers = [
    'eventId', 'clientEventId', 'participantId', 'action', 'contextNodeId', 'aiMode',
    'edited', 'decisionTimeMs', 'nodeCount', 'occurredAt', 'recordedAt', 'sourceFile',
    'condition', 'task',
  ]
  return toCsv(headers, records.map((record) => headers.map((header) => record[header as keyof EnrichedRecord] as string | number | boolean)))
}

export function createParticipantSummaryCsv(records: EnrichedRecord[]) {
  const groups = new Map<string, EnrichedRecord[]>()
  records.forEach((record) => groups.set(record.participantId, [...(groups.get(record.participantId) ?? []), record]))
  const headers = ['participantId', 'events', 'accepted', 'rejected', 'regenerated', 'acceptanceRate', 'editRate', 'meanDecisionTimeMs', 'meanNodeCount']
  const rows = [...groups.entries()].map(([participantId, items]) => {
    const accepted = items.filter((item) => item.action === 'accepted').length
    return [
      participantId, items.length, accepted,
      items.filter((item) => item.action === 'rejected').length,
      items.filter((item) => item.action === 'regenerated').length,
      accepted / items.length,
      items.filter((item) => item.edited).length / items.length,
      items.reduce((sum, item) => sum + item.decisionTimeMs, 0) / items.length,
      items.reduce((sum, item) => sum + item.nodeCount, 0) / items.length,
    ]
  })
  return toCsv(headers, rows)
}

export function createConditionSummaryCsv(records: EnrichedRecord[]) {
  const groups = new Map<string, EnrichedRecord[]>()
  records.forEach((record) => {
    const key = `${record.condition || '未指定'}\u0000${record.task || '未指定'}`
    groups.set(key, [...(groups.get(key) ?? []), record])
  })
  const headers = ['condition', 'task', 'events', 'participants', 'acceptanceRate', 'rejectionRate', 'regenerationRate', 'editRate', 'meanDecisionTimeMs', 'meanNodeCount']
  const rows = [...groups.entries()].map(([key, items]) => {
    const [condition, task] = key.split('\u0000')
    const summary = summarizeResearchRecords(items)
    return [condition, task, summary.total, summary.actorCount, summary.actionRates.accepted, summary.actionRates.rejected, summary.actionRates.regenerated, summary.editRate, summary.decisionTime.mean, summary.nodeCount.mean]
  })
  return toCsv(headers, rows)
}

export function createTimelineCsv(records: EnrichedRecord[]) {
  const summary = summarizeResearchRecords(records)
  return toCsv(
    ['date', 'events', 'accepted', 'rejected', 'regenerated'],
    summary.timeline.map((day) => [day.date, day.total, day.accepted, day.rejected, day.regenerated]),
  )
}

export function createDataQualityCsv(input: {
  duplicateRows: number
  excludedMockRows: number
  excludedOutlierRows: number
  importedRows: number
  invalidRows: number
  analyzedRows: number
}) {
  return toCsv(['metric', 'value'], Object.entries(input).map(([metric, value]) => [metric, value]))
}

export const researchCodebook = `# Co-Canvas 研究資料欄位字典

## 事件資料

| 欄位 | 說明 |
| --- | --- |
| participantId | 匿名化後的參與者代碼；停用匿名化時等於 actorId |
| action | accepted、rejected 或 regenerated |
| edited | 使用者接受前是否修改 AI 建議 |
| decisionTimeMs | 建議出現至使用者決策的毫秒數 |
| nodeCount | 該次 AI 建議包含的節點數 |
| occurredAt | 事件發生時間（ISO 8601） |
| sourceFile | 原始 CSV 檔名 |
| condition | 匯入時指定的實驗條件 |
| task | 匯入時指定的任務名稱 |

## 注意事項

- eventId、clientEventId 與 contextNodeId 仍可能具有研究識別風險，公開資料前請再次審查。
- 描述性統計不等於因果證據；正式推論需配合研究設計與樣本假設。
`

export const pythonAnalysisScript = `import pandas as pd

events = pd.read_csv("cleaned-events.csv")
participants = pd.read_csv("participant-summary.csv")
conditions = pd.read_csv("condition-summary.csv")

print(events.groupby(["condition", "action"]).size().unstack(fill_value=0))
print(conditions.to_string(index=False))
`

export const rAnalysisScript = `library(readr)
library(dplyr)

events <- read_csv("cleaned-events.csv")
participants <- read_csv("participant-summary.csv")

events %>%
  count(condition, action) %>%
  group_by(condition) %>%
  mutate(rate = n / sum(n)) %>%
  print()
`

export async function createResearchPackage(input: {
  records: ResearchEventRecord[]
  options: ResearchPackageOptions
  quality: Parameters<typeof createDataQualityCsv>[0]
}) {
  const enriched = enrichResearchRecords(input.records, input.options)
  const zip = new JSZip()
  zip.file('cleaned-events.csv', createEnrichedResearchCsv(enriched))
  zip.file('summary.csv', createResearchSummaryCsv(summarizeResearchRecords(input.records)))
  zip.file('participant-summary.csv', createParticipantSummaryCsv(enriched))
  zip.file('condition-summary.csv', createConditionSummaryCsv(enriched))
  zip.file('timeline.csv', createTimelineCsv(enriched))
  zip.file('data-quality.csv', createDataQualityCsv(input.quality))
  const estimates = conditionEstimates(input.records, input.options.fileMetadata)
  zip.file('condition-confidence-intervals.csv', toCsv(['condition', 'events', 'participants', 'acceptanceRate', 'ci95Low', 'ci95High'], estimates.map((item) => [item.condition, item.events, item.participants, item.acceptanceRate, item.ciLow, item.ciHigh])))
  const statistics = analyzeOutcome(input.records, input.options.fileMetadata, input.options.studyDesign, input.options.outcome)
  zip.file('statistical-tests.json', JSON.stringify({ actionDistribution: analyzeActionDistribution(input.records, input.options.fileMetadata), primaryOutcome: statistics }, null, 2))
  const sequences = analyzeSequences(input.records)
  zip.file('sequence-transitions.csv', toCsv(['transition', 'count'], sequences.transitions.map((item) => [item.transition, item.count])))
  zip.file('report.html', createResearchHtmlReport({ records: input.records, fileMetadata: input.options.fileMetadata, quality: input.quality }))
  zip.file('charts/action-distribution.svg', createActionChartSvg(input.records))
  zip.file('charts/condition-acceptance.svg', createConditionChartSvg(input.records, input.options.fileMetadata))
  zip.file('codebook.md', researchCodebook)
  zip.file('analysis-config.json', JSON.stringify({ generatedAt: new Date().toISOString(), ...input.options }, null, 2))
  zip.file('scripts/analyze.py', pythonAnalysisScript)
  zip.file('scripts/analyze.R', rAnalysisScript)
  zip.file('README.md', '# Co-Canvas 研究分析包\n\n先閱讀 `codebook.md`，再使用 `cleaned-events.csv` 或彙整檔案進行分析。`analysis-config.json` 記錄本次清理設定。\n')
  return zip.generateAsync({ type: 'blob' })
}
