import React from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div
      style={{
        height: 64,
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        padding: '0 32px',
      }}
      className="flex items-center justify-between shrink-0"
    >
      <div>
        <h1
          style={{ fontSize: 20, fontWeight: 600, color: '#111827', lineHeight: 1.2 }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
