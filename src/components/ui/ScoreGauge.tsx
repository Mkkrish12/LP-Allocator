import Plot from './Plot'
import type { ModuleScores, Recommendation } from '../../types/fund'
import { WEIGHTS } from '../../utils/scoreEngine'

interface ScoreGaugeProps {
  overall: number
  scores: ModuleScores
  recommendation: Recommendation
}

const MODULE_LABELS: Record<keyof typeof WEIGHTS, string> = {
  fundMath: 'Fund Math',
  teamPedigree: 'Team Pedigree',
  strategyDifferentiation: 'Strategy Fit',
  termsFairness: 'Terms',
  portfolioFit: 'Portfolio Fit',
  vintageTiming: 'Vintage Timing',
}

export default function ScoreGauge({ overall, scores, recommendation }: ScoreGaugeProps) {
  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      {/* Gauge */}
      <div style={{ flexShrink: 0 }}>
        <Plot
          data={[
            {
              type: 'indicator',
              mode: 'gauge+number',
              value: overall,
              number: {
                font: { family: 'Inter, sans-serif', size: 36, color: '#111827' },
                suffix: '/10',
              },
              gauge: {
                axis: {
                  range: [0, 10],
                  tickwidth: 1,
                  tickcolor: '#E5E7EB',
                  tickfont: { family: 'Inter, sans-serif', size: 10, color: '#9CA3AF' },
                  nticks: 6,
                },
                bar: { color: recommendation.color, thickness: 0.25 },
                bgcolor: '#F3F4F6',
                borderwidth: 0,
                steps: [
                  { range: [0, 5], color: '#FEE2E2' },
                  { range: [5, 6.5], color: '#FEF3C7' },
                  { range: [6.5, 8], color: '#DBEAFE' },
                  { range: [8, 10], color: '#D1FAE5' },
                ],
              },
            },
          ]}
          layout={{
            width: 200,
            height: 160,
            paper_bgcolor: 'transparent',
            margin: { l: 16, r: 16, t: 16, b: 8 },
            font: { family: 'Inter, sans-serif' },
          }}
          config={{ displayModeBar: false, responsive: false }}
        />
        <div style={{ textAlign: 'center', marginTop: -8 }}>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: recommendation.color,
            }}
          >
            {recommendation.label}
          </span>
          <p style={{ fontSize: 11, color: '#6B7280', marginTop: 6, maxWidth: 180 }}>
            {recommendation.description}
          </p>
        </div>
      </div>

      {/* Dimension bars */}
      <div style={{ flex: 1, paddingTop: 8 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: '#6B7280',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Score Breakdown
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((key) => {
            const score = scores[key]
            const weight = WEIGHTS[key]
            const contribution = score * weight
            return (
              <div key={key}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: '#374151' }}>
                    {MODULE_LABELS[key]}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      ×{(weight * 100).toFixed(0)}%
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', minWidth: 24 }}>
                      {score.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#F3F4F6',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(contribution / 2.5) * 100}%`,
                      backgroundColor:
                        score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626',
                      borderRadius: 3,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
