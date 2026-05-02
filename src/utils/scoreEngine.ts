import type { Fund, ModuleScores, Recommendation, TeamMember, FundStrategy } from '../types/fund'

const WEIGHTS: Record<keyof Omit<ModuleScores, 'overall'>, number> = {
  fundMath: 0.20,
  teamPedigree: 0.25,
  strategyDifferentiation: 0.15,
  termsFairness: 0.15,
  portfolioFit: 0.15,
  vintageTiming: 0.10,
}

export function calculateOverallScore(scores: Omit<ModuleScores, 'overall'>): number {
  const total = (Object.entries(WEIGHTS) as [keyof typeof WEIGHTS, number][]).reduce(
    (sum, [key, weight]) => sum + scores[key] * weight,
    0
  )
  return Math.round(total * 10) / 10
}

export function getRecommendation(score: number): Recommendation {
  if (score >= 8.0)
    return {
      label: 'Strong Conviction',
      color: '#059669',
      description: 'Proceed to term negotiation and final close',
    }
  if (score >= 6.5)
    return {
      label: 'Proceed to Diligence',
      color: '#2563EB',
      description: 'Warrants full diligence process and reference checks',
    }
  if (score >= 5.0)
    return {
      label: 'Soft Pass',
      color: '#D97706',
      description: 'Significant concerns. Revisit if terms improve or team adds experience',
    }
  return {
    label: 'Pass',
    color: '#DC2626',
    description: 'Does not meet minimum threshold for commitment',
  }
}

// ── Module 1: Fund Math ────────────────────────────────────────────────────
export function calcFundMathScore(fund: Fund, allFunds: Fund[]): number {
  const fundSize = fund.fundSize ?? 100
  const terms = fund.terms
  const construction = fund.construction
  const feeDrag = (terms?.managementFee ?? 0.02) * 10
  const requiredGrossReturn = fundSize * (construction?.targetReturnMultiple ?? 3) * (1 + feeDrag)
  const requiredPortfolioValue = requiredGrossReturn
  const ownership = construction?.targetOwnership ?? 0.15
  const requiredCompanyExitValue = ownership > 0
    ? requiredPortfolioValue / ownership
    : requiredPortfolioValue / 0.15
  const impliedExitsNeeded = requiredCompanyExitValue / 500

  const committedFunds = allFunds.filter((f) => f.status === 'committed')
  let totalCompanies = 0
  let successfulExits = 0
  committedFunds.forEach((f) => {
    (f.priorFunds ?? []).forEach((pf) => {
      (pf.portfolioCompanies ?? []).forEach((pc) => {
        totalCompanies++
        if (pc.status === 'exited' && pc.exitMOIC && pc.checkSize) {
          const exitValue = pc.exitMOIC * pc.checkSize / (pc.ownership || 0.15)
          if (exitValue >= 500) successfulExits++
        }
      })
    })
  })

  const historicalHitRate = totalCompanies > 0 ? successfulExits / totalCompanies : 0.05
  const targetCos = construction?.targetCompanies ?? 20
  const requiredHitRate = targetCos > 0 ? impliedExitsNeeded / targetCos : 0.15
  const viabilityRatio = requiredHitRate > 0 ? historicalHitRate / requiredHitRate : 1

  if (viabilityRatio >= 1.5) return Math.min(10, 9 + (viabilityRatio - 1.5) * 0.5)
  if (viabilityRatio >= 1.0) return 7 + (viabilityRatio - 1.0) * 4
  if (viabilityRatio >= 0.7) return 5 + (viabilityRatio - 0.7) * 6.67
  if (viabilityRatio >= 0.5) return 3 + (viabilityRatio - 0.5) * 10
  return Math.max(1, viabilityRatio * 6)
}

// ── Module 2: Team Pedigree ────────────────────────────────────────────────
function scoreTeamMember(member: TeamMember): {
  experience: number
  operator: number
  domain: number
  cohesion: number
  prestige: number
} {
  const prestige: Record<string, number> = {
    top_tier: 10, mid_tier: 7, emerging: 5, operator: 6,
  }
  return {
    experience: Math.min(10, (member.yearsVCExperience ?? 0) * 0.8),
    operator: member.operatorBackground ? 8 : 4,
    domain: Math.min(10, (member.domainExpertiseScore ?? 5) * 1.0),
    cohesion: Math.min(10, (member.yearsWorkingTogether ?? 0) * 1.5),
    prestige: prestige[member.priorFirmTier ?? 'emerging'] ?? 5,
  }
}

export function calcTeamPedigreeScore(fund: Fund, _allFunds: Fund[]): number {
  const team = (fund.team ?? []).filter(Boolean)
  if (team.length === 0) return 3

  const dims = team.map(scoreTeamMember)
  const avg = (key: keyof ReturnType<typeof scoreTeamMember>) =>
    dims.reduce((s, d) => s + d[key], 0) / dims.length

  const weighted =
    avg('experience') * 0.25 +
    avg('operator') * 0.20 +
    avg('domain') * 0.20 +
    avg('cohesion') * 0.20 +
    avg('prestige') * 0.15

  return Math.min(10, Math.max(1, weighted))
}

// ── Module 3: Strategy Differentiation ────────────────────────────────────
export function calcStrategyScore(fund: Fund, allFunds: Fund[]): number {
  const stageMap: Record<string, number> = {
    pre_seed: 1, seed: 2, series_a: 3, series_b: 4, growth: 5, multi_stage: 3,
  }
  const stratMap: Record<string, number> = {
    sector_agnostic: 1, seed_vc: 2, multi_stage: 2, solo_gp: 3,
    series_a: 3, operator_led: 4, ai_focused: 5, climate_tech: 6,
    deep_tech: 7, emerging_markets: 8,
  }

  const fundStageScore = stageMap[fund.stageF] ?? 3
  const fundStratScore = stratMap[fund.strategy] ?? 3

  const committed = allFunds.filter((f) => f.status === 'committed' && f.id !== fund.id)
  const inQuadrant = committed.filter((f) => {
    const fs = stageMap[f.stageF] ?? 3
    const ss = stratMap[f.strategy] ?? 3
    return Math.abs(fs - fundStageScore) <= 1 && Math.abs(ss - fundStratScore) <= 1
  }).length

  const strategyPresent = committed.some((f) => f.strategy === fund.strategy)

  let score: number
  if (inQuadrant === 0) score = 9.5
  else if (inQuadrant === 1) score = 7.5
  else if (inQuadrant === 2) score = 5.5
  else score = Math.max(2, 5.5 - (inQuadrant - 2))

  if (!strategyPresent) score = Math.min(10, score + 2)
  return Math.round(score * 10) / 10
}

// ── Module 4: Terms Fairness ───────────────────────────────────────────────
export function calcTermsScore(fund: Fund): number {
  const t = fund.terms
  if (!t) return 5  // no terms data → neutral score
  let score = 0

  if ((t.managementFee ?? 0.02) <= 0.0175) score += 10 * 0.20
  else if ((t.managementFee ?? 0.02) <= 0.02) score += 7 * 0.20
  else score += 3 * 0.20

  if ((t.carry ?? 0.20) < 0.20) score += 10 * 0.20
  else if ((t.carry ?? 0.20) === 0.20) score += 7 * 0.20
  else score += 3 * 0.20

  if ((t.hurdleRate ?? 0.08) >= 0.08) score += 10 * 0.15
  else if ((t.hurdleRate ?? 0) > 0) score += 6 * 0.15
  else score += 2 * 0.15

  if ((t.gpCommitPercent ?? 0.02) >= 0.03) score += 10 * 0.15
  else if ((t.gpCommitPercent ?? 0.02) >= 0.02) score += 7 * 0.15
  else score += 3 * 0.15

  score += (t.distributionWaterfall === 'european' ? 10 : 4) * 0.15

  const keyDef = t.keyPersonDefinition ?? ''
  const isNamedPerson = keyDef.toLowerCase().includes('named:')
  score += (isNamedPerson ? 10 : 5) * 0.10

  if ((t.gpRemovalThreshold ?? 0.75) <= 0.67) score += 10 * 0.05
  else if ((t.gpRemovalThreshold ?? 0.75) <= 0.75) score += 6 * 0.05
  else score += 2 * 0.05

  return Math.min(10, Math.max(1, Math.round(score * 10) / 10))
}

// ── Module 5: Portfolio Fit ────────────────────────────────────────────────
export function calcPortfolioFitScore(fund: Fund, allFunds: Fund[]): number {
  const committed = allFunds.filter((f) => f.status === 'committed')
  const total = committed.length

  let score = 5

  if (total === 0) return score

  // Stage fit
  const sameStage = committed.filter((f) => f.stageF === fund.stageF).length
  const stageRatio = sameStage / total
  if (stageRatio < 0.15) score += 3
  else if (stageRatio > 0.40) score -= 3

  // Strategy / sector fit
  const sameSector = committed.filter((f) => f.strategy === fund.strategy).length
  const sectorRatio = sameSector / total
  if (sectorRatio < 0.15) score += 2
  else if (sectorRatio > 0.40) score -= 2

  // Vintage fit
  const sameVintage = committed.filter((f) => f.vintageYear === fund.vintageYear).length
  const vintageRatio = sameVintage / total
  if (vintageRatio > 0.30) score -= 2
  else if (sameVintage === 0) score += 2

  return Math.min(10, Math.max(1, Math.round(score * 10) / 10))
}

// ── Module 6: Vintage Timing ───────────────────────────────────────────────
export function calcVintageScore(fund: Fund, allFunds: Fund[]): number {
  const strategies: FundStrategy[] = [
    'seed_vc', 'series_a', 'multi_stage', 'ai_focused', 'climate_tech',
    'sector_agnostic', 'deep_tech', 'emerging_markets', 'operator_led', 'solo_gp',
  ]
  const vintages = [2019, 2020, 2021, 2022, 2023]

  const heatmap: Record<string, number[]> = {}
  strategies.forEach((s) => { heatmap[s] = [] })

  allFunds.forEach((f) => {
    if (f.status === 'committed' && vintages.includes(f.vintageYear)) {
      const priorFunds = f.priorFunds ?? []
      const bestIRR = priorFunds.length > 0
        ? Math.max(...priorFunds.map((pf) => pf.netIRR ?? 0))
        : 0
      if (!heatmap[f.strategy]) heatmap[f.strategy] = []
      heatmap[f.strategy].push(bestIRR)
    }
  })

  // median IRR per cell
  const median = (arr: number[]) => {
    if (!arr.length) return 0.15
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }

  const cells: number[] = []
  strategies.forEach((s) => {
    cells.push(median(heatmap[s] ?? []))
  })

  const thisCellMedian = median(heatmap[fund.strategy] ?? [0.15])
  const sorted = [...cells].sort((a, b) => a - b)
  const rank = sorted.findIndex((v) => v >= thisCellMedian) / (sorted.length - 1)

  if (rank >= 0.8) return 9
  if (rank >= 0.6) return 7
  if (rank >= 0.4) return 5
  if (rank >= 0.2) return 3
  return 2
}

export { WEIGHTS }
