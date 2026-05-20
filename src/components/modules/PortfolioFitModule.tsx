import { useMemo } from 'react'
import Plot from '../ui/Plot'
import type { Fund } from '../../types/fund'
import { STRATEGY_LABELS, STAGE_LABELS } from '../../types/fund'
import { calcPortfolioFitScore, calcPortfolioFitDetail } from '../../utils/scoreEngine'
import { baseConfig } from '../../utils/plotlyTheme'

interface Props {
  fund: Fund
  allFunds: Fund[]
}

/** AUM-weighted percentage breakdown keyed by a string category. */
function aumPct(funds: Fund[], key: (f: Fund) => string): Record<string, number> {
  const buckets: Record<string, number> = {}
  let total = 0
  funds.forEach((f) => {
    const k = key(f)
    buckets[k] = (buckets[k] ?? 0) + (f.fundSize ?? 0)
    total += f.fundSize ?? 0
  })
  if (total === 0) return buckets
  Object.keys(buckets).forEach((k) => { buckets[k] = (buckets[k] / total) * 100 })
  return buckets
}

function deltaInfo(delta: number): { text: string; color: string } {
  if (delta < 0)     return { text: `ΔHHI ${delta.toFixed(3)} — diversifying ↓`,  color: '#059669' }
  if (delta < 0.005) return { text: `ΔHHI +${delta.toFixed(3)} — negligible`,     color: '#059669' }
  if (delta < 0.010) return { text: `ΔHHI +${delta.toFixed(3)} — slight ↑`,       color: '#374151' }
  if (delta < 0.020) return { text: `ΔHHI +${delta.toFixed(3)} — moderate ↑`,     color: '#D97706' }
  return               { text: `ΔHHI +${delta.toFixed(3)} — concentrated ↑↑`,     color: '#DC2626' }
}

const STAGE_ORDER = ['pre_seed', 'seed', 'series_a', 'series_b', 'growth', 'multi_stage']
const BEFORE_COLOR = '#CBD5E1'
const AFTER_COLOR  = '#2563EB'

export default function PortfolioFitModule({ fund, allFunds }: Props) {
  const { score, detail, stageChart, stratChart, vintageChart } = useMemo(() => {
    const committed = allFunds.filter((f) => f.status === 'committed')
    const withNew   = [...committed, fund]

    // ── Stage AUM %
    const stageBef = aumPct(committed, (f) => f.stageF)
    const stageAft = aumPct(withNew,   (f) => f.stageF)
    const stageKeys = STAGE_ORDER.filter((k) => (stageBef[k] ?? 0) > 0 || (stageAft[k] ?? 0) > 0)

    // ── Strategy AUM %
    const stratBef = aumPct(committed, (f) => f.strategy)
    const stratAft = aumPct(withNew,   (f) => f.strategy)
    const stratKeys = [...new Set([...Object.keys(stratBef), ...Object.keys(stratAft)])]
      .sort((a, b) => (stratAft[b] ?? 0) - (stratAft[a] ?? 0))

    // ── Vintage fund count
    const vintCountBef: Record<string, number> = {}
    committed.forEach((f) => {
      const k = String(f.vintageYear)
      vintCountBef[k] = (vintCountBef[k] ?? 0) + 1
    })
    const vintKeys = [...new Set([...Object.keys(vintCountBef), String(fund.vintageYear)])].sort()

    return {
      score:  calcPortfolioFitScore(fund, allFunds),
      detail: calcPortfolioFitDetail(fund, allFunds),
      stageChart: {
        labels:  stageKeys.map((k) => STAGE_LABELS[k as keyof typeof STAGE_LABELS] ?? k),
        before:  stageKeys.map((k) => stageBef[k] ?? 0),
        after:   stageKeys.map((k) => stageAft[k] ?? 0),
      },
      stratChart: {
        labels:  stratKeys.map((k) => STRATEGY_LABELS[k as keyof typeof STRATEGY_LABELS] ?? k),
        before:  stratKeys.map((k) => stratBef[k] ?? 0),
        after:   stratKeys.map((k) => stratAft[k] ?? 0),
      },
      vintageChart: {
        years:    vintKeys,
        existing: vintKeys.map((k) => vintCountBef[k] ?? 0),
        newFund:  vintKeys.map((k) => (k === String(fund.vintageYear) ? 1 : 0)),
      },
    }
  }, [fund, allFunds])

  const scoreColor   = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'
  const stageΔHHI    = detail.stageHHIAfter  - detail.stageHHIBefore
  const stratΔHHI    = detail.stratHHIAfter   - detail.stratHHIBefore
  const stageΔInfo   = deltaInfo(stageΔHHI)
  const stratΔInfo   = deltaInfo(stratΔHHI)
  const vintageColor = detail.vintageCount === 0 ? '#059669'
                     : detail.vintageCount >= 3  ? '#D97706'
                     : '#374151'

  const BAR_LAYOUT_COMMON = {
    barmode:         'group' as const,
    paper_bgcolor:   'transparent',
    plot_bgcolor:    'transparent',
    font:            { family: 'Inter, sans-serif', size: 11 },
    showlegend:      true,
    legend:          { orientation: 'h' as const, x: 0, y: -0.18, font: { size: 10 } },
    xaxis:           { tickformat: '.0f', ticksuffix: '%', tickfont: { size: 10 }, gridcolor: '#E5E7EB' },
    yaxis:           { tickfont: { size: 11 }, automargin: true, gridcolor: '#E5E7EB' },
    margin:          { l: 110, r: 30, t: 12, b: 40 },
  }

  function barTraces(chart: { labels: string[]; before: number[]; after: number[] }) {
    return [
      {
        type: 'bar' as const,
        orientation: 'h' as const,
        name: 'Before',
        y: chart.labels,
        x: chart.before,
        marker: { color: BEFORE_COLOR },
        text: chart.before.map((v) => (v > 0 ? `${v.toFixed(0)}%` : '')),
        textposition: 'outside' as const,
        textfont: { size: 10, color: '#6B7280' },
      },
      {
        type: 'bar' as const,
        orientation: 'h' as const,
        name: 'After (incl. this fund)',
        y: chart.labels,
        x: chart.after,
        marker: { color: AFTER_COLOR, opacity: 0.85 },
        text: chart.after.map((v) => (v > 0 ? `${v.toFixed(0)}%` : '')),
        textposition: 'outside' as const,
        textfont: { size: 10, color: '#374151' },
      },
    ]
  }

  return (
    <div>
      {/* ── Top stat row ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Score */}
        <div style={{ textAlign: 'center', minWidth: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{score.toFixed(1)}</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>/ 10</div>
        </div>

        {/* Stage ΔHHI */}
        <div style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, backgroundColor: stageΔInfo.color + '12', border: `1px solid ${stageΔInfo.color}30` }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Stage Concentration</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: stageΔInfo.color }}>{stageΔInfo.text}</div>
        </div>

        {/* Strategy ΔHHI */}
        <div style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, backgroundColor: stratΔInfo.color + '12', border: `1px solid ${stratΔInfo.color}30` }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Strategy Concentration</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: stratΔInfo.color }}>{stratΔInfo.text}</div>
        </div>

        {/* Vintage count */}
        <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, backgroundColor: vintageColor + '12', border: `1px solid ${vintageColor}30` }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Same-Vintage Funds</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: vintageColor }}>
            {detail.vintageCount} fund{detail.vintageCount !== 1 ? 's' : ''} already in {fund.vintageYear}
          </div>
        </div>
      </div>

      {/* ── Stage + Strategy charts ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Stage Mix */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Stage Allocation (AUM %)
          </p>
          <Plot
            data={barTraces(stageChart)}
            layout={{
              ...BAR_LAYOUT_COMMON,
              height: Math.max(200, stageChart.labels.length * 52 + 60),
            }}
            config={baseConfig}
            style={{ width: '100%' }}
          />
        </div>

        {/* Strategy Mix */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Strategy Allocation (AUM %)
          </p>
          <Plot
            data={barTraces(stratChart)}
            layout={{
              ...BAR_LAYOUT_COMMON,
              height: Math.max(220, stratChart.labels.length * 44 + 60),
            }}
            config={baseConfig}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* ── Vintage distribution ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Vintage Year Distribution (fund count)
        </p>
        <Plot
          data={[
            {
              type: 'bar',
              name: 'Committed',
              x: vintageChart.years,
              y: vintageChart.existing,
              marker: { color: BEFORE_COLOR },
            },
            {
              type: 'bar',
              name: 'This Fund',
              x: vintageChart.years,
              y: vintageChart.newFund,
              marker: { color: AFTER_COLOR, opacity: 0.85 },
            },
          ]}
          layout={{
            barmode:       'stack' as const,
            height:        160,
            margin:        { l: 40, r: 20, t: 10, b: 36 },
            xaxis:         { tickfont: { size: 11 }, gridcolor: '#E5E7EB' },
            yaxis:         { tickfont: { size: 10 }, dtick: 1, gridcolor: '#E5E7EB', title: { text: 'Funds', font: { size: 10 } } },
            showlegend:    true,
            legend:        { orientation: 'h' as const, x: 0, y: -0.3, font: { size: 10 } },
            paper_bgcolor: 'transparent',
            plot_bgcolor:  'transparent',
            font:          { family: 'Inter, sans-serif', size: 11 },
          }}
          config={baseConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* ── Interpretation ───────────────────────────────────────────────── */}
      <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
        Adding this fund{' '}
        {score >= 7 ? 'improves' : score >= 5 ? 'maintains' : 'reduces'} portfolio diversification.
        Stage HHI {stageΔHHI >= 0 ? 'increases' : 'decreases'} by {Math.abs(stageΔHHI).toFixed(4)} and
        strategy HHI {stratΔHHI >= 0 ? 'increases' : 'decreases'} by {Math.abs(stratΔHHI).toFixed(4)}.{' '}
        {STRATEGY_LABELS[fund.strategy]} at {STAGE_LABELS[fund.stageF]} stage is{' '}
        {score >= 7 ? 'underrepresented' : score >= 5 ? 'moderately represented' : 'already well-represented'}{' '}
        in your committed portfolio.
      </p>
    </div>
  )
}
