/**
 * FundMathModule — Power Law VC Math
 *
 * VC returns follow a power law: ~40-50% of investments are written off,
 * ~40-50% return modest capital, and the top 5% are outliers that generate
 * virtually ALL fund returns. The scoring checks whether this fund's
 * construction and stage allow those 1-2 outliers to actually return 3x+.
 */
import { useMemo } from 'react'
import Plot from '../ui/Plot'
import type { Fund } from '../../types/fund'
import { calcFundMathScore, calcFundMathDetail } from '../../utils/scoreEngine'
import { baseConfig } from '../../utils/plotlyTheme'

interface Props {
  fund: Fund
  allFunds: Fund[]
}

export default function FundMathModule({ fund, allFunds }: Props) {
  const { score, d } = useMemo(() => ({
    score: calcFundMathScore(fund, allFunds),
    d:     calcFundMathDetail(fund, allFunds),
  }), [fund, allFunds])

  const scoreColor = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'

  // Portfolio simulation: how many companies fall in each bucket?
  const modestCount  = fund.construction?.targetCompanies ?? 20
    - d.lossCount - d.winnerCount
  const bucketCounts = [
    Math.max(0, d.lossCount),
    Math.max(0, modestCount),
    Math.max(0, d.winnerCount),
  ]
  const totalCompanies = bucketCounts.reduce((a, b) => a + b, 0)
  const bucketPcts = bucketCounts.map((n) => totalCompanies > 0 ? ((n / totalCompanies) * 100) : 0)

  const viabilityLabel =
    d.moicViability >= 3.0 ? 'Very comfortable'
    : d.moicViability >= 2.0 ? 'Comfortable'
    : d.moicViability >= 1.5 ? 'Workable'
    : d.moicViability >= 1.0 ? 'Tight but viable'
    : d.moicViability >= 0.75 ? 'Marginal'
    : 'Challenging'

  return (
    <div>
      {/* ── Top stat row ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'stretch' }}>
        {/* Score */}
        <div style={{ textAlign: 'center', minWidth: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{score.toFixed(1)}</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>/ 10</div>
        </div>

        {/* MOIC viability */}
        <div style={{ flex: 1, minWidth: 160, padding: '10px 14px', borderRadius: 8, backgroundColor: scoreColor + '12', border: `1px solid ${scoreColor}30` }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Power Law Viability</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor }}>
            {d.moicViability.toFixed(1)}× headroom
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{viabilityLabel}</div>
        </div>

        {/* Required winner MOIC */}
        <div style={{ flex: 1, minWidth: 150, padding: '10px 14px', borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Required Outlier MOIC</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{d.requiredWinnerMOIC.toFixed(0)}×</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            from top {d.winnerCount} co{d.winnerCount !== 1 ? 's' : ''} ({(d.winnerRate * 100).toFixed(0)}% of portfolio)
          </div>
        </div>

        {/* Stage achievable */}
        <div style={{ flex: 1, minWidth: 150, padding: '10px 14px', borderRadius: 8, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Stage-Achievable MOIC</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>{d.achievableWinnerMOIC}×</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>top-decile {fund.stageF.replace('_', ' ')} exits</div>
        </div>

        {/* Fund returner */}
        <div style={{ flex: 1, minWidth: 150, padding: '10px 14px', borderRadius: 8, backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Fund Returner Exit Needed</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
            ${d.fundReturnerExitNeeded.toFixed(0)}M
          </div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
            at {((fund.construction?.targetOwnership ?? 0.15) * 100).toFixed(0)}% ownership → 1× fund
          </div>
        </div>

        {/* Co-investor validation (only shown when LP update data is present) */}
        {d.coInvestorTier != null && (
          <div style={{
            flex: 1, minWidth: 150, padding: '10px 14px', borderRadius: 8,
            backgroundColor: d.coInvestorTier === 'tier1' ? '#D1FAE5' : d.coInvestorTier === 'tier2' ? '#EFF6FF' : '#F9FAFB',
            border: `1px solid ${d.coInvestorTier === 'tier1' ? '#6EE7B7' : d.coInvestorTier === 'tier2' ? '#BFDBFE' : '#E5E7EB'}`,
          }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Co-investor Validation</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: d.coInvestorTier === 'tier1' ? '#065F46' : d.coInvestorTier === 'tier2' ? '#1D4ED8' : '#374151' }}>
              {d.coInvestorTier === 'tier1' ? '🏆 Tier-1 firms' : d.coInvestorTier === 'tier2' ? '✓ Tier-2 firms' : 'None recorded'}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              led follow-on rounds
            </div>
          </div>
        )}
      </div>

      {/* ── Two charts ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, marginBottom: 16 }}>

        {/* Power law portfolio simulation */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Simulated Portfolio Outcome ({fund.construction?.targetCompanies ?? 20} companies · {fund.stageF.replace('_', ' ')} stage)
          </p>
          <Plot
            data={[
              {
                type:        'bar',
                orientation: 'h' as const,
                y:           ['Outliers (fund returners)', 'Modest (1–5×)', 'Write-offs (0×)'],
                x:           [bucketCounts[2], bucketCounts[1], bucketCounts[0]],
                text:        [
                  `${bucketCounts[2]} co${bucketCounts[2] !== 1 ? 's' : ''} (${bucketPcts[2].toFixed(0)}%) — generate ALL returns`,
                  `${bucketCounts[1]} cos (${bucketPcts[1].toFixed(0)}%) — return some capital`,
                  `${bucketCounts[0]} cos (${bucketPcts[0].toFixed(0)}%) — written off`,
                ],
                textposition: 'auto' as const,
                textfont:    { size: 11, color: '#FFFFFF' },
                marker: {
                  color: ['#4F46E5', '#F97316', '#DC2626'],
                  opacity: 0.9,
                },
                hovertemplate: '%{y}<br>%{x} companies<extra></extra>',
              },
            ]}
            layout={{
              height:        220,
              margin:        { l: 24, r: 160, t: 12, b: 36 },
              xaxis:         { title: { text: 'Number of companies', font: { size: 10 } }, tickfont: { size: 10 }, gridcolor: '#E5E7EB' },
              yaxis:         { tickfont: { size: 11 }, automargin: true },
              showlegend:    false,
              paper_bgcolor: 'transparent',
              plot_bgcolor:  'transparent',
              font:          { family: 'Inter, sans-serif', size: 11 },
            }}
            config={baseConfig}
            style={{ width: '100%' }}
          />
        </div>

        {/* Required vs Achievable MOIC comparison */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Outlier MOIC: Required vs. Achievable
          </p>
          <Plot
            data={[
              {
                type:   'bar',
                x:      ['Required\nfrom outliers', 'Achievable\nat this stage'],
                y:      [d.requiredWinnerMOIC, d.achievableWinnerMOIC],
                text:   [`${d.requiredWinnerMOIC.toFixed(0)}×`, `${d.achievableWinnerMOIC}×`],
                textposition: 'outside' as const,
                textfont: { size: 13, color: '#111827' },
                marker: {
                  color: ['#F97316', '#4F46E5'],
                  opacity: 0.9,
                },
                hovertemplate: '%{x}: %{y:.0f}×<extra></extra>',
              },
            ]}
            layout={{
              height:        220,
              margin:        { l: 24, r: 24, t: 28, b: 48 },
              xaxis:         { tickfont: { size: 11 } },
              yaxis:         {
                title:     { text: 'MOIC (×)', font: { size: 10 } },
                tickfont:  { size: 10 },
                gridcolor: '#E5E7EB',
                range:     [0, Math.max(d.requiredWinnerMOIC, d.achievableWinnerMOIC) * 1.25],
              },
              showlegend:    false,
              paper_bgcolor: 'transparent',
              plot_bgcolor:  'transparent',
              font:          { family: 'Inter, sans-serif', size: 11 },
              shapes: [{
                type:      'line',
                x0:        -0.5, x1:  1.5,
                y0:        d.requiredWinnerMOIC, y1: d.requiredWinnerMOIC,
                line:      { color: '#DC2626', width: 1.5, dash: 'dot' },
              }],
              annotations: [{
                x:         0.5,
                y:         d.requiredWinnerMOIC,
                xref:      'x' as const,
                yref:      'y' as const,
                text:      `needed: ${d.requiredWinnerMOIC.toFixed(0)}×`,
                font:      { size: 9, color: '#DC2626' },
                showarrow: false,
                yshift:    8,
              }],
            }}
            config={baseConfig}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* ── Interpretation ────────────────────────────────────────────── */}
      <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.7 }}>
        <strong style={{ color: '#374151' }}>Power law math:</strong>{' '}
        At the {fund.stageF.replace('_', ' ')} stage, ~{(d.lossRate * 100).toFixed(0)}% of investments are
        written off and only the top ~{(d.winnerRate * 100).toFixed(0)}% become outliers. In a portfolio of{' '}
        {fund.construction?.targetCompanies ?? 20} companies, that means roughly{' '}
        <strong style={{ color: '#111827' }}>{d.winnerCount} outlier{d.winnerCount !== 1 ? 's' : ''}</strong> must
        generate all the fund returns. Each needs to exit at{' '}
        <strong style={{ color: '#111827' }}>${d.requiredWinnerExit.toFixed(0)}M</strong> ({d.requiredWinnerMOIC.toFixed(0)}× MOIC),
        while the stage's top-decile exits are historically around{' '}
        <strong style={{ color: '#059669' }}>{d.achievableWinnerMOIC}×</strong>.{' '}
        To return the entire fund solo, one company must exit at{' '}
        <strong style={{ color: '#111827' }}>${d.fundReturnerExitNeeded.toFixed(0)}M</strong> at the
        current {((fund.construction?.targetOwnership ?? 0.15) * 100).toFixed(0)}% ownership.{' '}
        {d.moicViability >= 1.5
          ? 'The construction is well-suited for power law outcomes.'
          : d.moicViability >= 1.0
          ? 'The math works but leaves little margin for error.'
          : 'The required outlier performance is above typical stage benchmarks — difficult to achieve.'}
      </p>
    </div>
  )
}
