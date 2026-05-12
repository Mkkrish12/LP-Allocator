import type { Fund, ModuleScores, Recommendation, FundStage, FundStrategy } from '../types/fund'

export const WEIGHTS: Record<keyof Omit<ModuleScores, 'overall'>, number> = {
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
    0,
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

// ── Module 1: Fund Math ────────────────────────────────────────────────────
// VC returns follow a power law: ~40-50% of investments are write-offs,
// ~40-50% return modest capital, and ~5-10% are the outliers that generate
// virtually ALL fund returns. A single "fund returner" — one company whose
// exit proceeds at the GP's ownership stake equal or exceed total fund capital —
// is the necessary condition for any VC fund to hit 3x net.
//
// Three sub-scores:
//   A (50%) — power law viability: can the achievable winner MOIC at this stage
//              cover the MOIC required from the top 5% of the portfolio?
//   B (30%) — fund returner check: can ONE company plausibly return the entire
//              fund given stage, entry valuation, and ownership?
//   C (20%) — construction quality: follow-on reserves and portfolio sizing

// Empirical power law distribution by stage
// (VenCap 11,350-startup study; AngelList; Cambridge Associates data)
const STAGE_LOSS_RATES: Record<FundStage, number> = {
  pre_seed: 0.50, seed: 0.40, series_a: 0.30,
  series_b: 0.20, growth: 0.15, multi_stage: 0.30,
}

// % of portfolio that becomes a genuine outlier (5-10x+ of fund cost basis)
const STAGE_WINNER_RATES: Record<FundStage, number> = {
  pre_seed: 0.05, seed: 0.05, series_a: 0.08,
  series_b: 0.10, growth: 0.12, multi_stage: 0.07,
}

// Achievable MOIC for the top ~5% of investments at each stage
// (Seed winners: Uber/Airbnb tier = 1000x+; realistic top-decile = 50-100x;
//  Series A top-decile = 30-50x; growth = 5-12x per Treble Peak / CA data)
const STAGE_ACHIEVABLE_WINNER_MOIC: Record<FundStage, number> = {
  pre_seed: 100, seed: 60, series_a: 35,
  series_b: 18,  growth: 8,  multi_stage: 35,
}

// Largest realistic single-company exit value by stage ($M)
// (Stage entry price + typical market size determines ceiling)
const STAGE_MAX_EXIT: Record<FundStage, number> = {
  pre_seed: 5000, seed: 3000, series_a: 2000,
  series_b: 1500, growth: 10000, multi_stage: 2000,
}

export function calcFundMathDetail(fund: Fund, _allFunds: Fund[]) {
  const { fundSize = 100, construction, terms, stageF } = fund
  const targetReturnMultiple = construction?.targetReturnMultiple ?? 3
  const targetCompanies      = construction?.targetCompanies ?? 20
  const targetOwnership      = construction?.targetOwnership ?? 0.15
  const avgEntryVal          = construction?.avgEntryValuation ?? 20
  const followOnReserve      = construction?.followOnReservePercent ?? 0.40

  const fee           = terms?.managementFee ?? 0.02
  const stepDown      = terms?.managementFeeStepDown ?? false
  const stepDownYear  = terms?.stepDownYear ?? 5
  const stepDownRate  = terms?.stepDownRate ?? fee * 0.75
  const effectiveFeeDrag = stepDown
    ? (fee * stepDownYear + stepDownRate * (10 - stepDownYear)) / 10
    : fee

  const recycling = terms?.recyclingProvisions ?? false

  // Power law distribution for this stage
  const lossRate   = STAGE_LOSS_RATES[stageF]   ?? 0.35
  const winnerRate = STAGE_WINNER_RATES[stageF]  ?? 0.05

  // Number of outlier companies that must generate ALL the returns
  const winnerCount = Math.max(1, Math.round(targetCompanies * winnerRate))
  const lossCount   = Math.round(targetCompanies * lossRate)

  // Total gross return the fund must produce (before fees)
  const grossReturnNeeded    = fundSize * targetReturnMultiple
  const effectiveDeployable  = fundSize * (1 - effectiveFeeDrag * 10) * (recycling ? 1.12 : 1.0)

  // Each outlier company must produce this exit value (all returns from winners only)
  const requiredWinnerExit = grossReturnNeeded / (winnerCount * targetOwnership)
  const requiredWinnerMOIC = requiredWinnerExit / Math.max(1, avgEntryVal)

  // Stage benchmark: top 5% achievable MOIC
  const achievableWinnerMOIC = STAGE_ACHIEVABLE_WINNER_MOIC[stageF] ?? 35

  // Viability: is the achievable MOIC comfortably above what we need?
  const moicViability = achievableWinnerMOIC / Math.max(0.1, requiredWinnerMOIC)

  // Fund returner: exit value of ONE company needed to return 1x the whole fund
  const fundReturnerExitNeeded = fundSize / targetOwnership

  // D. Co-investor validation from prior fund portfolio quality
  // (tier-1 firms independently co-leading follow-ons = strongest available external validation)
  const fundWithQuality = (fund.priorFunds ?? []).find((pf) => pf.portfolioQuality)
  const coInvestorTier = fundWithQuality?.portfolioQuality?.coInvestorTier ?? null
  const coInvestorScore =
    coInvestorTier === 'tier1' ? 9
    : coInvestorTier === 'tier2' ? 7
    : 5 // neutral when no data

  return {
    effectiveFeeDrag,
    followOnReserve,
    lossRate,
    winnerRate,
    lossCount,
    winnerCount,
    targetCompanies,
    grossReturnNeeded,
    effectiveDeployable,
    requiredWinnerExit,
    requiredWinnerMOIC,
    achievableWinnerMOIC,
    moicViability,
    fundReturnerExitNeeded,
    coInvestorTier,
    coInvestorScore,
  }
}

export function calcFundMathScore(fund: Fund, allFunds: Fund[]): number {
  const { construction, stageF } = fund
  const followOnReserve = construction?.followOnReservePercent ?? 0.40
  const targetCompanies = construction?.targetCompanies ?? 20

  const d = calcFundMathDetail(fund, allFunds)

  // A. Power law viability (45%): achievable winner MOIC vs required winner MOIC
  // The critical question: does the stage allow winners big enough to cover the math?
  let moicScore: number
  if      (d.moicViability >= 3.0) moicScore = 10
  else if (d.moicViability >= 2.0) moicScore = 9
  else if (d.moicViability >= 1.5) moicScore = 8
  else if (d.moicViability >= 1.0) moicScore = 6.5
  else if (d.moicViability >= 0.75) moicScore = 5
  else if (d.moicViability >= 0.5) moicScore = 3
  else moicScore = 1

  // B. Fund returner check (25%): can ONE company plausibly exit high enough
  // to return the entire fund (= fund size / ownership)?
  const maxExit      = STAGE_MAX_EXIT[stageF] ?? 2000
  const returnerRatio = maxExit / Math.max(1, d.fundReturnerExitNeeded)
  let returnerScore: number
  if      (returnerRatio >= 10) returnerScore = 10
  else if (returnerRatio >= 5)  returnerScore = 8.5
  else if (returnerRatio >= 3)  returnerScore = 7
  else if (returnerRatio >= 2)  returnerScore = 5.5
  else if (returnerRatio >= 1)  returnerScore = 4
  else returnerScore = 2

  // C. Construction quality (15%): reserves for doubling down on winners,
  // portfolio size vs. stage norms
  const reserveScore =
    followOnReserve >= 0.40 && followOnReserve <= 0.55 ? 10
    : followOnReserve >= 0.30 ? 7
    : 4

  const sizeNorms: Record<FundStage, [number, number]> = {
    pre_seed: [20, 40], seed: [15, 30], series_a: [15, 25],
    series_b: [10, 20], growth: [8, 15], multi_stage: [15, 30],
  }
  const [lo, hi] = sizeNorms[stageF] ?? [15, 25]
  const sizeScore = targetCompanies >= lo && targetCompanies <= hi ? 10
    : targetCompanies >= lo * 0.7 ? 7
    : 4

  const constructionScore = (reserveScore + sizeScore) / 2

  // D. Co-investor validation (15%): tier-1 firms independently leading follow-ons
  // in the prior fund is the strongest external validation of GP selection quality
  const raw = 0.45 * moicScore + 0.25 * returnerScore + 0.15 * constructionScore + 0.15 * d.coInvestorScore
  return clamp(Math.round(raw * 10) / 10, 1, 10)
}


// ── Module 2: Team Pedigree ────────────────────────────────────────────────
// Three pillars: founding partner quality (60%), actual track record (25%),
// team structure risk factors (15%).

function logScore(years: number): number {
  // Logarithmic: 3yrs→5.3, 7yrs→7.0, 12yrs→8.3, 20yrs→10
  return clamp(10 * Math.log2(years + 1) / Math.log2(21), 0, 10)
}

export function calcTeamPedigreeDetail(fund: Fund) {
  const team = (fund.team ?? []).filter(Boolean)
  const founders = team.filter((m) => m.isFoundingPartner)
  const priorFunds = fund.priorFunds ?? []
  const isFirstTimeManager = priorFunds.length === 0
  const isSoloGP = (fund.totalTeamSize ?? team.length) <= 1
  const bestNetIRR = priorFunds.length > 0
    ? Math.max(...priorFunds.map((pf) => pf.netIRR ?? 0)) : null
  const bestTVPI = priorFunds.length > 0
    ? Math.max(...priorFunds.map((pf) => pf.netTVPI ?? 0)) : null

  // Portfolio quality signals (from LP updates — optional)
  const fundWithQuality = priorFunds.find((pf) => pf.portfolioQuality)
  const pq = fundWithQuality?.portfolioQuality ?? null
  const hasOutlierFormation = pq ? pq.hasTopDecileOutlier : null
  const dpiVsBenchmark = pq ? pq.dpiVsBenchmark : null
  const proactiveWriteDowns = pq ? pq.proactiveWriteDowns : null
  const coInvestorTier = pq ? pq.coInvestorTier : null

  // Operational signals (from DDQ — optional)
  const ops = fund.operationalSignals ?? null
  const teamDepartures = ops?.teamDepartureCount ?? null
  const icGovernanceRigorous = ops?.icGovernanceRigorous ?? null

  return {
    isFirstTimeManager,
    isSoloGP,
    founderCount: founders.length,
    bestNetIRR,
    bestTVPI,
    hasOutlierFormation,
    dpiVsBenchmark,
    proactiveWriteDowns,
    coInvestorTier,
    teamDepartures,
    icGovernanceRigorous,
  }
}

export function calcTeamPedigreeScore(fund: Fund, _allFunds: Fund[]): number {
  const team = (fund.team ?? []).filter(Boolean)
  if (team.length === 0) return 2

  const prestige: Record<string, number> = {
    top_tier: 10, mid_tier: 7, emerging: 5, operator: 6,
  }

  // A. Founding partner score (60%)
  const founders = team.filter((m) => m.isFoundingPartner)
  const evalTeam = founders.length > 0 ? founders : team

  const founderScores = evalTeam.map((m) => {
    const exp = logScore(m.yearsVCExperience ?? 0)
    const op =
      m.operatorBackground && (m.domainExpertiseScore ?? 0) >= 8 ? 9
      : m.operatorBackground ? 7
      : 4
    const domain = clamp(m.domainExpertiseScore ?? 5, 0, 10)
    const cohesion = clamp((m.yearsWorkingTogether ?? 0) * 1.2, 0, 10)
    const pres = prestige[m.priorFirmTier ?? 'emerging'] ?? 5
    return exp * 0.30 + op * 0.20 + domain * 0.20 + cohesion * 0.15 + pres * 0.15
  })

  const founderScore = founderScores.reduce((s, v) => s + v, 0) / founderScores.length

  // B. Track record signal (25%) — base IRR/TVPI + portfolio quality bonuses from LP updates
  const priorFunds = fund.priorFunds ?? []
  let trackRecordScore: number
  if (priorFunds.length === 0) {
    trackRecordScore = 3
  } else {
    const bestNetIRR = Math.max(...priorFunds.map((pf) => pf.netIRR ?? 0))
    const bestTVPI = Math.max(...priorFunds.map((pf) => pf.netTVPI ?? 0))
    if (bestNetIRR >= 0.40 && bestTVPI >= 3.0) trackRecordScore = 10
    else if (bestNetIRR >= 0.30 && bestTVPI >= 2.5) trackRecordScore = 8.5
    else if (bestNetIRR >= 0.20 && bestTVPI >= 2.0) trackRecordScore = 7.0
    else if (bestNetIRR >= 0.15) trackRecordScore = 5.5
    else trackRecordScore = 3.5

    // Portfolio quality bonuses (only when LP update data is available)
    const fundWithQuality = priorFunds.find((pf) => pf.portfolioQuality)
    if (fundWithQuality?.portfolioQuality) {
      const pq = fundWithQuality.portfolioQuality
      let bonus = 0
      if (pq.hasTopDecileOutlier) bonus += 1.5  // power law outlier forming
      if (pq.dpiVsBenchmark === 'above') bonus += 1.0
      else if (pq.dpiVsBenchmark === 'on_track') bonus += 0.5
      else if (pq.dpiVsBenchmark === 'lagging') bonus -= 0.5
      if (pq.proactiveWriteDowns) bonus += 0.5  // marks integrity / conservative valuation
      if (pq.coInvestorTier === 'tier1') bonus += 1.0  // independent validation by top-tier
      else if (pq.coInvestorTier === 'tier2') bonus += 0.5
      trackRecordScore = clamp(trackRecordScore + bonus, 0, 10)
    }
  }

  // C. Team structure (15%) — base + retention and IC governance from DDQ
  let structureScore = 7
  const isSoloGP = (fund.totalTeamSize ?? team.length) <= 1
  if (isSoloGP) structureScore -= 2.5
  const founderCount = team.filter((m) => m.isFoundingPartner).length
  if (founderCount === 1 && !isSoloGP) structureScore -= 1.0
  if (team.length >= 3) structureScore += 1.0
  if (team.length >= 4) structureScore += 0.5
  const allTopTier = evalTeam.every((m) => m.priorFirmTier === 'top_tier')
  if (allTopTier && evalTeam.length >= 2) structureScore += 1.5
  const hasOperator = team.some((m) => m.operatorBackground)
  const hasTraditionalVC = team.some((m) => !m.operatorBackground)
  if (hasOperator && hasTraditionalVC) structureScore += 0.5

  // Retention signal (from DDQ — zero departures since inception is a top LP signal)
  const ops = fund.operationalSignals
  if (ops) {
    const dep = ops.teamDepartureCount
    if (dep === 0) structureScore += 1.0
    else if (dep != null && dep >= 2) structureScore -= (dep - 1) * 0.5
    // dep === 1 → no adjustment (neutral)
    if (ops.icGovernanceRigorous === true) structureScore += 0.5
    else if (ops.icGovernanceRigorous === false) structureScore -= 0.5
  }
  structureScore = clamp(structureScore, 1, 10)

  const raw = 0.60 * founderScore + 0.25 * trackRecordScore + 0.15 * structureScore
  return clamp(Math.round(raw * 10) / 10, 1, 10)
}


// ── Module 3: Strategy Differentiation ────────────────────────────────────
// Three components: exact strategy+stage overlap count (50%), AUM-weighted
// strategy concentration after adding this fund (30%), same-strategy
// same-vintage return correlation risk (20%).

export function calcStrategyDetail(fund: Fund, allFunds: Fund[]) {
  const committed = allFunds.filter((f) => f.status === 'committed' && f.id !== fund.id)
  const totalAUM = committed.reduce((s, f) => s + (f.fundSize ?? 0), 0)
  const sameStratAUM = committed.filter((f) => f.strategy === fund.strategy)
    .reduce((s, f) => s + (f.fundSize ?? 0), 0)
  const newTotalAUM = totalAUM + (fund.fundSize ?? 0)
  const stratConcentration = newTotalAUM > 0
    ? (sameStratAUM + (fund.fundSize ?? 0)) / newTotalAUM : 0
  const exactMatch = committed.filter(
    (f) => f.strategy === fund.strategy && f.stageF === fund.stageF,
  ).length
  const vintageCorrelated = committed.filter(
    (f) =>
      f.strategy === fund.strategy &&
      Math.abs((f.vintageYear ?? 0) - (fund.vintageYear ?? 0)) <= 1,
  ).length

  // Sourcing edge (from DDQ — warm referral rate from portfolio founder network)
  const warmReferralRate = fund.operationalSignals?.warmReferralRate ?? null
  const sourcingEdgeScore =
    warmReferralRate == null ? 5          // neutral — data not available
    : warmReferralRate >= 0.35 ? 10       // exceptional (Helix at 42% = 10)
    : warmReferralRate >= 0.25 ? 8
    : warmReferralRate >= 0.15 ? 6
    : warmReferralRate >= 0.10 ? 4
    : 3

  return { stratConcentration, exactMatch, vintageCorrelated, warmReferralRate, sourcingEdgeScore }
}

export function calcStrategyScore(fund: Fund, allFunds: Fund[]): number {
  const committed = allFunds.filter((f) => f.status === 'committed' && f.id !== fund.id)

  // A. Exact overlap (50%)
  const exactMatch = committed.filter(
    (f) => f.strategy === fund.strategy && f.stageF === fund.stageF,
  ).length
  const stratMatch = committed.filter(
    (f) => f.strategy === fund.strategy && f.stageF !== fund.stageF,
  ).length
  const stageOnlyMatch = committed.filter(
    (f) => f.strategy !== fund.strategy && f.stageF === fund.stageF,
  ).length

  let overlapScore: number
  if (exactMatch === 0 && stratMatch === 0) overlapScore = 10
  else if (exactMatch === 0 && stratMatch === 1) overlapScore = 8
  else if (exactMatch === 0 && stratMatch > 1) overlapScore = 6
  else if (exactMatch === 1) overlapScore = 5
  else if (exactMatch === 2) overlapScore = 3
  else overlapScore = 1

  if (exactMatch === 0 && stratMatch === 0 && stageOnlyMatch > 0) {
    overlapScore = Math.min(10, overlapScore + 1)
  }

  // B. AUM concentration (25%)
  const d = calcStrategyDetail(fund, allFunds)
  let concentrationScore: number
  if (d.stratConcentration <= 0.10) concentrationScore = 10
  else if (d.stratConcentration <= 0.20) concentrationScore = 8
  else if (d.stratConcentration <= 0.30) concentrationScore = 6
  else if (d.stratConcentration <= 0.40) concentrationScore = 4
  else if (d.stratConcentration <= 0.50) concentrationScore = 2
  else concentrationScore = 1

  // C. Vintage correlation (15%)
  const vintageCorrelationScore =
    d.vintageCorrelated === 0 ? 10
    : d.vintageCorrelated === 1 ? 7
    : d.vintageCorrelated === 2 ? 4
    : 2

  // D. Sourcing edge (20%): warm referral rate from portfolio founder network.
  // Hamilton Lane and GoingVC practitioners cite "founder pull" as a top-3 signal
  // for emerging managers — it's the clearest proxy for network quality.
  const raw = 0.40 * overlapScore + 0.25 * concentrationScore + 0.15 * vintageCorrelationScore + 0.20 * d.sourcingEdgeScore
  return clamp(Math.round(raw * 10) / 10, 1, 10)
}


// ── Module 4: Terms Fairness ───────────────────────────────────────────────
// Three pillars: economic terms — effective fee, waterfall, carry, hurdle,
// recycling (55%); GP alignment — commit, key person, removal (30%);
// LP protections — no-fault divorce, MFN, LPAC (15%).

export function calcTermsDetail(fund: Fund) {
  const t = fund.terms
  if (!t) return {
    effectiveFee: 0.02, hasStepDown: false, hasMFN: false, hasNoFault: false, hasRecycling: false,
    auditorTier: null as 'big4' | 'regional' | 'none' | null,
    counselTier: null as 'top_tier' | 'mid_tier' | 'none' | null,
    gpPersonalCommitAboveMin: null as boolean | null,
  }
  const effectiveFee = t.managementFeeStepDown && t.stepDownRate && t.stepDownYear
    ? (t.managementFee * t.stepDownYear + t.stepDownRate * (10 - t.stepDownYear)) / 10
    : t.managementFee
  const ops = fund.operationalSignals
  return {
    effectiveFee,
    hasStepDown: t.managementFeeStepDown,
    hasMFN: t.mostFavoredNation,
    hasNoFault: t.noFaultDivorce,
    hasRecycling: t.recyclingProvisions,
    auditorTier: ops?.auditorTier ?? null,
    counselTier: ops?.counselTier ?? null,
    gpPersonalCommitAboveMin: ops?.gpPersonalCommitAboveMin ?? null,
  }
}

export function calcTermsScore(fund: Fund): number {
  const t = fund.terms
  if (!t) return 5

  const d = calcTermsDetail(fund)

  // A. Economic terms (55%)
  const feeScore =
    d.effectiveFee <= 0.0150 ? 10
    : d.effectiveFee <= 0.0175 ? 8
    : d.effectiveFee <= 0.0200 ? 6
    : d.effectiveFee <= 0.0225 ? 3
    : 1

  const waterfallScore = t.distributionWaterfall === 'european' ? 10 : 3

  const carryScore =
    t.carry < 0.20 ? 10
    : t.carry === 0.20 ? 7
    : 3

  const hurdleScore =
    t.hurdleRate >= 0.08 ? 10
    : t.hurdleRate >= 0.06 ? 7
    : t.hurdleRate > 0 ? 5
    : t.carry <= 0.20 ? 3
    : 1

  const recyclingScore = t.recyclingProvisions ? 8 : 5

  const economicScore =
    feeScore * 0.20 +
    waterfallScore * 0.30 +
    carryScore * 0.20 +
    hurdleScore * 0.15 +
    recyclingScore * 0.15

  // B. GP alignment (30%)
  let gpCommitScore =
    t.gpCommitPercent >= 0.03 ? 10
    : t.gpCommitPercent >= 0.02 ? 7
    : t.gpCommitPercent >= 0.01 ? 4
    : 1

  const keyPersonLower = (t.keyPersonDefinition ?? '').toLowerCase()
  const keyPersonScore =
    keyPersonLower.includes('named:') || keyPersonLower.includes('named individuals') ? 10
    : keyPersonLower.includes('role') ? 4
    : 6

  const removalScore =
    t.gpRemovalThreshold <= 0.60 ? 10
    : t.gpRemovalThreshold <= 0.67 ? 8
    : t.gpRemovalThreshold <= 0.75 ? 5
    : 2

  // GP personal commit depth bonus (from DDQ — "largest personal investment" language)
  if (fund.operationalSignals?.gpPersonalCommitAboveMin) gpCommitScore = clamp(gpCommitScore + 0.5, 0, 10)

  const alignmentScore =
    gpCommitScore * 0.50 + keyPersonScore * 0.30 + removalScore * 0.20

  // C. LP protection (15%) — includes service provider quality bonus from DDQ
  let protectionPoints = 0
  if (t.noFaultDivorce) protectionPoints += 3.5
  if (t.mostFavoredNation) protectionPoints += 3.5
  const lpacLower = (t.lpacComposition ?? '').toLowerCase()
  if (lpacLower.includes('consent') || lpacLower.includes('4') || lpacLower.includes('5')) {
    protectionPoints += 3.0
  }
  // Service provider quality: big-4 audit + top-tier counsel signal institutional maturity
  const ops = fund.operationalSignals
  if (ops?.auditorTier === 'big4') protectionPoints += 1.0
  else if (ops?.auditorTier === 'regional') protectionPoints += 0.5
  if (ops?.counselTier === 'top_tier') protectionPoints += 1.0
  else if (ops?.counselTier === 'mid_tier') protectionPoints += 0.5
  const protectionScore = clamp(protectionPoints, 0, 10)

  const raw = 0.55 * economicScore + 0.30 * alignmentScore + 0.15 * protectionScore
  return clamp(Math.round(raw * 10) / 10, 1, 10)
}


// ── Module 5: Portfolio Fit ────────────────────────────────────────────────
// AUM-weighted Herfindahl-Hirschman Index measures how adding this fund
// shifts concentration by stage (35%), strategy (35%), and vintage (30%).

function calcHHI(buckets: Record<string, number>, totalAUM: number): number {
  if (totalAUM === 0) return 0
  return Object.values(buckets).reduce((sum, aum) => {
    const share = aum / totalAUM
    return sum + share * share
  }, 0)
}

function hhiScore(deltaHHI: number): number {
  if (deltaHHI < 0) return 10
  if (deltaHHI < 0.005) return 9
  if (deltaHHI < 0.010) return 7
  if (deltaHHI < 0.020) return 5
  if (deltaHHI < 0.040) return 3
  return 1
}

export function calcPortfolioFitDetail(fund: Fund, allFunds: Fund[]) {
  const committed = allFunds.filter((f) => f.status === 'committed')
  const stageBefore: Record<string, number> = {}
  committed.forEach((f) => { stageBefore[f.stageF] = (stageBefore[f.stageF] ?? 0) + (f.fundSize ?? 0) })
  const totalBefore = committed.reduce((s, f) => s + (f.fundSize ?? 0), 0)
  const stageAfter = { ...stageBefore }
  stageAfter[fund.stageF] = (stageAfter[fund.stageF] ?? 0) + (fund.fundSize ?? 0)
  const totalAfter = totalBefore + (fund.fundSize ?? 0)

  const stratBefore: Record<string, number> = {}
  committed.forEach((f) => { stratBefore[f.strategy] = (stratBefore[f.strategy] ?? 0) + (f.fundSize ?? 0) })
  const stratAfter = { ...stratBefore }
  stratAfter[fund.strategy] = (stratAfter[fund.strategy] ?? 0) + (fund.fundSize ?? 0)

  return {
    stageHHIBefore: calcHHI(stageBefore, totalBefore),
    stageHHIAfter: calcHHI(stageAfter, totalAfter),
    stratHHIBefore: calcHHI(stratBefore, totalBefore),
    stratHHIAfter: calcHHI(stratAfter, totalAfter),
    vintageCount: committed.filter((f) => f.vintageYear === fund.vintageYear).length,
  }
}

export function calcPortfolioFitScore(fund: Fund, allFunds: Fund[]): number {
  const committed = allFunds.filter((f) => f.status === 'committed')

  const stageBefore: Record<string, number> = {}
  committed.forEach((f) => { stageBefore[f.stageF] = (stageBefore[f.stageF] ?? 0) + (f.fundSize ?? 0) })
  const totalBefore = committed.reduce((s, f) => s + (f.fundSize ?? 0), 0)
  const stageAfter = { ...stageBefore }
  stageAfter[fund.stageF] = (stageAfter[fund.stageF] ?? 0) + (fund.fundSize ?? 0)
  const totalAfter = totalBefore + (fund.fundSize ?? 0)
  const stageScore = hhiScore(calcHHI(stageAfter, totalAfter) - calcHHI(stageBefore, totalBefore))

  const stratBefore: Record<string, number> = {}
  committed.forEach((f) => { stratBefore[f.strategy] = (stratBefore[f.strategy] ?? 0) + (f.fundSize ?? 0) })
  const stratAfter = { ...stratBefore }
  stratAfter[fund.strategy] = (stratAfter[fund.strategy] ?? 0) + (fund.fundSize ?? 0)
  const stratScore = hhiScore(calcHHI(stratAfter, totalAfter) - calcHHI(stratBefore, totalBefore))

  const vintageCount = committed.filter((f) => f.vintageYear === fund.vintageYear).length
  const vintageShareAfter = (vintageCount + 1) / (committed.length + 1)
  const vintageScore =
    vintageShareAfter <= 0.10 ? 10
    : vintageShareAfter <= 0.20 ? 8
    : vintageShareAfter <= 0.30 ? 6
    : vintageShareAfter <= 0.40 ? 4
    : 2

  const raw = 0.35 * stageScore + 0.35 * stratScore + 0.30 * vintageScore
  return clamp(Math.round(raw * 10) / 10, 1, 10)
}


// ── Module 6: Vintage Timing ───────────────────────────────────────────────
// Three components: absolute vintage quality from external Cambridge-style priors
// blended with portfolio cell data (40%); GP's prior fund DPI maturity signal (30%);
// portfolio vintage diversification bonus for J-curve staggering (30%).

type VintageTier = 'top' | 'mid' | 'bottom' | 'unknown'

const VINTAGE_TIERS: Record<number, VintageTier> = {
  2014: 'top', 2015: 'top', 2016: 'top',
  2017: 'mid',
  2018: 'top', 2019: 'top',
  2020: 'top',     // COVID trough = exceptional entry conditions
  2021: 'bottom',  // peak valuations, compressed multiples expected
  2022: 'mid',     // correction; historically good long-term entry
  2023: 'mid',     // recovery entry, TBD
  2024: 'unknown', // too early to classify
}

export const STRATEGIES: FundStrategy[] = [
  'seed_vc', 'series_a', 'multi_stage', 'ai_focused', 'climate_tech',
  'sector_agnostic', 'deep_tech', 'emerging_markets', 'operator_led', 'solo_gp',
]

export const VINTAGES = [2018, 2019, 2020, 2021, 2022, 2023, 2024]

export function median(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

export function calcVintageDetail(fund: Fund, allFunds: Fund[]) {
  const tier: VintageTier = VINTAGE_TIERS[fund.vintageYear] ?? 'unknown'
  const priorFunds = fund.priorFunds ?? []
  const bestDPI = priorFunds.length > 0
    ? Math.max(...priorFunds.map((pf) => pf.DPI ?? 0)) : null
  const committed = allFunds.filter((f) => f.status === 'committed')
  const vintageCount = committed.filter((f) => f.vintageYear === fund.vintageYear).length
  return { tier, bestDPI, vintageCount }
}

export function calcVintageScore(fund: Fund, allFunds: Fund[]): number {
  // A. Absolute vintage quality (40%)
  const tier: VintageTier = VINTAGE_TIERS[fund.vintageYear] ?? 'unknown'
  const tierBaseScore: Record<VintageTier, number> = {
    top: 9, mid: 6.5, bottom: 3.5, unknown: 5.5,
  }
  let absoluteVintageScore = tierBaseScore[tier]

  // Blend with portfolio cell data when ≥3 committed funds share same strategy
  const cellFunds = allFunds.filter(
    (f) => f.status === 'committed' && f.strategy === fund.strategy,
  )
  if (cellFunds.length >= 3) {
    const cellIRRs = cellFunds.map((f) =>
      f.priorFunds.length > 0 ? Math.max(...f.priorFunds.map((pf) => pf.netIRR ?? 0)) : 0.15,
    )
    const allIRRs = allFunds
      .filter((f) => f.status === 'committed')
      .map((f) =>
        f.priorFunds.length > 0 ? Math.max(...f.priorFunds.map((pf) => pf.netIRR ?? 0)) : 0.15,
      )
    const allSorted = [...allIRRs].sort((a, b) => a - b)
    const rank = allSorted.findIndex((v) => v >= median(cellIRRs)) / Math.max(1, allSorted.length - 1)
    const cellRankScore = 1 + rank * 9
    absoluteVintageScore = 0.5 * absoluteVintageScore + 0.5 * cellRankScore
  }

  // B. Prior fund DPI maturity (30%)
  const priorFunds = fund.priorFunds ?? []
  let dpiScore: number
  if (fund.vintageYear >= 2022 || priorFunds.length === 0) {
    dpiScore = 6 // too early — neutral
  } else {
    const bestDPI = Math.max(...priorFunds.map((pf) => pf.DPI ?? 0))
    if (fund.vintageYear <= 2020) {
      dpiScore =
        bestDPI >= 1.0 ? 10 : bestDPI >= 0.5 ? 7 : bestDPI >= 0.2 ? 5 : bestDPI >= 0.1 ? 3 : 2
    } else {
      // 2021
      dpiScore = bestDPI >= 0.3 ? 10 : bestDPI >= 0.1 ? 6 : 4
    }
  }

  // C. Portfolio vintage diversification (30%)
  const committed = allFunds.filter((f) => f.status === 'committed')
  const vintageCount = committed.filter((f) => f.vintageYear === fund.vintageYear).length
  const diversificationScore =
    vintageCount === 0 ? 10
    : vintageCount === 1 ? 8
    : vintageCount === 2 ? 6
    : vintageCount === 3 ? 4
    : 2

  const raw = 0.40 * absoluteVintageScore + 0.30 * dpiScore + 0.30 * diversificationScore
  return clamp(Math.round(raw * 10) / 10, 1, 10)
}
