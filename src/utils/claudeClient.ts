import OpenAI from 'openai'
import type { Fund, ModuleScores, BenchmarkAverages } from '../types/fund'
import { EXTRACTION_SYSTEM_PROMPT, IC_MEMO_SYSTEM_PROMPT } from './prompts'
import {
  calcFundMathDetail,
  calcTeamPedigreeDetail,
  calcStrategyDetail,
  calcTermsDetail,
  calcPortfolioFitDetail,
  calcVintageDetail,
  getRecommendation,
} from './scoreEngine'

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string
const MODEL = (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-4o'

function getClient(): OpenAI {
  if (!API_KEY) {
    throw new Error(
      'VITE_OPENAI_API_KEY is not set. Add your OpenAI key to .env.local and restart the dev server.',
    )
  }
  return new OpenAI({
    apiKey: API_KEY,
    dangerouslyAllowBrowser: true,
  })
}

async function callOpenAI(systemPrompt: string, userContent: string, maxTokens = 4096): Promise<string> {
  const client = getClient()

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  })

  const text = response.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('Empty response from OpenAI API')
  return text
}

export async function extractFundData(
  pdfText: string,
  documentType: string,
): Promise<Partial<Fund>> {
  const systemPrompt = EXTRACTION_SYSTEM_PROMPT.replace('{documentType}', documentType)
  const userContent = `Extract fund data from the following document:\n\n${pdfText}`

  const raw = await callOpenAI(systemPrompt, userContent, 4096)

  // Strip markdown code fences if the model wraps its output
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

  try {
    return JSON.parse(cleaned) as Partial<Fund>
  } catch {
    throw new Error('Model returned invalid JSON. Please retry.')
  }
}

export async function generateICMemo(
  fund: Fund,
  scores: ModuleScores,
  benchmarks: BenchmarkAverages,
  allFunds: Fund[] = [],
): Promise<string> {
  const computedSignals = {
    powerLaw:       calcFundMathDetail(fund, allFunds),
    team:           calcTeamPedigreeDetail(fund),
    strategy:       calcStrategyDetail(fund, allFunds),
    terms:          calcTermsDetail(fund),
    portfolioFit:   calcPortfolioFitDetail(fund, allFunds),
    vintage:        calcVintageDetail(fund, allFunds),
    recommendation: getRecommendation(scores.overall),
    scores,
    benchmarks,
  }
  const memoDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const systemPrompt = IC_MEMO_SYSTEM_PROMPT
    .replace('{fundJSON}', JSON.stringify(fund, null, 2))
    .replace('{computedSignalsJSON}', JSON.stringify(computedSignals, null, 2))
    .replace('{memoDate}', memoDate)

  return callOpenAI(systemPrompt, 'Generate the IC memo now.', 4000)
}

// PDF text extraction via PDF.js (pdfjs-dist v5)
export async function extractTextFromPDF(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')

  // Use the locally installed worker that matches pdfjs-dist v5.x exactly.
  // new URL(..., import.meta.url) lets Vite resolve and serve the file correctly.
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({
    data: arrayBuffer,
    // useSystemFonts avoids the need for standardFontDataUrl in pdfjs-dist v5.
    // cMapUrl handles CJK / encoded character maps.
    useSystemFonts: true,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/cmaps/',
    cMapPacked: true,
  }).promise

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (pageText) pages.push(pageText)
  }

  if (pages.length === 0) {
    throw new Error(
      'No text found in PDF. The file may be scanned/image-based and requires OCR.',
    )
  }

  // Trim to ~120 000 chars to stay within model context limits
  const fullText = pages.join('\n\n')
  return fullText.length > 120_000 ? fullText.slice(0, 120_000) : fullText
}
