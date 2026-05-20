import { useMemo } from 'react'
import Plot from '../ui/Plot'
import type { Fund } from '../../types/fund'
import { calcTeamPedigreeScore, calcTeamPedigreeDetail } from '../../utils/scoreEngine'
import { baseConfig } from '../../utils/plotlyTheme'

interface Props {
  fund: Fund
  allFunds: Fund[]
}

function logScore(years: number): number {
  return Math.min(10, (10 * Math.log2(years + 1)) / Math.log2(21))
}

function getDimensions(fund: Fund) {
  const team = (fund.team ?? []).filter(Boolean)
  if (team.length === 0) return [3, 3, 3, 3, 3]

  const prestige: Record<string, number> = {
    top_tier: 10, mid_tier: 7, emerging: 5, operator: 6,
  }

  const avg = (fn: (m: typeof team[0]) => number) =>
    team.reduce((s, m) => s + (fn(m) || 0), 0) / team.length

  return [
    Math.min(10, avg((m) => logScore(m.yearsVCExperience ?? 0))),
    avg((m) =>
      m.operatorBackground && (m.domainExpertiseScore ?? 0) >= 8 ? 9
      : m.operatorBackground ? 7
      : 4
    ),
    avg((m) => m.domainExpertiseScore ?? 5),
    Math.min(10, avg((m) => (m.yearsWorkingTogether ?? 0) * 1.2)),
    avg((m) => prestige[m.priorFirmTier ?? ''] ?? 5),
  ]
}

export default function TeamPedigreeModule({ fund, allFunds }: Props) {
  const { score, detail, fundDims, benchmarkDims } = useMemo(() => {
    const committed = allFunds.filter((f) => f.status === 'committed' && f.id !== fund.id)

    const fundDimsCalc = getDimensions(fund)
    const benchmarkDimsCalc =
      committed.length > 0
        ? getDimensions({ ...fund, team: committed.flatMap((f) => f.team) })
        : [5, 5, 5, 5, 5]

    return {
      score: calcTeamPedigreeScore(fund, allFunds),
      detail: calcTeamPedigreeDetail(fund),
      fundDims: fundDimsCalc,
      benchmarkDims: benchmarkDimsCalc,
    }
  }, [fund, allFunds])

  const scoreColor = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'
  const axes = ['VC Experience', 'Operator Bg', 'Domain Expert', 'Team Cohesion', 'Prior Prestige']

  const trackRecordParts: string[] = []
  if (!detail.isFirstTimeManager) {
    trackRecordParts.push(
      `Best fund: ${detail.bestNetIRR != null ? `${(detail.bestNetIRR * 100).toFixed(0)}% net IRR` : 'N/A'} / ${detail.bestTVPI != null ? `${detail.bestTVPI.toFixed(1)}× TVPI` : 'N/A'}`
    )
  }
  if (detail.hasOutlierFormation) trackRecordParts.push('Outlier forming (≥3×)')
  if (detail.dpiVsBenchmark === 'above') trackRecordParts.push('DPI above benchmark')
  if (detail.proactiveWriteDowns) trackRecordParts.push('Proactive write-downs ✓')
  const trackRecordText = detail.isFirstTimeManager
    ? 'First-time manager — no prior fund track record'
    : trackRecordParts.join(' • ')

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

        {/* Score + Signal Panel */}
        <div style={{ width: 160, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 42, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
              {score.toFixed(1)}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>/ 10</div>
          </div>

          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.7 }}>
            {detail.isFirstTimeManager && (
              <div
                style={{
                  marginBottom: 8,
                  padding: '3px 8px',
                  borderRadius: 4,
                  backgroundColor: '#FEE2E2',
                  color: '#991B1B',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                ⚠ First-time manager
              </div>
            )}
            {detail.isSoloGP && (
              <div
                style={{
                  marginBottom: 8,
                  padding: '3px 8px',
                  borderRadius: 4,
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                ⚡ Solo GP key-man risk
              </div>
            )}
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: '#6B7280' }}>Founding partners: </span>
              <strong>{detail.founderCount > 0 ? detail.founderCount : 'N/A'}</strong>
            </div>
            <div style={{ marginBottom: 6, fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>
              {trackRecordText}
            </div>

            {/* Co-investor validation */}
            {detail.coInvestorTier === 'tier1' && (
              <div style={{ marginBottom: 6, padding: '3px 8px', borderRadius: 4, backgroundColor: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 500 }}>
                🏆 Tier-1 co-investor validation
              </div>
            )}
            {detail.coInvestorTier === 'tier2' && (
              <div style={{ marginBottom: 6, padding: '3px 8px', borderRadius: 4, backgroundColor: '#F3F4F6', color: '#374151', fontSize: 11, fontWeight: 500 }}>
                ✓ Tier-2 co-investors
              </div>
            )}

            {/* IC governance */}
            {detail.icGovernanceRigorous === true && (
              <div style={{ marginBottom: 6, padding: '3px 8px', borderRadius: 4, backgroundColor: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 500 }}>
                ✅ Rigorous IC process
              </div>
            )}
            {detail.icGovernanceRigorous === false && (
              <div style={{ marginBottom: 6, padding: '3px 8px', borderRadius: 4, backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 500 }}>
                ⚠ Informal IC process
              </div>
            )}

            {/* Team retention */}
            {detail.teamDepartures === 0 && (
              <div style={{ marginBottom: 6, padding: '3px 8px', borderRadius: 4, backgroundColor: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 500 }}>
                ✅ Zero team departures
              </div>
            )}
            {detail.teamDepartures === 1 && (
              <div style={{ marginBottom: 6, padding: '3px 8px', borderRadius: 4, backgroundColor: '#F3F4F6', color: '#374151', fontSize: 11, fontWeight: 500 }}>
                ⚠ 1 team departure
              </div>
            )}
            {detail.teamDepartures != null && detail.teamDepartures >= 2 && (
              <div style={{ marginBottom: 6, padding: '3px 8px', borderRadius: 4, backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: 11, fontWeight: 500 }}>
                ⚠ {detail.teamDepartures} team departures
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Prior Fund Track Record ───────────────────────────────────── */}
      {(fund.priorFunds ?? []).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Prior Fund Track Record
          </p>

          {(fund.priorFunds ?? []).map((pf, fi) => {
            const companies = pf.portfolioCompanies ?? []
            const exits = companies
              .filter((c) => c.status === 'exited')
              .sort((a, b) => (b.exitMOIC ?? 0) - (a.exitMOIC ?? 0))
            const activeNotable = companies
              .filter((c) => c.status === 'active' && (c.currentMOIC ?? 0) >= 2)
              .sort((a, b) => (b.currentMOIC ?? 0) - (a.currentMOIC ?? 0))
            const writtenOffCount = companies.filter((c) => c.status === 'written_off' || c.status === 'written_down').length

            return (
              <div key={fi} style={{ marginBottom: 16, border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>

                {/* Fund header */}
                <div style={{ padding: '10px 14px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 6 }}>
                    {pf.fundName ?? `Fund ${fi + 1}`}
                    <span style={{ fontWeight: 400, color: '#6B7280', fontSize: 12, marginLeft: 8 }}>
                      {pf.vintageYear ? `${pf.vintageYear} vintage` : ''}
                      {pf.fundSize ? ` · $${pf.fundSize}M` : ''}
                      {pf.numberOfInvestments ? ` · ${pf.numberOfInvestments} investments` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12 }}>
                    {pf.netIRR != null && (
                      <div>
                        <span style={{ color: '#6B7280' }}>Net IRR </span>
                        <strong style={{ color: pf.netIRR >= 0.25 ? '#059669' : pf.netIRR >= 0.15 ? '#374151' : '#DC2626' }}>
                          {(pf.netIRR * 100).toFixed(0)}%
                        </strong>
                      </div>
                    )}
                    {pf.netTVPI != null && (
                      <div>
                        <span style={{ color: '#6B7280' }}>TVPI </span>
                        <strong>{pf.netTVPI.toFixed(2)}×</strong>
                      </div>
                    )}
                    {pf.DPI != null && (
                      <div>
                        <span style={{ color: '#6B7280' }}>DPI </span>
                        <strong style={{ color: pf.DPI >= 1.0 ? '#059669' : '#374151' }}>
                          {pf.DPI.toFixed(2)}×
                        </strong>
                      </div>
                    )}
                    {pf.RVPI != null && (
                      <div>
                        <span style={{ color: '#6B7280' }}>RVPI </span>
                        <strong>{pf.RVPI.toFixed(2)}×</strong>
                      </div>
                    )}
                    {pf.lossRatio != null && (
                      <div>
                        <span style={{ color: '#6B7280' }}>Loss ratio </span>
                        <strong style={{ color: pf.lossRatio > 0.45 ? '#DC2626' : '#374151' }}>
                          {(pf.lossRatio * 100).toFixed(0)}%
                        </strong>
                      </div>
                    )}
                    {pf.topCompanyConcentration != null && (
                      <div>
                        <span style={{ color: '#6B7280' }}>Top co. conc. </span>
                        <strong style={{ color: pf.topCompanyConcentration > 0.45 ? '#D97706' : '#374151' }}>
                          {(pf.topCompanyConcentration * 100).toFixed(0)}%
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Portfolio companies */}
                <div style={{ padding: '12px 14px' }}>

                  {/* Exits */}
                  {exits.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                        Exits ({exits.length})
                      </p>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                            {['Company', 'Sector', 'Stage', 'Entry → Exit', 'Exit MOIC'].map((h) => (
                              <th key={h} style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500, color: '#9CA3AF', textAlign: 'left', textTransform: 'uppercase' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {exits.map((c, ci) => {
                            const moic = c.exitMOIC ?? 0
                            const moicColor =
                              moic >= 10 ? '#B45309'
                              : moic >= 5 ? '#059669'
                              : moic >= 2 ? '#2563EB'
                              : '#6B7280'
                            const moicBg =
                              moic >= 10 ? '#FEF3C7'
                              : moic >= 5 ? '#D1FAE5'
                              : moic >= 2 ? '#DBEAFE'
                              : '#F3F4F6'
                            const moicLabel =
                              moic >= 10 ? `⭐ ${moic.toFixed(1)}×`
                              : moic >= 5 ? `🟢 ${moic.toFixed(1)}×`
                              : `${moic.toFixed(1)}×`
                            return (
                              <tr key={ci} style={{ borderBottom: '1px solid #F9FAFB' }}>
                                <td style={{ padding: '5px 8px', fontSize: 12, fontWeight: 500, color: '#111827' }}>{c.name}</td>
                                <td style={{ padding: '5px 8px', fontSize: 11, color: '#6B7280' }}>{c.sector ?? '—'}</td>
                                <td style={{ padding: '5px 8px', fontSize: 11, color: '#6B7280' }}>{c.entryStage ?? '—'}</td>
                                <td style={{ padding: '5px 8px', fontSize: 11, color: '#6B7280' }}>
                                  {c.entryYear ?? '?'}{c.exitYear ? ` → ${c.exitYear}` : ''}
                                </td>
                                <td style={{ padding: '5px 8px' }}>
                                  <span style={{ padding: '2px 8px', borderRadius: 4, backgroundColor: moicBg, color: moicColor, fontSize: 12, fontWeight: 700 }}>
                                    {moicLabel}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Active notable positions */}
                  {activeNotable.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                        Active — Notable Positions (≥2× current MOIC)
                      </p>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                            {['Company', 'Sector', 'Stage', 'Entry Year', 'Current MOIC'].map((h) => (
                              <th key={h} style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500, color: '#9CA3AF', textAlign: 'left', textTransform: 'uppercase' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeNotable.map((c, ci) => {
                            const moic = c.currentMOIC ?? 0
                            const moicColor = moic >= 5 ? '#059669' : moic >= 3 ? '#2563EB' : '#374151'
                            return (
                              <tr key={ci} style={{ borderBottom: '1px solid #F9FAFB' }}>
                                <td style={{ padding: '5px 8px', fontSize: 12, fontWeight: 500, color: '#111827' }}>{c.name}</td>
                                <td style={{ padding: '5px 8px', fontSize: 11, color: '#6B7280' }}>{c.sector ?? '—'}</td>
                                <td style={{ padding: '5px 8px', fontSize: 11, color: '#6B7280' }}>{c.entryStage ?? '—'}</td>
                                <td style={{ padding: '5px 8px', fontSize: 11, color: '#6B7280' }}>{c.entryYear ?? '—'}</td>
                                <td style={{ padding: '5px 8px', fontSize: 12, fontWeight: 600, color: moicColor }}>
                                  {moic.toFixed(1)}×
                                  <span style={{ fontSize: 10, fontWeight: 400, color: '#9CA3AF', marginLeft: 4 }}>(unrealised)</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Write-off count */}
                  {writtenOffCount > 0 && (
                    <p style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
                      ✗ {writtenOffCount} write-off{writtenOffCount > 1 ? 's' : ''} in portfolio
                    </p>
                  )}

                  {/* No company data */}
                  {companies.length === 0 && (
                    <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>
                      No portfolio company data — upload a quarterly LP update for this fund to see individual positions
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
                const isFounder = member.isFoundingPartner
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: isFounder ? '#F0F9FF' : 'transparent' }}>
                    <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 500, color: '#111827' }}>
                      {isFounder && <span style={{ color: '#F59E0B', marginRight: 4 }}>★</span>}
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
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>★ Founding partner</p>
        </div>
      )}
    </div>
  )
}
