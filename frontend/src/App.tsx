import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { ModeCard } from './components/ModeCard'
import { AnswerPanel, EvidencePanel, type AiResponseState } from './components/ResponsePanels'
import { StepHeader } from './components/StepHeader'
import { UploadedImages, UploadDropzone, type UploadedImage } from './components/UploadPanels'
import { agentModes, inferAgentMode, modelDestinations, type AgentModeId } from './data/agentModes'
import { askSatelliteAgent, fileToDataUrl } from './data/askApi'

function createSessionId() {
  return `session-${Date.now()}`
}

function App() {
  const [sessionId, setSessionId] = useState(createSessionId)
  const [question, setQuestion] = useState('')
  const [chosenModel, setChosenModel] = useState<AgentModeId>('auto')
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [response, setResponse] = useState<AiResponseState>({
    status: 'idle',
    answer: '',
    error: '',
    model: '',
  })

  const agentStatus = useMemo(() => {
    if (!question.trim()) return 'Waiting for input'

    const nextModel = inferAgentMode(question)
    const selectedMode = agentModes.find((mode) => mode.id === nextModel)
    return `Agent would route to ${selectedMode?.title ?? 'the selected model'}`
  }, [question])

  async function handleAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) return

    const nextModel = inferAgentMode(question)

    setChosenModel(nextModel)
    window.history.pushState(null, '', modelDestinations[nextModel])
    setResponse({ status: 'loading', answer: '', error: '', model: '' })

    try {
      const images = await Promise.all(
        uploadedImages.map(async (image) => ({
          name: image.name,
          type: image.file.type,
          dataUrl: await fileToDataUrl(image.file),
        })),
      )
      const result = await askSatelliteAgent({
        question: trimmedQuestion,
        selectedModel: nextModel,
        images,
      })

      setResponse({ status: 'success', answer: result.answer, error: '', model: result.model })
    } catch (error) {
      setResponse({
        status: 'error',
        answer: '',
        error: error instanceof Error ? error.message : 'Could not analyze the images.',
        model: '',
      })
    }
  }

  function handleNewQuery() {
    uploadedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl))
    setSessionId(createSessionId())
    setQuestion('')
    setChosenModel('auto')
    setUploadedImages([])
    setResponse({ status: 'idle', answer: '', error: '', model: '' })
    window.history.pushState(null, '', '/')
  }

  function handleImagesSelected(files: File[]) {
    const nextImages = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      file,
    }))

    setUploadedImages((currentImages) => [...currentImages, ...nextImages])
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Query navigation">
        <button className="new-query" type="button" onClick={handleNewQuery}>
          <span className="new-query__icon" aria-hidden="true">+</span>
          New Query
        </button>
        <p className="session-label">{sessionId}</p>
      </aside>

      <section className="workspace" aria-label="Satellite analysis workspace">
        <StepHeader number="1" title="Upload Inputs" description="Upload satellite image(s) and select the input mode." />
        <div className="mode-grid" aria-label="Agent modes">
          {agentModes.map((mode) => (
            <ModeCard key={mode.id} mode={mode} active={chosenModel === mode.id} />
          ))}
        </div>

        <div className="upload-layout">
          <UploadDropzone onImagesSelected={handleImagesSelected} />
          <UploadedImages images={uploadedImages} />
        </div>

        <form className="question-panel" onSubmit={handleAsk}>
          <StepHeader number="2" title="Ask Your Question" description="Enter your question." />
          <div className="question-row">
            <input
              aria-label="Question"
              maxLength={500}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="e.g., Is there a water body in this image?"
              value={question}
            />
            <span className="char-count">{question.length} / 500</span>
            <button type="submit" disabled={!question.trim()}>
              <span className="send-icon" aria-hidden="true" />
              Ask
            </button>
          </div>
          <p className="agent-status">{agentStatus}</p>
        </form>

        <section className="response-section" aria-label="AI response">
          <StepHeader number="3" title="AI Response" />
          <div className="response-grid">
            <AnswerPanel response={response} />
            <EvidencePanel />
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
