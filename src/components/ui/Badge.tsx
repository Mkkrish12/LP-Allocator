import type { FundStatus, FundStrategy, FundStage } from '../../types/fund'
import { STRATEGY_LABELS, STAGE_LABELS } from '../../types/fund'

interface StatusBadgeProps {
  status: FundStatus
}

const STATUS_STYLES: Record<FundStatus, { bg: string; color: string }> = {
  committed: { bg: '#D1FAE5', color: '#065F46' },
  evaluating: { bg: '#FEF3C7', color: '#92400E' },
  passed: { bg: '#F3F4F6', color: '#374151' },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.color,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}

interface StrategyBadgeProps {
  strategy: FundStrategy
}

const STRATEGY_COLORS: Record<FundStrategy, { bg: string; color: string }> = {
  seed_vc: { bg: '#EFF6FF', color: '#1D4ED8' },
  series_a: { bg: '#F0FDF4', color: '#15803D' },
  multi_stage: { bg: '#FAF5FF', color: '#7E22CE' },
  ai_focused: { bg: '#FFF7ED', color: '#C2410C' },
  climate_tech: { bg: '#F0FDF4', color: '#065F46' },
  sector_agnostic: { bg: '#F9FAFB', color: '#374151' },
  deep_tech: { bg: '#FDF2F8', color: '#86198F' },
  emerging_markets: { bg: '#FFFBEB', color: '#92400E' },
  operator_led: { bg: '#FFF1F2', color: '#9F1239' },
  solo_gp: { bg: '#F0F9FF', color: '#0369A1' },
}

export function StrategyBadge({ strategy }: StrategyBadgeProps) {
  const style = STRATEGY_COLORS[strategy] ?? { bg: '#F3F4F6', color: '#374151' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        backgroundColor: style.bg,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
      {STRATEGY_LABELS[strategy] ?? strategy}
    </span>
  )
}

interface StageBadgeProps {
  stage: FundStage
}

export function StageBadge({ stage }: StageBadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        backgroundColor: '#F3F4F6',
        color: '#374151',
        whiteSpace: 'nowrap',
      }}
    >
      {STAGE_LABELS[stage] ?? stage}
    </span>
  )
}

interface ScoreBadgeProps {
  score: number
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const color = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'
  const bg = score >= 7 ? '#D1FAE5' : score >= 5 ? '#FEF3C7' : '#FEE2E2'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        backgroundColor: bg,
        color,
      }}
    >
      {score.toFixed(1)}
    </span>
  )
}
