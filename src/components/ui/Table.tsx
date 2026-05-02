import React, { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => React.ReactNode
  numeric?: boolean
  sortable?: boolean
  width?: string | number
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export default function Table<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyMessage = 'No data',
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0
    const av = (a as Record<string, unknown>)[sortKey]
    const bv = (b as Record<string, unknown>)[sortKey]
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                style={{
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#6B7280',
                  textAlign: col.numeric ? 'right' : 'left',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  width: col.width,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.header}
                  {col.sortable && (
                    <span style={{ color: sortKey === String(col.key) ? '#2563EB' : '#D1D5DB' }}>
                      {sortKey === String(col.key) && sortDir === 'desc' ? (
                        <ChevronDown size={12} />
                      ) : (
                        <ChevronUp size={12} />
                      )}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '32px 12px',
                  textAlign: 'center',
                  fontSize: 14,
                  color: '#9CA3AF',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  borderBottom: '1px solid #F3F4F6',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) (e.currentTarget as HTMLElement).style.backgroundColor = '#F9FAFB'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                }}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    style={{
                      padding: '10px 12px',
                      fontSize: 13,
                      color: '#374151',
                      textAlign: col.numeric ? 'right' : 'left',
                    }}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[String(col.key)] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
