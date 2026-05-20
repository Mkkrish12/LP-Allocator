import React from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: React.ReactNode
  loading?: boolean
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  primary: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    border: '1px solid #2563EB',
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    color: '#374151',
    border: '1px solid #E5E7EB',
  },
  danger: {
    backgroundColor: '#DC2626',
    color: '#FFFFFF',
    border: '1px solid #DC2626',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '#6B7280',
    border: '1px solid transparent',
  },
}

const SIZE_STYLES: Record<Size, React.CSSProperties> = {
  sm: { padding: '4px 12px', fontSize: 12, borderRadius: 6, height: 28 },
  md: { padding: '6px 16px', fontSize: 14, borderRadius: 6, height: 36 },
  lg: { padding: '8px 24px', fontSize: 14, borderRadius: 8, height: 44 },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontWeight: 500,
        fontFamily: 'Inter, sans-serif',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.6 : 1,
        transition: 'opacity 0.15s, background-color 0.15s',
        whiteSpace: 'nowrap',
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <span
          style={{
            width: 14,
            height: 14,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
            display: 'inline-block',
          }}
        />
      ) : icon ? (
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      ) : null}
      {children}
    </button>
  )
}
