import { useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useFundStore } from '../store/fundStore'
import type { ModuleScores, BenchmarkAverages } from '../types/fund'
import {
  calcFundMathScore,
  calcTeamPedigreeScore,
  calcStrategyScore,
  calcTermsScore,
  calcPortfolioFitScore,
  calcVintageScore,
  calculateOverallScore,
  getRecommendation,
} from '../utils/scoreEngine'
import { generateICMemo } from '../utils/claudeClient'
import Header from '../components/ui/Header'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import ScoreGauge from '../components/ui/ScoreGauge'
import { StatusBadge, StrategyBadge, StageBadge } from '../components/ui/Badge'
import { TypingAnimation } from '../components/ui/LoadingSpinner'
import FundMathModule from '../components/modules/FundMathModule'
import TeamPedigreeModule from '../components/modules/TeamPedigreeModule'
import StrategyMapModule from '../components/modules/StrategyMapModule'
import TermsBenchmarkModule from '../components/modules/TermsBenchmarkModule'
import PortfolioFitModule from '../components/modules/PortfolioFitModule'
import VintageHeatmapModule from '../components/modules/VintageHeatmapModule'
import { GitCompare, FileText } from 'lucide-react'

const MODULE_TITLES = [
  'Fund Math Viability',
  'Team Pedigree',
  'Strategy Differentiation',
  'Terms Benchmark',
  'Portfolio Fit',
  'Vintage Timing Heatmap',
]

// Renders GPT's markdown-formatted IC memo with proper heading hierarchy.
function MemoRenderer({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      elements.push(<div key={key++} style={{ height: 10 }} />)
      continue
    }

    // --- horizontal rule
    if (/^-{3,}$/.test(trimmed)) {
      elements.push(<hr key={key++} style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '16px 0' }} />)
      continue
    }

    // # H1 — main title
    if (trimmed.startsWith('# ')) {
      const content = trimmed.slice(2).replace(/\*\*/g, '')
      elements.push(
        <h1 key={key++} style={{ fontSize: 22, fontWeight: 700, color: '#0F1B35', marginBottom: 4, marginTop: 4, letterSpacing: '-0.01em' }}>
          {content}
        </h1>
      )
      continue
    }

    // ## H2 — section headers
    if (trimmed.startsWith('## ')) {
      const content = trimmed.slice(3).replace(/\*\*/g, '')
      elements.push(
        <h2 key={key++} style={{ fontSize: 14, fontWeight: 700, color: '#0F1B35', marginTop: 20, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {content}
        </h2>
      )
      continue
    }

    // **Bold:** — inline bold section labels (GPT sometimes uses these instead of ##)
    if (/^\*\*[^*]+\*\*$/.test(trimmed) || /^\*\*[^*]+:\*\*$/.test(trimmed)) {
      const content = trimmed.replace(/\*\*/g, '')
      elements.push(
        <h2 key={key++} style={{ fontSize: 14, fontWeight: 700, color: '#0F1B35', marginTop: 20, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {content}
        </h2>
      )
      continue
    }

    // bullet list items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const content = trimmed.slice(2)
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 8 }}>
          <span style={{ color: '#2563EB', flexShrink: 0, marginTop: 1 }}>•</span>
          <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{renderInline(content)}</span>
        </div>
      )
      continue
    }

    // numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)/)
      if (match) {
        elements.push(
          <div key={key++} style={{ display: 'flex', gap: 8, marginBottom: 4, paddingLeft: 8 }}>
            <span style={{ color: '#2563EB', flexShrink: 0, fontWeight: 600, fontSize: 13, minWidth: 18 }}>{match[1]}.</span>
            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>{renderInline(match[2])}</span>
          </div>
        )
        continue
      }
    }

    // regular paragraph line
    elements.push(
      <p key={key++} style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, marginBottom: 4 }}>
        {renderInline(trimmed)}
      </p>
    )
  }

  return <div style={{ fontFamily: 'Inter, sans-serif' }}>{elements}</div>
}

// Renders inline markdown: **bold**, *italic*
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ fontWeight: 600, color: '#111827' }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

export default function FundAnalysis() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { funds, updateFund, updateFundStatus, toggleFundSelection } = useFundStore()

  const fund = funds.find((f) => f.id === id)
  const [generatingMemo, setGeneratingMemo] = useState(false)
  const [memoError, setMemoError] = useState<string | null>(null)

  const scores: ModuleScores = useMemo(() => {
    if (!fund) return { fundMath: 0, teamPedigree: 0, strategyDifferentiation: 0, termsFairness: 0, portfolioFit: 0, vintageTiming: 0, overall: 0 }
    const s = {
      fundMath: calcFundMathScore(fund, funds),
      teamPedigree: calcTeamPedigreeScore(fund, funds),
      strategyDifferentiation: calcStrategyScore(fund, funds),
      termsFairness: calcTermsScore(fund),
      portfolioFit: calcPortfolioFitScore(fund, funds),
      vintageTiming: calcVintageScore(fund, funds),
      overall: 0,
    }
    s.overall = calculateOverallScore(s)
    return s
  }, [fund, funds])

  const recommendation = useMemo(() => getRecommendation(scores.overall), [scores.overall])

  const benchmarks: BenchmarkAverages = useMemo(() => {
    const committed = funds.filter((f) => f.status === 'committed')
    const withIRR = committed.filter((f) => f.priorFunds.length > 0)
    const avg = (fn: (f: typeof committed[0]) => number) =>
      committed.length > 0 ? committed.reduce((s, f) => s + fn(f), 0) / committed.length : 0
    return {
      avgNetIRR:
        withIRR.length > 0
          ? withIRR.reduce((s, f) => s + Math.max(...f.priorFunds.map((pf) => pf.netIRR)), 0) /
            withIRR.length
          : 0,
      avgTVPI:
        withIRR.length > 0
          ? withIRR.reduce((s, f) => s + Math.max(...f.priorFunds.map((pf) => pf.netTVPI)), 0) /
            withIRR.length
          : 0,
      avgDPI:
        withIRR.length > 0
          ? withIRR.reduce((s, f) => s + Math.max(...f.priorFunds.map((pf) => pf.DPI)), 0) /
            withIRR.length
          : 0,
      avgManagementFee: avg((f) => f.terms.managementFee),
      avgCarry: avg((f) => f.terms.carry),
      avgGPCommitPercent: avg((f) => f.terms.gpCommitPercent),
      avgTeamVCExperience: avg((f) =>
        f.team.length > 0
          ? f.team.reduce((s, m) => s + m.yearsVCExperience, 0) / f.team.length
          : 0
      ),
      avgFundSize: avg((f) => f.fundSize),
    }
  }, [funds])

  const handleGenerateMemo = useCallback(async () => {
    if (!fund) return
    setGeneratingMemo(true)
    setMemoError(null)
    try {
      const memo = await generateICMemo(fund, scores, benchmarks)
      updateFund(fund.id, {
        icMemo: memo,
        memoGeneratedAt: new Date().toISOString(),
      })
    } catch (err) {
      setMemoError(err instanceof Error ? err.message : 'Failed to generate memo')
    } finally {
      setGeneratingMemo(false)
    }
  }, [fund, scores, benchmarks, updateFund])

  if (!fund) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, color: '#6B7280' }}>Fund not found.</p>
          <Button onClick={() => navigate('/library')} style={{ marginTop: 16 }}>
            Back to Library
          </Button>
        </div>
      </div>
    )
  }

  const bestPrior = fund.priorFunds.length > 0 ? fund.priorFunds.reduce((best, pf) => pf.netIRR > best.netIRR ? pf : best) : null

  const modules = [
    { component: <FundMathModule fund={fund} allFunds={funds} />, title: MODULE_TITLES[0] },
    { component: <TeamPedigreeModule fund={fund} allFunds={funds} />, title: MODULE_TITLES[1] },
    { component: <StrategyMapModule fund={fund} allFunds={funds} />, title: MODULE_TITLES[2] },
    { component: <TermsBenchmarkModule fund={fund} allFunds={funds} />, title: MODULE_TITLES[3] },
    { component: <PortfolioFitModule fund={fund} allFunds={funds} />, title: MODULE_TITLES[4] },
    { component: <VintageHeatmapModule fund={fund} allFunds={funds} />, title: MODULE_TITLES[5] },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        title={fund.fundName}
        subtitle={fund.gpFirm}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<GitCompare size={14} />}
              onClick={() => { toggleFundSelection(fund.id); navigate('/compare') }}
            >
              Compare
            </Button>
            <select
              value={fund.status}
              onChange={(e) => updateFundStatus(fund.id, e.target.value as 'committed' | 'evaluating' | 'passed')}
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 13,
                color: '#374151',
                fontFamily: 'Inter, sans-serif',
                cursor: 'pointer',
              }}
            >
              <option value="evaluating">Evaluating</option>
              <option value="committed">Committed</option>
              <option value="passed">Passed</option>
            </select>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        {/* Fund Header Card */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
            {/* Left: identity */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#6B7280' }}>Vintage {fund.vintageYear}</span>
                <StrategyBadge strategy={fund.strategy} />
                <StageBadge stage={fund.stageF} />
                <StatusBadge status={fund.status} />
              </div>
              <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, maxWidth: 480 }}>
                {fund.thesis}
              </p>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
                {fund.geography} · {fund.sectorFocus}
              </p>
            </div>

            {/* Center: key metrics */}
            <div style={{ display: 'flex', gap: 32 }}>
              {[
                { label: 'Fund Size', value: `$${fund.fundSize}M` },
                { label: 'Best Net IRR', value: bestPrior ? `${(bestPrior.netIRR * 100).toFixed(1)}%` : '—' },
                { label: 'Best DPI', value: bestPrior ? `${bestPrior.DPI.toFixed(2)}x` : '—' },
                { label: 'Best TVPI', value: bestPrior ? `${bestPrior.netTVPI.toFixed(2)}x` : '—' },
              ].map((m) => (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Right: score gauge */}
            <div style={{ flexShrink: 0 }}>
              <ScoreGauge overall={scores.overall} scores={scores} recommendation={recommendation} />
            </div>
          </div>
        </Card>

        {/* 6 Modules Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
            marginBottom: 24,
          }}
        >
          {modules.map((mod, i) => (
            <Card key={i} title={mod.title}>
              {mod.component}
            </Card>
          ))}
        </div>

        {/* IC Memo Section */}
        <Card title="Investment Committee Memo">
          {fund.icMemo ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                  Generated{' '}
                  {fund.memoGeneratedAt
                    ? new Date(fund.memoGeneratedAt).toLocaleString()
                    : 'recently'}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(fund.icMemo ?? '')
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateMemo}
                    loading={generatingMemo}
                  >
                    Regenerate
                  </Button>
                </div>
              </div>
              <MemoRenderer text={fund.icMemo ?? ''} />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              {generatingMemo ? (
                <TypingAnimation />
              ) : (
                <>
                  <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>
                    Generate a professional IC memo using GPT-4o, incorporating all module scores
                    and portfolio benchmarks.
                  </p>
                  {memoError && (
                    <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{memoError}</p>
                  )}
                  <Button
                    variant="primary"
                    icon={<FileText size={15} />}
                    onClick={handleGenerateMemo}
                    loading={generatingMemo}
                  >
                    Generate IC Memo
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
