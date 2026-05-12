import { useMemo, useState } from 'react'
import Plot from '../components/ui/Plot'
import { useFundStore } from '../store/fundStore'
import type { Fund } from '../types/fund'
import Header from '../components/ui/Header'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { COLORWAY, compareConfig, mergeLayout } from '../utils/plotlyTheme'
import { X, GitCompare } from 'lucide-react'

const STAGE_MAP: Record<string, number> = {
  pre_seed: 1, seed: 2, series_a: 3, series_b: 4, growth: 5, multi_stage: 3,
}

function cellStyle(value: number, values: number[], higherIsBetter: boolean): React.CSSProperties {
  const sorted = [...values].sort((a, b) => a - b)
  const rank = sorted.indexOf(value)
  const pct = values.length > 1 ? rank / (values.length - 1) : 0.5
  const score = higherIsBetter ? pct : 1 - pct
  if (score >= 0.7) return { backgroundColor: '#D1FAE5', color: '#065F46' }
  if (score <= 0.3) return { backgroundColor: '#FEE2E2', color: '#991B1B' }
  return { backgroundColor: '#FEF3C7', color: '#92400E' }
}

export default function CompareFunds() {
  const { funds, selectedFundIds } = useFundStore()
  const [localSelected, setLocalSelected] = useState<string[]>(selectedFundIds)

  const compareFunds: Fund[] = useMemo(
    () => localSelected.map((id) => funds.find((f) => f.id === id)).filter(Boolean) as Fund[],
    [localSelected, funds]
  )

  function toggleLocal(id: string) {
    setLocalSelected((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : prev.length < 5
        ? [...prev, id]
        : prev
    )
  }

  const fundColors = COLORWAY.slice(0, compareFunds.length)

  type TermRow = { label: string; ilpa: string; values: number[]; fmt: (v: number, f?: Fund) => string; good: (v: number) => string }
  const termRows: TermRow[] = [
    { label: 'Mgmt Fee', ilpa: '2.0%', values: compareFunds.map((f) => f.terms.managementFee), fmt: (v) => `${(v * 100).toFixed(2)}%`, good: (v) => v <= 0.0175 ? 'lp' : v <= 0.02 ? 'market' : 'gp' },
    { label: 'Carry', ilpa: '20%', values: compareFunds.map((f) => f.terms.carry), fmt: (v) => `${(v * 100).toFixed(0)}%`, good: (v) => v < 0.20 ? 'lp' : v === 0.20 ? 'market' : 'gp' },
    { label: 'Hurdle Rate', ilpa: '8%', values: compareFunds.map((f) => f.terms.hurdleRate), fmt: (v) => v > 0 ? `${(v * 100).toFixed(0)}%` : 'None', good: (v) => v >= 0.08 ? 'lp' : v > 0 ? 'market' : 'gp' },
    { label: 'GP Commit', ilpa: '2%', values: compareFunds.map((f) => f.terms.gpCommitPercent), fmt: (v) => `${(v * 100).toFixed(1)}%`, good: (v) => v >= 0.03 ? 'lp' : v >= 0.02 ? 'market' : 'gp' },
    { label: 'Waterfall', ilpa: 'European', values: compareFunds.map((f) => f.terms.distributionWaterfall === 'european' ? 1 : 0), fmt: (_v, f) => (f?.terms.distributionWaterfall === 'european' ? 'European' : 'American'), good: (v) => v === 1 ? 'lp' : 'gp' },
  ]

  function getBest(f: Fund, key: 'netIRR' | 'netTVPI' | 'DPI') {
    if (!f.priorFunds.length) return 0
    return Math.max(...f.priorFunds.map((pf) => pf[key]))
  }

  if (compareFunds.length < 2) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title="Compare Funds" />
        <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          {/* Selector */}
          <Card title="Select Funds to Compare" style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              Select 2–5 funds from your library to compare side by side.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {localSelected.map((id) => {
                const f = funds.find((f) => f.id === id)
                return f ? (
                  <span
                    key={id}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 9999,
                      backgroundColor: '#2563EB',
                      fontSize: 12,
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {f.fundName.split(' ').slice(0, 3).join(' ')}
                    <button
                      onClick={() => toggleLocal(id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFFFFF', padding: 0, display: 'flex' }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ) : null
              })}
            </div>
            <select
              onChange={(e) => { if (e.target.value) toggleLocal(e.target.value) }}
              value=""
              style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'Inter, sans-serif' }}
            >
              <option value="">Add a fund...</option>
              {funds
                .filter((f) => !localSelected.includes(f.id))
                .map((f) => (
                  <option key={f.id} value={f.id}>{f.fundName}</option>
                ))}
            </select>
          </Card>
          <Card>
            <EmptyState
              icon={<GitCompare size={28} />}
              title="Select at least 2 funds"
              description="Choose 2–5 funds from the dropdown above to see a full side-by-side comparison."
            />
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header title="Compare Funds" subtitle={`Comparing ${compareFunds.length} funds`} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        {/* Fund Selector Chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          {compareFunds.map((f, i) => (
            <span
              key={f.id}
              style={{
                padding: '6px 14px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 500,
                color: '#FFFFFF',
                backgroundColor: fundColors[i],
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {f.fundName.split(' ').slice(0, 3).join(' ')}
              <button
                onClick={() => toggleLocal(f.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFFFFF', padding: 0, display: 'flex' }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <select
            onChange={(e) => { if (e.target.value) toggleLocal(e.target.value) }}
            value=""
            style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
          >
            <option value="">+ Add fund</option>
            {funds.filter((f) => !localSelected.includes(f.id)).map((f) => (
              <option key={f.id} value={f.id}>{f.fundName}</option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={() => setLocalSelected([])}>Clear all</Button>
        </div>

        {/* Section 1: At a Glance */}
        <Card title="At a Glance" style={{ marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '8px 10px', fontSize: 11, color: '#6B7280', textAlign: 'left', textTransform: 'uppercase' }}>Metric</th>
                {compareFunds.map((f, i) => (
                  <th key={f.id} style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, color: fundColors[i], textAlign: 'center' }}>
                    {f.fundName.split(' ').slice(0, 3).join(' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Vintage', values: compareFunds.map((f) => f.vintageYear), fmt: (v: number) => String(v), higherBetter: true },
                { label: 'Fund Size ($M)', values: compareFunds.map((f) => f.fundSize), fmt: (v: number) => `$${v}M`, higherBetter: true },
                { label: 'Best Net IRR', values: compareFunds.map((f) => getBest(f, 'netIRR')), fmt: (v: number) => `${(v * 100).toFixed(1)}%`, higherBetter: true },
                { label: 'Best TVPI', values: compareFunds.map((f) => getBest(f, 'netTVPI')), fmt: (v: number) => `${v.toFixed(2)}x`, higherBetter: true },
                { label: 'Best DPI', values: compareFunds.map((f) => getBest(f, 'DPI')), fmt: (v: number) => `${v.toFixed(2)}x`, higherBetter: true },
                { label: 'Overall Score', values: compareFunds.map((f) => f.scores.overall), fmt: (v: number) => v.toFixed(1), higherBetter: true },
              ].map((row) => (
                <tr key={row.label} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 10px', fontSize: 12, fontWeight: 500, color: '#374151' }}>{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, textAlign: 'center', ...cellStyle(v, row.values, row.higherBetter) }}>
                      {row.fmt(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Section 2: Track Record Comparison */}
        <Card title="Track Record Comparison" style={{ marginBottom: 24 }}>
          <Plot
            data={['netIRR', 'netTVPI', 'DPI'].flatMap((metric, mi) =>
              compareFunds.map((f, fi) => ({
                type: 'bar' as const,
                name: fi === 0 ? metric.replace('net', 'Net ') : undefined,
                x: [metric.replace('net', 'Net ')],
                y: [getBest(f, metric as 'netIRR' | 'netTVPI' | 'DPI')],
                marker: { color: fundColors[fi] },
                legendgroup: f.fundName,
                showlegend: mi === 0,
                text: f.fundName.split(' ').slice(0, 2).join(' '),
                textposition: 'none' as const,
                hovertemplate: `${f.fundName}<br>${metric}: %{y:.2f}<extra></extra>`,
              }))
            )}
            layout={mergeLayout({
              height: 260,
              barmode: 'group',
              xaxis: { ...mergeLayout({}).xaxis, title: undefined },
              yaxis: { ...mergeLayout({}).yaxis, title: { text: 'Value', font: { size: 12 } } },
              legend: { x: 1, y: 1, xanchor: 'right', font: { size: 10 } },
            })}
            config={compareConfig}
            style={{ width: '100%' }}
          />
        </Card>

        {/* Section 3: Team Comparison Radar */}
        <Card title="Team Comparison" style={{ marginBottom: 24 }}>
          <Plot
            data={compareFunds.map((f, i) => {
              const prestige: Record<string, number> = { top_tier: 10, mid_tier: 7, emerging: 5, operator: 6 }
              const avg = (fn: (m: typeof f.team[0]) => number) =>
                f.team.length > 0 ? f.team.reduce((s, m) => s + fn(m), 0) / f.team.length : 3
              const dims = [
                Math.min(10, avg((m) => m.yearsVCExperience * 0.8)),
                avg((m) => (m.operatorBackground ? 8 : 4)),
                avg((m) => m.domainExpertiseScore),
                Math.min(10, avg((m) => m.yearsWorkingTogether * 1.5)),
                avg((m) => prestige[m.priorFirmTier] ?? 5),
              ]
              const axes = ['VC Experience', 'Operator Bg', 'Domain Expert', 'Cohesion', 'Prestige']
              return {
                type: 'scatterpolar' as const,
                r: [...dims, dims[0]],
                theta: [...axes, axes[0]],
                fill: 'toself' as const,
                fillcolor: fundColors[i] + '22',
                line: { color: fundColors[i], width: 2 },
                name: f.fundName.split(' ').slice(0, 2).join(' '),
              }
            })}
            layout={{
              polar: {
                radialaxis: { visible: true, range: [0, 10], tickfont: { size: 9, color: '#9CA3AF' }, gridcolor: '#E5E7EB' },
                angularaxis: { tickfont: { size: 10, color: '#374151' }, gridcolor: '#E5E7EB' },
                bgcolor: 'transparent',
              },
              paper_bgcolor: 'transparent',
              margin: { l: 48, r: 48, t: 24, b: 24 },
              height: 280,
              showlegend: true,
              legend: { x: 1, y: 1, xanchor: 'right', font: { size: 10 } },
              font: { family: 'Inter, sans-serif', size: 11, color: '#374151' },
            }}
            config={compareConfig}
            style={{ width: '100%' }}
          />
        </Card>

        {/* Section 4: Terms Side-by-Side */}
        <Card title="Terms Comparison vs ILPA Standards" style={{ marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '8px 10px', fontSize: 11, color: '#6B7280', textAlign: 'left', textTransform: 'uppercase' }}>Term</th>
                <th style={{ padding: '8px 10px', fontSize: 11, color: '#6B7280', textAlign: 'center', textTransform: 'uppercase' }}>ILPA Standard</th>
                {compareFunds.map((f, i) => (
                  <th key={f.id} style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, color: fundColors[i], textAlign: 'center' }}>
                    {f.fundName.split(' ').slice(0, 3).join(' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {termRows.map((row) => (
                <tr key={row.label} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 10px', fontSize: 12, fontWeight: 500, color: '#374151' }}>{row.label}</td>
                  <td style={{ padding: '10px 10px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>{row.ilpa}</td>
                  {compareFunds.map((f, i) => {
                    const v = row.values[i]
                    const flag = row.good(v)
                    const style: React.CSSProperties = flag === 'lp'
                      ? { backgroundColor: '#D1FAE5', color: '#065F46' }
                      : flag === 'gp'
                      ? { backgroundColor: '#FEE2E2', color: '#991B1B' }
                      : { backgroundColor: '#FEF3C7', color: '#92400E' }
                    return (
                      <td key={i} style={{ padding: '10px 10px', fontSize: 12, fontWeight: 500, textAlign: 'center', ...style }}>
                        {row.fmt ? row.fmt(v, f) : String(v)}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #E5E7EB' }}>
                <td style={{ padding: '10px 10px', fontSize: 12, fontWeight: 700, color: '#111827' }}>Terms Score</td>
                <td style={{ padding: '10px 10px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>—</td>
                {compareFunds.map((f, i) => (
                  <td key={i} style={{ padding: '10px 10px', fontSize: 13, fontWeight: 700, textAlign: 'center', color: fundColors[i] }}>
                    {f.scores.termsFairness.toFixed(1)}/10
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Section 5: Strategy Positioning */}
        <Card title="Strategy Positioning" style={{ marginBottom: 24 }}>
          <Plot
            data={[
              {
                type: 'scatter' as const,
                mode: 'markers' as const,
                x: funds.filter((f) => !localSelected.includes(f.id)).map((f) => STAGE_MAP[f.stageF] ?? 3),
                y: funds.filter((f) => !localSelected.includes(f.id)).map((f) => f.fundSize / 100),
                marker: { color: '#D1D5DB', size: 7, opacity: 0.5 },
                text: funds.filter((f) => !localSelected.includes(f.id)).map((f) => f.fundName),
                hovertemplate: '%{text}<extra></extra>',
                name: 'Other Funds',
              },
              ...compareFunds.map((f, i) => ({
                type: 'scatter' as const,
                mode: 'text+markers' as const,
                x: [STAGE_MAP[f.stageF] ?? 3],
                y: [f.fundSize / 100],
                marker: { color: fundColors[i], size: 18, symbol: 'star', line: { color: '#FFFFFF', width: 2 } },
                text: [f.fundName.split(' ').slice(0, 2).join(' ')],
                textposition: 'top center' as const,
                textfont: { size: 10, color: fundColors[i] },
                name: f.fundName.split(' ').slice(0, 2).join(' '),
              })),
            ]}
            layout={mergeLayout({
              height: 280,
              xaxis: {
                ...mergeLayout({}).xaxis,
                title: { text: 'Investment Stage', font: { size: 12 } },
                range: [0.5, 5.5],
                tickvals: [1, 2, 3, 4, 5],
                ticktext: ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Growth'],
              },
              yaxis: {
                ...mergeLayout({}).yaxis,
                title: { text: 'Fund Size (relative)', font: { size: 12 } },
              },
              legend: { x: 1, y: 1, xanchor: 'right', font: { size: 10 } },
            })}
            config={compareConfig}
            style={{ width: '100%' }}
          />
        </Card>

        {/* Section 6: Portfolio Construction */}
        <Card title="Portfolio Construction Comparison">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '8px 10px', fontSize: 11, color: '#6B7280', textAlign: 'left', textTransform: 'uppercase' }}>Metric</th>
                {compareFunds.map((f, i) => (
                  <th key={f.id} style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, color: fundColors[i], textAlign: 'right' }}>
                    {f.fundName.split(' ').slice(0, 3).join(' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Target # Companies', key: 'targetCompanies', fmt: (v: number) => String(v) },
                { label: 'Avg Initial Check', key: 'avgInitialCheck', fmt: (v: number) => `$${v}M` },
                { label: 'Follow-on Reserve', key: 'followOnReservePercent', fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
                { label: 'Target Ownership', key: 'targetOwnership', fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
                { label: 'Leads Deals', key: 'leadsDeals', fmt: (v: boolean) => v ? 'Yes' : 'No' },
                { label: 'Avg Entry Valuation', key: 'avgEntryValuation', fmt: (v: number) => `$${v}M` },
                { label: 'Target Return Multiple', key: 'targetReturnMultiple', fmt: (v: number) => `${v}x` },
              ].map((row) => (
                <tr key={row.label} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 10px', fontSize: 12, fontWeight: 500, color: '#374151' }}>{row.label}</td>
                  {compareFunds.map((f, i) => (
                    <td key={i} style={{ padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'right' }}>
                      {row.fmt((f.construction as unknown as Record<string, unknown>)[row.key] as never)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
