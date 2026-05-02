import { useMemo } from 'react'
import type { Fund } from '../../types/fund'
import { calcTermsScore } from '../../utils/scoreEngine'

interface Props {
  fund: Fund
  allFunds: Fund[]
}

type Flag = 'lp' | 'market' | 'gp'

interface TermRow {
  label: string
  thisValue: string
  portfolioAvg: string
  ilpaStandard: string
  flag: Flag
}

function flagColor(flag: Flag) {
  if (flag === 'lp') return { bg: '#D1FAE5', color: '#065F46', label: '🟢 LP-Favorable' }
  if (flag === 'market') return { bg: '#FEF3C7', color: '#92400E', label: '🟡 At Market' }
  return { bg: '#FEE2E2', color: '#991B1B', label: '🔴 GP-Favorable' }
}

function pct(v: number) { return `${(v * 100).toFixed(2)}%` }
function dollar(v: number) { return `$${v.toFixed(1)}M` }

export default function TermsBenchmarkModule({ fund, allFunds }: Props) {
  const { score, rows, gpFavorableCount, negotiationPoints } = useMemo(() => {
    const t = fund.terms
    const committed = allFunds.filter((f) => f.status === 'committed')

    const avgFee =
      committed.length > 0
        ? committed.reduce((s, f) => s + f.terms.managementFee, 0) / committed.length
        : 0.02
    const avgCarry =
      committed.length > 0
        ? committed.reduce((s, f) => s + f.terms.carry, 0) / committed.length
        : 0.20
    const avgHurdle =
      committed.length > 0
        ? committed.reduce((s, f) => s + f.terms.hurdleRate, 0) / committed.length
        : 0.08
    const avgGPCommit =
      committed.length > 0
        ? committed.reduce((s, f) => s + f.terms.gpCommitPercent, 0) / committed.length
        : 0.025

    const calcRows: TermRow[] = [
      {
        label: 'Management Fee',
        thisValue: pct(t.managementFee) + (t.managementFeeStepDown ? ` → ${pct(t.stepDownRate ?? 0.015)} (yr ${t.stepDownYear ?? 5})` : ''),
        portfolioAvg: pct(avgFee),
        ilpaStandard: '2.0% (1.75% w/ step-down)',
        flag: t.managementFee <= 0.0175 ? 'lp' : t.managementFee <= 0.02 ? 'market' : 'gp',
      },
      {
        label: 'Carried Interest',
        thisValue: pct(t.carry),
        portfolioAvg: pct(avgCarry),
        ilpaStandard: '20%',
        flag: t.carry < 0.20 ? 'lp' : t.carry === 0.20 ? 'market' : 'gp',
      },
      {
        label: 'Hurdle Rate',
        thisValue: t.hurdleRate > 0 ? pct(t.hurdleRate) : 'None',
        portfolioAvg: pct(avgHurdle),
        ilpaStandard: '8%',
        flag: t.hurdleRate >= 0.08 ? 'lp' : t.hurdleRate > 0 ? 'market' : 'gp',
      },
      {
        label: 'GP Commit',
        thisValue: `${dollar(t.gpCommit)} (${pct(t.gpCommitPercent)})`,
        portfolioAvg: pct(avgGPCommit),
        ilpaStandard: '2% of fund',
        flag: t.gpCommitPercent >= 0.03 ? 'lp' : t.gpCommitPercent >= 0.02 ? 'market' : 'gp',
      },
      {
        label: 'Distribution Waterfall',
        thisValue: t.distributionWaterfall === 'european' ? 'European (Deal-by-Deal)' : 'American (Fund-Level)',
        portfolioAvg: 'Mixed',
        ilpaStandard: 'European',
        flag: t.distributionWaterfall === 'european' ? 'lp' : 'gp',
      },
      {
        label: 'Key Person Definition',
        thisValue: t.keyPersonDefinition,
        portfolioAvg: 'Named individuals',
        ilpaStandard: 'Named individuals',
        flag: t.keyPersonDefinition.toLowerCase().includes('named:') ? 'lp' : t.keyPersonDefinition.toLowerCase().includes('role') ? 'gp' : 'market',
      },
      {
        label: 'GP Removal Threshold',
        thisValue: `${(t.gpRemovalThreshold * 100).toFixed(0)}% LP vote`,
        portfolioAvg: '67-75%',
        ilpaStandard: '≤75%',
        flag: t.gpRemovalThreshold <= 0.67 ? 'lp' : t.gpRemovalThreshold <= 0.75 ? 'market' : 'gp',
      },
    ]

    const gpCount = calcRows.filter((r) => r.flag === 'gp').length
    const nego = calcRows.filter((r) => r.flag === 'gp').map((r) => r.label)

    return {
      score: calcTermsScore(fund),
      rows: calcRows,
      gpFavorableCount: gpCount,
      negotiationPoints: nego,
    }
  }, [fund, allFunds])

  const scoreColor = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'

  return (
    <div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Term', 'This Fund', 'Portfolio Avg', 'ILPA Standard', 'Flag'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 10px',
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
              {rows.map((row) => {
                const fc = flagColor(row.flag)
                return (
                  <tr key={row.label} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 500, color: '#374151' }}>
                      {row.label}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        fontSize: 12,
                        color: fc.color,
                        backgroundColor: fc.bg,
                        fontWeight: 500,
                      }}
                    >
                      {row.thisValue}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 12, color: '#374151' }}>
                      {row.portfolioAvg}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 12, color: '#374151' }}>
                      {row.ilpaStandard}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 11 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 9999,
                          backgroundColor: fc.bg,
                          color: fc.color,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fc.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Score */}
        <div style={{ width: 130, flexShrink: 0, textAlign: 'center', paddingTop: 16 }}>
          <div style={{ fontSize: 42, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
            {score.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>/ 10</div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#6B7280', marginTop: 12, lineHeight: 1.6 }}>
        This fund has {gpFavorableCount} GP-favorable term{gpFavorableCount !== 1 ? 's' : ''}.
        {negotiationPoints.length > 0
          ? ` Key negotiation opportunities: ${negotiationPoints.join(', ')}.`
          : ' Terms are broadly LP-friendly.'}
      </p>
    </div>
  )
}
