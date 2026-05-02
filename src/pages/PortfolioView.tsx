import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Plot from '../components/ui/Plot'
import { useFundStore } from '../store/fundStore'
import { STRATEGY_LABELS, STAGE_LABELS } from '../types/fund'
import Header from '../components/ui/Header'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { StrategyBadge } from '../components/ui/Badge'
import { COLORWAY, baseConfig, mergeLayout } from '../utils/plotlyTheme'
import { Briefcase } from 'lucide-react'

export default function PortfolioView() {
  const navigate = useNavigate()
  const { funds } = useFundStore()
  const committed = useMemo(() => funds.filter((f) => f.status === 'committed'), [funds])

  const totalAUM = useMemo(() => committed.reduce((s, f) => s + f.fundSize, 0), [committed])

  // Stage Mix
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    committed.forEach((f) => {
      const l = STAGE_LABELS[f.stageF] ?? f.stageF
      counts[l] = (counts[l] ?? 0) + 1
    })
    return counts
  }, [committed])

  // Strategy Mix
  const strategyCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    committed.forEach((f) => {
      const l = STRATEGY_LABELS[f.strategy] ?? f.strategy
      counts[l] = (counts[l] ?? 0) + 1
    })
    return counts
  }, [committed])

  // Geography Mix
  const geoCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    committed.forEach((f) => {
      const region = f.geography.includes('Europe')
        ? 'Europe'
        : f.geography.includes('Asia') || f.geography.includes('India') || f.geography.includes('SEA')
        ? 'Asia'
        : f.geography.includes('Latin') || f.geography.includes('LATAM')
        ? 'LatAm'
        : f.geography === 'Global'
        ? 'Global'
        : 'US'
      counts[region] = (counts[region] ?? 0) + 1
    })
    return counts
  }, [committed])

  // Vintage Distribution
  const vintageData = useMemo(() => {
    const v: Record<number, number> = {}
    committed.forEach((f) => {
      v[f.vintageYear] = (v[f.vintageYear] ?? 0) + f.fundSize
    })
    const years = Object.keys(v).map(Number).sort()
    return { years, sizes: years.map((y) => v[y]) }
  }, [committed])

  // Performance scatter: years since vintage vs net IRR
  const perfScatter = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return committed
      .filter((f) => f.priorFunds.length > 0)
      .map((f) => ({
        name: f.fundName,
        yearsSince: currentYear - f.vintageYear,
        netIRR: Math.max(...f.priorFunds.map((pf) => pf.netIRR)),
        fundSize: f.fundSize,
      }))
  }, [committed])

  if (committed.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title="Your Portfolio" />
        <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
          <Card>
            <EmptyState
              icon={<Briefcase size={28} />}
              title="No committed funds yet"
              description="Mark funds as committed from the Dashboard or Fund Library to see your portfolio analytics here."
              action={{ label: 'Go to Fund Library', onClick: () => navigate('/library') }}
            />
          </Card>
        </div>
      </div>
    )
  }

  function donut(title: string, counts: Record<string, number>) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return (
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: 4 }}>
          {title}
        </p>
        <Plot
          data={[
            {
              type: 'pie',
              labels: entries.map(([k]) => k),
              values: entries.map(([, v]) => v),
              hole: 0.55,
              textinfo: 'percent',
              textposition: 'outside',
              hovertemplate: '%{label}: %{value} funds (%{percent})<extra></extra>',
              marker: { colors: COLORWAY },
              textfont: { family: 'Inter, sans-serif', size: 11 },
            },
          ]}
          layout={{
            paper_bgcolor: 'transparent',
            margin: { l: 32, r: 32, t: 16, b: 16 },
            height: 200,
            showlegend: true,
            legend: {
              x: 0.5,
              y: -0.15,
              xanchor: 'center',
              orientation: 'h',
              font: { family: 'Inter, sans-serif', size: 10 },
            },
            font: { family: 'Inter, sans-serif', size: 11, color: '#374151' },
          }}
          config={baseConfig}
          style={{ width: '100%' }}
        />
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        title="Your Portfolio"
        subtitle={`${committed.length} committed funds · $${totalAUM.toLocaleString()}M total AUM`}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        {/* Donut Charts Row */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            {donut('Stage Mix', stageCounts)}
            {donut('Strategy Mix', strategyCounts)}
            {donut('Geography Mix', geoCounts)}
          </div>
        </Card>

        {/* Vintage Distribution + Performance Scatter */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <Card title="Vintage Distribution">
            <Plot
              data={[
                {
                  type: 'bar',
                  x: vintageData.years.map(String),
                  y: vintageData.sizes,
                  marker: {
                    color: COLORWAY[0],
                    opacity: 0.85,
                  },
                  text: vintageData.sizes.map((v) => `$${v}M`),
                  textposition: 'outside',
                  hovertemplate: 'Vintage %{x}: $%{y}M committed<extra></extra>',
                  textfont: { size: 11 },
                },
              ]}
              layout={mergeLayout({
                height: 220,
                xaxis: { ...mergeLayout({}).xaxis, title: { text: 'Vintage Year', font: { size: 12 } } },
                yaxis: { ...mergeLayout({}).yaxis, title: { text: '$ Committed (M)', font: { size: 12 } }, tickprefix: '$' },
                margin: { l: 60, r: 16, t: 24, b: 48 },
              })}
              config={baseConfig}
              style={{ width: '100%' }}
            />
          </Card>

          <Card title="Performance by Maturity">
            <Plot
              data={[
                {
                  type: 'scatter',
                  mode: 'markers',
                  x: perfScatter.map((d) => d.yearsSince),
                  y: perfScatter.map((d) => d.netIRR),
                  marker: {
                    color: COLORWAY[0],
                    size: perfScatter.map((d) => Math.max(8, Math.min(24, d.fundSize / 30))),
                    opacity: 0.8,
                    line: { color: '#FFFFFF', width: 1.5 },
                  },
                  text: perfScatter.map((d) => `<b>${d.name}</b><br>Net IRR: ${(d.netIRR * 100).toFixed(1)}%<br>Size: $${d.fundSize}M`),
                  hovertemplate: '%{text}<extra></extra>',
                },
              ]}
              layout={mergeLayout({
                height: 220,
                xaxis: { ...mergeLayout({}).xaxis, title: { text: 'Years Since Vintage', font: { size: 12 } } },
                yaxis: { ...mergeLayout({}).yaxis, title: { text: 'Net IRR', font: { size: 12 } }, tickformat: '.0%' },
                margin: { l: 56, r: 16, t: 24, b: 48 },
              })}
              config={baseConfig}
              style={{ width: '100%' }}
            />
          </Card>
        </div>

        {/* Portfolio Table */}
        <Card title="Committed Funds">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Fund Name', 'GP Firm', 'Vintage', 'Strategy', 'Size ($M)', 'Net IRR', 'TVPI', 'DPI', 'Score'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 10px',
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#6B7280',
                      textAlign: h === 'Fund Name' || h === 'GP Firm' || h === 'Strategy' ? 'left' : 'right',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {committed.map((fund) => {
                const bestIRR = fund.priorFunds.length > 0 ? Math.max(...fund.priorFunds.map((pf) => pf.netIRR)) : null
                const bestTVPI = fund.priorFunds.length > 0 ? Math.max(...fund.priorFunds.map((pf) => pf.netTVPI)) : null
                const bestDPI = fund.priorFunds.length > 0 ? Math.max(...fund.priorFunds.map((pf) => pf.DPI)) : null

                return (
                  <tr
                    key={fund.id}
                    style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                    onClick={() => navigate(`/fund/${fund.id}`)}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = '#F9FAFB')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 500, color: '#2563EB' }}>
                      {fund.fundName}
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151' }}>{fund.gpFirm}</td>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'right' }}>{fund.vintageYear}</td>
                    <td style={{ padding: '10px 10px' }}><StrategyBadge strategy={fund.strategy} /></td>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'right' }}>${fund.fundSize}M</td>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: bestIRR && bestIRR > 0.2 ? '#059669' : '#374151', textAlign: 'right', fontWeight: 500 }}>
                      {bestIRR != null ? `${(bestIRR * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'right' }}>
                      {bestTVPI != null ? `${bestTVPI.toFixed(2)}x` : '—'}
                    </td>
                    <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'right' }}>
                      {bestDPI != null ? `${bestDPI.toFixed(2)}x` : '—'}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: fund.scores.overall >= 7 ? '#059669' : fund.scores.overall >= 5 ? '#D97706' : '#DC2626',
                      }}>
                        {fund.scores.overall.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}
