import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFundStore } from '../store/fundStore'
import type { Fund, FundStrategy, FundStage } from '../types/fund'
import { STRATEGY_LABELS, STAGE_LABELS } from '../types/fund'
import Header from '../components/ui/Header'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { StatusBadge, StrategyBadge, ScoreBadge } from '../components/ui/Badge'
import { Search, GitCompare, Eye, PlusCircle } from 'lucide-react'

export default function FundLibrary() {
  const navigate = useNavigate()
  const { funds, selectedFundIds, toggleFundSelection, clearSelection } = useFundStore()

  const [query, setQuery] = useState('')
  const [filterVintage, setFilterVintage] = useState<string>('all')
  const [filterStrategy, setFilterStrategy] = useState<string>('all')
  const [filterStage, setFilterStage] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortKey, setSortKey] = useState<string>('dateAnalyzed')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const vintages = useMemo(
    () => Array.from(new Set(funds.map((f) => f.vintageYear))).sort((a, b) => b - a),
    [funds]
  )

  const filtered = useMemo(() => {
    let result = [...funds]
    if (query)
      result = result.filter(
        (f) =>
          f.fundName.toLowerCase().includes(query.toLowerCase()) ||
          f.gpFirm.toLowerCase().includes(query.toLowerCase())
      )
    if (filterVintage !== 'all')
      result = result.filter((f) => f.vintageYear === Number(filterVintage))
    if (filterStrategy !== 'all')
      result = result.filter((f) => f.strategy === filterStrategy)
    if (filterStage !== 'all') result = result.filter((f) => f.stageF === filterStage)
    if (filterStatus !== 'all') result = result.filter((f) => f.status === filterStatus)

    result.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey]
      const bv = (b as unknown as Record<string, unknown>)[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [funds, query, filterVintage, filterStrategy, filterStage, filterStatus, sortKey, sortDir])

  function handleSort(key: string) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const cols = [
    { key: 'select', label: '', width: 40 },
    { key: 'fundName', label: 'Fund Name', sortable: true },
    { key: 'gpFirm', label: 'GP Firm', sortable: true },
    { key: 'vintageYear', label: 'Vintage', sortable: true, numeric: true },
    { key: 'strategy', label: 'Strategy' },
    { key: 'fundSize', label: 'Size ($M)', sortable: true, numeric: true },
    { key: 'netIRR', label: 'Net IRR', sortable: false, numeric: true },
    { key: 'tvpi', label: 'TVPI', numeric: true },
    { key: 'dpi', label: 'DPI', numeric: true },
    { key: 'scores.overall', label: 'Score', sortable: true, numeric: true },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ]

  function getBestMetric(f: Fund, key: 'netIRR' | 'netTVPI' | 'DPI') {
    if (!f.priorFunds.length) return null
    return Math.max(...f.priorFunds.map((pf) => pf[key]))
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        title="Fund Library"
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
        {/* Filters */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid #E5E7EB',
                borderRadius: 6,
                padding: '6px 10px',
                flex: 1,
                minWidth: 200,
              }}
            >
              <Search size={14} color="#9CA3AF" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search fund name or GP firm..."
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  color: '#374151',
                  width: '100%',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
            </div>

            {[
              {
                value: filterVintage,
                setter: setFilterVintage,
                label: 'Vintage',
                options: [
                  { value: 'all', label: 'All Vintages' },
                  ...vintages.map((v) => ({ value: String(v), label: String(v) })),
                ],
              },
              {
                value: filterStrategy,
                setter: setFilterStrategy,
                label: 'Strategy',
                options: [
                  { value: 'all', label: 'All Strategies' },
                  ...(Object.keys(STRATEGY_LABELS) as FundStrategy[]).map((k) => ({
                    value: k,
                    label: STRATEGY_LABELS[k],
                  })),
                ],
              },
              {
                value: filterStage,
                setter: setFilterStage,
                label: 'Stage',
                options: [
                  { value: 'all', label: 'All Stages' },
                  ...(Object.keys(STAGE_LABELS) as FundStage[]).map((k) => ({
                    value: k,
                    label: STAGE_LABELS[k],
                  })),
                ],
              },
              {
                value: filterStatus,
                setter: setFilterStatus,
                label: 'Status',
                options: [
                  { value: 'all', label: 'All Status' },
                  { value: 'committed', label: 'Committed' },
                  { value: 'evaluating', label: 'Evaluating' },
                  { value: 'passed', label: 'Passed' },
                ],
              },
            ].map((f) => (
              <select
                key={f.label}
                value={f.value}
                onChange={(e) => f.setter(e.target.value)}
                style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 13,
                  color: '#374151',
                  fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ))}
          </div>
        </Card>

        {filtered.length === 0 ? (
          <Card>
            <EmptyState
              title="No funds found"
              description="No funds analyzed yet. Upload your first fund deck to get started."
              action={{ label: 'Analyze New Fund', onClick: () => navigate('/analyze') }}
            />
          </Card>
        ) : (
          <Card>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
              Showing {filtered.length} fund{filtered.length !== 1 ? 's' : ''}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                    {cols.map((col) => (
                      <th
                        key={col.key}
                        onClick={col.sortable ? () => handleSort(col.key) : undefined}
                        style={{
                          padding: '8px 10px',
                          fontSize: 11,
                          fontWeight: 500,
                          color: '#6B7280',
                          textAlign: col.numeric ? 'right' : 'left',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          cursor: col.sortable ? 'pointer' : 'default',
                          whiteSpace: 'nowrap',
                          width: col.width,
                        }}
                      >
                        {col.label}
                        {col.sortable && sortKey === col.key && (
                          <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((fund) => {
                    const bestIRR = getBestMetric(fund, 'netIRR')
                    const bestTVPI = getBestMetric(fund, 'netTVPI')
                    const bestDPI = getBestMetric(fund, 'DPI')
                    const isSelected = selectedFundIds.includes(fund.id)

                    return (
                      <tr
                        key={fund.id}
                        style={{
                          borderBottom: '1px solid #F3F4F6',
                          backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                          transition: 'background-color 0.1s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            (e.currentTarget as HTMLElement).style.backgroundColor = '#F9FAFB'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected)
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                        }}
                      >
                        <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleFundSelection(fund.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <button
                            onClick={() => navigate(`/fund/${fund.id}`)}
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: '#2563EB',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              padding: 0,
                            }}
                          >
                            {fund.fundName}
                          </button>
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151' }}>
                          {fund.gpFirm}
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'right' }}>
                          {fund.vintageYear}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <StrategyBadge strategy={fund.strategy} />
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'right' }}>
                          ${fund.fundSize}M
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 13, textAlign: 'right', color: bestIRR && bestIRR > 0.2 ? '#059669' : '#374151' }}>
                          {bestIRR != null ? `${(bestIRR * 100).toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'right' }}>
                          {bestTVPI != null ? `${bestTVPI.toFixed(2)}x` : '—'}
                        </td>
                        <td style={{ padding: '10px 10px', fontSize: 13, color: '#374151', textAlign: 'right' }}>
                          {bestDPI != null ? `${bestDPI.toFixed(2)}x` : '—'}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                          <ScoreBadge score={fund.scores.overall} />
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          <StatusBadge status={fund.status} />
                        </td>
                        <td style={{ padding: '10px 10px' }}>
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
                              <Eye size={11} /> View
                            </button>
                            <button
                              onClick={() => {
                                toggleFundSelection(fund.id)
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
                              <GitCompare size={11} /> Compare
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Compare sticky bar */}
      {selectedFundIds.length >= 2 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 240,
            right: 0,
            backgroundColor: '#1B2A4A',
            padding: '12px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 100,
          }}
        >
          <span style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 500 }}>
            Comparing {selectedFundIds.length} fund{selectedFundIds.length > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
            {selectedFundIds.map((id) => {
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
                    fontWeight: 500,
                  }}
                >
                  {f.fundName.split(' ').slice(0, 3).join(' ')}
                </span>
              ) : null
            })}
          </div>
          <Button variant="secondary" size="sm" onClick={clearSelection}>
            Clear
          </Button>
          <Button
            variant="primary"
            icon={<GitCompare size={14} />}
            onClick={() => navigate('/compare')}
          >
            Compare Now
          </Button>
        </div>
      )}
    </div>
  )
}
