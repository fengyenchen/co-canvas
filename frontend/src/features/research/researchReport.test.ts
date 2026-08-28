import { describe, expect, it } from 'vitest'
import { parseResearchCsv } from './researchAnalysis'
import { createActionChartSvg, createConditionChartSvg, createResearchHtmlReport } from './researchReport'

const csv = `eventId,clientEventId,actorId,action,contextNodeId,aiMode,edited,decisionTimeMs,nodeCount,occurredAt,recordedAt
e1,c1,p1,accepted,n1,gemini,true,1000,2,2026-01-01T00:00:00Z,2026-01-01T00:00:01Z
e2,c2,p2,rejected,n1,gemini,false,2000,1,2026-01-01T00:01:00Z,2026-01-01T00:01:01Z`

describe('research report exports', () => {
  const records = parseResearchCsv(csv, 'a.csv').records
  const fileMetadata = { 'a.csv': { condition: 'Co-Canvas', task: '摘要' } }

  it('creates accessible standalone SVG charts', () => {
    expect(createActionChartSvg(records)).toContain('aria-label="AI 建議決策比例"')
    expect(createConditionChartSvg(records, fileMetadata)).toContain('Co-Canvas')
  })

  it('creates a standalone HTML report with embedded charts', () => {
    const html = createResearchHtmlReport({ records, fileMetadata, quality: { analyzedRows: 2 } })
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('Co-Canvas 研究分析報告')
    expect(html).toContain('<svg')
  })
})
