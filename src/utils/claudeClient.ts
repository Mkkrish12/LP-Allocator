import type { Fund, ModuleScores, BenchmarkAverages } from '../types/fund'
import { EXTRACTION_SYSTEM_PROMPT, IC_MEMO_SYSTEM_PROMPT } from './prompts'

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string
const MODEL = (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-4o'
const API_URL = 'https://api.openai.com/v1/chat/completions'

async function callOpenAI(systemPrompt: string, userContent: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('VITE_OPENAI_API_KEY is not set. Add your OpenAI key to .env.local and restart the dev server.')
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
    const msg = error?.error?.message ?? response.statusText
    throw new Error(`OpenAI API error ${response.status}: ${msg}`)
  }

  const data = await response.json()
  const text: string = data.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('Empty response from OpenAI API')
  return text
}

export async function extractFundData(
  pdfText: string,
  documentType: string,
): Promise<Partial<Fund>> {
  const systemPrompt = EXTRACTION_SYSTEM_PROMPT.replace('{documentType}', documentType)
  const userContent = `Extract fund data from the following document:\n\n${pdfText}`

  const raw = await callOpenAI(systemPrompt, userContent)

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
): Promise<string> {
  const systemPrompt = IC_MEMO_SYSTEM_PROMPT
    .replace('{fundJSON}', JSON.stringify(fund, null, 2))
    .replace('{scoresJSON}', JSON.stringify(scores, null, 2))
    .replace('{benchmarkJSON}', JSON.stringify(benchmarks, null, 2))

  return callOpenAI(systemPrompt, 'Generate the IC memo now.')
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
