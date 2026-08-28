import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderKanban,
  LockKeyhole,
  Trash2,
  Upload,
} from 'lucide-react'
import { Link } from 'react-router'
import coCanvasMark from '../assets/branding/co-canvas-mark-primary.svg'
import {
  parseResearchCsv,
  prepareResearchRecords,
  summarizeResearchRecords,
  type ResearchCsvImport,
  type ResearchFilterOptions,
} from '../features/research/researchAnalysis'
import {
  createResearchPackage,
  type ResearchFileMetadata,
} from '../features/research/researchPackage'
import {
  analyzeActionDistribution,
  analyzeAllOutcomes,
  analyzeSequences,
  conditionEstimates,
} from '../features/research/researchStatistics'

function formatPercent(value: number) {
  return new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 1,
    style: 'percent',
  }).format(value)
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits }).format(value)
}

function formatDuration(milliseconds: number) {
  return `${formatNumber(milliseconds / 1000, 1)} 秒`
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function defaultCondition(fileName: string) {
  return fileName.replace(/\.csv$/i, '').replace(/[-_]+/g, ' ')
}

function OptionToggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean
  description: string
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-20 cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 transition hover:bg-control-hover">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-primary"
      />
      <span>
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-foreground/55">{description}</span>
      </span>
    </label>
  )
}

function MetricCard({ label, value, detail }: { detail?: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <p className="text-sm text-foreground/55">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {detail && <p className="mt-2 text-xs leading-5 text-foreground/50">{detail}</p>}
    </div>
  )
}

function SectionCard({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return (
    <section className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm leading-6 text-foreground/55">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function ResearchAnalysisPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [imports, setImports] = useState<ResearchCsvImport[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [filters, setFilters] = useState<ResearchFilterOptions>({
    excludeDecisionTimeOutliers: false,
    includeMock: false,
    removeDuplicates: true,
  })
  const [fileMetadata, setFileMetadata] = useState<Record<string, ResearchFileMetadata>>({})
  const [isPackaging, setIsPackaging] = useState(false)

  const preparation = useMemo(
    () => prepareResearchRecords(imports, filters),
    [filters, imports],
  )
  const summary = useMemo(
    () => summarizeResearchRecords(preparation.records),
    [preparation.records],
  )
  const statisticalResults = useMemo(
    () => analyzeAllOutcomes(preparation.records, fileMetadata),
    [fileMetadata, preparation.records],
  )
  const actionDistributionResult = useMemo(
    () => analyzeActionDistribution(preparation.records, fileMetadata),
    [fileMetadata, preparation.records],
  )
  const estimates = useMemo(
    () => conditionEstimates(preparation.records, fileMetadata),
    [fileMetadata, preparation.records],
  )
  const sequences = useMemo(() => analyzeSequences(preparation.records), [preparation.records])
  const totalRows = imports.reduce((total, item) => total + item.totalRows, 0)
  const invalidRows = imports.reduce((total, item) => total + item.invalidRows, 0)
  const hasData = imports.length > 0

  useEffect(() => {
    const previousTitle = document.title
    document.title = '研究資料分析｜Co-Canvas'
    return () => {
      document.title = previousTitle
    }
  }, [])

  async function addFiles(files: File[]) {
    const nextImports: ResearchCsvImport[] = []
    const nextErrors: string[] = []

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        nextErrors.push(`${file.name}：只支援 CSV 檔案。`)
        continue
      }
      try {
        nextImports.push(parseResearchCsv(await file.text(), file.name))
      } catch (error) {
        nextErrors.push(`${file.name}：${error instanceof Error ? error.message : '無法解析。'}`)
      }
    }

    setImports((current) => [
      ...current.filter(
        (item) => !nextImports.some((nextImport) => nextImport.fileName === item.fileName),
      ),
      ...nextImports,
    ])
    setFileMetadata((current) => {
      const next = { ...current }
      nextImports.forEach((item) => {
        next[item.fileName] ??= { condition: defaultCondition(item.fileName), task: '' }
      })
      return next
    })
    setErrors(nextErrors)
  }

  async function downloadPackage() {
    setIsPackaging(true)
    try {
      const blob = await createResearchPackage({
        records: preparation.records,
        options: { anonymizeActors: true, fileMetadata, filters },
        quality: qualityMetrics(),
      })
      downloadBlob(blob, 'co-canvas-research-package.zip')
    } finally {
      setIsPackaging(false)
    }
  }

  function qualityMetrics() {
    return {
      analyzedRows: summary.total,
      duplicateRows: preparation.duplicateRows,
      excludedMockRows: preparation.excludedMockRows,
      excludedOutlierRows: preparation.excludedOutlierRows,
      importedRows: totalRows,
      invalidRows,
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    void addFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    void addFiles(Array.from(event.dataTransfer.files))
  }

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/research/analyze" aria-label="返回研究分析工具頂端" className="inline-flex min-h-11 min-w-0 items-center gap-3 rounded-lg pr-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <img src={coCanvasMark} alt="" className="size-9 shrink-0" />
            <span className="truncate">研究資料分析</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/guide/research" className="hidden min-h-11 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition hover:bg-control-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:inline-flex">
              <ArrowLeft aria-hidden="true" className="size-4" />
              研究指南
            </Link>
            <Link to="/projects" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <FolderKanban aria-hidden="true" className="size-4" />
              進入專案
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.16em] text-primary">CO-CANVAS RESEARCH</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">研究資料分析工具</h1>
          <p className="mt-4 text-base leading-7 text-foreground/60">
            匯入 Co-Canvas 研究事件 CSV，即可查看全部描述統計、組間與組內檢定，並產生可重現的完整報表。所有處理都在目前瀏覽器完成，檔案不會上傳至伺服器。
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start">
          <div className="space-y-6 lg:sticky lg:top-24">
            <SectionCard title="1 · 匯入研究資料" description="可同時選擇多個由 Co-Canvas 匯出的 CSV。檔名會保留在清理後的資料中。">
              <input ref={inputRef} type="file" accept=".csv,text/csv" multiple onChange={handleInput} className="sr-only" />
              <div
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className={`rounded-xl border border-dashed p-6 text-center transition ${isDragging ? 'border-primary bg-control-hover' : 'border-border bg-canvas/45'}`}
              >
                <Upload aria-hidden="true" className="mx-auto size-6 text-primary" />
                <p className="mt-3 text-sm font-medium">拖曳 CSV 到這裡，或選擇檔案</p>
                <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer">
                  選擇 CSV
                </button>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-foreground/50">
                  <LockKeyhole aria-hidden="true" className="size-3.5" />
                  僅在本機瀏覽器處理
                </div>
              </div>

              {errors.length > 0 && (
                <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
                  {errors.map((error) => <p key={error}>{error}</p>)}
                </div>
              )}

              {imports.length > 0 && (
                <ul aria-label="已匯入檔案" className="mt-4 space-y-2">
                  {imports.map((item) => (
                    <li key={item.fileName} className="rounded-xl border border-border p-3">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.fileName}</span>
                          <span className="block text-xs text-foreground/50">{item.records.length} 筆有效事件{item.invalidRows > 0 ? `，${item.invalidRows} 筆無效` : ''}</span>
                        </span>
                        <button type="button" aria-label={`移除 ${item.fileName}`} onClick={() => setImports((current) => current.filter((entry) => entry.fileName !== item.fileName))} className="inline-flex size-11 items-center justify-center rounded-lg text-foreground/55 transition hover:bg-control-hover hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer">
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <label className="text-xs text-foreground/55">實驗條件
                          <input value={fileMetadata[item.fileName]?.condition ?? ''} onChange={(event) => setFileMetadata((current) => ({ ...current, [item.fileName]: { ...(current[item.fileName] ?? { task: '' }), condition: event.target.value } }))} placeholder="例如：Co-Canvas" className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
                        </label>
                        <label className="text-xs text-foreground/55">任務名稱
                          <input value={fileMetadata[item.fileName]?.task ?? ''} onChange={(event) => setFileMetadata((current) => ({ ...current, [item.fileName]: { ...(current[item.fileName] ?? { condition: '' }), task: event.target.value } }))} placeholder="例如：影片摘要" className="mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="2 · 資料處理" description="系統會自動去除重複事件並匿名化參與者；只有會改變分析母體的規則需要手動調整。">
              <div className="space-y-3">
                <OptionToggle checked={filters.includeMock} label="納入 Mock 模式" description="預設排除測試模式，只分析 Gemini 事件。" onChange={(checked) => setFilters((current) => ({ ...current, includeMock: checked }))} />
                <OptionToggle checked={filters.excludeDecisionTimeOutliers} label="排除決策時間離群值" description="使用 1.5 × IQR 規則；結果會顯示排除筆數。" onChange={(checked) => setFilters((current) => ({ ...current, excludeDecisionTimeOutliers: checked }))} />
                <div className="rounded-xl border border-border bg-canvas/55 p-4 text-xs leading-5 text-foreground/55">
                  固定套用：依 clientEventId 去重；ZIP 內的參與者代碼匿名化為 P001、P002。
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="space-y-6">
            {!hasData ? (
              <div className="rounded-2xl border border-dashed border-border bg-background px-6 py-16 text-center">
                <BarChart3 aria-hidden="true" className="mx-auto size-8 text-foreground/30" />
                <h2 className="mt-4 text-lg font-semibold">匯入 CSV 後顯示分析結果</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-foreground/50">系統會先驗證欄位與資料型別，再依左側設定清理資料並計算所選指標。</p>
              </div>
            ) : (
              <>
                <SectionCard title="資料品質摘要">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <MetricCard label="匯入原始列數" value={formatNumber(totalRows, 0)} />
                    <MetricCard label="進入分析事件" value={formatNumber(summary.total, 0)} />
                    <MetricCard label="參與者" value={formatNumber(summary.actorCount, 0)} detail="依 actorId 計算" />
                    <MetricCard label="無效資料列" value={formatNumber(invalidRows, 0)} />
                    <MetricCard label="重複資料列" value={formatNumber(preparation.duplicateRows, 0)} />
                    <MetricCard label="排除事件" value={formatNumber(preparation.excludedMockRows + preparation.excludedOutlierRows, 0)} detail={`Mock ${preparation.excludedMockRows} 筆；離群值 ${preparation.excludedOutlierRows} 筆`} />
                  </div>
                  {summary.total === 0 && (
                    <div role="status" className="mt-4 flex gap-3 rounded-xl border border-border bg-canvas/55 p-4 text-sm text-foreground/60">
                      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      目前篩選條件下沒有可分析事件，請調整資料處理選項。
                    </div>
                  )}
                </SectionCard>

                {summary.total > 0 && (
                  <SectionCard title="行為比例" description="分母為目前篩選後的全部決策事件。">
                    <div className="space-y-5">
                      {([
                        ['accepted', '接受', 'bg-primary'],
                        ['rejected', '取消', 'bg-foreground/50'],
                        ['regenerated', '重新生成', 'bg-foreground/25'],
                      ] as const).map(([action, label, barClass]) => (
                        <div key={action}>
                          <div className="flex items-center justify-between gap-4 text-sm">
                            <span className="font-medium">{label}</span>
                            <span className="tabular-nums text-foreground/60">{summary.actionCounts[action]} 筆 · {formatPercent(summary.actionRates[action])}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
                            <div className={`h-full rounded-full ${barClass}`} style={{ width: `${summary.actionRates[action] * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {summary.total > 0 && (
                  <SectionCard title="核心指標">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <MetricCard label="建議修改率" value={formatPercent(summary.editRate)} detail="edited=true ÷ 分析事件" />
                      <MetricCard label="決策時間中位數" value={formatDuration(summary.decisionTime.median)} detail={`Q1 ${formatDuration(summary.decisionTime.q1)} · Q3 ${formatDuration(summary.decisionTime.q3)}`} />
                      <MetricCard label="平均決策時間" value={formatDuration(summary.decisionTime.mean)} detail="容易受極端值影響，建議搭配中位數解讀" />
                      <MetricCard label="平均建議節點數" value={formatNumber(summary.nodeCount.mean, 2)} detail={`中位數 ${formatNumber(summary.nodeCount.median, 1)}`} />
                    </div>
                  </SectionCard>
                )}

                {summary.total > 0 && (
                  <SectionCard title="參與者比較" description="actorId 可能具有可識別性，分享結果前請重新編碼。">
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-176 text-left text-sm">
                        <thead className="bg-canvas/65"><tr><th className="px-4 py-3">actorId</th><th className="px-4 py-3">事件</th><th className="px-4 py-3">接受</th><th className="px-4 py-3">取消</th><th className="px-4 py-3">重新生成</th><th className="px-4 py-3">修改率</th><th className="px-4 py-3">決策中位數</th></tr></thead>
                        <tbody className="divide-y divide-border">
                          {summary.participants.map((participant) => <tr key={participant.actorId}><td className="max-w-52 truncate px-4 py-3 font-mono text-xs">{participant.actorId}</td><td className="px-4 py-3">{participant.total}</td><td className="px-4 py-3">{participant.accepted}</td><td className="px-4 py-3">{participant.rejected}</td><td className="px-4 py-3">{participant.regenerated}</td><td className="px-4 py-3">{formatPercent(participant.editRate)}</td><td className="px-4 py-3">{formatDuration(participant.medianDecisionTimeMs)}</td></tr>)}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                )}

                {summary.total > 0 && (
                  <SectionCard title="時間趨勢" description="依 occurredAt 日期彙整；跨時區研究應先統一時區。">
                    <div className="space-y-3">
                      {summary.timeline.map((day) => {
                        const maximum = Math.max(...summary.timeline.map((entry) => entry.total))
                        return <div key={day.date} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm"><span className="tabular-nums text-foreground/60">{day.date}</span><div className="h-8 overflow-hidden rounded-md bg-canvas"><div className="flex h-full items-center bg-primary px-3 text-xs font-medium text-primary-foreground" style={{ width: `${Math.max(8, (day.total / maximum) * 100)}%` }}>{day.accepted} 接受</div></div><span className="text-right tabular-nums">{day.total}</span></div>
                      })}
                    </div>
                  </SectionCard>
                )}

                {summary.total > 0 && (
                  <SectionCard title="條件比較與不確定性" description="接受率使用 Wilson 95% 信賴區間；所有主要指標會同時計算組間與組內檢定，請依實際研究設計採用。">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {estimates.map((estimate) => (
                        <MetricCard key={estimate.condition} label={estimate.condition} value={formatPercent(estimate.acceptanceRate)} detail={`95% CI ${formatPercent(estimate.ciLow)}–${formatPercent(estimate.ciHigh)} · ${estimate.participants} 人／${estimate.events} 事件`} />
                      ))}
                    </div>
                    <div className="mt-4 space-y-3">
                      {statisticalResults.map((analysis) => (
                        <div key={analysis.outcome} className="rounded-xl border border-border bg-canvas/55 p-4">
                          <strong className="text-sm">{analysis.label}</strong>
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {([
                              ['組間假設', analysis.between],
                              ['組內假設', analysis.within],
                            ] as const).map(([assumption, result]) => (
                              <div key={assumption} className="rounded-lg bg-background p-3 text-sm">
                                <p className="font-medium text-foreground/70">{assumption}</p>
                                {result ? (
                                  <>
                                    <p className="mt-1 font-semibold">{result.name}</p>
                                    <p className="mt-1 tabular-nums text-foreground/60">統計量 {formatNumber(result.statistic, 3)} · p = {formatNumber(result.pValue, 4)}</p>
                                    <p className="mt-1 text-xs leading-5 text-foreground/55">{result.effectName} = {Number.isFinite(result.effectSize) ? formatNumber(result.effectSize, 3) : '∞'}；{result.note}</p>
                                  </>
                                ) : (
                                  <p className="mt-1 text-foreground/50">資料不足，無法計算。</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {actionDistributionResult && (
                      <div className="mt-3 rounded-xl border border-border bg-canvas/55 p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-2"><strong>{actionDistributionResult.name}（決策分布）</strong><span className="text-sm tabular-nums">統計量 {formatNumber(actionDistributionResult.statistic, 3)} · p = {formatNumber(actionDistributionResult.pValue, 4)}</span></div>
                        <p className="mt-2 text-sm text-foreground/60">{actionDistributionResult.effectName} = {Number.isFinite(actionDistributionResult.effectSize) ? formatNumber(actionDistributionResult.effectSize, 3) : '∞'}。{actionDistributionResult.note}</p>
                      </div>
                    )}
                  </SectionCard>
                )}

                {summary.total > 0 && (
                  <SectionCard title="決策序列" description="依每位參與者的 occurredAt 排序，呈現相鄰決策轉移；適合觀察重新生成後的下一步。">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {sequences.transitions.slice(0, 6).map((item) => <MetricCard key={item.transition} label={item.transition} value={`${item.count} 次`} />)}
                    </div>
                    {sequences.transitions.length === 0 && <p className="text-sm text-foreground/55">目前每位參與者都只有一筆事件，尚無可計算的轉移。</p>}
                  </SectionCard>
                )}

                {summary.total > 0 && (
                  <SectionCard title="匯出完整分析報表" description="一次產生全部描述統計、組間與組內檢定、分析資料、HTML 報告與重現範例。">
                    <div className="mb-4 grid gap-2 text-xs leading-5 text-foreground/60 sm:grid-cols-2">
                      <p className="rounded-lg bg-canvas/55 px-3 py-2">CSV：清理資料、參與者、條件、時間、品質與決策序列</p>
                      <p className="rounded-lg bg-canvas/55 px-3 py-2">報告：易讀 HTML、欄位字典與分析設定</p>
                      <p className="rounded-lg bg-canvas/55 px-3 py-2">視覺化：直接在 HTML 報告查看或自行截圖</p>
                      <p className="rounded-lg bg-canvas/55 px-3 py-2">程式：Python 與 R 重現分析範例</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button type="button" disabled={isPackaging} onClick={() => void downloadPackage()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait disabled:opacity-45 cursor-pointer"><Download aria-hidden="true" className="size-4" />{isPackaging ? '正在建立 ZIP 報表…' : '下載完整 ZIP 報表'}</button>
                    </div>
                    <div className="mt-4 flex gap-3 rounded-xl bg-canvas/55 p-4 text-xs leading-5 text-foreground/55"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />這些數值是描述性統計，不能單獨證明 Co-Canvas 提升任務表現；正式研究仍需結合實驗條件、任務結果、問卷或訪談。</div>
                  </SectionCard>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
