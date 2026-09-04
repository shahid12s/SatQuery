export type AskRequestImage = {
  name: string
  type: string
  dataUrl: string
}

export type AskResponse = {
  answer: string
  model: string
  detections: Array<{
    label: string
    confidence: number | null
    box: { x1: number; y1: number; x2: number; y2: number }
  }>
  visual_evidence: boolean
  annotated_image: string | null
  execution_trace: string[]
}

export async function askSatelliteAgent(input: {
  question: string
  selectedModel: string
  images: AskRequestImage[]
}): Promise<AskResponse> {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed')
  }

  return data
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}
