import { describe, expect, it } from 'vitest'
import { parseResearchCsv, type ResearchFilterOptions } from './researchAnalysis'
import {
  createActorAliases,
  createConditionSummaryCsv,
  createEnrichedResearchCsv,
  createResearchPackage,
  enrichResearchRecords,
} from './researchPackage'

const csv = `eventId,clientEventId,actorId,action,contextNodeId,aiMode,edited,decisionTimeMs,nodeCount,occurredAt,recordedAt
e1,c1,user-b,accepted,n1,gemini,true,1000,2,2026-01-01T00:00:00Z,2026-01-01T00:00:01Z
e2,c2,user-a,rejected,n1,gemini,false,2000,1,2026-01-01T00:01:00Z,2026-01-01T00:01:01Z`

describe('research package', () => {
  it('creates stable participant aliases and enriched rows', () => {
    const records = parseResearchCsv(csv, 'condition-a.csv').records
    const aliases = createActorAliases(records)
    expect(aliases.get('user-a')).toBe('P001')
    expect(aliases.get('user-b')).toBe('P002')

    const enriched = enrichResearchRecords(records, {
      anonymizeActors: true,
      fileMetadata: { 'condition-a.csv': { condition: 'A', task: '摘要' } },
    })
    expect(enriched[0]).toMatchObject({ condition: 'A', participantId: 'P002', task: '摘要' })
    expect(createEnrichedResearchCsv(enriched)).toContain('participantId')
    expect(createConditionSummaryCsv(enriched)).toContain('A,摘要,2,2,0.5')
  })

  it('builds a zip with reproducibility files', async () => {
    const records = parseResearchCsv(csv, 'condition-a.csv').records
    const filters: ResearchFilterOptions = {
      excludeDecisionTimeOutliers: false,
      includeMock: false,
      removeDuplicates: true,
    }
    const blob = await createResearchPackage({
      records,
      options: {
        anonymizeActors: true,
        fileMetadata: { 'condition-a.csv': { condition: 'A', task: '摘要' } },
        filters,
      },
      quality: { analyzedRows: 2, duplicateRows: 0, excludedMockRows: 0, excludedOutlierRows: 0, importedRows: 2, invalidRows: 0 },
    })
    expect(blob.size).toBeGreaterThan(500)
  })
})
