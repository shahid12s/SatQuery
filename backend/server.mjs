import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PORT = Number(process.env.PORT ?? 8787)
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash'

function loadEnvFile() {
  const envPaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '.env'),
  ]

  const envPath = envPaths.find((candidatePath) => existsSync(candidatePath))
  if (!envPath) return

  const content = readFileSync(envPath, 'utf8')

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue

    const [, key, rawValue] = match
    const value = rawValue.trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY ?? process.env.gemini_api_key
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  })
  response.end(JSON.stringify(payload))
}

async function readJsonBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function toInlineImagePart(image) {
  const [header, base64Data] = String(image.dataUrl ?? '').split(',')
  const headerMimeType = header?.match(/^data:(.*?);base64$/)?.[1]

  return {
    type: 'image',
    data: base64Data ?? '',
    mime_type: image.type || headerMimeType || 'image/png',
  }
}

function buildGeminiRequest({ question, model, images }) {
  return {
    model,
    input: [
      {
        type: 'text',
        text: `Selected analysis route: ${model}. User question: ${question}`,
      },
      ...images.map(toInlineImagePart),
    ],
    system_instruction: 'You are a satellite image analysis assistant. Answer clearly and mention visual evidence when possible.',
    generation_config: {
      temperature: 0.2,
      max_output_tokens: 700,
    },
    store: false,
  }
}

function extractGeminiText(data) {
  return data.steps
    ?.filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim() || 'No answer returned.'
}

loadEnvFile()

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname

  if (request.method !== 'POST' || pathname !== '/api/ask') {
    sendJson(response, 404, { error: 'Not found' })
    return
  }

  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    sendJson(response, 500, { error: 'Missing GEMINI_API_KEY in .env' })
    return
  }

  try {
    const body = await readJsonBody(request)
    const question = String(body.question ?? '').trim()
    const images = Array.isArray(body.images) ? body.images : []

    if (!question) {
      sendJson(response, 400, { error: 'Question is required' })
      return
    }

    const geminiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(buildGeminiRequest({ question, model: DEFAULT_MODEL, images })),
    })

    const data = await geminiResponse.json()

    if (!geminiResponse.ok) {
      sendJson(response, geminiResponse.status, { error: data.error?.message ?? 'Gemini request failed' })
      return
    }

    sendJson(response, 200, {
      answer: extractGeminiText(data),
      model: DEFAULT_MODEL,
    })
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'Unexpected server error' })
  }
})

server.listen(PORT, () => {
  console.log(`API server running at http://127.0.0.1:${PORT}`)
})

