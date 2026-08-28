import { describe, expect, it } from 'vitest'
import {
  createCleanedResearchCsv,
  parseResearchCsv,
  prepareResearchRecords,
  summarizeResearchRecords,
} from './researchAnalysis'

const header = 'eventId,clientEventId,actorId,action,contextNodeId,aiMode,edited,decisionTimeMs,nodeCount,occurredAt,recordedAt'

const csv = `${header}
event-1,client-1,actor-a,accepted,node-1,gemini,true,1000,3,2026-08-01T00:00:00Z,2026-08-01T00:00:01Z
event-2,client-2,actor-a,rejected,node-1,gemini,false,3000,1,2026-08-01T00:01:00Z,2026-08-01T00:01:01Z
event-3,client-3,actor-b,regenerated,node-2,mock,false,5000,2,2026-08-02T00:00:00Z,2026-08-02T00:00:01Z
event-4,client-2,actor-a,rejected,node-1,gemini,false,3000,1,2026-08-01T00:01:00Z,2026-08-01T00:01:01Z`

describe('researchAnalysis', () => {
  it('解析、去重並預設排除 Mock 事件', () => {
    const imported = parseResearchCsv(csv, 'study.csv')
    const prepared = prepareResearchRecords([imported], {
      excludeDecisionTimeOutliers: false,
      includeMock: false,
      removeDuplicates: true,
    })

    expect(imported.totalRows).toBe(4)
    expect(imported.invalidRows).toBe(0)
    expect(prepared.duplicateRows).toBe(1)
    expect(prepared.excludedMockRows).toBe(1)
    expect(prepared.records).toHaveLength(2)
  })

  it('計算行為比例、修改率及決策時間', () => {
    const imported = parseResearchCsv(csv, 'study.csv')
    const prepared = prepareResearchRecords([imported], {
      excludeDecisionTimeOutliers: false,
      includeMock: true,
      removeDuplicates: true,
    })
    const summary = summarizeResearchRecords(prepared.records)

    expect(summary.total).toBe(3)
    expect(summary.actorCount).toBe(2)
    expect(summary.actionRates.accepted).toBeCloseTo(1 / 3)
    expect(summary.editRate).toBeCloseTo(1 / 3)
    expect(summary.decisionTime.median).toBe(3000)
    expect(summary.timeline).toHaveLength(2)
  })

  it('拒絕缺少必要欄位的 CSV', () => {
    expect(() => parseResearchCsv('eventId,action\n1,accepted', 'invalid.csv')).toThrow(
      '缺少必要欄位',
    )
  })

  it('匯出可再次解析的清理資料', () => {
    const imported = parseResearchCsv(csv, 'study.csv')
    const cleaned = createCleanedResearchCsv(imported.records.slice(0, 1))

    expect(cleaned).toContain('sourceFile')
    expect(cleaned).toContain('study.csv')
    expect(parseResearchCsv(cleaned, 'cleaned.csv').records).toHaveLength(1)
  })
})
