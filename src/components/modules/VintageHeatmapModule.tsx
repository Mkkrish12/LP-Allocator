import { useMemo } from 'react'
import Plot from '../ui/Plot'
import type { Fund, FundStrategy } from '../../types/fund'
import { STRATEGY_LABELS } from '../../types/fund'
import { calcVintageScore, calcVintageDetail, VINTAGES, STRATEGIES, median } from '../../utils/scoreEngine'
import { baseConfig } from '../../utils/plotlyTheme'

interface Props {
  fund: Fund
  allFunds: Fund[]
}

// Short labels for the heatmap y-axis so they don't eat horizontal space
const STRATEGY_SHORT: Record<string, string> = {
  seed_vc:          'Seed VC',
  series_a:         'Series A',
  multi_stage:      'Multi-Stage',
  ai_focused:       'AI Focused',
  climate_tech:     'Climate Tech',
  sector_agnostic:  'Generalist',
  deep_tech:        'Deep Tech',
  emerging_markets: 'Emrg Markets',
  operator_led:     'Operator-Led',
  solo_gp:          'Solo GP',
}

// Absolute vintage quality scores (from VINTAGE_TIERS in scoreEngine)
const VINTAGE_QUALITY: Record<number, { score: number; tier: string; color: string }> = {
  2014: { score: 9.0, tier: 'Top',     color: '#059669' },
  2015: { score: 9.0, tier: 'Top',     color: '#059669' },
  2016: { score: 9.0, tier: 'Top',     color: '#059669' },
  2017: { score: 6.5, tier: 'Mid',     color: '#D97706' },
  2018: { score: 9.0, tier: 'Top',     color: '#059669' },
  2019: { score: 9.0, tier: 'Top',     color: '#059669' },
  2020: { score: 9.0, tier: 'Top',     color: '#059669' },
  2021: { score: 3.5, tier: 'Weak',    color: '#DC2626' },
  2022: { score: 6.5, tier: 'Mid',     color: '#D97706' },
  2023: { score: 6.5, tier: 'Mid',     color: '#D97706' },
  2024: { score: 5.5, tier: 'Unknown', color: '#9CA3AF' },
}

const TIER_LABELS: Record<string, string> = {
  top:     '🟢 Top vintage',
  mid:     '🟡 Mid vintage',
  bottom:  '🔴 Weak vintage',
  unknown: '⬜ Too early',
}
const TIER_COLORS: Record<string, string> = {
  top:     '#059669',
  mid:     '#D97706',
  bottom:  '#DC2626',
  unknown: '#9CA3AF',
}

export default function VintageHeatmapModule({ fund, allFunds }: Props) {
  const { score, detail, zData, heatmapAnnotations, vintPortfolioData } = useMemo(() => {
    const localStrategies: FundStrategy[] = STRATEGIES
    const localVintages: number[]         = VINTAGES

    // ── Build heatmap z matrix ─────────────────────────────────────────
    const bucket: Record<string, number[]> = {}
    localStrategies.forEach((s) =>
      localVintages.forEach((v) => { bucket[`${s}_${v}`] = [] })
    )
    allFunds
      .filter((f) => f.status === 'committed' && localVintages.includes(f.vintageYear))
      .forEach((f) => {
        const key     = `${f.strategy}_${f.vintageYear}`
        const bestIRR = f.priorFunds.length > 0
          ? Math.max(...f.priorFunds.map((pf) => pf.netIRR))
          : 0.15
        if (bucket[key]) bucket[key].push(bestIRR)
      })

    const z: (number | null)[][] = localStrategies.map((s) =>
      localVintages.map((v) => {
        const vals = bucket[`${s}_${v}`]
        return vals.length > 0 ? median(vals) : null
      })
    )

    // ── Star annotation for this fund ─────────────────────────────────
    const annots: Partial<Plotly.Annotations>[] = []
    const fundStratIdx   = localStrategies.indexOf(fund.strategy)
    const fundVintageIdx = localVintages.indexOf(fund.vintageYear)
    if (fundStratIdx >= 0 && fundVintageIdx >= 0) {
      annots.push({
        x: fundVintageIdx, y: fundStratIdx,
        text: '★', font: { size: 18, color: '#FFFFFF' },
        showarrow: false,
      })
    }

    // ── Portfolio vintage distribution ────────────────────────────────
    const committed = allFunds.filter((f) => f.status === 'committed')
    const vintCount: Record<string, number> = {}
    committed.forEach((f) => {
      const k = String(f.vintageYear)
      vintCount[k] = (vintCount[k] ?? 0) + 1
    })
    const vintKeys = [...new Set([...Object.keys(vintCount), String(fund.vintageYear)])].sort()

    return {
      score:               calcVintageScore(fund, allFunds),
      detail:              calcVintageDetail(fund, allFunds),
      zData:               z,
      heatmapAnnotations:  annots,
      vintPortfolioData: {
        years:    vintKeys,
        existing: vintKeys.map((k) => vintCount[k] ?? 0),
        newFund:  vintKeys.map((k) => (k === String(fund.vintageYear) ? 1 : 0)),
      },
    }
  }, [fund, allFunds])

  const scoreColor = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'
  const tierLabel  = TIER_LABELS[detail.tier] ?? '⬜ Unknown'
  const tierColor  = TIER_COLORS[detail.tier] ?? '#9CA3AF'

  const localStrategies: FundStrategy[] = STRATEGIES
  const localVintages: number[]         = VINTAGES
  const cellValue =
    zData[localStrategies.indexOf(fund.strategy)]?.[localVintages.indexOf(fund.vintageYear)]

  const dpiText =
    detail.bestDPI != null
      ? `${detail.bestDPI.toFixed(2)}× DPI`
      : fund.vintageYear >= 2022 ? 'Too early' : 'No data'

  // Vintage quality bar data — all vintages in our list
  const qualityVintages = localVintages
  const qualityScores   = qualityVintages.map((v) => VINTAGE_QUALITY[v]?.score ?? 5.5)
  const qualityColors   = qualityVintages.map((v) =>
    v === fund.vintageYear
      ? (VINTAGE_QUALITY[v]?.color ?? '#9CA3AF')
      : (VINTAGE_QUALITY[v]?.color ?? '#9CA3AF') + 'AA'
  )
  const qualityTiers    = qualityVintages.map((v) => VINTAGE_QUALITY[v]?.tier ?? 'Unknown')

  return (
    <div>
      {/* ── Top stat row ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Score */}
        <div style={{ textAlign: 'center', minWidth: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{score.toFixed(1)}</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>/ 10</div>
        </div>

        {/* Tier badge */}
        <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, backgroundColor: tierColor + '12', border: `1px solid ${tierColor}30` }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Vintage Quality ({fund.vintageYear})</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: tierColor }}>{tierLabel}</div>
        </div>

        {/* DPI */}
        <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Prior Fund DPI</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: detail.bestDPI != null && detail.bestDPI >= 0.5 ? '#059669' : '#374151' }}>
            {dpiText}
          </div>
        </div>

        {/* Same-vintage funds */}
        <div style={{ flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Same-Vintage Committed</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: detail.vintageCount === 0 ? '#059669' : detail.vintageCount >= 3 ? '#D97706' : '#374151' }}>
            {detail.vintageCount} fund{detail.vintageCount !== 1 ? 's' : ''} in {fund.vintageYear}
          </div>
        </div>

        {/* Cell IRR */}
        {cellValue != null && (
          <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Cell Median Net IRR</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{(cellValue * 100).toFixed(1)}%</div>
          </div>
        )}
      </div>

      {/* ── Two charts side by side ───────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Vintage Quality Bar */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Vintage Quality Score (Cambridge Associates priors)
          </p>
          <Plot
            data={[
              {
                type:            'bar',
                x:               qualityVintages.map(String),
                y:               qualityScores,
                text:            qualityTiers,
                textposition:    'inside' as const,
                textfont:        { size: 10, color: '#FFFFFF' },
                insidetextanchor: 'middle' as const,
                marker:          {
                  color: qualityColors,
                  line:  { color: qualityVintages.map((v) => v === fund.vintageYear ? '#1E3A5F' : 'transparent'), width: 2 },
                },
                hovertemplate:   '%{x}: %{text} (%{y})<extra></extra>',
              },
            ]}
            layout={{
              height:         220,
              margin:         { l: 36, r: 16, t: 24, b: 36 },
              xaxis:          { tickfont: { size: 11 }, gridcolor: '#E5E7EB' },
              yaxis:          { range: [0, 10.5], tickfont: { size: 10 }, gridcolor: '#E5E7EB', title: { text: 'Score', font: { size: 10 } } },
              showlegend:     false,
              paper_bgcolor:  'transparent',
              plot_bgcolor:   'transparent',
              font:           { family: 'Inter, sans-serif', size: 11 },
              annotations:    [{
                x:          String(fund.vintageYear),
                y:          (VINTAGE_QUALITY[fund.vintageYear]?.score ?? 5.5) + 1.8,
                text:       '▼ This fund',
                font:       { size: 10, color: '#1E3A5F' },
                showarrow:  false,
              }],
            }}
            config={baseConfig}
            style={{ width: '100%' }}
          />
        </div>

        {/* Portfolio Vintage Distribution */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Portfolio Vintage Distribution (J-curve spread)
          </p>
          <Plot
            data={[
              {
                type:   'bar',
                name:   'Committed',
                x:      vintPortfolioData.years,
                y:      vintPortfolioData.existing,
                marker: { color: '#4F46E5', opacity: 0.75 },
              },
              {
                type:   'bar',
                name:   'This Fund',
                x:      vintPortfolioData.years,
                y:      vintPortfolioData.newFund,
                marker: { color: '#F97316', opacity: 0.9 },
              },
            ]}
            layout={{
              barmode:        'stack' as const,
              height:         220,
              margin:         { l: 36, r: 16, t: 10, b: 36 },
              xaxis:          { tickfont: { size: 11 }, gridcolor: '#E5E7EB' },
              yaxis:          { dtick: 1, tickfont: { size: 10 }, gridcolor: '#E5E7EB', title: { text: 'Funds', font: { size: 10 } } },
              showlegend:     true,
              legend:         { orientation: 'h' as const, x: 0, y: -0.22, font: { size: 10 } },
              paper_bgcolor:  'transparent',
              plot_bgcolor:   'transparent',
              font:           { family: 'Inter, sans-serif', size: 11 },
            }}
            config={baseConfig}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* ── Full-width heatmap ────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Portfolio Strategy × Vintage — Median Net IRR Heatmap
          <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 8 }}>(★ = this fund's position)</span>
        </p>
        <Plot
          data={[
            {
              type: 'heatmap',
              z:    zData,
              x:    localVintages.map(String),
              y:    localStrategies.map((s) => STRATEGY_SHORT[s] ?? STRATEGY_LABELS[s]),
              colorscale: [
                [0,   '#FEE2E2'],
                [0.3, '#FCA5A5'],
                [0.5, '#FDE68A'],
                [0.7, '#6EE7B7'],
                [1,   '#059669'],
              ],
              showscale: true,
              colorbar: {
                title:      { text: 'Net IRR', side: 'right' as const },
                tickformat: '.0%',
                thickness:  14,
                len:        1,
                tickfont:   { size: 10 },
              },
              hovertemplate: '%{y} · %{x}: %{z:.1%} Net IRR<extra></extra>',
              zmin: 0,
              zmax: 0.5,
            } as Plotly.PlotData,
          ]}
          layout={{
            height:         380,
            margin:         { l: 110, r: 80, t: 16, b: 48 },
            annotations:    heatmapAnnotations,
            xaxis:          { type: 'category' as const, tickfont: { size: 12, color: '#374151' }, side: 'bottom' as const },
            yaxis:          { tickfont: { size: 11, color: '#374151' }, automargin: true },
            paper_bgcolor:  'transparent',
            plot_bgcolor:   'transparent',
            font:           { family: 'Inter, sans-serif', size: 11, color: '#374151' },
          }}
          config={baseConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* ── Interpretation ───────────────────────────────────────────── */}
      <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>
        {fund.vintageYear} is a <strong style={{ color: tierColor }}>{detail.tier}</strong>-tier vintage per
        Cambridge Associates benchmarks.{' '}
        {STRATEGY_LABELS[fund.strategy]} funds in this cell returned{' '}
        {cellValue != null ? `${(cellValue * 100).toFixed(1)}% median net IRR` : 'insufficient portfolio data'} historically.{' '}
        {detail.vintageCount === 0
          ? 'No other committed funds share this vintage — strong J-curve diversification benefit.'
          : `${detail.vintageCount} committed fund${detail.vintageCount > 1 ? 's' : ''} already in ${fund.vintageYear}.`}
        {detail.bestDPI != null && detail.bestDPI >= 0.5
          ? ` GP has returned ${detail.bestDPI.toFixed(2)}× DPI on prior funds.`
          : ''}
      </p>
    </div>
  )
}
