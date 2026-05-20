import type { Layout, Config } from 'plotly.js'

export const COLORWAY = ['#2563EB', '#C9A84C', '#059669', '#DC2626', '#7C3AED', '#0891B2', '#D97706']

export const STATUS_COLORS = {
  committed: '#1B2A4A',
  evaluating: '#C9A84C',
  current: '#2563EB',
  passed: '#9CA3AF',
}

export const baseLayout: Partial<Layout> = {
  font: { family: 'Inter, sans-serif', size: 12, color: '#374151' },
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  margin: { l: 48, r: 24, t: 32, b: 48 },
  colorway: COLORWAY,
  xaxis: {
    gridcolor: '#E5E7EB',
    linecolor: '#E5E7EB',
    tickfont: { family: 'Inter, sans-serif', size: 11, color: '#6B7280' },
    title: { font: { family: 'Inter, sans-serif', size: 12, color: '#6B7280' } },
  },
  yaxis: {
    gridcolor: '#E5E7EB',
    linecolor: '#E5E7EB',
    tickfont: { family: 'Inter, sans-serif', size: 11, color: '#6B7280' },
    title: { font: { family: 'Inter, sans-serif', size: 12, color: '#6B7280' } },
  },
  legend: {
    font: { family: 'Inter, sans-serif', size: 11, color: '#374151' },
    bgcolor: 'transparent',
    bordercolor: 'transparent',
  },
  hoverlabel: {
    bgcolor: '#1F2937',
    bordercolor: '#1F2937',
    font: { family: 'Inter, sans-serif', size: 12, color: '#F9FAFB' },
  },
}

export const baseConfig: Partial<Config> = {
  displayModeBar: false,
  responsive: true,
}

export const compareConfig: Partial<Config> = {
  displayModeBar: true,
  modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'resetScale2d', 'autoScale2d'],
  responsive: true,
}

export function mergeLayout(overrides: Partial<Layout>): Partial<Layout> {
  return {
    ...baseLayout,
    ...overrides,
    xaxis: { ...baseLayout.xaxis, ...(overrides.xaxis as object) },
    yaxis: { ...baseLayout.yaxis, ...(overrides.yaxis as object) },
  }
}
