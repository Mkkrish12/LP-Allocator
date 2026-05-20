import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { useFundStore } from '../store/fundStore'
import type { Fund, FundVintage } from '../types/fund'
import { extractTextFromPDF, extractFundData } from '../utils/claudeClient'
import Header from '../components/ui/Header'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, ChevronRight, Key } from 'lucide-react'

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined

type DocType = 'Fund Deck' | 'DDQ' | 'Quarterly Report' | 'LPA / Term Sheet'
type FileStatus = 'queued' | 'extracting' | 'done' | 'error'

interface FileEntry {
  file: File
  docType: DocType
  status: FileStatus
  error?: string
  extracted?: Partial<Fund>
}

const STEPS = ['Upload Documents', 'Review Extracted Data', 'Analysis Dashboard']

function StepIndicator({ step }: { step: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {STEPS.map((label, i) => {
        const isActive = i === step
        const isDone = i < step
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 6,
                backgroundColor: isActive ? '#EFF6FF' : 'transparent',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: isDone ? '#059669' : isActive ? '#2563EB' : '#E5E7EB',
                  color: isDone || isActive ? '#FFFFFF' : '#6B7280',
                }}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#2563EB' : isDone ? '#059669' : '#6B7280',
                }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  width: 40,
                  height: 1,
                  backgroundColor: isDone ? '#059669' : '#E5E7EB',
                  margin: '0 4px',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function mergeObjects(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base }
  for (const key of Object.keys(overlay)) {
    const val = overlay[key]
    if (val !== null && val !== undefined) result[key] = val
  }
  return result
}

function mergePriorFunds(base: FundVintage[], overlay: FundVintage[]): FundVintage[] {
  const result = [...base]
  for (const ovFund of overlay) {
    const idx = result.findIndex(
      (f) =>
        (f.fundName && ovFund.fundName && f.fundName === ovFund.fundName) ||
        (f.vintageYear && ovFund.vintageYear && f.vintageYear === ovFund.vintageYear),
    )
    if (idx >= 0) {
      // Merge matched fund — overlay wins for primitives, deep-merge portfolioQuality
      const merged = { ...result[idx], ...ovFund }
      if (result[idx].portfolioQuality && ovFund.portfolioQuality) {
        merged.portfolioQuality = { ...result[idx].portfolioQuality, ...ovFund.portfolioQuality }
      } else if (!ovFund.portfolioQuality) {
        merged.portfolioQuality = result[idx].portfolioQuality
      }
      result[idx] = merged
    } else {
      result.push(ovFund)
    }
  }
  return result
}

function deepMerge(base: Partial<Fund>, overlay: Partial<Fund>): Partial<Fund> {
  const result = { ...base } as Record<string, unknown>
  for (const key of Object.keys(overlay) as (keyof Fund)[]) {
    const val = overlay[key]
    if (val === null || val === undefined) continue
    const existing = result[key]
    if (key === 'priorFunds' && Array.isArray(val) && Array.isArray(existing)) {
      result[key] = mergePriorFunds(existing as FundVintage[], val as FundVintage[])
    } else if (isPlainObject(val) && isPlainObject(existing)) {
      result[key] = mergeObjects(existing, val)
    } else if (Array.isArray(val)) {
      // For other arrays (team, sourceDocuments): prefer the longer / non-empty one
      result[key] = (val as unknown[]).length > 0 ? val : (existing ?? val)
    } else {
      result[key] = val
    }
  }
  return result as Partial<Fund>
}

export default function AnalyzeNewFund() {
  const navigate = useNavigate()
  const { addFund } = useFundStore()
  const [step, setStep] = useState(0)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [extracting, setExtracting] = useState(false)
  const [mergedData, setMergedData] = useState<Partial<Fund>>({})
  const [_createdFundId, setCreatedFundId] = useState<string | null>(null)
  const [dropError, setDropError] = useState<string | null>(null)

  const onDrop = useCallback(
    (accepted: File[]) => {
      setDropError(null)
      const newEntries: FileEntry[] = accepted.map((file) => ({
        file,
        docType: 'Fund Deck',
        status: 'queued',
      }))
      setFiles((prev) => [...prev, ...newEntries])
    },
    []
  )

  const onDropRejected = useCallback(() => {
    setDropError('Only PDF files are accepted. Please upload .pdf documents.')
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  })

  const updateDocType = (idx: number, docType: DocType) => {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, docType } : f)))
  }

  const handleExtractAll = async () => {
    if (files.length === 0) return
    setExtracting(true)

    let merged: Partial<Fund> = {}
    const updated = [...files]

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === 'done') {
        // Already extracted — include in merge but skip re-extraction
        if (updated[i].extracted) merged = deepMerge(merged, updated[i].extracted!)
        continue
      }
      updated[i] = { ...updated[i], status: 'extracting' }
      setFiles([...updated])

      try {
        const text = await extractTextFromPDF(updated[i].file)
        const extracted = await extractFundData(text, updated[i].docType)
        merged = deepMerge(merged, extracted)
        updated[i] = { ...updated[i], status: 'done', extracted }
      } catch (err) {
        updated[i] = {
          ...updated[i],
          status: 'error',
          error: err instanceof Error ? err.message : 'Extraction failed',
        }
      }

      setFiles([...updated])
    }

    setMergedData(merged)
    setExtracting(false)
    if (updated.some((f) => f.status === 'done')) setStep(1)
  }

  const handleRetry = (idx: number) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, status: 'queued', error: undefined } : f))
    )
  }

  const handleSaveAndAnalyze = () => {
    const id = `user_${Date.now()}`
    const newFund: Fund = {
      id,
      dateAnalyzed: new Date().toISOString().split('T')[0],
      status: 'evaluating',
      analystNotes: '',
      fundName: mergedData.fundName ?? 'Unnamed Fund',
      gpFirm: mergedData.gpFirm ?? 'Unknown GP',
      vintageYear: mergedData.vintageYear ?? new Date().getFullYear(),
      fundSize: mergedData.fundSize ?? 100,
      strategy: mergedData.strategy ?? 'sector_agnostic',
      stageF: mergedData.stageF ?? 'series_a',
      geography: mergedData.geography ?? 'Global',
      sectorFocus: mergedData.sectorFocus ?? 'Generalist',
      thesis: mergedData.thesis ?? '',
      team: mergedData.team ?? [],
      totalTeamSize: mergedData.totalTeamSize ?? 0,
      priorFunds: mergedData.priorFunds ?? [],
      terms: mergedData.terms ?? {
        managementFee: 0.02,
        managementFeeStepDown: false,
        carry: 0.20,
        hurdleRate: 0.08,
        gpCommit: 0,
        gpCommitPercent: 0.02,
        recyclingProvisions: false,
        distributionWaterfall: 'european',
        lpacComposition: '',
        keyPersonDefinition: '',
        gpRemovalThreshold: 0.75,
        noFaultDivorce: true,
        mostFavoredNation: false,
      },
      construction: mergedData.construction ?? {
        targetCompanies: 20,
        avgInitialCheck: 5,
        followOnReservePercent: 0.40,
        targetOwnership: 0.15,
        leadsDeals: true,
        avgEntryValuation: 20,
        targetReturnMultiple: 3,
      },
      scores: { fundMath: 0, teamPedigree: 0, strategyDifferentiation: 0, termsFairness: 0, portfolioFit: 0, vintageTiming: 0, overall: 0 },
      sourceDocuments: files.map((f) => f.file.name),
      extractionConfidence: mergedData.extractionConfidence ?? 0.7,
    }

    addFund(newFund)
    setCreatedFundId(id)
    setStep(2)
    navigate(`/fund/${id}`)
  }

  const statusIcon = (status: FileStatus) => {
    if (status === 'queued') return <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#E5E7EB' }} />
    if (status === 'extracting') return <LoadingSpinner size={16} />
    if (status === 'done') return <CheckCircle size={16} color="#059669" />
    return <XCircle size={16} color="#DC2626" />
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header title="Analyze New Fund" subtitle="AI-powered fund due diligence in minutes" />

      <div style={{ flex: 1, overflowY: 'auto', padding: 32, maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <StepIndicator step={step} />

        {step === 0 && (
          <div>
            {/* API key warning */}
            {!API_KEY && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 8,
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  marginBottom: 20,
                }}
              >
                <Key size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', marginBottom: 2 }}>
                    API key not configured
                  </p>
                  <p style={{ fontSize: 12, color: '#B45309', lineHeight: 1.5 }}>
                    Add your OpenAI API key to{' '}
                    <code style={{ backgroundColor: '#FEF9C3', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace' }}>
                      .env.local
                    </code>{' '}
                    at the project root:{' '}
                    <code style={{ backgroundColor: '#FEF9C3', padding: '1px 4px', borderRadius: 3, fontFamily: 'monospace' }}>
                      VITE_OPENAI_API_KEY=sk-...
                    </code>
                    {' '}then restart the dev server. Document extraction requires GPT-4o.
                  </p>
                </div>
              </div>
            )}

            {/* Drop Zone */}
            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? '#2563EB' : '#D1D5DB'}`,
                borderRadius: 12,
                padding: '48px 32px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isDragActive ? '#EFF6FF' : '#FAFAFA',
                transition: 'all 0.15s',
                marginBottom: 24,
              }}
            >
              <input {...getInputProps()} />
              <Upload size={32} color={isDragActive ? '#2563EB' : '#9CA3AF'} style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 15, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                {isDragActive ? 'Drop files here...' : 'Drop fund documents here or click to browse'}
              </p>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>PDF files only · Fund decks, DDQs, quarterly reports, LPAs</p>
            </div>

            {/* Drop rejection error */}
            {dropError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  marginBottom: 16,
                }}
              >
                <XCircle size={14} color="#DC2626" />
                <p style={{ fontSize: 13, color: '#DC2626' }}>{dropError}</p>
                <button
                  onClick={() => setDropError(null)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex' }}
                >
                  <XCircle size={14} />
                </button>
              </div>
            )}

            {/* File List */}
            {files.length > 0 && (
              <Card style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Queued Files
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {files.map((entry, i) => (
                    <div key={i}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: entry.status === 'error' ? '6px 6px 0 0' : 6,
                          backgroundColor: '#F9FAFB',
                          border: '1px solid #E5E7EB',
                          borderBottom: entry.status === 'error' ? 'none' : '1px solid #E5E7EB',
                        }}
                      >
                        <FileText size={18} color="#6B7280" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.file.name}
                          </p>
                          <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {(entry.file.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <select
                          value={entry.docType}
                          onChange={(e) => updateDocType(i, e.target.value as DocType)}
                          disabled={entry.status !== 'queued'}
                          style={{
                            border: '1px solid #E5E7EB',
                            borderRadius: 4,
                            padding: '4px 8px',
                            fontSize: 12,
                            fontFamily: 'Inter, sans-serif',
                            cursor: 'pointer',
                          }}
                        >
                          {(['Fund Deck', 'DDQ', 'Quarterly Report', 'LPA / Term Sheet'] as DocType[]).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {statusIcon(entry.status)}
                          <span style={{ fontSize: 11, color: entry.status === 'error' ? '#DC2626' : '#6B7280', textTransform: 'capitalize' }}>
                            {entry.status === 'extracting' ? 'Extracting…' : entry.status}
                          </span>
                        </div>
                      </div>
                      {entry.status === 'error' && entry.error && (
                        <div
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#FEF2F2',
                            borderRadius: '0 0 6px 6px',
                            border: '1px solid #FECACA',
                            borderTop: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <p style={{ fontSize: 11, color: '#DC2626', lineHeight: 1.5 }}>
                            ⚠ {entry.error}
                          </p>
                          <button
                            onClick={() => handleRetry(i)}
                            style={{
                              fontSize: 11,
                              color: '#2563EB',
                              background: 'none',
                              border: '1px solid #2563EB',
                              borderRadius: 4,
                              padding: '2px 8px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              fontFamily: 'Inter, sans-serif',
                            }}
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button
                variant="primary"
                size="lg"
                disabled={files.length === 0 || extracting}
                loading={extracting}
                onClick={handleExtractAll}
                icon={<ChevronRight size={16} />}
              >
                Extract All Documents
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <Card style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <AlertCircle size={16} color="#D97706" />
                <p style={{ fontSize: 13, color: '#D97706' }}>
                  Review the extracted data below. Fields with low confidence are highlighted.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { label: 'Fund Name', value: mergedData.fundName ?? '' },
                  { label: 'GP Firm', value: mergedData.gpFirm ?? '' },
                  { label: 'Vintage Year', value: String(mergedData.vintageYear ?? '') },
                  { label: 'Fund Size ($M)', value: String(mergedData.fundSize ?? '') },
                  { label: 'Geography', value: mergedData.geography ?? '' },
                  { label: 'Sector Focus', value: mergedData.sectorFocus ?? '' },
                ].map((field) => (
                  <div key={field.label}>
                    <label style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                      {field.label}
                    </label>
                    <input
                      defaultValue={field.value}
                      onChange={(e) => {
                        setMergedData((prev) => ({
                          ...prev,
                          [field.label.toLowerCase().replace(/\s+/g, '')]: e.target.value,
                        }))
                      }}
                      style={{
                        width: '100%',
                        border: '1px solid #E5E7EB',
                        borderRadius: 6,
                        padding: '7px 10px',
                        fontSize: 13,
                        color: '#374151',
                        fontFamily: 'Inter, sans-serif',
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: field.value ? '#FFFFFF' : '#FFFBEB',
                      }}
                    />
                  </div>
                ))}
              </div>

              {mergedData.thesis && (
                <div style={{ marginTop: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                    Investment Thesis
                  </label>
                  <textarea
                    defaultValue={mergedData.thesis}
                    rows={4}
                    style={{
                      width: '100%',
                      border: '1px solid #E5E7EB',
                      borderRadius: 6,
                      padding: '8px 10px',
                      fontSize: 13,
                      color: '#374151',
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </Card>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
              <Button variant="primary" size="lg" onClick={handleSaveAndAnalyze} icon={<ChevronRight size={16} />}>
                Save & Analyze
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
