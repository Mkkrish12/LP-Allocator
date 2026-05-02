import { useMemo } from 'react'
import Plot from '../ui/Plot'
import type { Fund, FundStrategy } from '../../types/fund'
import { STRATEGY_LABELS } from '../../types/fund'
import { calcVintageScore } from '../../utils/scoreEngine'
import { baseConfig } from '../../utils/plotlyTheme'

interface Props {
  fund: Fund
  allFunds: Fund[]
}

const STRATEGIES: FundStrategy[] = [
  'seed_vc', 'series_a', 'multi_stage', 'ai_focused', 'climate_tech',
  'sector_agnostic', 'deep_tech', 'emerging_markets', 'operator_led', 'solo_gp',
]
const VINTAGES = [2019, 2020, 2021, 2022, 2023]

function median(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

export default function VintageHeatmapModule({ fund, allFunds }: Props) {
  const { score, zData, annotations } = useMemo(() => {
    const bucket: Record<string, number[]> = {}
    STRATEGIES.forEach((s) =>
      VINTAGES.forEach((v) => { bucket[`${s}_${v}`] = [] })
    )

    allFunds
      .filter((f) => f.status === 'committed' && VINTAGES.includes(f.vintageYear))
      .forEach((f) => {
        const key = `${f.strategy}_${f.vintageYear}`
        const bestIRR =
          f.priorFunds.length > 0
            ? Math.max(...f.priorFunds.map((pf) => pf.netIRR))
            : 0.15
        if (bucket[key]) bucket[key].push(bestIRR)
      })

    const z: (number | null)[][] = STRATEGIES.map((s) =>
      VINTAGES.map((v) => {
        const vals = bucket[`${s}_${v}`]
        return vals.length > 0 ? median(vals) : null
      })
    )

    const annots: Partial<Plotly.Annotations>[] = []
    const fundStratIdx = STRATEGIES.indexOf(fund.strategy)
    const fundVintageIdx = VINTAGES.indexOf(fund.vintageYear)

    if (fundStratIdx >= 0 && fundVintageIdx >= 0) {
      annots.push({
        x: fundVintageIdx,
        y: fundStratIdx,
        text: '★',
        font: { size: 16, color: '#FFFFFF' },
        showarrow: false,
      })
    }

    return {
      score: calcVintageScore(fund, allFunds),
      zData: z,
      annotations: annots,
    }
  }, [fund, allFunds])

  const scoreColor = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'
  const cellValue =
    zData[STRATEGIES.indexOf(fund.strategy)]?.[VINTAGES.indexOf(fund.vintageYear)]

  return (
    <div>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <Plot
            data={[
              {
                type: 'heatmap',
                z: zData,
                x: VINTAGES.map(String),
                y: STRATEGIES.map((s) => STRATEGY_LABELS[s]),
                colorscale: [
                  [0, '#DC2626'],
                  [0.5, '#D97706'],
                  [1, '#059669'],
                ],
                showscale: true,
                colorbar: {
                  title: { text: 'Median Net IRR', side: 'right' },
                  tickformat: '.0%',
                  thickness: 12,
                  len: 0.8,
                },
                hovertemplate: '%{y} %{x}: %{z:.1%} Net IRR<extra></extra>',
                zmin: 0,
                zmax: 0.5,
              } as Plotly.PlotData,
            ]}
            layout={{
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              margin: { l: 120, r: 80, t: 24, b: 48 },
              height: 280,
              annotations,
              xaxis: {
                tickfont: { size: 11, color: '#374151' },
              },
              yaxis: {
                tickfont: { size: 10, color: '#374151' },
              },
              font: { family: 'Inter, sans-serif', size: 11, color: '#374151' },
            }}
            config={baseConfig}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ width: 130, flexShrink: 0, textAlign: 'center', paddingTop: 24 }}>
          <div style={{ fontSize: 42, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
            {score.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>/ 10</div>
          {cellValue != null && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
                {(cellValue * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: '#6B7280' }}>median net IRR for this cell</div>
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#6B7280', marginTop: 8, lineHeight: 1.6 }}>
        {STRATEGY_LABELS[fund.strategy]} funds from {fund.vintageYear} have returned a median{' '}
        {cellValue != null ? `${(cellValue * 100).toFixed(1)}%` : 'N/A'} net IRR historically.
        ★ marks this fund's strategy-vintage position on the heatmap.
      </p>
    </div>
  )
}
