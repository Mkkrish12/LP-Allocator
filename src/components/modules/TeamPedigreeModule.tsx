import { useMemo } from 'react'
import Plot from '../ui/Plot'
import type { Fund } from '../../types/fund'
import { calcTeamPedigreeScore } from '../../utils/scoreEngine'
import { baseConfig } from '../../utils/plotlyTheme'

interface Props {
  fund: Fund
  allFunds: Fund[]
}

function getDimensions(fund: Fund) {
  const team = fund.team?.filter(Boolean) ?? []
  if (team.length === 0) return [3, 3, 3, 3, 3]

  const prestige: Record<string, number> = {
    top_tier: 10, mid_tier: 7, emerging: 5, operator: 6,
  }

  const avg = (fn: (m: typeof team[0]) => number) =>
    team.reduce((s, m) => s + (fn(m) || 0), 0) / team.length

  return [
    Math.min(10, avg((m) => (m.yearsVCExperience ?? 0) * 0.8)),
    avg((m) => (m.operatorBackground ? 8 : 4)),
    avg((m) => m.domainExpertiseScore ?? 5),
    Math.min(10, avg((m) => (m.yearsWorkingTogether ?? 0) * 1.5)),
    avg((m) => prestige[m.priorFirmTier ?? ''] ?? 5),
  ]
}

export default function TeamPedigreeModule({ fund, allFunds }: Props) {
  const { score, fundDims, benchmarkDims } = useMemo(() => {
    const committed = allFunds.filter((f) => f.status === 'committed' && f.id !== fund.id)

    const fundDimsCalc = getDimensions(fund)

    const benchmarkDimsCalc =
      committed.length > 0
        ? getDimensions({
            ...fund,
            team: committed.flatMap((f) => f.team),
          })
        : [5, 5, 5, 5, 5]

    return {
      score: calcTeamPedigreeScore(fund, allFunds),
      fundDims: fundDimsCalc,
      benchmarkDims: benchmarkDimsCalc,
    }
  }, [fund, allFunds])

  const scoreColor = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'

  const axes = ['VC Experience', 'Operator Bg', 'Domain Expert', 'Team Cohesion', 'Prior Prestige']

  return (
    <div>
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Radar Chart */}
        <div style={{ flex: 1 }}>
          <Plot
            data={[
              {
                type: 'scatterpolar',
                r: [...fundDims, fundDims[0]],
                theta: [...axes, axes[0]],
                fill: 'toself',
                fillcolor: 'rgba(37,99,235,0.15)',
                line: { color: '#2563EB', width: 2 },
                name: fund.fundName,
              },
              {
                type: 'scatterpolar',
                r: [...benchmarkDims, benchmarkDims[0]],
                theta: [...axes, axes[0]],
                fill: 'none',
                line: { color: '#1B2A4A', width: 1.5, dash: 'dash' },
                name: 'Portfolio Avg',
              },
            ]}
            layout={{
              polar: {
                radialaxis: {
                  visible: true,
                  range: [0, 10],
                  tickfont: { size: 9, color: '#9CA3AF' },
                  gridcolor: '#E5E7EB',
                },
                angularaxis: {
                  tickfont: { size: 10, color: '#374151' },
                  gridcolor: '#E5E7EB',
                },
                bgcolor: 'transparent',
              },
              paper_bgcolor: 'transparent',
              margin: { l: 48, r: 48, t: 24, b: 24 },
              height: 240,
              showlegend: true,
              legend: {
                x: 0.5,
                y: -0.1,
                xanchor: 'center',
                orientation: 'h',
                font: { family: 'Inter, sans-serif', size: 11 },
              },
              font: { family: 'Inter, sans-serif', size: 11, color: '#374151' },
            }}
            config={baseConfig}
            style={{ width: '100%' }}
          />
        </div>

        {/* Score */}
        <div style={{ width: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 24 }}>
          <div style={{ fontSize: 42, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
            {score.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>/ 10</div>
        </div>
      </div>

      {/* Team Table */}
      {fund.team && fund.team.length > 0 && (
        <div style={{ marginTop: 16, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Name', 'Title', 'Yrs VC', 'Prior Firm', 'Notable Deals'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '6px 10px',
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#6B7280',
                      textAlign: 'left',
                      textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(fund.team ?? []).map((member, i) => {
                const tier = member.priorFirmTier ?? 'emerging'
                const deals = member.notableDeals ?? []
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 500, color: '#111827' }}>
                      {member.name ?? '—'}
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: 12, color: '#374151' }}>
                      {member.title ?? '—'}
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: 12, color: '#374151' }}>
                      {member.yearsVCExperience ?? 0}y
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: 12, color: '#374151' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: tier === 'top_tier' ? '#DBEAFE' : '#F3F4F6',
                          color: tier === 'top_tier' ? '#1D4ED8' : '#374151',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {tier.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: 12, color: '#6B7280' }}>
                      {deals.join(', ') || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
