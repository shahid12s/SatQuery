import type { AskResponse } from '../data/askApi'

export type AiResponseState = {
  status: 'idle' | 'loading' | 'success' | 'error'
  answer: string
  error: string
  model: string
  detections: AskResponse['detections']
  annotatedImage: string | null
  executionTrace: string[]
}

export function AnswerPanel({ response }: { response: AiResponseState }) {
  return (
    <article className="answer-card">
      <h3>Answer</h3>
      {response.status === 'idle' ? <AnswerSkeleton /> : null}
      {response.status === 'loading' ? <p className="answer-muted">Analyzing uploaded imagery...</p> : null}
      {response.status === 'success' ? (
        <div className="answer-content">
          <p>{response.answer}</p>
          <small>Model: {response.model}</small>
          {response.detections.length > 0 ? (
            <div className="detection-list">
              <strong>Detections</strong>
              {response.detections.map((detection, index) => (
                <span key={`${detection.label}-${index}`}>
                  {detection.label} {index + 1} {detection.confidence == null ? '' : `- ${(detection.confidence * 100).toFixed(0)}%`} ({detection.box.x1}, {detection.box.y1}) to ({detection.box.x2}, {detection.box.y2})
                </span>
              ))}
            </div>
          ) : null}
          {response.executionTrace.length > 0 ? (
            <div className="trace-list">
              <strong>Execution trace</strong>
              {response.executionTrace.map((step) => <span key={step}>{step}</span>)}
            </div>
          ) : null}
        </div>
      ) : null}
      {response.status === 'error' ? <p className="answer-error">{response.error}</p> : null}
    </article>
  )
}

export function EvidencePanel({ response }: { response: AiResponseState }) {
  return (
    <article className="evidence-card">
      <h3>Visual Evidence</h3>
      {response.annotatedImage ? <img className="annotated-image" src={response.annotatedImage} alt="Satellite image with detected regions highlighted" /> : <div className="evidence-placeholder" aria-hidden="true" />}
    </article>
  )
}

function AnswerSkeleton() {
  return (
    <>
      <div className="skeleton skeleton--wide" />
      <div className="skeleton skeleton--mid" />
      <div className="skeleton skeleton--mid" />
      <div className="skeleton skeleton--wide" />
      <div className="skeleton skeleton--short" />
    </>
  )
}
