export interface PortfolioCompany {
  name: string
  sector: string
  entryStage: string
  entryYear: number
  entryValuation: number
  checkSize: number
  ownership: number
  currentMOIC: number
  status: 'active' | 'exited' | 'written_off' | 'written_down'
  exitMOIC?: number
  exitYear?: number
}

export interface FundVintage {
  fundName: string
  vintageYear: number
  fundSize: number
  grossIRR: number
  netIRR: number
  grossTVPI: number
  netTVPI: number
  DPI: number
  RVPI: number
  numberOfInvestments: number
  lossRatio: number
  topCompanyConcentration: number
  portfolioCompanies: PortfolioCompany[]
}

export interface TeamMember {
  name: string
  title: string
  yearsVCExperience: number
  priorFirmTier: 'top_tier' | 'mid_tier' | 'emerging' | 'operator'
  isFoundingPartner: boolean
  operatorBackground: boolean
  domainExpertiseScore: number
  yearsWorkingTogether: number
  notableDeals: string[]
}

export interface FundTerms {
  managementFee: number
  managementFeeStepDown: boolean
  stepDownYear?: number
  stepDownRate?: number
  carry: number
  hurdleRate: number
  gpCommit: number
  gpCommitPercent: number
  recyclingProvisions: boolean
  distributionWaterfall: 'american' | 'european'
  lpacComposition: string
  keyPersonDefinition: string
  gpRemovalThreshold: number
  noFaultDivorce: boolean
  mostFavoredNation: boolean
}

export interface PortfolioConstruction {
  targetCompanies: number
  avgInitialCheck: number
  followOnReservePercent: number
  targetOwnership: number
  leadsDeals: boolean
  avgEntryValuation: number
  targetReturnMultiple: number
}

export type FundStrategy =
  | 'seed_vc'
  | 'series_a'
  | 'multi_stage'
  | 'ai_focused'
  | 'climate_tech'
  | 'sector_agnostic'
  | 'deep_tech'
  | 'emerging_markets'
  | 'operator_led'
  | 'solo_gp'

export type FundStage =
  | 'pre_seed'
  | 'seed'
  | 'series_a'
  | 'series_b'
  | 'growth'
  | 'multi_stage'

export type FundStatus = 'evaluating' | 'committed' | 'passed'

export interface ModuleScores {
  fundMath: number
  teamPedigree: number
  strategyDifferentiation: number
  termsFairness: number
  portfolioFit: number
  vintageTiming: number
  overall: number
}

export interface Recommendation {
  label: string
  color: string
  description: string
}

export interface BenchmarkAverages {
  avgNetIRR: number
  avgTVPI: number
  avgDPI: number
  avgManagementFee: number
  avgCarry: number
  avgGPCommitPercent: number
  avgTeamVCExperience: number
  avgFundSize: number
}

export interface Fund {
  id: string
  dateAnalyzed: string
  status: FundStatus
  analystNotes: string

  // Overview
  fundName: string
  gpFirm: string
  vintageYear: number
  fundSize: number
  strategy: FundStrategy
  stageF: FundStage
  geography: string
  sectorFocus: string
  thesis: string

  // Team
  team: TeamMember[]
  totalTeamSize: number

  // Track record (prior funds)
  priorFunds: FundVintage[]

  // Current fund terms
  terms: FundTerms

  // Portfolio construction
  construction: PortfolioConstruction

  // Scores (calculated)
  scores: ModuleScores

  // Source documents
  sourceDocuments: string[]
  extractionConfidence: number

  // Generated memo
  icMemo?: string
  memoGeneratedAt?: string
}

export const STRATEGY_LABELS: Record<FundStrategy, string> = {
  seed_vc: 'Seed VC',
  series_a: 'Series A',
  multi_stage: 'Multi-Stage',
  ai_focused: 'AI Focused',
  climate_tech: 'Climate Tech',
  sector_agnostic: 'Sector Agnostic',
  deep_tech: 'Deep Tech',
  emerging_markets: 'Emerging Markets',
  operator_led: 'Operator-Led',
  solo_gp: 'Solo GP',
}

export const STAGE_LABELS: Record<FundStage, string> = {
  pre_seed: 'Pre-Seed',
  seed: 'Seed',
  series_a: 'Series A',
  series_b: 'Series B',
  growth: 'Growth',
  multi_stage: 'Multi-Stage',
}
