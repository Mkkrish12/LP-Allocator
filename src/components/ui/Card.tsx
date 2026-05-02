import React from 'react'

interface CardProps {
  children: React.ReactNode
  title?: string
  className?: string
  style?: React.CSSProperties
  actions?: React.ReactNode
}

export default function Card({ children, title, className = '', style, actions }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        ...style,
      }}
      className={className}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#6B7280',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {title}
            </p>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
