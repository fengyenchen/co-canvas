export const researchCsvHeaders = [
  'eventId',
  'clientEventId',
  'actorId',
  'action',
  'contextNodeId',
  'aiMode',
  'edited',
  'decisionTimeMs',
  'nodeCount',
  'occurredAt',
  'recordedAt',
] as const

export type ResearchAction = 'accepted' | 'rejected' | 'regenerated'

export type ResearchEventRecord = {
  eventId: string
  clientEventId: string
  actorId: string
  action: ResearchAction
  contextNodeId: string
  aiMode: string
  edited: boolean
  decisionTimeMs: number
  nodeCount: number
  occurredAt: string
  recordedAt: string
  sourceFile: string
}

export type ResearchCsvImport = {
  fileName: string
  invalidRows: number
  records: ResearchEventRecord[]
  totalRows: number
}

export type ResearchFilterOptions = {
  excludeDecisionTimeOutliers: boolean
  includeMock: boolean
  removeDuplicates: boolean
}

export type ResearchPreparation = {
  duplicateRows: number
  excludedMockRows: number
  excludedOutlierRows: number
  records: ResearchEventRecord[]
}

export type ResearchSummary = {
  actionCounts: Record<ResearchAction, number>
  actionRates: Record<ResearchAction, number>
  actorCount: number
  decisionTime: {
    mean: number
    median: number
    q1: number
    q3: number
  }
  editRate: number
  nodeCount: {
    mean: number
    median: number
  }
  participants: Array<{
    accepted: number
    actorId: string
    editRate: number
    medianDecisionTimeMs: number
    regenerated: number
    rejected: number
    total: number
  }>
  timeline: Array<{
    accepted: number
    date: string
    regenerated: number
    rejected: number
    total: number
  }>
  total: number
}

function parseCsvRows(csv: string) {
  const rows: string[][] = []
  let currentField = ''
  let currentRow: string[] = []
  let quoted = false
  const input = csv.replace(/^\uFEFF/, '')

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]

    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        currentField += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        currentField += character
      }
      continue
    }

    if (character === '"') {
      quoted = true
    } else if (character === ',') {
      currentRow.push(currentField)
      currentField = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1
      currentRow.push(currentField)
      if (currentRow.some((value) => value.trim() !== '')) rows.push(currentRow)
      currentRow = []
      currentField = ''
    } else {
      currentField += character
    }
  }

  if (quoted) throw new Error('CSV 含有未關閉的引號。')
  currentRow.push(currentField)
  if (currentRow.some((value) => value.trim() !== '')) rows.push(currentRow)
  return rows
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return null
}

export function parseResearchCsv(csv: string, fileName: string): ResearchCsvImport {
  const rows = parseCsvRows(csv)
  if (rows.length === 0) throw new Error('CSV 是空的。')

  const headers = rows[0].map((header) => header.trim())
  const missingHeaders = researchCsvHeaders.filter((header) => !headers.includes(header))
  if (missingHeaders.length > 0) {
    throw new Error(`缺少必要欄位：${missingHeaders.join('、')}`)
  }

  const headerIndexes = Object.fromEntries(headers.map((header, index) => [header, index]))
  const records: ResearchEventRecord[] = []
  let invalidRows = 0

  for (const row of rows.slice(1)) {
    const get = (header: typeof researchCsvHeaders[number]) => row[headerIndexes[header]]?.trim() ?? ''
    const action = get('action')
    const edited = parseBoolean(get('edited'))
    const decisionTimeMs = Number(get('decisionTimeMs'))
    const nodeCount = Number(get('nodeCount'))
    const occurredAt = get('occurredAt')
    const recordedAt = get('recordedAt')

    const valid =
      ['accepted', 'rejected', 'regenerated'].includes(action) &&
      edited !== null &&
      Number.isFinite(decisionTimeMs) &&
      decisionTimeMs >= 0 &&
      Number.isInteger(nodeCount) &&
      nodeCount >= 0 &&
      !Number.isNaN(Date.parse(occurredAt)) &&
      !Number.isNaN(Date.parse(recordedAt)) &&
      get('clientEventId') !== '' &&
      get('actorId') !== ''

    if (!valid) {
      invalidRows += 1
      continue
    }

    records.push({
      eventId: get('eventId'),
      clientEventId: get('clientEventId'),
      actorId: get('actorId'),
      action: action as ResearchAction,
      contextNodeId: get('contextNodeId'),
      aiMode: get('aiMode').toLowerCase(),
      edited,
      decisionTimeMs,
      nodeCount,
      occurredAt,
      recordedAt,
      sourceFile: fileName,
    })
  }

  return {
    fileName,
    invalidRows,
    records,
    totalRows: Math.max(0, rows.length - 1),
  }
}

function quantile(values: number[], position: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = (sorted.length - 1) * position
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

export function prepareResearchRecords(
  imports: ResearchCsvImport[],
  options: ResearchFilterOptions,
): ResearchPreparation {
  const allRecords = imports.flatMap((item) => item.records)
  let records = allRecords
  let duplicateRows = 0
  let excludedMockRows = 0
  let excludedOutlierRows = 0

  if (options.removeDuplicates) {
    const seen = new Set<string>()
    records = records.filter((record) => {
      if (seen.has(record.clientEventId)) {
        duplicateRows += 1
        return false
      }
      seen.add(record.clientEventId)
      return true
    })
  }

  if (!options.includeMock) {
    const before = records.length
    records = records.filter((record) => record.aiMode !== 'mock')
    excludedMockRows = before - records.length
  }

  if (options.excludeDecisionTimeOutliers && records.length >= 4) {
    const times = records.map((record) => record.decisionTimeMs)
    const q1 = quantile(times, 0.25)
    const q3 = quantile(times, 0.75)
    const iqr = q3 - q1
    const lower = Math.max(0, q1 - iqr * 1.5)
    const upper = q3 + iqr * 1.5
    const before = records.length
    records = records.filter(
      (record) => record.decisionTimeMs >= lower && record.decisionTimeMs <= upper,
    )
    excludedOutlierRows = before - records.length
  }

  return { duplicateRows, excludedMockRows, excludedOutlierRows, records }
}

export function summarizeResearchRecords(records: ResearchEventRecord[]): ResearchSummary {
  const actionCounts: Record<ResearchAction, number> = {
    accepted: 0,
    rejected: 0,
    regenerated: 0,
  }
  for (const record of records) actionCounts[record.action] += 1

  const total = records.length
  const rate = (count: number) => (total === 0 ? 0 : count / total)
  const decisionTimes = records.map((record) => record.decisionTimeMs)
  const nodeCounts = records.map((record) => record.nodeCount)
  const actorGroups = new Map<string, ResearchEventRecord[]>()
  const dateGroups = new Map<string, ResearchEventRecord[]>()

  for (const record of records) {
    actorGroups.set(record.actorId, [...(actorGroups.get(record.actorId) ?? []), record])
    const date = record.occurredAt.slice(0, 10)
    dateGroups.set(date, [...(dateGroups.get(date) ?? []), record])
  }

  const participants = [...actorGroups.entries()]
    .map(([actorId, actorRecords]) => {
      const count = (action: ResearchAction) => actorRecords.filter((record) => record.action === action).length
      return {
        accepted: count('accepted'),
        actorId,
        editRate: actorRecords.filter((record) => record.edited).length / actorRecords.length,
        medianDecisionTimeMs: quantile(actorRecords.map((record) => record.decisionTimeMs), 0.5),
        regenerated: count('regenerated'),
        rejected: count('rejected'),
        total: actorRecords.length,
      }
    })
    .sort((left, right) => right.total - left.total)

  const timeline = [...dateGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dateRecords]) => ({
      accepted: dateRecords.filter((record) => record.action === 'accepted').length,
      date,
      regenerated: dateRecords.filter((record) => record.action === 'regenerated').length,
      rejected: dateRecords.filter((record) => record.action === 'rejected').length,
      total: dateRecords.length,
    }))

  return {
    actionCounts,
    actionRates: {
      accepted: rate(actionCounts.accepted),
      rejected: rate(actionCounts.rejected),
      regenerated: rate(actionCounts.regenerated),
    },
    actorCount: actorGroups.size,
    decisionTime: {
      mean: average(decisionTimes),
      median: quantile(decisionTimes, 0.5),
      q1: quantile(decisionTimes, 0.25),
      q3: quantile(decisionTimes, 0.75),
    },
    editRate: total === 0 ? 0 : records.filter((record) => record.edited).length / total,
    nodeCount: {
      mean: average(nodeCounts),
      median: quantile(nodeCounts, 0.5),
    },
    participants,
    timeline,
    total,
  }
}

function escapeCsv(value: string | number | boolean) {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function createCleanedResearchCsv(records: ResearchEventRecord[]) {
  const headers: Array<keyof ResearchEventRecord> = [...researchCsvHeaders, 'sourceFile']
  const rows = records.map((record) => headers.map((header) => escapeCsv(record[header])))
  return `\uFEFF${[headers, ...rows].map((row) => row.join(',')).join('\r\n')}`
}

export function createResearchSummaryCsv(summary: ResearchSummary) {
  const rows: Array<[string, string | number]> = [
    ['metric', 'value'],
    ['analyzedEvents', summary.total],
    ['participants', summary.actorCount],
    ['acceptanceRate', summary.actionRates.accepted],
    ['rejectionRate', summary.actionRates.rejected],
    ['regenerationRate', summary.actionRates.regenerated],
    ['editRate', summary.editRate],
    ['medianDecisionTimeMs', summary.decisionTime.median],
    ['decisionTimeQ1Ms', summary.decisionTime.q1],
    ['decisionTimeQ3Ms', summary.decisionTime.q3],
    ['meanNodeCount', summary.nodeCount.mean],
  ]
  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`
}
