import React from 'react'

interface LoadingSpinnerProps {
  size?: number
  color?: string
}

export function LoadingSpinner({ size = 20, color = '#2563EB' }: LoadingSpinnerProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}33`,
        borderTop: `2px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
        display: 'inline-block',
      }}
    />
  )
}

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: number
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 4, style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: '#F3F4F6',
        animation: 'pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

export function CardSkeleton() {
  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <Skeleton width="40%" height={14} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={120} borderRadius={6} style={{ marginBottom: 12 }} />
      <Skeleton width="60%" height={12} />
    </div>
  )
}

interface TypingAnimationProps {
  text?: string
}

export function TypingAnimation({ text = 'Generating IC Memo...' }: TypingAnimationProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <LoadingSpinner size={16} />
      <span style={{ fontSize: 14, color: '#6B7280' }}>{text}</span>
      <span
        style={{
          display: 'inline-flex',
          gap: 3,
          alignItems: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: '#9CA3AF',
              animation: `bounce 1s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </span>
    </div>
  )
}
