import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Plot from '../components/ui/Plot'
import { useFundStore } from '../store/fundStore'
import type { Fund } from '../types/fund'
import { STRATEGY_LABELS } from '../types/fund'
import Header from '../components/ui/Header'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { StatusBadge, ScoreBadge } from '../components/ui/Badge'
import { STATUS_COLORS, baseConfig, mergeLayout } from '../utils/plotlyTheme'
import { PlusCircle, Eye, GitCompare, CheckCircle, XCircle } from 'lucide-react'

const hour = new Date().getHours()
const greeting =
  hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

function MetricCard({
  label,
  value,
  dot,
}: {
  label: string
  value: string | number
  dot?: 'green' | 'yellow'
}) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {dot && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: dot === 'green' ? '#059669' : '#D97706',
              marginTop: 6,
              flexShrink: 0,
            }}
          />
        )}
        <div>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{value}</p>
        </div>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { funds, updateFundStatus, toggleFundSelection } = useFundStore()

  const committed = useMemo(() => funds.filter((f) => f.status === 'committed'), [funds])
  const evaluating = useMemo(() => funds.filter((f) => f.status === 'evaluating'), [funds])

  const avgPortfolioIRR = useMemo(() => {
    const withIRR = committed.filter((f) => f.priorFunds.length > 0)
    if (!withIRR.length) return 0
    const total = withIRR.reduce((s, f) => {
      const best = Math.max(...f.priorFunds.map((pf) => pf.netIRR))
      return s + best
    }, 0)
    return total / withIRR.length
  }, [committed])

  const recent = useMemo(
    () =>
      [...funds]
        .sort((a, b) => new Date(b.dateAnalyzed).getTime() - new Date(a.dateAnalyzed).getTime())
        .slice(0, 5),
    [funds]
  )

  const topPerformers = useMemo(
    () =>
      committed
        .filter((f) => f.priorFunds.length > 0)
        .map((f) => ({ ...f, bestIRR: Math.max(...f.priorFunds.map((pf) => pf.netIRR)) }))
        .sort((a, b) => b.bestIRR - a.bestIRR)
        .slice(0, 3),
    [committed]
  )

  // Pipeline scatter data
  const scatterData = useMemo(() => {
    const grouped: Record<string, Fund[]> = { committed: [], evaluating: [], passed: [] }
    funds.forEach((f) => {
      const bestNetIRR =
        f.priorFunds.length > 0 ? Math.max(...f.priorFunds.map((pf) => pf.netIRR)) : 0
      const bestDPI =
        f.priorFunds.length > 0 ? Math.max(...f.priorFunds.map((pf) => pf.DPI)) : 0
      if (bestNetIRR > 0 || bestDPI > 0) grouped[f.status].push(f)
    })
    return grouped
  }, [funds])

  const makeTrace = (status: 'committed' | 'evaluating' | 'passed') => {
    const fds = scatterData[status]
    return {
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: status.charAt(0).toUpperCase() + status.slice(1),
      x: fds.map((f) =>
        f.priorFunds.length > 0 ? Math.max(...f.priorFunds.map((pf) => pf.netIRR)) : 0
      ),
      y: fds.map((f) =>
        f.priorFunds.length > 0 ? Math.max(...f.priorFunds.map((pf) => pf.DPI)) : 0
      ),
      marker: {
        color: STATUS_COLORS[status],
        size: fds.map((f) => Math.max(8, Math.min(28, f.fundSize / 30))),
        opacity: 0.8,
        line: { color: '#FFFFFF', width: 1.5 },
      },
      text: fds.map(
        (f) =>
          `<b>${f.fundName}</b><br>Vintage: ${f.vintageYear}<br>Strategy: ${STRATEGY_LABELS[f.strategy]}<br>Size: $${f.fundSize}M`
      ),
      hovertemplate: '%{text}<extra></extra>',
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        title={`${greeting}. Here's your fund pipeline.`}
        actions={
          <Button
            variant="primary"
            icon={<PlusCircle size={15} />}
            onClick={() => navigate('/analyze')}
          >
            Analyze New Fund
          </Button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
        {/* Stat Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 24,
            marginBottom: 24,
          }}
        >
          <MetricCard label="Total Funds Analyzed" value={funds.length} />
          <MetricCard label="Under Evaluation" value={evaluating.length} dot="yellow" />
          <MetricCard label="Committed" value={committed.length} dot="green" />
          <MetricCard
            label="Avg Portfolio Net IRR"
            value={`${(avgPortfolioIRR * 100).toFixed(1)}%`}
          />
        </div>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', gap: 24, marginBottom: 24 }}>
          {/* Pipeline Scatter */}
          <Card title="Pipeline Overview">
            <Plot
              data={[makeTrace('committed'), makeTrace('evaluating'), makeTrace('passed')]}
              layout={mergeLayout({
                height: 280,
                xaxis: {
                  ...mergeLayout({}).xaxis,
                  title: { text: 'Net IRR (Best Prior Fund)', font: { size: 12 } },
                  tickformat: '.0%',
                  gridcolor: '#E5E7EB',
                },
                yaxis: {
                  ...mergeLayout({}).yaxis,
                  title: { text: 'DPI (Best Prior Fund)', font: { size: 12 } },
                  gridcolor: '#E5E7EB',
                },
                legend: {
                  x: 0.01,
                  y: 0.99,
                  bgcolor: 'rgba(255,255,255,0.8)',
                  font: { size: 11 },
                },
              })}
              config={baseConfig}
              style={{ width: '100%' }}
            />
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
              Dot size = fund size. Hover for details.
            </p>
          </Card>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Recent Activity */}
            <Card title="Recent Activity">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recent.map((fund) => (
                  <div
                    key={fund.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid #F3F4F6',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#111827',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {fund.fundName}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {new Date(fund.dateAnalyzed).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                      <StatusBadge status={fund.status} />
                      <button
                        onClick={() => navigate(`/fund/${fund.id}`)}
                        style={{
                          fontSize: 12,
                          color: '#2563EB',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Performers */}
            <Card title="Top Performing">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {topPerformers.map((fund) => (
                  <div key={fund.id}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: '#374151',
                          fontWeight: 500,
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          paddingRight: 8,
                        }}
                      >
                        {fund.fundName}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#059669', flexShrink: 0 }}>
                        {(fund.bestIRR * 100).toFixed(0)}% IRR
                      </span>
                    </div>
                    <div
                      style={{
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: '#F3F4F6',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (fund.bestIRR / 0.65) * 100)}%`,
                          backgroundColor: '#059669',
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Evaluating Funds Table */}
        <Card title="Funds Under Evaluation">
          {evaluating.length === 0 ? (
            <p style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '24px 0' }}>
              No funds currently under evaluation.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  {['Name', 'Vintage', 'Strategy', 'Size', 'Overall Score', 'Days Ago', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#6B7280',
                          textAlign: 'left',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {evaluating.map((fund) => {
                  const days = Math.floor(
                    (Date.now() - new Date(fund.dateAnalyzed).getTime()) / 86400000
                  )
                  return (
                    <tr
                      key={fund.id}
                      style={{ borderBottom: '1px solid #F3F4F6' }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.backgroundColor = '#F9FAFB')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
                      }
                    >
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500, color: '#111827' }}>
                        {fund.fundName}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#374151' }}>
                        {fund.vintageYear}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 4,
                            backgroundColor: '#EFF6FF',
                            color: '#1D4ED8',
                          }}
                        >
                          {STRATEGY_LABELS[fund.strategy]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#374151', textAlign: 'right' }}>
                        ${fund.fundSize}M
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <ScoreBadge score={fund.scores.overall} />
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: '#6B7280' }}>
                        {days}d
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => navigate(`/fund/${fund.id}`)}
                            style={{
                              fontSize: 12,
                              color: '#2563EB',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <Eye size={12} /> View
                          </button>
                          <button
                            onClick={() => {
                              toggleFundSelection(fund.id)
                              navigate('/compare')
                            }}
                            style={{
                              fontSize: 12,
                              color: '#7C3AED',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <GitCompare size={12} /> Compare
                          </button>
                          <button
                            onClick={() => updateFundStatus(fund.id, 'committed')}
                            style={{
                              fontSize: 12,
                              color: '#059669',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <CheckCircle size={12} /> Commit
                          </button>
                          <button
                            onClick={() => updateFundStatus(fund.id, 'passed')}
                            style={{
                              fontSize: 12,
                              color: '#DC2626',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <XCircle size={12} /> Pass
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}
