import { useMemo } from 'react'
import Plot from '../ui/Plot'
import type { Fund } from '../../types/fund'
import { calcStrategyScore, calcStrategyDetail } from '../../utils/scoreEngine'
import { STATUS_COLORS, baseConfig } from '../../utils/plotlyTheme'
import { STRATEGY_LABELS } from '../../types/fund'

interface Props {
  fund: Fund
  allFunds: Fund[]
}

const STAGE_MAP: Record<string, number> = {
  pre_seed: 1, seed: 2, series_a: 3, series_b: 4, growth: 5, multi_stage: 3,
}

const STRAT_MAP: Record<string, number> = {
  sector_agnostic: 1, seed_vc: 2, multi_stage: 2, solo_gp: 3,
  series_a: 3, operator_led: 4, ai_focused: 5, climate_tech: 6,
  deep_tech: 7, emerging_markets: 8,
}

export default function StrategyMapModule({ fund, allFunds }: Props) {
  const { score, detail } = useMemo(() => ({
    score: calcStrategyScore(fund, allFunds),
    detail: calcStrategyDetail(fund, allFunds),
  }), [fund, allFunds])

  const scoreColor = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'

  const otherFunds = allFunds.filter((f) => f.id !== fund.id)
  const committed = otherFunds.filter((f) => f.status === 'committed')
  const others = otherFunds.filter((f) => f.status !== 'committed')

  const overlapLabel =
    detail.exactMatch === 0 && detail.vintageCorrelated === 0
      ? 'No exact overlap — unique positioning'
      : detail.exactMatch === 0
      ? `${detail.vintageCorrelated} strategy+vintage overlap${detail.vintageCorrelated > 1 ? 's' : ''}`
      : `${detail.exactMatch} exact match${detail.exactMatch > 1 ? 'es' : ''} (same strategy & stage)`

  return (
    <div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <Plot
            data={[
              ...(others.length > 0
                ? [
                    {
                      type: 'scatter' as const,
                      mode: 'markers' as const,
                      x: others.map((f) => STAGE_MAP[f.stageF] ?? 3),
                      y: others.map((f) => STRAT_MAP[f.strategy] ?? 4),
                      marker: { color: '#D1D5DB', size: 8, opacity: 0.6 },
                      text: others.map((f) => f.fundName),
                      hovertemplate: '%{text}<extra></extra>',
                      name: 'Other Funds',
                    },
                  ]
                : []),
              {
                type: 'scatter' as const,
                mode: 'markers' as const,
                x: committed.map((f) => STAGE_MAP[f.stageF] ?? 3),
                y: committed.map((f) => STRAT_MAP[f.strategy] ?? 4),
                marker: {
                  color: STATUS_COLORS.committed,
                  size: 10,
                  opacity: 0.8,
                  line: { color: '#FFFFFF', width: 1.5 },
                },
                text: committed.map((f) => f.fundName),
                hovertemplate: '%{text}<extra></extra>',
                name: 'Committed',
              },
              {
                type: 'scatter' as const,
                mode: 'text+markers' as const,
                x: [STAGE_MAP[fund.stageF] ?? 3],
                y: [STRAT_MAP[fund.strategy] ?? 4],
                marker: {
                  color: STATUS_COLORS.current,
                  size: 18,
                  symbol: 'star',
                  line: { color: '#FFFFFF', width: 2 },
                },
                text: [fund.fundName.split(' ').slice(0, 2).join(' ')],
                textposition: 'top center' as const,
                textfont: { family: 'Inter, sans-serif', size: 11, color: '#2563EB' },
                name: 'This Fund',
              },
            ]}
            layout={{
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              margin: { l: 90, r: 24, t: 24, b: 64 },
              height: 260,
              xaxis: {
                title: { text: 'Stage Focus', font: { size: 12 } },
                range: [0.5, 5.5],
                tickvals: [1, 2, 3, 4, 5],
                ticktext: ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Growth'],
                gridcolor: '#E5E7EB',
                tickfont: { size: 10 },
              },
              yaxis: {
                title: { text: 'Strategy Specialization', font: { size: 12 } },
                range: [0.5, 8.5],
                tickvals: [1, 2, 3, 4, 5, 6, 7, 8],
                ticktext: ['Generalist', 'Seed/Stage', 'Multi-Stage', 'Operator', 'AI', 'Climate', 'Deep Tech', 'Emerg Mkt'],
                gridcolor: '#E5E7EB',
                tickfont: { size: 10 },
              },
              showlegend: true,
              legend: { x: 1, y: 1, xanchor: 'right', font: { size: 10 } },
              font: { family: 'Inter, sans-serif', size: 11, color: '#374151' },
            }}
            config={baseConfig}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ width: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 42, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
              {score.toFixed(1)}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>/ 10</div>
          </div>

          <div style={{ width: '100%', fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: '#6B7280' }}>Exact overlaps: </span>
              <strong style={{ color: detail.exactMatch > 0 ? '#DC2626' : '#059669' }}>
                {detail.exactMatch}
              </strong>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: '#6B7280' }}>Strategy AUM: </span>
              <strong style={{ color: detail.stratConcentration > 0.30 ? '#D97706' : '#374151' }}>
                {(detail.stratConcentration * 100).toFixed(0)}%
              </strong>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: '#6B7280' }}>Vintage corr.: </span>
              <strong style={{ color: detail.vintageCorrelated >= 2 ? '#D97706' : '#374151' }}>
                {detail.vintageCorrelated}
              </strong>
            </div>
            {detail.warmReferralRate != null && (
              <div>
                <span style={{ color: '#6B7280' }}>Warm referral: </span>
                <strong style={{
                  color: detail.warmReferralRate >= 0.35 ? '#059669'
                    : detail.warmReferralRate >= 0.20 ? '#374151'
                    : '#D97706'
                }}>
                  {(detail.warmReferralRate * 100).toFixed(0)}%
                </strong>
              </div>
            )}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#6B7280', marginTop: 8, lineHeight: 1.6 }}>
        {overlapLabel}. {STRATEGY_LABELS[fund.strategy]} funds represent{' '}
        {(detail.stratConcentration * 100).toFixed(0)}% of committed AUM after adding this fund
        {detail.vintageCorrelated > 0
          ? ` — ${detail.vintageCorrelated} committed fund${detail.vintageCorrelated > 1 ? 's' : ''} share a similar strategy and vintage (return correlation risk).`
          : '.'}
      </p>
    </div>
  )
}
