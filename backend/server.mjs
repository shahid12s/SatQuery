import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const PORT = Number(process.env.PORT ?? 8787)
const pythonScript = resolve(process.cwd(), 'backend', 'satquery_grounding_dino.py')
const pythonExecutable = process.env.PYTHON ?? resolve(process.cwd(), '.venv', 'Scripts', 'python.exe')

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

function parseProcessJson(output) {
  const lines = output.trim().split(/\r?\n/).reverse()
  for (const line of lines) {
    try { return JSON.parse(line) } catch { }
  }
  throw new Error('Grounding DINO returned an invalid response.')
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

function runGrounding(payload) {
  return new Promise((resolvePromise, reject) => {
    const python = spawn(pythonExecutable, [pythonScript], { env: process.env })
    let output = ''
    let errorOutput = ''
    python.stdout.on('data', (chunk) => { output += chunk })
    python.stderr.on('data', (chunk) => { errorOutput += chunk })
    python.on('error', (error) => reject(new Error(`Could not start the model service: ${error.message}`)))
    python.on('close', (code) => {
      if (code !== 0) {
        try {
          const modelError = parseProcessJson(output).error
          reject(new Error(modelError || errorOutput || 'Grounding DINO failed.'))
        } catch {
          reject(new Error(errorOutput || 'Grounding DINO failed.'))
        }
        return
      }
      try { resolvePromise(parseProcessJson(output)) } catch { reject(new Error('Grounding DINO returned an invalid response.')) }
    })
    python.stdin.end(JSON.stringify(payload))
  })
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

  try {
    const body = await readJsonBody(request)
    const question = String(body.question ?? '').trim()
    const images = Array.isArray(body.images) ? body.images : []

    if (!question) {
      sendJson(response, 400, { error: 'Question is required' })
      return
    }
    if (images.length === 0) {
      sendJson(response, 400, { error: 'Upload at least one satellite image first.' })
      return
    }

    const result = await runGrounding({ question, images })
    sendJson(response, 200, {
      ...result,
      execution_trace: [
        'Received satellite image',
        `Received user query: ${question}`,
        'Task identified: Grounding',
        'Model selected: Grounding DINO',
        `Text prompt: ${result.prompt}`,
        `${result.detections.length} valid regions detected`,
        ...(result.visual_evidence ? ['Bounding boxes generated'] : []),
        ...(result.visual_evidence ? ['Annotated image generated'] : []),
      ],
    })
  } catch (error) {
    sendJson(response, 502, { error: error instanceof Error ? error.message : 'Grounding request failed.' })
  }
})

server.listen(PORT, () => {
  console.log(`API server running at http://127.0.0.1:${PORT}`)
})

