import { useMemo } from 'react'
import Plot from '../ui/Plot'
import type { Fund } from '../../types/fund'
import { STRATEGY_LABELS, STAGE_LABELS } from '../../types/fund'
import { calcPortfolioFitScore } from '../../utils/scoreEngine'
import { baseConfig, COLORWAY } from '../../utils/plotlyTheme'

interface Props {
  fund: Fund
  allFunds: Fund[]
}

function countBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {}
  arr.forEach((item) => {
    const k = key(item)
    result[k] = (result[k] ?? 0) + 1
  })
  return result
}

function makePieData(counts: Record<string, number>, labels: (k: string) => string) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return {
    labels: entries.map(([k]) => labels(k)),
    values: entries.map(([, v]) => v),
  }
}

export default function PortfolioFitModule({ fund, allFunds }: Props) {
  const { score, stageBefore, stageAfter, stratBefore, stratAfter, vintageBefore, vintageAfter } =
    useMemo(() => {
      const committed = allFunds.filter((f) => f.status === 'committed')
      const withNew = [...committed, fund]

      const stageBef = countBy(committed, (f) => f.stageF)
      const stageAft = countBy(withNew, (f) => f.stageF)

      const stratBef = countBy(committed, (f) => f.strategy)
      const stratAft = countBy(withNew, (f) => f.strategy)

      const vinBef = countBy(committed, (f) => String(f.vintageYear))
      const vinAft = countBy(withNew, (f) => String(f.vintageYear))

      return {
        score: calcPortfolioFitScore(fund, allFunds),
        stageBefore: makePieData(stageBef, (k) => STAGE_LABELS[k as keyof typeof STAGE_LABELS] ?? k),
        stageAfter: makePieData(stageAft, (k) => STAGE_LABELS[k as keyof typeof STAGE_LABELS] ?? k),
        stratBefore: makePieData(stratBef, (k) => STRATEGY_LABELS[k as keyof typeof STRATEGY_LABELS] ?? k),
        stratAfter: makePieData(stratAft, (k) => STRATEGY_LABELS[k as keyof typeof STRATEGY_LABELS] ?? k),
        vintageBefore: makePieData(vinBef, (k) => k),
        vintageAfter: makePieData(vinAft, (k) => k),
      }
    }, [fund, allFunds])

  const scoreColor = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'

  function DonutPair({
    title,
    before,
    after,
  }: {
    title: string
    before: { labels: string[]; values: number[] }
    after: { labels: string[]; values: number[] }
  }) {
    return (
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            textAlign: 'center',
            marginBottom: 4,
          }}
        >
          {title}
        </p>
        <div style={{ display: 'flex', gap: 0 }}>
          {[before, after].map((data, i) => (
            <div key={i} style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginBottom: 2 }}>
                {i === 0 ? 'Before' : 'After'}
              </p>
              <Plot
                data={[
                  {
                    type: 'pie',
                    labels: data.labels,
                    values: data.values,
                    hole: 0.5,
                    textinfo: 'none',
                    hovertemplate: '%{label}: %{percent}<extra></extra>',
                    marker: { colors: COLORWAY },
                  },
                ]}
                layout={{
                  paper_bgcolor: 'transparent',
                  margin: { l: 8, r: 8, t: 8, b: 8 },
                  height: 130,
                  showlegend: false,
                  font: { family: 'Inter, sans-serif', size: 10 },
                }}
                config={baseConfig}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <DonutPair title="Stage Mix" before={stageBefore} after={stageAfter} />
        <DonutPair title="Strategy Mix" before={stratBefore} after={stratAfter} />
        <DonutPair title="Vintage Mix" before={vintageBefore} after={vintageAfter} />

        <div style={{ width: 100, flexShrink: 0, textAlign: 'center', paddingTop: 24 }}>
          <div style={{ fontSize: 36, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
            {score.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>/ 10</div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#6B7280', marginTop: 8, lineHeight: 1.6 }}>
        Adding this fund {score >= 7 ? 'improves' : score >= 5 ? 'maintains' : 'reduces'} portfolio
        diversification. {STRATEGY_LABELS[fund.strategy]} at {STAGE_LABELS[fund.stageF]} stage is{' '}
        {score >= 7 ? 'underrepresented' : score >= 5 ? 'moderately represented' : 'already well-represented'} in
        your committed portfolio.
      </p>
    </div>
  )
}
