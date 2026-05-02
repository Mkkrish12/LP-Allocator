import { useMemo } from 'react'
import Plot from '../ui/Plot'
import type { Fund } from '../../types/fund'
import { calcFundMathScore } from '../../utils/scoreEngine'
import { baseConfig } from '../../utils/plotlyTheme'

interface Props {
  fund: Fund
  allFunds: Fund[]
}

export default function FundMathModule({ fund, allFunds }: Props) {
  const { score, steps, viabilityRatio, historicalHitRate, requiredHitRate, impliedExits } =
    useMemo(() => {
      const { fundSize = 100, construction, terms } = fund
      const feeDrag = (terms?.managementFee ?? 0.02) * 10
      const feeAmount = fundSize * feeDrag
      const postFee = fundSize - feeAmount
      const targetMultiple = construction?.targetReturnMultiple ?? 3
      const requiredReturn = fundSize * targetMultiple
      const requiredPortfolioValue = requiredReturn * (1 + feeDrag)
      const avgOwnership = construction?.targetOwnership || 0.15
      const requiredCompanyExitValue = requiredPortfolioValue / avgOwnership
      const impliedExitsCalc = requiredCompanyExitValue / 500

      const committedFunds = allFunds.filter((f) => f.status === 'committed')
      let totalCompanies = 0
      let successfulExits = 0
      committedFunds.forEach((f) => {
        (f.priorFunds ?? []).forEach((pf) => {
          (pf.portfolioCompanies ?? []).forEach((pc) => {
            totalCompanies++
            if (pc.status === 'exited' && pc.exitMOIC && pc.checkSize) {
              const exitValue = (pc.exitMOIC * pc.checkSize) / (pc.ownership || 0.15)
              if (exitValue >= 500) successfulExits++
            }
          })
        })
      })

      const hist = totalCompanies > 0 ? successfulExits / totalCompanies : 0.05
      const targetCompanies = construction?.targetCompanies ?? 20
      const req = targetCompanies > 0 ? impliedExitsCalc / targetCompanies : 0.15
      const ratio = req > 0 ? hist / req : 1

      return {
        score: calcFundMathScore(fund, allFunds),
        steps: {
          fundSize,
          feeDrag: -feeAmount,
          postFee,
          requiredReturn,
          impliedExits: impliedExitsCalc,
        },
        viabilityRatio: ratio,
        historicalHitRate: hist,
        requiredHitRate: req,
        impliedExits: impliedExitsCalc,
      }
    }, [fund, allFunds])

  const scoreColor = score >= 7 ? '#059669' : score >= 5 ? '#D97706' : '#DC2626'

  const viable = viabilityRatio >= 1
  const interpretation = `This fund needs ${impliedExits.toFixed(1)} companies to exit at $500M+. Based on historical data, approximately ${(historicalHitRate * 100).toFixed(1)}% of portfolio companies reach this threshold. The required hit rate is ${(requiredHitRate * 100).toFixed(1)}% — ${viable ? 'below' : 'above'} historical average. Fund math is ${viable ? 'viable' : 'challenging'}.`

  return (
    <div>
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Chart */}
        <div style={{ flex: 1 }}>
          <Plot
            data={[
              {
                type: 'waterfall',
                orientation: 'v',
                measure: ['absolute', 'relative', 'total', 'relative', 'relative'],
                x: ['Fund Size', 'Fee Drag', 'Net Deployable', 'Target Return', 'Implied Exits ($500M+)'],
                y: [
                  steps.fundSize,
                  steps.feeDrag,
                  0,
                  steps.requiredReturn - steps.fundSize,
                  0,
                ],
                text: [
                  `$${steps.fundSize}M`,
                  `-$${Math.abs(steps.feeDrag).toFixed(0)}M`,
                  `$${steps.postFee.toFixed(0)}M`,
                  `$${steps.requiredReturn.toFixed(0)}M req.`,
                  `${steps.impliedExits.toFixed(1)} exits`,
                ],
                textposition: 'outside',
                connector: { line: { color: '#E5E7EB', width: 1 } },
                increasing: { marker: { color: '#059669' } },
                decreasing: { marker: { color: '#DC2626' } },
                totals: { marker: { color: viable ? '#2563EB' : '#D97706' } },
                textfont: { family: 'Inter, sans-serif', size: 11, color: '#374151' },
              } as unknown as Plotly.PlotData,
            ]}
            layout={{
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              margin: { l: 48, r: 24, t: 24, b: 64 },
              height: 240,
              font: { family: 'Inter, sans-serif', size: 11, color: '#374151' },
              yaxis: {
                gridcolor: '#E5E7EB',
                tickformat: '$.0f',
                ticksuffix: 'M',
                tickfont: { size: 10 },
              },
              xaxis: {
                tickfont: { size: 10 },
              },
              showlegend: false,
            }}
            config={baseConfig}
            style={{ width: '100%' }}
          />
        </div>

        {/* Score + Interpretation */}
        <div
          style={{
            width: 180,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingTop: 8,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 42,
                fontWeight: 700,
                color: scoreColor,
                lineHeight: 1,
              }}
            >
              {score.toFixed(1)}
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>/ 10</div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: scoreColor,
                marginTop: 8,
                padding: '3px 10px',
                borderRadius: 9999,
                backgroundColor: scoreColor + '18',
              }}
            >
              {viabilityRatio >= 1.5
                ? 'Highly Viable'
                : viabilityRatio >= 1
                ? 'Viable'
                : viabilityRatio >= 0.7
                ? 'Marginal'
                : 'Challenging'}
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: '#6B7280' }}>Viability ratio: </span>
              <strong style={{ color: scoreColor }}>{viabilityRatio.toFixed(2)}x</strong>
            </div>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: '#6B7280' }}>Historical hit rate: </span>
              <strong>{(historicalHitRate * 100).toFixed(1)}%</strong>
            </div>
            <div>
              <span style={{ color: '#6B7280' }}>Required hit rate: </span>
              <strong>{(requiredHitRate * 100).toFixed(1)}%</strong>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#6B7280', marginTop: 12, lineHeight: 1.6 }}>
        {interpretation}
      </p>
    </div>
  )
}
