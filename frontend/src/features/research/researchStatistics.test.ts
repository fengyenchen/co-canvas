import { describe, expect, it } from 'vitest'
import { parseResearchCsv } from './researchAnalysis'
import { analyzeActionDistribution, analyzeAllOutcomes, analyzeOutcome, analyzeSequences, conditionEstimates } from './researchStatistics'

function rows(file: string, condition: string, values: Array<[string, string, number]>) {
  const header = 'eventId,clientEventId,actorId,action,contextNodeId,aiMode,edited,decisionTimeMs,nodeCount,occurredAt,recordedAt'
  const body = values.map(([actor, action, time], index) => `${file}-${index},${file}-c${index},${actor},${action},n,gemini,${index % 2 === 0},${time},${index + 1},2026-01-01T00:0${index}:00Z,2026-01-01T00:0${index}:01Z`).join('\n')
  return { condition, records: parseResearchCsv(`${header}\n${body}`, `${file}.csv`).records }
}

describe('research statistics', () => {
  const a = rows('a', 'A', [['p1', 'accepted', 1000], ['p2', 'accepted', 1200], ['p3', 'rejected', 1600]])
  const b = rows('b', 'B', [['p4', 'rejected', 3000], ['p5', 'rejected', 3200], ['p6', 'accepted', 2800]])
  const records = [...a.records, ...b.records]
  const metadata = { 'a.csv': { condition: 'A', task: 't' }, 'b.csv': { condition: 'B', task: 't' } }

  it('calculates Wilson confidence intervals by condition', () => {
    const estimates = conditionEstimates(records, metadata)
    expect(estimates).toHaveLength(2)
    expect(estimates[0].ciLow).toBeLessThan(estimates[0].acceptanceRate)
    expect(estimates[0].ciHigh).toBeGreaterThan(estimates[0].acceptanceRate)
  })

  it('selects Mann-Whitney for a two-condition between design', () => {
    const result = analyzeOutcome(records, metadata, 'between', 'medianDecisionTimeMs')
    expect(result?.name).toBe('Mann–Whitney U')
    expect(result?.pValue).toBeGreaterThanOrEqual(0)
    expect(result?.pValue).toBeLessThanOrEqual(1)
  })

  it('uses Fisher exact test for a two-condition decision distribution', () => {
    const result = analyzeActionDistribution(records, metadata)
    expect(result?.name).toBe("Fisher's exact test")
    expect(result?.effectName).toBe('odds ratio')
  })

  it('selects Wilcoxon for paired two-condition data', () => {
    const pairedB = rows('b', 'B', [['p1', 'rejected', 3000], ['p2', 'rejected', 3200], ['p3', 'accepted', 2800]])
    const pairedRecords = [...a.records, ...pairedB.records]
    expect(analyzeOutcome(pairedRecords, metadata, 'within', 'medianDecisionTimeMs')?.name).toBe('Wilcoxon signed-rank')
  })

  it('calculates every outcome for both study assumptions', () => {
    const pairedB = rows('b', 'B', [['p1', 'rejected', 3000], ['p2', 'rejected', 3200], ['p3', 'accepted', 2800]])
    const results = analyzeAllOutcomes([...a.records, ...pairedB.records], metadata)

    expect(results).toHaveLength(4)
    expect(results.every((result) => result.between !== null)).toBe(true)
    expect(results.every((result) => result.within !== null)).toBe(true)
  })

  it('counts adjacent action transitions per participant', () => {
    const recordsForOneActor = records.map((record) => ({ ...record, actorId: 'p1' }))
    const sequence = analyzeSequences(recordsForOneActor)
    expect(sequence.transitions.reduce((sum, item) => sum + item.count, 0)).toBe(records.length - 1)
  })
})
