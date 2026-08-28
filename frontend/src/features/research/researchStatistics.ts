import type { ResearchEventRecord } from './researchAnalysis'
import type { ResearchFileMetadata } from './researchPackage'

export type StudyDesign = 'between' | 'within'
export type ResearchOutcome = 'acceptanceRate' | 'editRate' | 'medianDecisionTimeMs' | 'meanNodeCount'

export type StatisticalResult = {
  effectName: string
  effectSize: number
  groups: number
  name: string
  note: string
  pValue: number
  participants: number
  statistic: number
}

export type ConditionEstimate = {
  acceptanceRate: number
  ciHigh: number
  ciLow: number
  condition: string
  events: number
  participants: number
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value) / Math.sqrt(2)
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return 0.5 * (1 + sign * erf)
}

function logGamma(value: number) {
  const coefficients = [76.1800917294715, -86.5053203294168, 24.0140982408309, -1.23173957245016, 0.00120865097386618, -0.00000539523938495]
  const x = value
  let y = value
  let temporary = x + 5.5
  temporary -= (x + 0.5) * Math.log(temporary)
  let series = 1.00000000019002
  coefficients.forEach((coefficient) => { y += 1; series += coefficient / y })
  return -temporary + Math.log(2.506628274631 * series / x)
}

function gammaQ(a: number, x: number) {
  if (x <= 0) return 1
  if (x < a + 1) {
    let sum = 1 / a
    let delta = sum
    let ap = a
    for (let index = 1; index <= 100; index += 1) {
      ap += 1
      delta *= x / ap
      sum += delta
      if (Math.abs(delta) < Math.abs(sum) * 3e-7) break
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a))
  }
  let b = x + 1 - a
  let c = 1 / 1e-30
  let d = 1 / b
  let h = d
  for (let index = 1; index <= 100; index += 1) {
    const an = -index * (index - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = b + an / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    const delta = d * c
    h *= delta
    if (Math.abs(delta - 1) < 3e-7) break
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h
}

function chiSquareP(statistic: number, degreesOfFreedom: number) {
  return Math.max(0, Math.min(1, gammaQ(degreesOfFreedom / 2, statistic / 2)))
}

function ranks(values: number[]) {
  const indexed = values.map((value, index) => ({ index, value })).sort((a, b) => a.value - b.value)
  const output = Array(values.length).fill(0) as number[]
  for (let start = 0; start < indexed.length;) {
    let end = start
    while (end + 1 < indexed.length && indexed[end + 1].value === indexed[start].value) end += 1
    const rank = (start + end + 2) / 2
    for (let position = start; position <= end; position += 1) output[indexed[position].index] = rank
    start = end + 1
  }
  return output
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function participantConditionValues(records: ResearchEventRecord[], metadata: Record<string, ResearchFileMetadata>, outcome: ResearchOutcome) {
  const groups = new Map<string, ResearchEventRecord[]>()
  records.forEach((record) => {
    const condition = metadata[record.sourceFile]?.condition.trim() || '未指定'
    groups.set(`${record.actorId}\u0000${condition}`, [...(groups.get(`${record.actorId}\u0000${condition}`) ?? []), record])
  })
  return [...groups.entries()].map(([key, items]) => {
    const [participant, condition] = key.split('\u0000')
    let value = 0
    if (outcome === 'acceptanceRate') value = items.filter((item) => item.action === 'accepted').length / items.length
    if (outcome === 'editRate') value = items.filter((item) => item.edited).length / items.length
    if (outcome === 'medianDecisionTimeMs') value = median(items.map((item) => item.decisionTimeMs))
    if (outcome === 'meanNodeCount') value = items.reduce((sum, item) => sum + item.nodeCount, 0) / items.length
    return { condition, participant, value }
  })
}

function mannWhitney(groups: number[][]): StatisticalResult {
  const [left, right] = groups
  const allRanks = ranks([...left, ...right])
  const rankSum = allRanks.slice(0, left.length).reduce((sum, rank) => sum + rank, 0)
  const u1 = rankSum - left.length * (left.length + 1) / 2
  const u2 = left.length * right.length - u1
  const u = Math.min(u1, u2)
  const mean = left.length * right.length / 2
  const sd = Math.sqrt(left.length * right.length * (left.length + right.length + 1) / 12)
  const z = sd ? (u - mean) / sd : 0
  return { effectName: 'rank-biserial r', effectSize: 1 - 2 * u / (left.length * right.length || 1), groups: 2, name: 'Mann–Whitney U', note: '雙尾常態近似；小樣本請以專業統計軟體複核。', pValue: 2 * (1 - normalCdf(Math.abs(z))), participants: left.length + right.length, statistic: u }
}

function kruskalWallis(groups: number[][]): StatisticalResult {
  const all = groups.flat()
  const allRanks = ranks(all)
  let cursor = 0
  let h = 0
  groups.forEach((group) => {
    const rankSum = allRanks.slice(cursor, cursor + group.length).reduce((sum, rank) => sum + rank, 0)
    h += rankSum * rankSum / group.length
    cursor += group.length
  })
  h = 12 * h / (all.length * (all.length + 1)) - 3 * (all.length + 1)
  return { effectName: 'epsilon-squared', effectSize: Math.max(0, (h - groups.length + 1) / (all.length - groups.length || 1)), groups: groups.length, name: 'Kruskal–Wallis H', note: '顯著時仍需進行校正後的事後比較。', pValue: chiSquareP(h, groups.length - 1), participants: all.length, statistic: h }
}

function wilcoxon(pairs: Array<[number, number]>): StatisticalResult {
  const differences = pairs.map(([a, b]) => b - a).filter((value) => value !== 0)
  const ranked = ranks(differences.map(Math.abs))
  const positive = ranked.reduce((sum, rank, index) => sum + (differences[index] > 0 ? rank : 0), 0)
  const negative = ranked.reduce((sum, rank, index) => sum + (differences[index] < 0 ? rank : 0), 0)
  const w = Math.min(positive, negative)
  const n = differences.length
  const mean = n * (n + 1) / 4
  const sd = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24)
  const z = sd ? (w - mean) / sd : 0
  return { effectName: 'rank-biserial r', effectSize: (positive - negative) / (positive + negative || 1), groups: 2, name: 'Wilcoxon signed-rank', note: '僅納入同時完成兩條件且差值非零的參與者。', pValue: 2 * (1 - normalCdf(Math.abs(z))), participants: n, statistic: w }
}

function friedman(matrix: number[][]): StatisticalResult {
  const n = matrix.length
  const k = matrix[0]?.length ?? 0
  const rankSums = Array(k).fill(0) as number[]
  matrix.forEach((row) => ranks(row).forEach((rank, index) => { rankSums[index] += rank }))
  const q = 12 * rankSums.reduce((sum, value) => sum + value * value, 0) / (n * k * (k + 1)) - 3 * n * (k + 1)
  return { effectName: "Kendall's W", effectSize: q / (n * (k - 1) || 1), groups: k, name: 'Friedman', note: '僅納入完成所有條件的參與者；顯著時仍需事後比較。', pValue: chiSquareP(q, k - 1), participants: n, statistic: q }
}

export function analyzeOutcome(records: ResearchEventRecord[], metadata: Record<string, ResearchFileMetadata>, design: StudyDesign, outcome: ResearchOutcome): StatisticalResult | null {
  const values = participantConditionValues(records, metadata, outcome)
  const conditions = [...new Set(values.map((item) => item.condition))].sort()
  if (conditions.length < 2) return null
  if (design === 'between') {
    const groups = conditions.map((condition) => values.filter((item) => item.condition === condition).map((item) => item.value)).filter((group) => group.length)
    return groups.length === 2 ? mannWhitney(groups) : kruskalWallis(groups)
  }
  const byParticipant = new Map<string, Map<string, number>>()
  values.forEach((item) => {
    const row = byParticipant.get(item.participant) ?? new Map<string, number>()
    row.set(item.condition, item.value)
    byParticipant.set(item.participant, row)
  })
  const complete = [...byParticipant.values()].filter((row) => conditions.every((condition) => row.has(condition)))
  if (!complete.length) return null
  if (conditions.length === 2) return wilcoxon(complete.map((row) => [row.get(conditions[0])!, row.get(conditions[1])!]))
  return friedman(complete.map((row) => conditions.map((condition) => row.get(condition)!)))
}

function logCombination(n: number, k: number) {
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1)
}

function fisherExact(a: number, b: number, c: number, d: number) {
  const row1 = a + b
  const row2 = c + d
  const column1 = a + c
  const total = row1 + row2
  const probability = (x: number) => Math.exp(logCombination(column1, x) + logCombination(total - column1, row1 - x) - logCombination(total, row1))
  const observed = probability(a)
  const minimum = Math.max(0, row1 - (total - column1))
  const maximum = Math.min(row1, column1)
  let p = 0
  for (let x = minimum; x <= maximum; x += 1) if (probability(x) <= observed + 1e-12) p += probability(x)
  return Math.min(1, p)
}

export function analyzeActionDistribution(records: ResearchEventRecord[], metadata: Record<string, ResearchFileMetadata>): StatisticalResult | null {
  const conditions = [...new Set(records.map((record) => metadata[record.sourceFile]?.condition.trim() || '未指定'))].sort()
  if (conditions.length < 2) return null
  const table = conditions.map((condition) => {
    const items = records.filter((record) => (metadata[record.sourceFile]?.condition.trim() || '未指定') === condition)
    return [
      items.filter((item) => item.action === 'accepted').length,
      items.filter((item) => item.action === 'rejected').length,
      items.filter((item) => item.action === 'regenerated').length,
    ]
  })
  const total = table.flat().reduce((sum, value) => sum + value, 0)
  if (!total || table.some((row) => row.reduce((sum, value) => sum + value, 0) === 0)) return null
  if (conditions.length === 2) {
    const a = table[0][0]
    const b = table[0][1] + table[0][2]
    const c = table[1][0]
    const d = table[1][1] + table[1][2]
    const oddsRatio = b * c === 0 ? (a * d === 0 ? 0 : Number.POSITIVE_INFINITY) : a * d / (b * c)
    return { effectName: 'odds ratio', effectSize: oddsRatio, groups: 2, name: "Fisher's exact test", note: '將決策分為接受與未接受；p 值為雙尾精確機率。', pValue: fisherExact(a, b, c, d), participants: new Set(records.map((record) => record.actorId)).size, statistic: oddsRatio }
  }
  const columnTotals = [0, 1, 2].map((column) => table.reduce((sum, row) => sum + row[column], 0))
  let statistic = 0
  table.forEach((row) => {
    const rowTotal = row.reduce((sum, value) => sum + value, 0)
    row.forEach((observed, column) => {
      const expected = rowTotal * columnTotals[column] / total
      if (expected) statistic += (observed - expected) ** 2 / expected
    })
  })
  const degreesOfFreedom = (conditions.length - 1) * 2
  return { effectName: "Cramér's V", effectSize: Math.sqrt(statistic / (total * Math.min(conditions.length - 1, 2))), groups: conditions.length, name: 'Chi-square test', note: '若預期次數過低，請以精確或蒙地卡羅方法複核。', pValue: chiSquareP(statistic, degreesOfFreedom), participants: new Set(records.map((record) => record.actorId)).size, statistic }
}

export function conditionEstimates(records: ResearchEventRecord[], metadata: Record<string, ResearchFileMetadata>): ConditionEstimate[] {
  const groups = new Map<string, ResearchEventRecord[]>()
  records.forEach((record) => {
    const condition = metadata[record.sourceFile]?.condition.trim() || '未指定'
    groups.set(condition, [...(groups.get(condition) ?? []), record])
  })
  return [...groups.entries()].map(([condition, items]) => {
    const successes = items.filter((item) => item.action === 'accepted').length
    const n = items.length
    const p = successes / n
    const z2 = 1.96 ** 2
    const center = (p + z2 / (2 * n)) / (1 + z2 / n)
    const margin = 1.96 * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n) / (1 + z2 / n)
    return { acceptanceRate: p, ciHigh: Math.min(1, center + margin), ciLow: Math.max(0, center - margin), condition, events: n, participants: new Set(items.map((item) => item.actorId)).size }
  })
}

export function analyzeSequences(records: ResearchEventRecord[]) {
  const groups = new Map<string, ResearchEventRecord[]>()
  records.forEach((record) => groups.set(record.actorId, [...(groups.get(record.actorId) ?? []), record]))
  const transitions = new Map<string, number>()
  let regenerationRuns = 0
  groups.forEach((items) => {
    const ordered = [...items].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const key = `${ordered[index].action} → ${ordered[index + 1].action}`
      transitions.set(key, (transitions.get(key) ?? 0) + 1)
      if (ordered[index].action === 'regenerated') regenerationRuns += 1
    }
  })
  return { regenerationRuns, transitions: [...transitions.entries()].map(([transition, count]) => ({ transition, count })).sort((a, b) => b.count - a.count) }
}
