/**
 * Thin React wrapper around plotly.js.
 * Uses the Plotly API (newPlot / react / purge) directly to avoid the
 * react-plotly.js CJS ↔ ESM interop issue that crashes Vite in dev mode.
 */
import { useRef, useEffect, useCallback } from 'react'
import type { Layout, Config, Data } from 'plotly.js'

export interface PlotParams {
  data: Partial<Data>[]
  layout?: Partial<Layout>
  config?: Partial<Config>
  style?: React.CSSProperties
  className?: string
}

// Singleton promise so we only load plotly.js once across all Plot instances.
let plotlyPromise: Promise<typeof import('plotly.js')> | null = null

function loadPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = import('plotly.js/dist/plotly').then((mod) => {
      // Handle both CJS (`mod` is Plotly) and ESM (`mod.default` is Plotly)
      return ((mod as { default?: typeof import('plotly.js') }).default ?? mod) as typeof import('plotly.js')
    })
  }
  return plotlyPromise
}

export default function Plot({ data, layout, config, style, className }: PlotParams) {
  const divRef = useRef<HTMLDivElement>(null)
  const isInitialized = useRef(false)
  const latestData = useRef(data)
  const latestLayout = useRef(layout)
  const latestConfig = useRef(config)

  // Keep refs in sync so the cleanup effect always has the latest values
  latestData.current = data
  latestLayout.current = layout
  latestConfig.current = config

  const mergedConfig = useCallback(
    (extra?: Partial<Config>): Partial<Config> => ({
      displayModeBar: false,
      responsive: true,
      ...extra,
    }),
    []
  )

  useEffect(() => {
    const el = divRef.current
    if (!el) return
    let cancelled = false

    loadPlotly().then((Plotly) => {
      if (cancelled || !divRef.current) return

      const mergedLayout: Partial<Layout> = { ...latestLayout.current }

      if (!isInitialized.current) {
        Plotly.newPlot(el, latestData.current as Data[], mergedLayout, mergedConfig(latestConfig.current))
        isInitialized.current = true
      } else {
        Plotly.react(el, latestData.current as Data[], mergedLayout, mergedConfig(latestConfig.current))
      }
    })

    return () => {
      cancelled = true
    }
  }, [data, layout, config, mergedConfig])

  // Purge chart when component unmounts
  useEffect(() => {
    return () => {
      const el = divRef.current
      if (el && isInitialized.current) {
        loadPlotly().then((Plotly) => Plotly.purge(el))
      }
    }
  }, [])

  return (
    <div
      ref={divRef}
      style={{ width: '100%', ...style }}
      className={className}
    />
  )
}
